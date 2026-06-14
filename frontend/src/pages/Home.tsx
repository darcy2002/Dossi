import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/misc";
import { useCreateSession } from "@/lib/queries";
import { ApiError } from "@/lib/api";

const SUGGESTIONS = [
  "Prep for a sales meeting with their GTM team",
  "Understand their product and target customers",
  "Find partnership angles and recent signals",
  "Assess risks before an investor call",
];

export function Home() {
  const navigate = useNavigate();
  const create = useCreateSession();
  const [objective, setObjective] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [expanded, setExpanded] = useState(false);

  function onComposerSubmit(e: FormEvent) {
    e.preventDefault();
    if (!objective.trim()) return;
    if (!expanded) {
      setExpanded(true);
      return;
    }
    if (!company.trim() || !website.trim()) return;
    create.mutate(
      { company_name: company, website, objective },
      { onSuccess: (res) => navigate(`/app/sessions/${res.id}`) }
    );
  }

  const error =
    create.error instanceof ApiError ? create.error.message : create.error ? "Couldn't start research." : null;

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center px-6 py-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="animate-orb-pulse mb-7 flex h-28 w-28 items-center justify-center rounded-[28px] bg-card glow-ring"
      >
        <span className="text-3xl font-bold tracking-tight">
          doss<span className="text-primary">i</span>
        </span>
      </motion.div>

      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Chat with Dossi</h2>
      <p className="mt-3 text-center text-sm text-muted-foreground">
        Describe your meeting objective and the company — Dossi researches it and briefs you.
      </p>

      {!expanded && (
        <div className="mt-7 flex max-w-xl flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setObjective(s);
                setExpanded(true);
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onComposerSubmit} className="mt-7 w-full space-y-3">
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <Input placeholder="Company name" value={company} onChange={(e) => setCompany(e.target.value)} autoFocus />
            <Input placeholder="https://company.com" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </motion.div>
        )}

        <div className="flex items-center gap-2 rounded-2xl border border-border glass px-3 py-2 focus-within:border-primary/60">
          <Input
            className="border-0 bg-transparent focus-visible:ring-0"
            placeholder={expanded ? "Refine your objective…" : "What's your meeting objective?"}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
          />
          <button
            type="submit"
            disabled={create.isPending || !objective.trim() || (expanded && (!company.trim() || !website.trim()))}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            aria-label="Start research"
          >
            {create.isPending ? <Spinner /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>

        {expanded && (
          <p className="text-center text-xs text-muted-foreground">
            {company.trim() && website.trim()
              ? "Press the arrow to start research."
              : "Add the company name and website to begin."}
          </p>
        )}
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
      </form>
    </div>
  );
}
