import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Card, Spinner } from "@/components/ui/misc";
import { useCreateSession } from "@/lib/queries";
import { ApiError } from "@/lib/api";

export function NewResearch() {
  const navigate = useNavigate();
  const create = useCreateSession();
  const [form, setForm] = useState({ company_name: "", website: "", objective: "" });

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(form, {
      onSuccess: (res) => navigate(`/app/sessions/${res.id}`),
    });
  }

  const error =
    create.error instanceof ApiError ? create.error.message : create.error ? "Couldn't start research." : null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">New research</h1>
          <p className="text-sm text-muted-foreground">
            Dossi will research the company and build your briefing.
          </p>
        </div>
      </div>

      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="company">Company name</label>
            <Input id="company" required placeholder="Notion" value={form.company_name} onChange={set("company_name")} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="website">Website</label>
            <Input id="website" required type="url" placeholder="https://notion.so" value={form.website} onChange={set("website")} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="objective">Meeting objective</label>
            <Textarea
              id="objective" required
              placeholder="e.g. Pitch our outbound sales-automation platform to their GTM team"
              value={form.objective} onChange={set("objective")}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending && <Spinner />}
            Start research
          </Button>
        </form>
      </Card>
    </div>
  );
}
