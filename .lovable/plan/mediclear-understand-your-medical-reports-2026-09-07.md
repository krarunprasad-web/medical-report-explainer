# MediClear — Understand your medical reports

A web app where a patient uploads a lab report (PDF or photo) and gets a plain-language explanation of every value, colour-coded, plus a chat to ask follow-up questions. Warm, empathetic tone, simple wording, with a clear "this is not medical advice" note everywhere results appear.

## What people will be able to do

1. **Sign in** with email and password, so their reports stay private and saved.
2. **Upload a report** — a PDF or a phone photo of a printed report. A friendly progress state while it's read.
3. **See a results page**
   - A short, kind summary at the top ("Most of your results look healthy. Two are worth a chat with your doctor.")
   - One card per parameter: name in plain words (e.g. "Haemoglobin — the oxygen carrier in your blood"), the value, the normal range, and a green / amber / red status.
   - A short explanation of what it means for them, and a lifestyle suggestion where relevant (food, sleep, movement, hydration).
   - Grouped so the items needing attention come first.
4. **Ask about my results** — a chat panel beside the report that already knows the extracted values and answers questions in the same gentle, simple language, always steering serious concerns to a doctor.
5. **History** — a list of past reports with date and a one-line summary; open any of them again.

## Safety and tone

- Every page with results carries a visible disclaimer: educational only, not a diagnosis, not a replacement for a doctor.
- The AI is instructed to be empathetic, avoid alarming language, explain medical terms in everyday words, and never suggest medication or dosages.
- Red results always come with "please discuss this with your doctor" rather than a scary verdict.

## Build steps

1. Enable Lovable Cloud (accounts, private file storage, database).
2. Design and build the sign-in / sign-up screen, upload screen, results screen, history list, and chat panel.
3. Wire the upload → AI reading → saved results flow.
4. Wire the chat to the saved report.
5. Test with a sample report end to end.

## Technical section

**Backend:** Lovable Cloud (Supabase). Email/password auth. Private storage bucket `reports`, RLS scoped to `auth.uid()`.

Tables (all with grants + RLS, owner-only policies):
- `reports` — `id`, `user_id`, `file_path`, `original_name`, `status` (processing/ready/failed), `summary`, `created_at`
- `report_parameters` — `id`, `report_id`, `name`, `plain_name`, `value`, `unit`, `reference_range`, `status` (`green|amber|red`), `explanation`, `suggestion`, `sort_order`
- `report_messages` — `id`, `report_id`, `role`, `content`, `created_at` (chat history per report)

**AI:** Lovable AI Gateway via the AI SDK.
- Extraction: a `createServerFn` in `src/lib/reports.functions.ts`, auth-middleware protected. Reads the stored file, sends it to a multimodal model as a `file` block (PDF) or `image_url` block (photo) with the real MIME type, and uses `streamText` + `Output.object` (constraint-free schema, limits stated in the prompt, guarded with `NoObjectGeneratedError`) to return the summary and parameter rows. Persists them, sets `status`.
- Chat: streaming server route `src/routes/api/chat.ts` using `streamText` + `toUIMessageStreamResponse`, with the report's parameters injected into the system prompt and messages persisted in `onFinish`. Chat is one conversation per report (not threaded), stored in the database.
- Model chosen from the live gateway listing; OpenAI models go through the Responses API path.

**Routes:** `/` (landing + upload for signed-in users), `/auth`, `/_authenticated/reports` (history), `/_authenticated/reports/$reportId` (results + chat), `/api/chat`. Each content route gets its own `head()` metadata.

Colour statuses map to semantic design tokens in `src/styles.css`, not hardcoded colours.
