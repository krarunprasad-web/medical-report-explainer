import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ReportStatus = "processing" | "ready" | "failed";
export type ValueStatus = "green" | "amber" | "red";

const CreateInput = z.object({
  filePath: z.string().min(1),
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
});

export const createReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("reports")
      .insert({
        user_id: context.userId,
        file_path: data.filePath,
        original_name: data.originalName,
        mime_type: data.mimeType,
        status: "processing",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const listReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("reports")
      .select("id, original_name, title, summary, status, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ reportId: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: report, error } = await context.supabase
      .from("reports")
      .select("*")
      .eq("id", data.reportId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!report) throw new Error("Report not found");

    const { data: parameters, error: pErr } = await context.supabase
      .from("report_parameters")
      .select("*")
      .eq("report_id", data.reportId)
      .order("sort_order", { ascending: true });
    if (pErr) throw new Error(pErr.message);

    const { data: messages, error: mErr } = await context.supabase
      .from("report_messages")
      .select("id, role, content, created_at")
      .eq("report_id", data.reportId)
      .order("created_at", { ascending: true });
    if (mErr) throw new Error(mErr.message);

    return { report, parameters: parameters ?? [], messages: messages ?? [] };
  });

export const deleteReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ reportId: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("reports").delete().eq("id", data.reportId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ExtractionSchema = z.object({
  title: z.string(),
  summary: z.string(),
  parameters: z.array(
    z.object({
      name: z.string(),
      plain_name: z.string(),
      value: z.string(),
      unit: z.string().nullable(),
      reference_range: z.string().nullable(),
      status: z.enum(["green", "amber", "red"]),
      explanation: z.string(),
      suggestion: z.string().nullable(),
    }),
  ),
});

export const analyzeReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ reportId: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { streamText, Output, NoObjectGeneratedError } = await import("ai");
    const { createGateway, MEDICLEAR_MODEL, CARE_TONE } = await import("./ai-gateway.server");

    const { data: report, error } = await context.supabase
      .from("reports")
      .select("id, file_path, mime_type, original_name")
      .eq("id", data.reportId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!report) throw new Error("Report not found");

    const fail = async (message: string) => {
      await context.supabase
        .from("reports")
        .update({ status: "failed", error_message: message })
        .eq("id", data.reportId);
      return { status: "failed" as const, message };
    };

    const { data: file, error: dlErr } = await context.supabase.storage
      .from("reports")
      .download(report.file_path as string);
    if (dlErr || !file) return fail("We couldn't open that file. Please try uploading it again.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength === 0) return fail("That file looked empty. Please try another copy.");

    const mimeType = (report.mime_type as string) || "application/pdf";
    const isPdf = mimeType.includes("pdf");

    const { provider } = createGateway();

    const prompt = `Read this medical lab report and explain it for the patient who owns it.

Return:
- title: a short friendly name for the report, for example "Complete Blood Count, 12 March".
- summary: two or three warm sentences saying overall how things look and whether anything deserves a chat with their doctor. Keep it under 60 words.
- parameters: one entry for every measured value you can find, in the order they appear.
  - name: the exact label printed on the report.
  - plain_name: the same thing in everyday words, e.g. "Haemoglobin - the oxygen carrier in your blood".
  - value: the measured value as printed.
  - unit: the unit, or null.
  - reference_range: the normal range printed on the report, or null.
  - status: "green" if comfortably within range, "amber" if slightly outside or borderline, "red" if clearly outside the range.
  - explanation: 1-2 short sentences in plain, kind language about what this value means for them.
  - suggestion: one gentle, safe lifestyle suggestion (food, water, sleep, movement, stress, or follow-up with their doctor), or null if nothing useful applies. For anything amber or red always encourage discussing it with their doctor.

If the file is not a medical report, return an empty parameters list and say so kindly in the summary.`;

    try {
      const result = streamText({
        model: provider.responses(MEDICLEAR_MODEL),
        system: CARE_TONE,
        output: Output.object({ schema: ExtractionSchema }),
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              isPdf
                ? {
                    type: "file" as const,
                    data: bytes,
                    mediaType: mimeType,
                    filename: (report.original_name as string) || "report.pdf",
                  }
                : { type: "image" as const, image: bytes, mediaType: mimeType },
            ],
          },
        ],
      });

      const output = await result.output;

      const parameters = output.parameters.slice(0, 80).map((p, index) => ({
        report_id: data.reportId,
        user_id: context.userId,
        name: p.name.slice(0, 200),
        plain_name: p.plain_name?.slice(0, 300) ?? null,
        value: p.value?.slice(0, 100) ?? null,
        unit: p.unit?.slice(0, 50) ?? null,
        reference_range: p.reference_range?.slice(0, 120) ?? null,
        status: p.status,
        explanation: p.explanation ?? null,
        suggestion: p.suggestion ?? null,
        sort_order: index,
      }));

      await context.supabase.from("report_parameters").delete().eq("report_id", data.reportId);
      if (parameters.length > 0) {
        const { error: insErr } = await context.supabase
          .from("report_parameters")
          .insert(parameters);
        if (insErr) return fail(insErr.message);
      }

      await context.supabase
        .from("reports")
        .update({
          status: "ready",
          title: output.title.slice(0, 200),
          summary: output.summary,
          error_message: null,
        })
        .eq("id", data.reportId);

      return { status: "ready" as const };
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        return fail("We couldn't read the values in that report. A clearer scan usually helps.");
      }
      const message = err instanceof Error ? err.message : "Something went wrong reading the report.";
      console.error("analyzeReport failed", err);
      return fail(message.slice(0, 300));
    }
  });
