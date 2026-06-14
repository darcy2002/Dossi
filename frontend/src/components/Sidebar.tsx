import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LogOut, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/misc";
import { StatusBadge } from "@/components/StatusBadge";
import { ErrorState } from "@/components/states";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth";
import { useSessions } from "@/lib/queries";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const { data, isLoading, isError, refetch } = useSessions();
  const [query, setQuery] = useState("");

  const filtered = (data ?? []).filter((s) =>
    s.company_name.toLowerCase().includes(query.toLowerCase())
  );

  function go(path: string) {
    navigate(path);
    onNavigate?.();
  }

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center justify-between px-4 py-4">
        <Link to="/app" onClick={onNavigate} className="text-lg font-bold">
          doss<span className="text-primary">i</span>
        </Link>
        <ThemeToggle />
      </div>

      <div className="space-y-3 px-3">
        <Button className="w-full gap-2" onClick={() => go("/app")}>
          <Plus className="h-4 w-4" /> New research
        </Button>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search sessions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <nav className="mt-3 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        {isError && <ErrorState message="Couldn't load sessions." onRetry={() => refetch()} />}
        {!isLoading && !isError && filtered.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            {query ? "No matches." : "No research yet. Start one above."}
          </p>
        )}
        {filtered.map((s) => (
          <button
            key={s.id}
            onClick={() => go(`/app/sessions/${s.id}`)}
            className={`flex w-full flex-col gap-1 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted ${
              String(s.id) === id ? "bg-muted" : ""
            }`}
          >
            <span className="truncate text-sm font-medium">{s.company_name}</span>
            <StatusBadge status={s.status} />
          </button>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground" title={user?.email}>
            {user?.email}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
