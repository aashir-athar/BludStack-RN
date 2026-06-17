// Lever: reciprocity + commitment. Chat unlocks only after a donor accepts, so
// the conversation itself is proof the two are in this together.
//
// FlashList v2 chat pattern: maintainVisibleContentPosition.startRenderingFromBottom
// (the `inverted` prop is deprecated in v2). Older pages load via onStartReached.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/stores/themeStore';
import { useAuth } from '@/stores/authStore';
import { useToast } from '@/stores/toastStore';
import { useChatMessages, type ChatMessage } from '@/hooks/useChatMessages';
import { useChatTyping } from '@/hooks/useChatTyping';
import { supabase } from '@/utils/supabase';
import { Spacing, Radius } from '@/constants/Typography';
import { Text } from '@/ui';

// react-native-keyboard-controller's KAV is the only primitive that handles
// Android edge-to-edge correctly (RN's KAV does not resize there). Lazy require
// so Expo Go (no native module) falls back to RN's KAV.
const KeyboardAvoidingView: React.ComponentType<{ style?: object; behavior?: string; children?: React.ReactNode }> = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-keyboard-controller').KeyboardAvoidingView;
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native').KeyboardAvoidingView;
  }
})();

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

type ReqStatus = 'active' | 'fulfilled' | 'cancelled' | 'expired' | null;

export default function ChatScreen() {
  const { requestId, receiverId, receiverName } = useLocalSearchParams<{ requestId: string; receiverId: string; receiverName: string }>();
  const theme = useAppTheme();
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const listRef = useRef<FlashListRef<ChatMessage>>(null);

  const { messages, loading, sendMessage, loadOlder, markRead, retrySend } = useChatMessages(requestId, user?.id, receiverId);
  const { otherTyping, notifyTyping } = useChatTyping(requestId, user?.id, receiverId);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [reqStatus, setReqStatus] = useState<ReqStatus>(null);

  // Live request status: seal the chat the moment the request closes.
  useEffect(() => {
    if (!requestId) return;
    supabase.from('blood_requests').select('status').eq('id', requestId).maybeSingle()
      .then(({ data }) => setReqStatus((data?.status as ReqStatus) ?? null));
    const channel = supabase
      .channel(`chat_req_${requestId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'blood_requests', filter: `id=eq.${requestId}` },
        (payload) => setReqStatus(((payload.new as { status?: ReqStatus }).status) ?? null))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [requestId]);

  useEffect(() => { void markRead(); }, [markRead, messages.length]);

  const closed = reqStatus != null && reqStatus !== 'active';

  const onSend = useCallback(async () => {
    const t = text.trim();
    if (!t || sending) return;
    setText('');
    setSending(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await sendMessage(t);
    } catch {
      toast.error("Message didn't send", { description: 'Tap it to retry.' });
    } finally {
      setSending(false);
    }
  }, [text, sending, sendMessage, toast]);

  const renderItem = useCallback(({ item }: { item: ChatMessage }) => {
    const mine = item.sender_id === user?.id;
    const failed = item._status === 'failed';
    return (
      <View style={{ paddingHorizontal: Spacing[4], paddingVertical: Spacing[1], alignItems: mine ? 'flex-end' : 'flex-start' }}>
        <Pressable
          onPress={() => { if (failed && item.client_id) void retrySend(item.client_id); }}
          accessibilityRole={failed ? 'button' : 'text'}
          accessibilityLabel={`${mine ? 'You' : receiverName ?? 'They'}: ${item.content}`}
          style={{
            maxWidth: '82%',
            backgroundColor: mine ? theme.primary : theme.card,
            borderColor: mine ? 'transparent' : theme.border,
            borderWidth: mine ? 0 : 1,
            borderRadius: Radius.xl,
            borderCurve: 'continuous',
            paddingHorizontal: Spacing[4],
            paddingVertical: Spacing[3],
          }}
        >
          <Text variant="body" style={{ color: mine ? theme.textOnPrimary : theme.textPrimary }}>{item.content}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[1], marginTop: 2, alignSelf: 'flex-end' }}>
            <Text variant="caption" style={{ color: mine ? theme.textOnPrimary : theme.textTertiary, opacity: 0.7, fontVariant: ['tabular-nums'] }}>
              {clock(item.created_at)}
            </Text>
            {mine && item._status === 'sending' ? <Ionicons name="time-outline" size={12} color={theme.textOnPrimary} /> : null}
            {mine && item._status === 'sent' ? <Ionicons name="checkmark-done" size={13} color={theme.textOnPrimary} /> : null}
            {failed ? <Ionicons name="alert-circle" size={13} color={theme.danger} /> : null}
          </View>
        </Pressable>
        {failed ? <Text variant="caption" tone="danger" style={{ marginTop: 2 }}>Tap to retry</Text> : null}
      </View>
    );
  }, [user?.id, receiverName, theme, retrySend]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back" style={[styles.backBtn, { backgroundColor: theme.pillBg }]}>
          <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="titleSm" numberOfLines={1}>{receiverName ?? 'Conversation'}</Text>
          <Text variant="caption" tone={otherTyping ? 'brand' : 'muted'}>{otherTyping ? 'Typing...' : 'Private to you both'}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <FlashList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.client_id ?? item.id}
          renderItem={renderItem}
          maintainVisibleContentPosition={{ startRenderingFromBottom: true, autoscrollToBottomThreshold: 0.2 }}
          onStartReached={loadOlder}
          onStartReachedThreshold={0.3}
          contentContainerStyle={{ paddingVertical: Spacing[3] }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            loading ? null : (
              <View style={{ alignItems: 'center', paddingTop: Spacing[16], paddingHorizontal: Spacing[8] }}>
                <Text variant="bodySm" tone="muted" style={{ textAlign: 'center' }}>
                  Start the conversation. Messages are private between you and {receiverName ?? 'them'}.
                </Text>
              </View>
            )
          }
        />

        {closed ? (
          <View style={{ padding: Spacing[4], alignItems: 'center', backgroundColor: theme.surfaceMuted }}>
            <Text variant="caption" tone="muted">This conversation is closed. The request is {reqStatus}.</Text>
          </View>
        ) : (
          <View style={[styles.composer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            <View style={{ flex: 1, backgroundColor: theme.inputBg, borderRadius: Radius.pill, borderCurve: 'continuous', paddingHorizontal: Spacing[4], minHeight: 44, justifyContent: 'center' }}>
              <TextInput
                value={text}
                onChangeText={(t) => { setText(t); notifyTyping(); }}
                placeholder="Message"
                placeholderTextColor={theme.placeholder}
                multiline
                style={{ color: theme.textPrimary, fontSize: 16, paddingVertical: Spacing[2], maxHeight: 120 }}
              />
            </View>
            <Pressable
              onPress={onSend}
              disabled={!text.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              style={{ width: 44, height: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: text.trim() ? theme.primary : theme.border, opacity: sending ? 0.6 : 1 }}
            >
              <Ionicons name="arrow-up" size={20} color={theme.textOnPrimary} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing[2],
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
