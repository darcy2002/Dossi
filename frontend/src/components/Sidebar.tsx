import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Clock, PanelLeftClose, PanelLeft, Plus, Settings } from "lucide-react";
import { Skeleton } from "@/components/ui/misc";
import { ErrorState } from "@/components/states";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { useSessions } from "@/lib/queries";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<string, string> = {
  pending: "bg-muted-foreground",
  running: "bg-primary animate-pulse",
  complete: "bg-green-500",
  needs_review: "bg-amber-500",
  failed: "bg-destructive",
};

export function Sidebar({
  collapsed,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { data, isLoading, isError, refetch } = useSessions();
  const recent = (data ?? []).slice(0, 8);

  function go(path: string) {
    navigate(path);
    onNavigate?.();
  }

  return (
    <div className="flex h-full flex-col glass">
      {/* Header: brand + collapse toggle */}
      <div className={cn("flex items-center px-3 py-4", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <Link to="/app" onClick={onNavigate} className="pl-1 text-lg font-bold">
            doss<span className="text-primary">i</span>
          </Link>
        )}
        {onToggle && (
          <button
            onClick={onToggle}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Toggle sidebar"
          >
            {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        )}
      </div>

      {/* New conversation */}
      <div className="px-3">
        <button
          onClick={() => go("/app")}
          title="Start new conversation"
          className={cn(
            "flex w-full items-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90",
            collapsed && "justify-center px-0"
          )}
        >
          <Plus className="h-4 w-4" />
          {!collapsed && "Start new conversation"}
        </button>
      </div>

      {/* Recent + history */}
      <nav className="mt-4 flex-1 overflow-y-auto px-3">
        {!collapsed && (
          <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recent
          </p>
        )}
        {isLoading &&
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="mb-1 h-8 w-full" />)}
        {isError && !collapsed && (
          <ErrorState message="Couldn't load." onRetry={() => refetch()} />
        )}
        {!isLoading &&
          recent.map((s) => {
            const active = String(s.id) === id;
            return (
              <button
                key={s.id}
                onClick={() => go(`/app/sessions/${s.id}`)}
                title={s.company_name}
                className={cn(
                  "mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted",
                  active && "bg-muted",
                  collapsed && "justify-center px-0"
                )}
              >
                <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[s.status])} />
                {!collapsed && <span className="truncate">{s.company_name}</span>}
              </button>
            );
          })}

        <button
          onClick={() => go("/app/history")}
          title="History"
          className={cn(
            "mt-2 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            location.pathname === "/app/history" && "bg-muted text-foreground",
            collapsed && "justify-center px-0"
          )}
        >
          <Clock className="h-4 w-4 shrink-0" />
          {!collapsed && "History"}
        </button>
      </nav>

      {/* Bottom: theme toggle above settings, then user */}
      <div className="space-y-1 border-t border-border p-3">
        <div className={cn("flex items-center", collapsed ? "flex-col gap-1" : "gap-1")}>
          <ThemeToggle />
          <button
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Settings"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
        <UserMenu collapsed={collapsed} />
      </div>
    </div>
  );
}
