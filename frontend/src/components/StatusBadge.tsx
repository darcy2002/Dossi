import { Badge } from "@/components/ui/misc";
import type { SessionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const styles: Record<SessionStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  running: "bg-accent text-accent-foreground",
  complete: "bg-green-500/15 text-green-600 dark:text-green-400",
  needs_review: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  failed: "bg-destructive/15 text-destructive",
};

const labels: Record<SessionStatus, string> = {
  pending: "Pending",
  running: "Running",
  complete: "Complete",
  needs_review: "Needs review",
  failed: "Failed",
};

export function StatusBadge({ status, className }: { status: SessionStatus; className?: string }) {
  return (
    <Badge className={cn(styles[status], className)}>
      {status === "running" && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {labels[status]}
    </Badge>
  );
}
