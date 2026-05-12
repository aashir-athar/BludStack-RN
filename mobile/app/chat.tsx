// app/chat.tsx
// IN-APP CHAT — Real-time messaging between donor and recipient.
// Accessed via: router.push(`/chat?requestId=...&receiverId=...&receiverName=...`)
//
// Uses the `messages` table in Supabase with RLS:
//   - sender_id = auth.uid()
//   - receiver_id = the other party
//   - request_id = the blood request context

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import LoadingScreen from '@/components/LoadingScreen';
import {
  FontSize, FontWeight, Spacing, Radius, LetterSpacing,
} from '@/constants/Typography';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  request_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

function uniqueChannel(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function ChatScreen() {
  const { requestId, receiverId, receiverName } = useLocalSearchParams<{
    requestId: string;
    receiverId: string;
    receiverName: string;
  }>();
  const { theme }        = useTheme();
  const { user, profile } = useAuth();
  const router            = useRouter();
  const insets            = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText]         = useState('');
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const listRef = useRef<FlatList>(null);

  // ── Fetch all messages for this request between these two users ──────────
  const fetchMessages = useCallback(async () => {
    if (!requestId || !user?.id || !receiverId) return;
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('request_id', requestId)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages((data as Message[]) ?? []);
    } catch (e: any) {
      console.warn('[chat fetchMessages]', e.message);
    } finally {
      setLoading(false);
    }
  }, [requestId, user?.id, receiverId]);

  // ── Mark incoming messages as read ───────────────────────────────────────
  const markRead = useCallback(async () => {
    if (!requestId || !user?.id || !receiverId) return;
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('request_id', requestId)
      .eq('sender_id', receiverId)
      .eq('receiver_id', user.id)
      .eq('read', false);
  }, [requestId, user?.id, receiverId]);

  useEffect(() => {
    fetchMessages().then(markRead);

    const channel = supabase
      .channel(uniqueChannel(`chat_${requestId}`))
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `request_id=eq.${requestId}`,
      }, async payload => {
        const msg = payload.new as Message;
        // Only add if relevant to this conversation
        const isRelevant =
          (msg.sender_id === user?.id && msg.receiver_id === receiverId) ||
          (msg.sender_id === receiverId && msg.receiver_id === user?.id);
        if (isRelevant) {
          setMessages(prev => [...prev, msg]);
          if (msg.receiver_id === user?.id) markRead();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [requestId, receiverId, user?.id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // ── Send a message ────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !user?.id || !receiverId || !requestId || sending) return;
    setSending(true);
    setText('');
    try {
      const { error } = await supabase.from('messages').insert({
        request_id:  requestId,
        sender_id:   user.id,
        receiver_id: receiverId,
        content:     trimmed,
        read:        false,
      });
      if (error) throw error;
    } catch (e: any) {
      console.warn('[chat sendMessage]', e.message);
      setText(trimmed); // restore on fail
    } finally {
      setSending(false);
    }
  }, [text, user?.id, receiverId, requestId, sending]);

  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    const isMine  = item.sender_id === user?.id;
    const isFirst = index === 0;
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const showTime = !prevMsg ||
      new Date(item.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 5 * 60 * 1000;

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
        ]}>
          <View style={[
            styles.bubble,
            isMine
              ? [styles.bubbleMine,   { backgroundColor: theme.primary }]
              : [styles.bubbleTheirs, { backgroundColor: theme.cardElevated, borderColor: theme.border }],
          ]}>
            <Text style={[styles.bubbleText, { color: isMine ? '#fff' : theme.textPrimary }]}>
              {item.content}
            </Text>
          </View>
          {isMine && (
            <Text style={[styles.readReceipt, { color: theme.textMuted }]}>
              {item.read ? '✓✓' : '✓'}
            </Text>
          )}
        </View>
      </View>
    );
  }, [user?.id, messages, theme]);

  if (loading) return <LoadingScreen message="Loading messages…" />;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={[styles.backIcon, { color: theme.textPrimary }]}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={[styles.avatarSmall, { backgroundColor: theme.cardElevated }]}>
            <Text style={[styles.avatarInitial, { color: theme.textPrimary }]}>
              {decodeURIComponent(receiverName).charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={[styles.headerName, { color: theme.textPrimary }]} numberOfLines={1}>
              {decodeURIComponent(receiverName)}
            </Text>
            <Text style={[styles.headerSub, { color: theme.textMuted }]}>
              Re: blood request #{requestId.slice(0, 6).toUpperCase()}
            </Text>
          </View>
        </View>
        {/* View request button */}
        <TouchableOpacity
          onPress={() => router.push(`/request/${requestId}`)}
          style={[styles.viewReqBtn, { borderColor: theme.border }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.viewReqLabel, { color: theme.textSecondary }]}>Request</Text>
        </TouchableOpacity>
      </View>

      {/* Messages list */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.messageList, messages.length === 0 && styles.messageListEmpty]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
                Start the conversation
              </Text>
              <Text style={[styles.emptyDesc, { color: theme.textMuted }]}>
                Messages are private between you and {decodeURIComponent(receiverName)}.
              </Text>
            </View>
          }
        />

        {/* Input bar */}
        <View style={[styles.inputBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <View style={[styles.inputWrap, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Message…"
              placeholderTextColor={theme.textMuted}
              style={[styles.textInput, { color: theme.textPrimary }]}
              multiline
              maxLength={1000}
              returnKeyType="default"
            />
          </View>
          <TouchableOpacity
            onPress={sendMessage}
            disabled={!text.trim() || sending}
            style={[
              styles.sendBtn,
              { backgroundColor: text.trim() ? theme.primary : theme.cardElevated },
            ]}
            activeOpacity={0.8}
          >
            <Text style={[styles.sendIcon, { color: text.trim() ? '#fff' : theme.textMuted }]}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
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
  backBtn:      { width: 36, height: 36, justifyContent: 'center' },
  backIcon:     { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  headerInfo:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  avatarSmall:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarInitial:{ fontSize: FontSize.base, fontWeight: FontWeight.black },
  headerName:   { fontSize: FontSize.sm, fontWeight: FontWeight.black },
  headerSub:    { fontSize: FontSize.xs, marginTop: 1 },
  viewReqBtn: {
    paddingHorizontal: Spacing[2], paddingVertical: Spacing[1],
    borderRadius: Radius.xs, borderWidth: 1,
  },
  viewReqLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },

  messageList:      { padding: Spacing[4], gap: Spacing[1] },
  messageListEmpty: { flex: 1, justifyContent: 'center' },

  timestamp: {
    textAlign: 'center', fontSize: FontSize.xs,
    marginVertical: Spacing[3],
    letterSpacing: LetterSpacing.wide,
  },

  bubbleRow:       { marginVertical: 2 },
  bubbleRowMine:   { alignItems: 'flex-end' },
  bubbleRowTheirs: { alignItems: 'flex-start' },

  bubble: {
    maxWidth: '78%', borderRadius: Radius.lg,
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[3],
  },
  bubbleMine: {
    borderBottomRightRadius: Radius.xs,
  },
  bubbleTheirs: {
    borderBottomLeftRadius: Radius.xs,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleText:  { fontSize: FontSize.base, lineHeight: 22 },
  readReceipt: { fontSize: FontSize.xs, marginTop: 2, marginRight: Spacing[1] },

  empty:      { alignItems: 'center', gap: Spacing[3], paddingVertical: Spacing[12] },
  emptyIcon:  { fontSize: 44 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.black },
  emptyDesc:  { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 22 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing[2],
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flex: 1, borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[2],
    maxHeight: 120,
  },
  textInput:  { fontSize: FontSize.base, maxHeight: 100 },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  sendIcon:   { fontSize: FontSize.md, fontWeight: FontWeight.black },
});
