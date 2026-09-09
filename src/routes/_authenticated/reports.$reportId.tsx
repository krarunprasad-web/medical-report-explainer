import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, Loader2, RefreshCw, Trash2, AlertCircle } from "lucide-react";
import { downloadReportPdf } from "@/lib/report-pdf";
import { toast } from "sonner";
import { analyzeReport, deleteReport, getReport } from "@/lib/reports.functions";
import { SiteHeader } from "@/components/SiteHeader";
import { Disclaimer } from "@/components/Disclaimer";
import { ReportChat } from "@/components/ReportChat";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/reports/$reportId")({
  head: () => ({
    meta: [
      { title: "Your results, explained — MediClear" },
      {
        name: "description",
        content:
          "Every value from your lab report in plain language, colour-coded, with gentle suggestions and a chat for your questions.",
      },
      { property: "og:title", content: "Your results, explained — MediClear" },
      {
        property: "og:description",
        content: "Every value from your lab report in plain, caring language.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportPage,
});

const statusOrder: Record<string, number> = { red: 0, amber: 1, green: 2 };

function ReportPage() {
  const { reportId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);

  const fetchReport = useServerFn(getReport);
  const retry = useServerFn(analyzeReport);
  const remove = useServerFn(deleteReport);

  const { data, isLoading, error } = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => fetchReport({ data: { reportId } }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-20 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Opening your report…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h1 className="text-3xl">We couldn't find that report</h1>
          <Button asChild className="mt-6">
            <Link to="/reports">Back to my reports</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { report, parameters, messages } = data;
  const sorted = [...parameters].sort(
    (a, b) =>
      (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3) ||
      (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const counts = {
    green: parameters.filter((p) => p.status === "green").length,
    amber: parameters.filter((p) => p.status === "amber").length,
    red: parameters.filter((p) => p.status === "red").length,
  };

  const runAgain = async () => {
    setRetrying(true);
    try {
      const result = await retry({ data: { reportId } });
      await queryClient.invalidateQueries({ queryKey: ["report", reportId] });
      if (result.status === "failed") toast.error(result.message ?? "Still couldn't read it.");
    } catch {
      toast.error("That didn't work. Please try again in a moment.");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-10">
        <Link
          to="/reports"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          My reports
        </Link>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl">{report.title ?? report.original_name}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Added{" "}
              {new Date(report.created_at).toLocaleDateString(undefined, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={runAgain} disabled={retrying}>
              {retrying ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              Read again
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await remove({ data: { reportId } });
                await queryClient.invalidateQueries({ queryKey: ["reports"] });
                navigate({ to: "/reports" });
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete
            </Button>
          </div>
        </div>

        {report.status === "failed" && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-alert/30 bg-alert-surface p-5">
            <AlertCircle className="mt-0.5 size-5 text-alert" aria-hidden="true" />
            <div>
              <p className="font-medium">We couldn't read this report</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {report.error_message ??
                  "A clearer photo, or the PDF straight from the lab, usually works better."}
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:items-start">
          <div>
            {report.summary && (
              <div className="rounded-3xl border border-border/70 bg-card p-6">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                  In a nutshell
                </p>
                <p className="mt-3 text-lg leading-relaxed">{report.summary}</p>
                {parameters.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2 text-xs">
                    <Pill tone="ok" label={`${counts.green} looking healthy`} />
                    {counts.amber > 0 && <Pill tone="watch" label={`${counts.amber} to watch`} />}
                    {counts.red > 0 && (
                      <Pill tone="alert" label={`${counts.red} to discuss with your doctor`} />
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 space-y-3">
              {sorted.map((parameter) => (
                <ParameterCard key={parameter.id} parameter={parameter} />
              ))}
            </div>

            {parameters.length === 0 && report.status !== "failed" && (
              <p className="mt-6 text-sm text-muted-foreground">
                We didn't find any measured values in this file.
              </p>
            )}

            <div className="mt-8">
              <Disclaimer />
            </div>
          </div>

          <div className="lg:sticky lg:top-20">
            <ReportChat reportId={reportId} initialMessages={messages} />
          </div>
        </div>
      </main>
    </div>
  );
}

function Pill({ tone, label }: { tone: "ok" | "watch" | "alert"; label: string }) {
  const classes =
    tone === "ok"
      ? "bg-ok-surface text-ok-foreground"
      : tone === "watch"
        ? "bg-watch-surface text-watch-foreground"
        : "bg-alert-surface text-alert-foreground";
  return <span className={`rounded-full px-3 py-1 font-medium ${classes}`}>{label}</span>;
}

type Parameter = {
  id: string;
  name: string;
  plain_name: string | null;
  value: string | null;
  unit: string | null;
  reference_range: string | null;
  status: string;
  explanation: string | null;
  suggestion: string | null;
};

function ParameterCard({ parameter }: { parameter: Parameter }) {
  const tone =
    parameter.status === "red" ? "alert" : parameter.status === "amber" ? "watch" : "ok";
  const surface =
    tone === "ok"
      ? "border-ok/25 bg-ok-surface/60"
      : tone === "watch"
        ? "border-watch/30 bg-watch-surface/70"
        : "border-alert/30 bg-alert-surface/70";
  const dot = tone === "ok" ? "bg-ok" : tone === "watch" ? "bg-watch" : "bg-alert";
  const statusLabel =
    tone === "ok" ? "In range" : tone === "watch" ? "Slightly off" : "Needs attention";

  return (
    <article className={`rounded-2xl border p-5 ${surface}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className={`mt-2 size-2.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
          <div>
            <h3 className="text-lg leading-tight">{parameter.name}</h3>
            {parameter.plain_name && (
              <p className="mt-0.5 text-sm text-muted-foreground">{parameter.plain_name}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg tabular-nums">
            {parameter.value}
            {parameter.unit ? ` ${parameter.unit}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {parameter.reference_range ? `Normal: ${parameter.reference_range}` : statusLabel}
          </p>
        </div>
      </div>

      {parameter.explanation && (
        <p className="mt-3 pl-5 text-sm leading-relaxed">{parameter.explanation}</p>
      )}
      {parameter.suggestion && (
        <p className="mt-2.5 ml-5 rounded-xl bg-background/70 px-3.5 py-2.5 text-sm leading-relaxed">
          <span className="font-medium">What can help: </span>
          {parameter.suggestion}
        </p>
      )}
    </article>
  );
}
