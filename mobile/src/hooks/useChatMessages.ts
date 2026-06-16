// hooks/useChatMessages.ts
// ─────────────────────────────────────────────────────────────────────────────
// Donor ↔ Recipient chat for a single blood_request thread.
//
// Architecture (mirrors realtime-chat-expo-54-55 skill, Supabase Realtime path):
//   • Initial paginated load — oldest-first array (newest at END of array).
//   • Realtime subscription on INSERT / UPDATE / DELETE filtered by request_id;
//     reconciles by client_id (the idempotency key) — optimistic message gets
//     swapped for the server row in-place.
//   • Optimistic send: append locally with status='sending', then INSERT.
//     If the INSERT fails the message is marked 'failed' for retry.
//   • Cleanup via supabase.removeChannel — without this, channels leak after
//     ~10 navigations and the WebSocket queue silently fills up.
//   • RLS ensures only the two parties of the message can read it; INSERT is
//     gated by the accepted-donation relationship between sender/receiver.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/utils/supabase';

export interface ChatMessage {
  id: string;
  request_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  client_id: string | null;
  created_at: string;
  _status?: 'sending' | 'sent' | 'failed';
}

const PAGE_SIZE = 30;

function buildPairFilter(myId: string, otherId: string) {
  // a SELECT-side .or() to limit messages to the two-party conversation
  return (
    `and(sender_id.eq.${myId},receiver_id.eq.${otherId}),` +
    `and(sender_id.eq.${otherId},receiver_id.eq.${myId})`
  );
}

export function useChatMessages(
  requestId: string | undefined,
  myId: string | undefined,
  otherId: string | undefined,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading]   = useState(true);
  const [hasMore, setHasMore]   = useState(true);
  const [fetchingOlder, setFetchingOlder] = useState(false);
  const oldestCreatedAtRef = useRef<string | null>(null);

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!requestId || !myId || !otherId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setMessages([]);
    setHasMore(true);
    oldestCreatedAtRef.current = null;

    (async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('request_id', requestId)
        .or(buildPairFilter(myId, otherId))
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (cancelled) return;
      if (error) {
        console.warn('[chat] initial load error', error.message);
        setLoading(false);
        return;
      }
      const rows = (data ?? []).reverse() as ChatMessage[]; // oldest → newest
      setMessages(rows);
      setHasMore((data ?? []).length === PAGE_SIZE);
      oldestCreatedAtRef.current = rows[0]?.created_at ?? null;
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [requestId, myId, otherId]);

  // ── Realtime subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!requestId || !myId || !otherId) return;

    const channelName = `chat:${requestId}:${myId.slice(0, 4)}:${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `request_id=eq.${requestId}`,
      }, (payload) => {
        const m = payload.new as ChatMessage;
        // Only consume messages between these two parties
        const isOurs =
          (m.sender_id === myId    && m.receiver_id === otherId) ||
          (m.sender_id === otherId && m.receiver_id === myId);
        if (!isOurs) return;

        setMessages(prev => {
          // Reconcile by client_id (replaces optimistic ghost in-place)
          if (m.client_id) {
            const idx = prev.findIndex(x => x.client_id === m.client_id);
            if (idx >= 0) {
              const next = prev.slice();
              next[idx] = { ...m, _status: 'sent' };
              return next;
            }
          }
          // De-dupe by id
          if (prev.some(x => x.id === m.id)) return prev;
          return [...prev, { ...m, _status: 'sent' }];
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `request_id=eq.${requestId}`,
      }, (payload) => {
        const m = payload.new as ChatMessage;
        setMessages(prev => prev.map(x => x.id === m.id ? { ...m, _status: 'sent' } : x));
      })
      .subscribe();

    return () => {
      // Cleanup is the entire game — without removeChannel, sockets leak.
      supabase.removeChannel(channel);
    };
  }, [requestId, myId, otherId]);

  // ── Pagination (load older) ──────────────────────────────────────────────
  const loadOlder = useCallback(async () => {
    if (!requestId || !myId || !otherId) return;
    if (fetchingOlder || !hasMore || !oldestCreatedAtRef.current) return;
    setFetchingOlder(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('request_id', requestId)
        .or(buildPairFilter(myId, otherId))
        .lt('created_at', oldestCreatedAtRef.current)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;
      const older = (data ?? []).reverse() as ChatMessage[];
      if (older.length > 0) {
        setMessages(prev => [...older, ...prev]);
        oldestCreatedAtRef.current = older[0].created_at;
      }
      setHasMore((data ?? []).length === PAGE_SIZE);
    } catch (e: any) {
      console.warn('[chat] loadOlder error', e?.message);
    } finally {
      setFetchingOlder(false);
    }
  }, [requestId, myId, otherId, fetchingOlder, hasMore]);

  // ── Send (optimistic + idempotent) ──────────────────────────────────────
  const sendMessage = useCallback(async (content: string) => {
    if (!requestId || !myId || !otherId) return;
    const trimmed = content.trim();
    if (!trimmed) return;

    const clientId = Crypto.randomUUID();
    const optimistic: ChatMessage = {
      id: clientId, // temp id until server INSERT lands and we reconcile by client_id
      request_id: requestId,
      sender_id: myId,
      receiver_id: otherId,
      content: trimmed,
      read: false,
      client_id: clientId,
      created_at: new Date().toISOString(),
      _status: 'sending',
    };

    setMessages(prev => [...prev, optimistic]);

    const { error } = await supabase
      .from('messages')
      .insert({
        request_id: requestId,
        sender_id:  myId,
        receiver_id: otherId,
        content:    trimmed,
        client_id:  clientId,
      });

    if (error) {
      console.warn('[chat] send failed', error.message);
      setMessages(prev =>
        prev.map(x => x.client_id === clientId ? { ...x, _status: 'failed' } : x),
      );
      throw error;
    }
    // INSERT realtime event will reconcile the optimistic row.
  }, [requestId, myId, otherId]);

  // ── Mark all incoming as read ───────────────────────────────────────────
  const markRead = useCallback(async () => {
    if (!requestId || !myId || !otherId) return;
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('request_id', requestId)
      .eq('sender_id',  otherId)
      .eq('receiver_id', myId)
      .eq('read', false);
  }, [requestId, myId, otherId]);

  // ── Retry a failed message ──────────────────────────────────────────────
  const retrySend = useCallback(async (clientId: string) => {
    const msg = messages.find(m => m.client_id === clientId);
    if (!msg) return;
    setMessages(prev =>
      prev.map(x => x.client_id === clientId ? { ...x, _status: 'sending' } : x),
    );
    const { error } = await supabase
      .from('messages')
      .insert({
        request_id:  msg.request_id,
        sender_id:   msg.sender_id,
        receiver_id: msg.receiver_id,
        content:     msg.content,
        client_id:   msg.client_id,
      });
    if (error) {
      // Unique-constraint violation on retry of an already-inserted row is fine —
      // realtime will deliver and reconcile. Otherwise mark failed again.
      const isDupe = /duplicate key|unique/i.test(error.message);
      if (!isDupe) {
        setMessages(prev =>
          prev.map(x => x.client_id === clientId ? { ...x, _status: 'failed' } : x),
        );
      }
    }
  }, [messages]);

  return {
    messages, loading, hasMore, fetchingOlder,
    sendMessage, loadOlder, markRead, retrySend,
  };
}
