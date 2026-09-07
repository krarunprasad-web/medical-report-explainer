import { ShieldCheck } from "lucide-react";

export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p
      className={`flex items-start gap-2 rounded-xl bg-muted/70 px-4 py-3 text-xs leading-relaxed text-muted-foreground ${className}`}
    >
      <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        This is a plain-language explanation to help you understand your report. It is not a
        diagnosis and it does not replace your doctor. Please talk to a qualified doctor about
        anything that concerns you.
      </span>
    </p>
  );
}
