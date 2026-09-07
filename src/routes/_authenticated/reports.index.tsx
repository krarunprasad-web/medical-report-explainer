import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileUp, Loader2, FileText, Camera, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { analyzeReport, createReport, listReports } from "@/lib/reports.functions";
import { SiteHeader } from "@/components/SiteHeader";
import { Disclaimer } from "@/components/Disclaimer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "My reports — MediClear" },
      {
        name: "description",
        content:
          "Upload a new lab report or revisit a past one, each explained in plain, caring language.",
      },
      { property: "og:title", content: "My reports — MediClear" },
      {
        property: "og:description",
        content: "Upload a lab report and understand every value in plain language.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});

const ACCEPTED = ".pdf,image/png,image/jpeg,image/webp,image/heic";

function ReportsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const fetchReports = useServerFn(listReports);
  const create = useServerFn(createReport);
  const analyze = useServerFn(analyzeReport);

  const { data: reports, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: () => fetchReports(),
  });

  const handleFile = async (file: File) => {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/");
    if (!isPdf && !isImage) {
      toast.error("Please choose a PDF or a photo of your report.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("That file is larger than 20 MB. Try a smaller scan or photo.");
      return;
    }

    try {
      setBusy("Saving your report…");
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Please sign in again.");

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("reports")
        .upload(path, file, { contentType: file.type || "application/pdf" });
      if (uploadError) throw new Error(uploadError.message);

      const { id } = await create({
        data: {
          filePath: path,
          originalName: file.name,
          mimeType: file.type || "application/pdf",
        },
      });

      setBusy("Reading your report — this can take a minute…");
      const result = await analyze({ data: { reportId: id } });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });

      if (result.status === "failed") {
        toast.error(result.message ?? "We couldn't read that report.");
      }
      navigate({ to: "/reports/$reportId", params: { reportId: id } });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-5 py-12">
        <h1 className="text-4xl">Your reports</h1>
        <p className="mt-2 text-muted-foreground">
          Upload a new one, or open a report you've looked at before.
        </p>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={`mt-8 rounded-3xl border-2 border-dashed p-10 text-center transition-colors ${
            dragging ? "border-primary bg-primary/5" : "border-border bg-card"
          }`}
        >
          {busy ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
              <p className="font-medium">{busy}</p>
              <p className="text-sm text-muted-foreground">
                Take a breath — we're going through every value carefully.
              </p>
            </div>
          ) : (
            <>
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FileUp className="size-6" aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-2xl">Add a report</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Drop the lab's PDF here, or take a clear photo of the printed sheet. Only you can
                see it.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button onClick={() => inputRef.current?.click()}>
                  <FileText className="size-4" aria-hidden="true" />
                  Choose a file
                </Button>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Camera className="size-3.5" aria-hidden="true" />
                  PDF, JPG, PNG · up to 20 MB
                </span>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void handleFile(file);
                }}
              />
            </>
          )}
        </div>

        <section className="mt-12">
          <h2 className="text-xl">Past reports</h2>
          {isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading your reports…</p>
          ) : !reports || reports.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Nothing here yet. Your first report will appear in this list.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {reports.map((report) => (
                <li key={report.id}>
                  <Link
                    to="/reports/$reportId"
                    params={{ reportId: report.id }}
                    className="block rounded-2xl border border-border/70 bg-card p-5 transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium">{report.title ?? report.original_name}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {report.status === "failed"
                            ? "We couldn't read this one — open it to try again."
                            : (report.summary ?? "Still being read…")}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        {report.status === "failed" ? (
                          <AlertCircle className="size-3.5 text-alert" aria-hidden="true" />
                        ) : (
                          <Clock className="size-3.5" aria-hidden="true" />
                        )}
                        {new Date(report.created_at).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-12">
          <Disclaimer />
        </div>
      </main>
    </div>
  );
}
