import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/misc";
import type { Report } from "@/lib/types";

function TextSection({ title, body }: { title: string; body: string }) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
    </Card>
  );
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <ul className="mt-2 space-y-2">
        {items?.length ? (
          items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{it}</span>
            </li>
          ))
        ) : (
          <li className="text-sm text-muted-foreground">None noted.</li>
        )}
      </ul>
    </Card>
  );
}

export function ReportView({ report }: { report: Report }) {
  return (
    <div className="space-y-4">
      <TextSection title="Company overview" body={report.company_overview} />
      <TextSection title="Products & services" body={report.products_and_services} />
      <TextSection title="Target customers" body={report.target_customers} />
      <ListSection title="Business signals" items={report.business_signals} />
      <ListSection title="Risks & challenges" items={report.risks_and_challenges} />
      <ListSection title="Suggested discovery questions" items={report.suggested_discovery_questions} />
      <TextSection title="Suggested outreach strategy" body={report.suggested_outreach_strategy} />
      <ListSection title="Unknowns" items={report.unknowns} />

      <Card className="p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Sources</h3>
        <ul className="mt-2 space-y-2">
          {report.sources?.length ? (
            report.sources.map((src, i) => (
              <li key={i}>
                <a
                  href={src.url} target="_blank" rel="noreferrer"
                  className="inline-flex items-start gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="break-words">{src.title}</span>
                </a>
              </li>
            ))
          ) : (
            <li className="text-sm text-muted-foreground">No sources.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
