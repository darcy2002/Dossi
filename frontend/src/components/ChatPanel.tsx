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
import { useToast } from "@/lib/toast";

// Force external links to open safely; registered once at module scope.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

// Tags/attrs the assistant is allowed to emit. Anything else is stripped.
const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "code", "pre", "ul", "ol", "li",
  "a", "blockquote", "h1", "h2", "h3", "hr",
];
const ALLOWED_ATTR = ["href", "title", "target", "rel"];

// Assistant replies are markdown; sanitize before injecting as HTML.
function MarkdownContent({ content }: { content: string }) {
  // async:false guarantees a string (no unsafe cast); strict allowlist limits
  // the blast radius if a token store is ever exposed to injected HTML.
  const raw = marked.parse(content, { async: false, gfm: true, breaks: true });
  const html = DOMPurify.sanitize(raw, { ALLOWED_TAGS, ALLOWED_ATTR });
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
  const toast = useToast();
  const { data: messages, isLoading, isError, refetch } = useMessages(sessionId, true);
  const [input, setInput] = useState("");
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy, pendingUser]);

  // Abort an in-flight stream when the panel unmounts (navigation mid-reply),
  // so the read loop stops and we never call setState on an unmounted component.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setPendingUser(text);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let failed = false;
    let gotDone = false;

    try {
      const res = await chatStreamResponse(sessionId, text, controller.signal);
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
          if (payload === "[DONE]") {
            gotDone = true;
            continue;
          }
          try {
            const data = JSON.parse(payload);
            // Accept any of the shapes the backend (or a proxy) might use.
            const errMsg = data.error ?? data.detail ?? data.message;
            if (errMsg) {
              failed = true;
              toast("The assistant ran into an error.", "error");
            }
          } catch {
            // A non-JSON data line is unexpected — treat it as a failure rather
            // than silently dropping it, so the user isn't left with nothing.
            failed = true;
            toast("The assistant ran into an error.", "error");
          }
        }
      }
      // Stream closed without a terminal [DONE] and without an error event:
      // the reply is incomplete — tell the user instead of showing nothing.
      if (!gotDone && !failed) {
        toast("The assistant's response was incomplete. Please try again.", "error");
      }
    } catch {
      if (controller.signal.aborted) return; // unmounted/navigated away — leave state alone
      toast("Couldn't reach the assistant. Please try again.", "error");
    } finally {
      if (!controller.signal.aborted) {
        // Refetch first so the persisted reply is in cache before we drop the
        // typing bubble — avoids a flicker gap between the two.
        await qc.invalidateQueries({ queryKey: ["messages", sessionId] });
        setBusy(false);
        setPendingUser(null);
      }
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
        {messages?.map((m) => (
          <Bubble key={m.id} role={m.role} content={m.content} />
        ))}
        {pendingUser && <Bubble role="user" content={pendingUser} />}
        {busy && <TypingBubble />}
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
