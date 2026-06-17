// hooks/useChatTyping.ts
// Typing indicator over Supabase Realtime `broadcast` - no DB writes.
// (Per skill 03_supabase_realtime_implementation.md: don't use postgres_changes
//  for ephemeral typing state.)
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/utils/supabase';

const TYPING_HIDE_AFTER_MS = 3000;
const TYPING_THROTTLE_MS   = 2000;

export function useChatTyping(
  requestId: string | undefined,
  myId: string | undefined,
  otherId: string | undefined,
) {
  const [otherTyping, setOtherTyping] = useState(false);
  const channelRef     = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSentAtRef  = useRef<number>(0);
  const hideTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!requestId || !myId || !otherId) return;

    const channel = supabase.channel(`typing:${requestId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const fromId = payload.payload?.userId as string | undefined;
        if (!fromId || fromId !== otherId) return;
        setOtherTyping(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setOtherTyping(false), TYPING_HIDE_AFTER_MS);
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      channelRef.current = null;
    };
  }, [requestId, myId, otherId]);

  const notifyTyping = useCallback(() => {
    const ch = channelRef.current;
    if (!ch || !myId) return;
    const now = Date.now();
    if (now - lastSentAtRef.current < TYPING_THROTTLE_MS) return;
    lastSentAtRef.current = now;
    ch.send({ type: 'broadcast', event: 'typing', payload: { userId: myId } });
  }, [myId]);

  return { otherTyping, notifyTyping };
}
