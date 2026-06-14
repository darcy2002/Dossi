import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "planner", label: "Planning research" },
  { key: "research", label: "Gathering sources" },
  { key: "analysis", label: "Analyzing findings" },
  { key: "quality_check", label: "Quality check" },
  { key: "report_generation", label: "Writing report" },
];

export function ProgressSteps({
  currentStep,
  done,
  retrying,
}: {
  currentStep: string | null;
  done: boolean;
  retrying: boolean;
}) {
  const activeIdx = currentStep ? STEPS.findIndex((s) => s.key === currentStep) : -1;

  return (
    <div className="space-y-1">
      {STEPS.map((step, i) => {
        const isDone = done || (activeIdx > -1 && i < activeIdx);
        const isActive = !done && i === activeIdx;
        return (
          <div key={step.key} className="flex items-center gap-3 py-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs",
                isDone && "border-primary bg-primary text-primary-foreground",
                isActive && "border-primary text-primary",
                !isDone && !isActive && "border-border text-muted-foreground"
              )}
            >
              {isDone ? (
                <Check className="h-4 w-4" />
              ) : isActive ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                i + 1
              )}
            </span>
            <span
              className={cn(
                "text-sm",
                isActive ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
          </div>
        );
      })}
      {retrying && (
        <p className="pl-10 pt-1 text-xs text-amber-600 dark:text-amber-400">
          Refining — coverage was thin, gathering more sources.
        </p>
      )}
    </div>
  );
}
