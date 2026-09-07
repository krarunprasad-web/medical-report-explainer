import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Loader2, Send, MessageCircleHeart } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type StoredMessage = { id: string; role: string; content: string };

const suggestions = [
  "Which result should I worry about most?",
  "What can I eat to help these numbers?",
  "Can you explain this in even simpler words?",
];

export function ReportChat({
  reportId,
  initialMessages,
}: {
  reportId: string;
  initialMessages: StoredMessage[];
}) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const startingMessages: UIMessage[] = initialMessages.map((message) => ({
    id: message.id,
    role: message.role === "assistant" ? "assistant" : "user",
    parts: [{ type: "text", text: message.content }],
  }));

  const { messages, sendMessage, status } = useChat({
    id: reportId,
    messages: startingMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { reportId },
      headers: async () => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
    onError: () => toast.error("That message didn't go through. Please try again in a moment."),
  });

  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    textareaRef.current?.focus();
  }, [reportId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    setInput("");
    await sendMessage({ text: trimmed });
    textareaRef.current?.focus();
  };

  return (
    <div className="flex h-[32rem] flex-col rounded-3xl border border-border/70 bg-card lg:h-[calc(100vh-9rem)]">
      <div className="flex items-center gap-2.5 border-b border-border/70 px-5 py-4">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MessageCircleHeart className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base leading-tight">Ask about my results</h2>
          <p className="text-xs text-muted-foreground">Gentle answers, based on your report.</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Ask me anything about your report — no question is too small.
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="rounded-full border border-border bg-background px-3.5 py-1.5 text-xs transition-colors hover:bg-muted"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => {
          const text = message.parts
            .map((part) => (part.type === "text" ? part.text : ""))
            .join("");
          if (!text) return null;
          const isUser = message.role === "user";
          return (
            <div key={message.id} className={isUser ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  isUser
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground [&_li]:my-1 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5"
                }`}
              >
                {isUser ? text : <ReactMarkdown>{text}</ReactMarkdown>}
              </div>
            </div>
          );
        })}

        {status === "submitted" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Thinking about your results…
          </div>
        )}
      </div>

      <form
        className="flex items-end gap-2 border-t border-border/70 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(input);
            }
          }}
          rows={1}
          placeholder="Type your question…"
          className="max-h-32 min-h-11 resize-none"
        />
        <Button type="submit" size="icon" disabled={isBusy || !input.trim()} aria-label="Send">
          {isBusy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
        </Button>
      </form>
    </div>
  );
}
