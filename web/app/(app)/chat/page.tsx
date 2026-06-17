"use client";

// Lever: reciprocity + commitment. Chat unlocks after a match, so the thread is
// proof the two are in this together. Supabase Realtime, optimistic send.
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { errorReporter } from "@/lib/error-reporter";
import { Skeleton, cn } from "@/components/ui";

interface ChatMessage {
  id: string;
  request_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  client_id: string | null;
  created_at: string;
  pending?: boolean;
}

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ChatContent() {
  const searchParams = useSearchParams();
  const requestId = searchParams.get("id") ?? "";
  const router = useRouter();
  const otherId = searchParams.get("with") ?? "";
  const { user } = useAuth();
  const myId = user?.id;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const scrollToEnd = useCallback(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), []);

  // Initial load + realtime. This effect syncs Supabase (initial fetch +
  // subscription) into state - a subscription, not a render cascade.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!requestId || !myId || !otherId) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("request_id", requestId)
        .or(`and(sender_id.eq.${myId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${myId})`)
        .order("created_at", { ascending: true })
        .limit(100);
      if (!active) return;
      setMessages((data as ChatMessage[]) ?? []);
      setLoading(false);
      setTimeout(scrollToEnd, 60);
    })();

    const channel = supabase
      .channel(`chat_${requestId}_${myId.slice(0, 6)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `request_id=eq.${requestId}` }, (payload) => {
        const m = payload.new as ChatMessage;
        const isOurs = (m.sender_id === myId && m.receiver_id === otherId) || (m.sender_id === otherId && m.receiver_id === myId);
        if (!isOurs) return;
        setMessages((prev) => {
          if (m.client_id) {
            const idx = prev.findIndex((x) => x.client_id === m.client_id);
            if (idx >= 0) {
              const next = prev.slice();
              next[idx] = m;
              return next;
            }
          }
          if (prev.some((x) => x.id === m.id)) return prev;
          return [...prev, m];
        });
        setTimeout(scrollToEnd, 60);
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [requestId, myId, otherId, scrollToEnd]);

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || !myId || !otherId || sending) return;
    setText("");
    setSending(true);
    const clientId = crypto.randomUUID();
    const optimistic: ChatMessage = {
      id: clientId,
      request_id: requestId,
      sender_id: myId,
      receiver_id: otherId,
      content,
      client_id: clientId,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(scrollToEnd, 30);
    const { error } = await supabase
      .from("messages")
      .insert({ request_id: requestId, sender_id: myId, receiver_id: otherId, content, client_id: clientId });
    if (error) {
      errorReporter.warn("chat send failed", { message: error.message });
      setMessages((prev) => prev.map((m) => (m.client_id === clientId ? { ...m, pending: false, content: content + " (failed)" } : m)));
    }
    setSending(false);
  };

  if (!otherId) {
    return <p className="text-sm text-onyx-200">This conversation needs a participant.</p>;
  }

  return (
    <div className="flex h-[calc(100dvh-12rem)] flex-col">
      <button onClick={() => router.back()} className="mb-3 inline-flex w-fit items-center gap-1.5 text-sm text-onyx-200 hover:text-bone-50">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="flex-1 overflow-y-auto rounded-3xl border border-white/8 bg-surface p-4">
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="ml-auto h-10 w-1/2" />
            <Skeleton className="h-10 w-3/5" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-onyx-300">Start the conversation. Messages are private between you two.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((m) => {
              const mine = m.sender_id === myId;
              return (
                <div key={m.client_id ?? m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5",
                      mine ? "bg-crimson-600 text-white" : "border border-white/8 bg-onyx-900 text-bone-50",
                      m.pending && "opacity-70",
                    )}
                  >
                    <p className="text-sm leading-relaxed">{m.content}</p>
                    <p className={cn("mt-1 text-right text-[0.65rem] tabular-nums", mine ? "text-white/70" : "text-onyx-400")}>{clock(m.created_at)}</p>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <form onSubmit={onSend} className="mt-3 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message"
          aria-label="Message"
          className="flex-1 rounded-full border border-white/10 bg-onyx-900 px-5 py-3 text-base text-bone-50 outline-none placeholder:text-onyx-400 focus:border-crimson-500/60"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          aria-label="Send"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-crimson-600 text-white transition-colors hover:bg-crimson-500 disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex flex-col gap-4"><div className="h-40 w-full animate-pulse rounded-2xl bg-white/5" /></div>}>
      <ChatContent />
    </Suspense>
  );
}
