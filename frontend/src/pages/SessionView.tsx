import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, Skeleton, Spinner } from "@/components/ui/misc";
import { StatusBadge } from "@/components/StatusBadge";
import { ProgressSteps } from "@/components/ProgressSteps";
import { ErrorState } from "@/components/states";
import { ReportView } from "@/components/ReportView";
import { ChatPanel } from "@/components/ChatPanel";
import { useRetrySession, useSession, useSessionStatus } from "@/lib/queries";
import { TERMINAL_STATUSES } from "@/lib/types";

const STEP_ORDER = ["planner", "research", "analysis", "quality_check", "report_generation"];

export function SessionView() {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const qc = useQueryClient();

  const detail = useSession(id);
  const status = useSessionStatus(id, true);
  const retry = useRetrySession(id);

  const liveStatus = status.data?.status ?? detail.data?.status;
  const currentStep = status.data?.current_step ?? detail.data?.current_step ?? null;

  // Detect the quality-check retry loop: current step regressed to an earlier one.
  const maxStepRef = useRef(-1);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    const idx = currentStep ? STEP_ORDER.indexOf(currentStep) : -1;
    if (idx > maxStepRef.current) maxStepRef.current = idx;
    else if (idx > -1 && idx < maxStepRef.current) setRetrying(true);
  }, [currentStep]);

  // When the run reaches a terminal state, refetch the full detail (now has the report).
  useEffect(() => {
    if (liveStatus && TERMINAL_STATUSES.includes(liveStatus)) {
      qc.invalidateQueries({ queryKey: ["session", id] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
      maxStepRef.current = -1;
      setRetrying(false);
    }
  }, [liveStatus, id, qc]);

  if (detail.isLoading && !detail.data) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <ErrorState message="Couldn't load this session." onRetry={() => detail.refetch()} />
      </div>
    );
  }

  const s = detail.data;
  const isRunning = liveStatus === "pending" || liveStatus === "running";

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{s.company_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{s.objective}</p>
        </div>
        {liveStatus && <StatusBadge status={liveStatus} />}
      </div>

      {isRunning && (
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium">
            <Spinner className="text-primary" /> Researching {s.company_name}…
          </div>
          <ProgressSteps currentStep={currentStep} done={false} retrying={retrying} />
        </Card>
      )}

      {liveStatus === "failed" && (
        <Card className="border-destructive/40 p-6">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="flex-1">
              <h2 className="font-semibold">This run failed</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Something went wrong during research. You can retry — it resumes
                from where it stopped.
              </p>
              {s.error_log_json?.length ? (
                <ul className="mt-3 space-y-1 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                  {s.error_log_json.map((e, i) => (
                    <li key={i} className="break-words">{e}</li>
                  ))}
                </ul>
              ) : null}
              <Button className="mt-4 gap-2" disabled={retry.isPending} onClick={() => retry.mutate()}>
                {retry.isPending ? <Spinner /> : <RefreshCw className="h-4 w-4" />} Retry
              </Button>
            </div>
          </div>
        </Card>
      )}

      {(liveStatus === "complete" || liveStatus === "needs_review") && (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            {liveStatus === "needs_review" && (
              <Card className="border-amber-500/40 bg-amber-500/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Needs review — coverage was thin.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      The report is below, but the agent flagged unresolved gaps
                      (see Unknowns). Retry to gather more, or use it as-is.
                    </p>
                    <Button
                      variant="outline" size="sm" className="mt-3 gap-2"
                      disabled={retry.isPending} onClick={() => retry.mutate()}
                    >
                      {retry.isPending ? <Spinner /> : <RefreshCw className="h-4 w-4" />} Retry research
                    </Button>
                  </div>
                </div>
              </Card>
            )}
            {s.report_json ? (
              <ReportView report={s.report_json} />
            ) : (
              <ErrorState message="Report data is missing." onRetry={() => detail.refetch()} />
            )}
          </div>
          <div className="lg:sticky lg:top-8 lg:h-[calc(100vh-8rem)]">
            <ChatPanel sessionId={id} />
          </div>
        </div>
      )}
    </div>
  );
}
