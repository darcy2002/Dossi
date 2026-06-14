import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, Skeleton, Spinner } from "@/components/ui/misc";
import { ErrorState } from "@/components/states";
import { useMessages } from "@/lib/queries";
import { chatStreamResponse } from "@/lib/api";

function Bubble({ role, content }: { role: string; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        }`}
      >
        {content || <span className="opacity-60">…</span>}
      </div>
    </div>
  );
}

export function ChatPanel({ sessionId }: { sessionId: number }) {
  const qc = useQueryClient();
  const { data: messages, isLoading, isError, refetch } = useMessages(sessionId, true);
  const [input, setInput] = useState("");
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming, pendingUser]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError(null);
    setPendingUser(text);
    setStreaming("");
    setBusy(true);

    try {
      const res = await chatStreamResponse(sessionId, text);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

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
            if (data.delta) {
              acc += data.delta;
              setStreaming(acc);
            } else if (data.error) {
              setError("The assistant ran into an error.");
            }
          } catch {
            /* ignore partial */
          }
        }
      }
    } catch {
      setError("Couldn't reach the assistant. Please try again.");
    } finally {
      setBusy(false);
      setPendingUser(null);
      setStreaming("");
      await qc.invalidateQueries({ queryKey: ["messages", sessionId] });
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
        {busy && <Bubble role="assistant" content={streaming} />}
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
