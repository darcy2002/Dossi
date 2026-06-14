import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, Skeleton, Spinner } from "@/components/ui/misc";
import { ErrorState } from "@/components/states";
import { useMessages } from "@/lib/queries";
import { chatStreamResponse } from "@/lib/api";

// Assistant replies are markdown; sanitize before injecting as HTML.
function MarkdownContent({ content }: { content: string }) {
  const html = DOMPurify.sanitize(marked.parse(content, { gfm: true, breaks: true }) as string);
  return <div className="chat-md" dangerouslySetInnerHTML={{ __html: html }} />;
}

function Bubble({ role, content }: { role: string; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "whitespace-pre-wrap bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        {isUser ? content : <MarkdownContent content={content} />}
      </div>
    </div>
  );
}

// Shown while the assistant reply is generating, in place of live partial text.
function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-lg bg-muted px-3 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export function ChatPanel({ sessionId }: { sessionId: number }) {
  const qc = useQueryClient();
  const { data: messages, isLoading, isError, refetch } = useMessages(sessionId, true);
  const [input, setInput] = useState("");
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy, pendingUser]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError(null);
    setPendingUser(text);
    setBusy(true);

    try {
      const res = await chatStreamResponse(sessionId, text);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Drain the stream to detect completion / errors; the final message is
      // persisted server-side and rendered via the refetch below.
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const ev of events) {
          const line = ev.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const data = JSON.parse(payload);
            if (data.error) setError("The assistant ran into an error.");
          } catch {
            /* ignore partial */
          }
        }
      }
    } catch {
      setError("Couldn't reach the assistant. Please try again.");
    } finally {
      // Refetch first so the persisted reply is in cache before we drop the
      // typing bubble — avoids a flicker gap between the two.
      await qc.invalidateQueries({ queryKey: ["messages", sessionId] });
      setBusy(false);
      setPendingUser(null);
    }
  }

  return (
    <Card className="flex h-full min-h-[420px] flex-col glass">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Ask about this briefing</h3>
        <p className="text-xs text-muted-foreground">Answers come only from the research.</p>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading && <Skeleton className="h-16 w-3/4" />}
        {isError && <ErrorState message="Couldn't load messages." onRetry={() => refetch()} />}
        {!isLoading && !isError && (messages?.length ?? 0) === 0 && !pendingUser && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No questions yet. Ask anything about {`the company`}.
          </p>
        )}
        {messages?.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} />
        ))}
        {pendingUser && <Bubble role="user" content={pendingUser} />}
        {busy && <TypingBubble />}
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
        <Input
          placeholder="Ask a follow-up…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send">
          {busy ? <Spinner /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </Card>
  );
}
