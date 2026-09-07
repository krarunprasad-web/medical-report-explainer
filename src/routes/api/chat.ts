import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  CARE_TONE,
  MEDICLEAR_MODEL,
  createGateway,
  getLovableAiGatewayResponseHeaders,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai-gateway.server";

function textOf(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabaseUrl = process.env["SUPABASE_URL"];
        const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!supabaseUrl || !publishableKey) {
          return new Response("Backend not configured", { status: 500 });
        }

        const supabase = createClient<Database>(supabaseUrl, publishableKey, {
          global: {
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              if (headers.get("Authorization") === `Bearer ${publishableKey}`) {
                headers.delete("Authorization");
              }
              headers.set("apikey", publishableKey);
              headers.set("Authorization", `Bearer ${token}`);
              return fetch(input, { ...init, headers });
            },
          },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
        const userId = claimsData?.claims?.sub;
        if (claimsError || !userId) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as { messages?: UIMessage[]; reportId?: string };
        const messages = body.messages;
        const reportId = body.reportId;
        if (!Array.isArray(messages) || !reportId) {
          return new Response("Bad request", { status: 400 });
        }

        const { data: report } = await supabase
          .from("reports")
          .select("id, title, summary")
          .eq("id", reportId)
          .maybeSingle();
        if (!report) return new Response("Report not found", { status: 404 });

        const { data: parameters } = await supabase
          .from("report_parameters")
          .select("name, plain_name, value, unit, reference_range, status, explanation")
          .eq("report_id", reportId)
          .order("sort_order", { ascending: true });

        const context = (parameters ?? [])
          .map(
            (p) =>
              `- ${p.name} (${p.plain_name ?? "—"}): ${p.value ?? "?"}${p.unit ? " " + p.unit : ""}; normal range: ${p.reference_range ?? "not printed"}; status: ${p.status}. ${p.explanation ?? ""}`,
          )
          .join("\n");

        const system = `${CARE_TONE}

You are answering questions about this specific report the person uploaded.

Report: ${report.title ?? "Lab report"}
Overall summary: ${report.summary ?? "not available"}

Their measured values:
${context || "No values were extracted from this report."}

Answer only from these values and general health knowledge. Keep answers short — a few sentences — unless they ask for detail. If something is worrying or outside the range, warmly encourage them to speak with their doctor.`;

        const last = messages[messages.length - 1];
        if (last && last.role === "user") {
          const content = textOf(last);
          if (content) {
            await supabase
              .from("report_messages")
              .insert({ report_id: reportId, user_id: userId, role: "user", content });
          }
        }

        const initialRunId = getLovableAiGatewayRunId(request);
        const { provider, runIdFetch } = createGateway(initialRunId);

        const result = streamText({
          model: provider.responses(MEDICLEAR_MODEL),
          system,
          messages: await convertToModelMessages(messages),
          abortSignal: request.signal,
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        const response = result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ responseMessage }) => {
            const content = textOf(responseMessage);
            if (!content) return;
            const { error } = await supabase
              .from("report_messages")
              .insert({ report_id: reportId, user_id: userId, role: "assistant", content });
            if (error) console.error("Failed to save assistant message", error.message);
          },
          headers: getLovableAiGatewayResponseHeaders(undefined, {
            ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}),
          }),
        });

        return withLovableAiGatewayRunIdHeader(response, runIdFetch);
      },
    },
  },
});
