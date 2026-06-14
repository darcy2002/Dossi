import { useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";
import { Card, Skeleton } from "@/components/ui/misc";
import { StatusBadge } from "@/components/StatusBadge";
import { ErrorState } from "@/components/states";
import { useSessions } from "@/lib/queries";
import type { SessionListItem } from "@/lib/types";

export function History() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useSessions();

  const groups = new Map<string, SessionListItem[]>();
  for (const s of data ?? []) {
    const list = groups.get(s.company_name) ?? [];
    list.push(s);
    groups.set(s.company_name, list);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h2 className="mb-1 text-2xl font-semibold">History</h2>
      <p className="mb-6 text-sm text-muted-foreground">Your research, grouped by company.</p>

      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      )}
      {isError && <ErrorState message="Couldn't load history." onRetry={() => refetch()} />}
      {!isLoading && !isError && groups.size === 0 && (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No research yet. Start a new conversation to build your first briefing.
        </p>
      )}

      <div className="space-y-6">
        {[...groups.entries()].map(([company, sessions]) => (
          <div key={company}>
            <div className="mb-2 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">{company}</h3>
              <span className="text-xs text-muted-foreground">
                {sessions.length} {sessions.length === 1 ? "briefing" : "briefings"}
              </span>
            </div>
            <div className="space-y-2">
              {sessions.map((s) => (
                <Card
                  key={s.id}
                  onClick={() => navigate(`/app/sessions/${s.id}`)}
                  className="cursor-pointer p-4 transition-colors hover:border-primary/50 glass"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm text-muted-foreground">{s.company_name}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleString()}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
