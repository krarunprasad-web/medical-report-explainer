import { createFileRoute, Link } from "@tanstack/react-router";
import { FileUp, MessageCircleHeart, Sparkles, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Disclaimer } from "@/components/Disclaimer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MediClear — Your lab report, explained kindly" },
      {
        name: "description",
        content:
          "Upload a lab report and get every value explained in plain, caring language, colour-coded, with gentle lifestyle suggestions and a chat for your questions.",
      },
      { property: "og:title", content: "MediClear — Your lab report, explained kindly" },
      {
        property: "og:description",
        content:
          "Upload a lab report and understand every value in plain language, with gentle lifestyle suggestions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const steps = [
  {
    icon: FileUp,
    title: "Upload your report",
    body: "A PDF from the lab, or just a photo of the printed sheet. It stays private to your account.",
  },
  {
    icon: Sparkles,
    title: "See it in plain words",
    body: "Every value gets an everyday name, a green, amber or red status, and a short kind explanation.",
  },
  {
    icon: MessageCircleHeart,
    title: "Ask anything",
    body: "A gentle chat that already knows your numbers, ready for the questions you forgot to ask.",
  },
];

function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        <section className="paper-grain border-b border-border/60">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-20 md:py-28 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3.5 py-1.5 text-xs tracking-wide text-muted-foreground uppercase">
                For patients, not doctors
              </p>
              <h1 className="mt-6 text-5xl leading-[1.05] md:text-6xl">
                Your lab report,
                <br />
                explained kindly.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Those long words and tiny numbers are hard to read when you're already worried.
                Upload your report and we'll walk you through it, one value at a time, in language
                that actually makes sense.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link to={user ? "/reports" : "/auth"}>
                    {user ? "Go to my reports" : "Upload a report"}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
                <span className="text-sm text-muted-foreground">
                  Private to you. Free to try.
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-border/70 bg-card p-7 shadow-[0_30px_80px_-45px_oklch(0.4_0.06_195_/_0.7)]">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                A glimpse of what you'll see
              </p>
              <div className="mt-5 space-y-3">
                <SampleRow
                  tone="ok"
                  label="Haemoglobin"
                  plain="the oxygen carrier in your blood"
                  value="13.8 g/dL"
                  note="Comfortably in range — your blood is carrying oxygen well."
                />
                <SampleRow
                  tone="watch"
                  label="Vitamin D"
                  plain="the sunshine vitamin your bones rely on"
                  value="22 ng/mL"
                  note="A little low. Some morning sunlight and a chat with your doctor would help."
                />
                <SampleRow
                  tone="alert"
                  label="LDL Cholesterol"
                  plain="the fat that can settle in your arteries"
                  value="168 mg/dL"
                  note="Above the usual range. Worth discussing with your doctor soon."
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-20">
          <h2 className="text-3xl">Three simple steps</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.title}
                className="rounded-2xl border border-border/70 bg-card p-6 transition-shadow hover:shadow-[0_20px_50px_-35px_oklch(0.4_0.06_195_/_0.8)]"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <step.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-xl">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 max-w-3xl">
            <Disclaimer />
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-10">
        <p className="mx-auto max-w-6xl px-5 text-sm text-muted-foreground">
          MediClear — clarity and confidence when you read your own results.
        </p>
      </footer>
    </div>
  );
}

function SampleRow({
  tone,
  label,
  plain,
  value,
  note,
}: {
  tone: "ok" | "watch" | "alert";
  label: string;
  plain: string;
  value: string;
  note: string;
}) {
  const surface =
    tone === "ok"
      ? "bg-ok-surface border-ok/25"
      : tone === "watch"
        ? "bg-watch-surface border-watch/30"
        : "bg-alert-surface border-alert/30";
  const dot = tone === "ok" ? "bg-ok" : tone === "watch" ? "bg-watch" : "bg-alert";

  return (
    <div className={`rounded-2xl border p-4 ${surface}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`size-2.5 rounded-full ${dot}`} aria-hidden="true" />
          <span className="font-medium">{label}</span>
        </div>
        <span className="text-sm tabular-nums">{value}</span>
      </div>
      <p className="mt-1 pl-5 text-xs text-muted-foreground">{plain}</p>
      <p className="mt-2 pl-5 text-sm leading-relaxed">{note}</p>
    </div>
  );
}
