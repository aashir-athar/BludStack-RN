// app/chat.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Donor ↔ Recipient real-time chat scoped to a single blood_request thread.
//
// Architecture (per realtime-chat-expo-54-55 skill):
//   • FlashList v2 with maintainVisibleContentPosition.startRenderingFromBottom
//     (the v2 chat pattern — `inverted` is deprecated). Pagination fires on
//     onStartReached because the oldest message is the data "start".
//   • Optimistic send with idempotency key (client_id) — message renders
//     instantly with a 'sending' ticker, then reconciles in-place when the
//     realtime INSERT event echoes the server row.
//   • Typing indicator via Supabase Realtime broadcast (no DB writes).
//   • Retry button on failed sends — the unique constraint on client_id makes
//     retries safe.
//   • Cleanup: every channel is removed on unmount (otherwise sockets leak
//     after ~10 navigations).
//   • Memoized renderItem + stable keyExtractor — required for FlashList v2
//     recycling to work correctly.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform,
} from 'react-native';
// IMPORTANT: react-native's KeyboardAvoidingView does NOT work in edge-to-edge
// mode on Android (which Expo SDK 54 enables by default — see app.json's
// edgeToEdgeEnabled: true). In edge-to-edge, Android does not resize the
// window for the keyboard, so RN's KAV has nothing to push.
// react-native-keyboard-controller's KAV reads the keyboard frame natively
// and animates the wrapper above it — the only primitive that handles
// edge-to-edge correctly. The KeyboardProvider is mounted in app/_layout.tsx.
// On native it's lazy-required so Expo Go (which lacks the native module)
// still loads — it falls back to RN's KAV there, which is fine since Expo Go
// doesn't run edge-to-edge.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const KeyboardAvoidingView: React.ComponentType<any> = (() => {
  try {
    return require('react-native-keyboard-controller').KeyboardAvoidingView;
  } catch {
    return require('react-native').KeyboardAvoidingView;
  }
})();
import Skeleton from '@/components/Skeleton';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useChatMessages, type ChatMessage } from '@/hooks/useChatMessages';
import { useChatTyping } from '@/hooks/useChatTyping';
import LoadingScreen from '@/components/LoadingScreen';
import { supabase } from '@/utils/supabase';
import { FontSize, FontWeight, Spacing, Radius, LetterSpacing } from '@/constants/Typography';

export default function ChatScreen() {
  const { requestId, receiverId, receiverName } = useLocalSearchParams<{
    requestId: string;
    receiverId: string;
    receiverName: string;
  }>();
  const { theme }    = useTheme();
  const { user }     = useAuth();
  const router       = useRouter();
  const insets       = useSafeAreaInsets();
  const listRef      = useRef<FlashListRef<ChatMessage>>(null);

  const {
    messages, loading, hasMore, fetchingOlder,
    sendMessage, loadOlder, markRead, retrySend,
  } = useChatMessages(requestId, user?.id, receiverId);

  const { otherTyping, notifyTyping } = useChatTyping(requestId, user?.id, receiverId);

  const [text, setText] = React.useState('');
  const [sending, setSending] = React.useState(false);

  // Request status drives the "chat closed" banner + composer disable.
  // Subscribed to realtime so the chat seals the moment the request flips
  // to fulfilled / cancelled / expired — the user doesn't have to navigate
  // away and back.
  const [reqStatus, setReqStatus] =
    React.useState<'active' | 'fulfilled' | 'cancelled' | 'expired' | null>(null);

  useEffect(() => {
    if (!requestId) return;
    let cancelled = false;

    const fetchStatus = async () => {
      const { data, error } = await supabase
        .from('blood_requests')
        .select('status')
        .eq('id', requestId)
        .maybeSingle();
      if (cancelled) return;
      if (error) { console.warn('[chat fetchStatus]', error.message); return; }
      if (data?.status) setReqStatus(data.status as any);
    };
    fetchStatus();

    const ch = supabase
      .channel(`chat_req_status_${requestId}_${Date.now()}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'blood_requests',
        filter: `id=eq.${requestId}`,
      }, (payload: any) => {
        const next = payload?.new?.status;
        if (next) setReqStatus(next);
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [requestId]);

  const chatClosed   = reqStatus !== null && reqStatus !== 'active';
  const closedLabel  =
    reqStatus === 'fulfilled' ? 'This request was fulfilled — chat is closed.'
    : reqStatus === 'cancelled' ? 'This request was cancelled — chat is closed.'
    : reqStatus === 'expired'   ? 'This request expired — chat is closed.'
    : '';
  const closedIcon: keyof typeof Ionicons.glyphMap =
    reqStatus === 'fulfilled' ? 'heart'
    : reqStatus === 'cancelled' ? 'close-circle'
    : 'time-outline';
  const closedTone = reqStatus === 'fulfilled' ? theme.success : theme.textMuted;

  // Mark incoming as read on entry + whenever new messages arrive while open
  useEffect(() => { markRead(); }, [markRead, messages.length]);

  const onChangeText = useCallback((next: string) => {
    setText(next);
    if (next.length > 0) notifyTyping();
  }, [notifyTyping]);

  const onSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || chatClosed) return;
    setSending(true);
    setText('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await sendMessage(trimmed);
      // Auto-scroll regardless of current position when the user themselves sends.
      listRef.current?.scrollToEnd({ animated: true });
    } catch {
      // Restore the draft on hard failure (the optimistic message stays
      // marked 'failed' with a retry button)
      setText(trimmed);
    } finally {
      setSending(false);
    }
  }, [text, sending, sendMessage]);

  // ── Memoized FlashList configuration (v2 wants stable refs) ───────────
  const maintainPosition = useMemo(() => ({
    startRenderingFromBottom: true,
    autoscrollToBottomThreshold: 0.2,
  }), []);

  const contentContainerStyle = useMemo(
    () => ({ paddingHorizontal: Spacing[4], paddingTop: Spacing[4], paddingBottom: Spacing[2] }),
    [],
  );

  // ── Bubble renderer (memoized; only depends on messages + user) ───────
  const renderItem = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    const isMine = item.sender_id === user?.id;
    const prev   = index > 0 ? messages[index - 1] : null;

    // Group consecutive messages from same sender within 3 minutes
    const grouped = !!prev
      && prev.sender_id === item.sender_id
      && new Date(item.created_at).getTime() - new Date(prev.created_at).getTime() < 3 * 60_000;

    // Show timestamp on first message OR gap > 5 min from previous
    const showTime = !prev
      || new Date(item.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60_000;

    const status: ChatMessage['_status'] = item._status ?? 'sent';

    return (
      <View>
        {showTime && (
          <Text style={[styles.timestamp, { color: theme.textMuted }]}>
            {formatTime(item.created_at)}
          </Text>
        )}
        <View style={[
          styles.bubbleRow,
          isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
          grouped && styles.bubbleRowGrouped,
        ]}>
          <View style={[
            styles.bubble,
            isMine
              ? [styles.bubbleMine,   { backgroundColor: theme.primary, opacity: status === 'sending' ? 0.7 : 1 }]
              : [styles.bubbleTheirs, { backgroundColor: theme.cardElevated, borderColor: theme.border }],
            grouped && (isMine ? styles.bubbleMineGrouped : styles.bubbleTheirsGrouped),
          ]}>
            <Text style={[styles.bubbleText, { color: isMine ? '#fff' : theme.textPrimary }]}>
              {item.content}
            </Text>
          </View>

          {isMine && (
            <View style={styles.metaRow}>
              {status === 'sending' && (
                <Text style={[styles.metaText, { color: theme.textMuted }]}>Sending…</Text>
              )}
              {status === 'failed' && item.client_id && (
                <TouchableOpacity onPress={() => retrySend(item.client_id!)} hitSlop={8}>
                  <Text style={[styles.metaText, { color: theme.danger ?? '#E8002D', fontWeight: FontWeight.bold }]}>
                    Failed · Tap to retry
                  </Text>
                </TouchableOpacity>
              )}
              {status === 'sent' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Ionicons
                    name={item.read ? 'checkmark-done' : 'checkmark'}
                    size={14}
                    color={item.read ? theme.success : theme.textMuted}
                  />
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    );
  }, [user?.id, messages, theme, retrySend]);

  // Stable keyExtractor — client_id survives the optimistic→server id swap.
  const keyExtractor = useCallback(
    (item: ChatMessage) => item.client_id ?? item.id,
    [],
  );

  const ListHeaderComponent = useCallback(() => {
    if (!hasMore && !fetchingOlder) return null;
    if (!fetchingOlder) return null;
    return (
      <View style={styles.olderLoader}>
        <Skeleton width={60} height={4} radius={2} />
      </View>
    );
  }, [hasMore, fetchingOlder]);

  if (loading) return <LoadingScreen message="Loading messages…" />;

  // KeyboardAvoidingView (from react-native-keyboard-controller) setup:
  //   • SafeAreaView claims only the TOP edge — bottom edge is owned by the
  //     KAV so it can push the composer above the keyboard cleanly.
  //   • `behavior="padding"` works on BOTH iOS and Android with this library
  //     (RN's built-in KAV cannot do this in edge-to-edge mode — see the
  //     import comment above).
  //   • `keyboardVerticalOffset` = 0: no extra offset because the header is
  //     outside the KAV. The composer hugs the top of the keyboard exactly.
  //   • The bottom inset is added to the input bar's paddingBottom for the
  //     "no keyboard" state so the composer sits above the Android gesture
  //     indicator. When the keyboard is up, the inset shrinks to 0 naturally.
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]} edges={['top']}>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={[styles.avatarSmall, { backgroundColor: theme.cardElevated }]}>
            <Text style={[styles.avatarInitial, { color: theme.textPrimary }]}>
              {safeDecode(receiverName).charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerName, { color: theme.textPrimary }]} numberOfLines={1}>
              {safeDecode(receiverName)}
            </Text>
            <Text style={[styles.headerSub, { color: theme.textMuted }]} numberOfLines={1}>
              {otherTyping ? 'Typing…' : `Re: blood request #${(requestId ?? '').slice(0, 6).toUpperCase()}`}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/request/[id]', params: { id: String(requestId) } })}
          style={[styles.viewReqBtn, { borderColor: theme.border }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.viewReqLabel, { color: theme.textSecondary }]}>Request</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS == 'ios' ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* ── Messages list (FlashList v2) ───────────────────────────── */}
        <FlashList
          ref={listRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          // v2 chat pattern: visual bottom = data end. `inverted` is deprecated.
          maintainVisibleContentPosition={maintainPosition}
          onStartReached={loadOlder}
          onStartReachedThreshold={0.5}
          ListHeaderComponent={ListHeaderComponent}
          contentContainerStyle={contentContainerStyle}
          showsVerticalScrollIndicator={false}
          // Recycle media-less text bubbles together
          getItemType={() => 'text'}
        />

        {/* ── Composer (or closed-state banner when the request is sealed) ──
            When the parent request flips to fulfilled / cancelled / expired,
            we swap the input row for a banner that explains why chat is
            closed. Past messages stay visible above so the conversation
            is read-only, not deleted. */}
        {chatClosed ? (
          <View
            style={[
              styles.closedBar,
              {
                backgroundColor: theme.surface,
                borderTopColor:  theme.border,
                paddingBottom:   Math.max(insets.bottom, Spacing[3]),
              },
            ]}
          >
            <View
              style={[
                styles.closedBarInner,
                {
                  backgroundColor: reqStatus === 'fulfilled' ? theme.successSoft : theme.cardElevated,
                  borderColor:     reqStatus === 'fulfilled' ? theme.success     : theme.border,
                },
              ]}
            >
              <View style={[styles.closedBarIcon, { backgroundColor: closedTone + '1F', borderColor: closedTone }]}>
                <Ionicons name={closedIcon} size={16} color={closedTone} />
              </View>
              <Text style={[styles.closedBarText, { color: closedTone }]} numberOfLines={2}>
                {closedLabel}
              </Text>
            </View>
          </View>
        ) : (
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: theme.surface,
              borderTopColor:  theme.border,
              paddingBottom:   Math.max(insets.bottom, Spacing[3]),
            },
          ]}
        >
          <View style={[styles.inputWrap, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
            <TextInput
              value={text}
              onChangeText={onChangeText}
              placeholder="Message…"
              placeholderTextColor={theme.textMuted}
              style={[styles.textInput, { color: theme.textPrimary }]}
              multiline
              maxLength={2000}
              returnKeyType="default"
            />
          </View>
          <TouchableOpacity
            onPress={onSend}
            disabled={!text.trim() || sending}
            style={[
              styles.sendBtn,
              { backgroundColor: text.trim() ? theme.primary : theme.cardElevated },
            ]}
            activeOpacity={0.8}
          >
            <Ionicons
              name="arrow-up"
              size={20}
              color={text.trim() ? theme.textOnPrimary : theme.textMuted}
            />
          </TouchableOpacity>
        </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function safeDecode(s: string | undefined): string {
  if (!s) return '';
  try { return decodeURIComponent(s); } catch { return s; }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    '  ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:       { width: 36, height: 36, justifyContent: 'center' },
  backIcon:      { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  headerInfo:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  avatarSmall:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: FontSize.base, fontWeight: FontWeight.black },
  headerName:    { fontSize: FontSize.sm, fontWeight: FontWeight.black },
  headerSub:     { fontSize: FontSize.xs, marginTop: 1 },
  viewReqBtn: {
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[1],
    borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth,
  },
  viewReqLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },

  olderLoader: { paddingVertical: Spacing[3], alignItems: 'center' },

  timestamp: {
    textAlign: 'center', fontSize: FontSize.xs,
    marginVertical: Spacing[3],
    letterSpacing: LetterSpacing.wide,
  },

  bubbleRow:        { marginVertical: 6 },
  bubbleRowGrouped: { marginTop: 2 },
  bubbleRowMine:    { alignItems: 'flex-end' },
  bubbleRowTheirs:  { alignItems: 'flex-start' },

  bubble: {
    maxWidth: '78%', borderRadius: Radius.lg,
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[3],
  },
  bubbleMine:           { borderBottomRightRadius: Radius.xs },
  bubbleMineGrouped:    { borderTopRightRadius: Radius.xs },
  bubbleTheirs:         { borderBottomLeftRadius: Radius.xs, borderWidth: StyleSheet.hairlineWidth },
  bubbleTheirsGrouped:  { borderTopLeftRadius: Radius.xs },
  bubbleText:           { fontSize: FontSize.base, lineHeight: 22 },

  metaRow:  { marginTop: 2, marginRight: Spacing[1] },
  metaText: { fontSize: FontSize.xs },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing[2],
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // ── Closed-state banner (replaces composer when request is sealed) ──
  closedBar: {
    paddingHorizontal: Spacing[4], paddingTop: Spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  closedBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[3],
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  closedBarIcon: {
    width: 32, height: 32, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  closedBarText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: LetterSpacing.snug,
    lineHeight: FontSize.sm * 1.4,
  },
  inputWrap: {
    flex: 1, minHeight: 40, maxHeight: 120,
    borderRadius: Radius.full, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[2],
    justifyContent: 'center',
  },
  textInput: { fontSize: FontSize.base, lineHeight: 22, padding: 0 },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  sendIcon: { fontSize: FontSize.lg, fontWeight: FontWeight.black },
});
