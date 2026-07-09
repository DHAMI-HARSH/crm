# GrowEasy CRM CSV Importer

AI-powered CSV importer for messy real estate lead exports. The app parses a CSV in the browser, shows a preview without calling AI, then sends confirmed rows to a Next.js route handler. The server batches rows, asks an OpenAI-compatible NVIDIA NIM model to map arbitrary CSV columns into the GrowEasy CRM schema, validates the result, and returns imported and skipped rows.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment

- `NVIDIA_API_KEY`: API key from NVIDIA NIM at `build.nvidia.com`.
- `NVIDIA_BASE_URL`: OpenAI-compatible endpoint. Defaults to `https://integrate.api.nvidia.com/v1`.
- `AI_MODEL`: NVIDIA model with tool/function calling support. Defaults to `nvidia/llama-3.3-nemotron-super-49b-v1`.

## Commands

```bash
npm run dev
npm run build
npm start
npm test
npm run lint
```

## Docker

```bash
docker compose up --build
```

The container builds with `npm run build` and runs with `npm start` on port `3000`.

## User Flow

1. The user drops a `.csv` file into the browser UI.
2. The browser validates the file type and 10 MB size limit.
3. Papa Parse reads the CSV with headers, trims header names, keeps values as strings, and skips empty lines.
4. The user reviews the raw parsed rows in the preview table.
5. AI extraction starts only after the user clicks `Confirm Import`.
6. The client posts `{ "rows": [...] }` to `POST /api/import`.
7. The server validates the request, checks environment variables, and passes the rows to the AI extraction pipeline.
8. The UI shows imported CRM records and skipped source rows.

## CRM Output Schema

Each imported record is normalized into this CRM shape:

```ts
{
  full_name: string;
  email: string;
  mobile_without_country_code: string;
  city: string;
  crm_status: "GOOD_LEAD_FOLLOW_UP" | "DID_NOT_CONNECT" | "BAD_LEAD" | "SALE_DONE" | "";
  data_source: "leads_on_demand" | "meridian_tower" | "eden_park" | "varah_swamy" | "sarjapur_plots" | "";
  created_at: string;
  crm_note: string;
  project_name: string;
  property_type: string;
  budget: string;
  lead_source_campaign: string;
  country_code: string;
  assigned_to: string;
}
```

Rows that cannot become CRM records are returned as:

```ts
{
  row: Record<string, unknown>;
  reason: string;
}
```

## AI Pipeline Structure

The AI pipeline lives in `lib/ai/extract.ts`.

- `extractCrmRecords(rows)`: reads environment configuration, creates the OpenAI-compatible NVIDIA client, splits rows into batches of 20, and processes batches concurrently.
- `processBatchWithRetry(...)`: retries failed AI batches after 500 ms and 1500 ms delays.
- `processBatch(...)`: sends the prompt and function tool schema, parses the model response, retries once with a JSON-only fallback if needed, then normalizes each returned record.
- `buildMessages(batch)`: builds the system prompt and user payload sent to the model.
- `parseAiPayload(raw)`: strips JSON markdown fences, parses JSON, and validates it with Zod.
- `normalizeExtractedRecord(record, row)`: deterministically re-checks enums, dates, emails, phone numbers, and required contact availability.

The API route is `app/api/import/route.ts`. It runs on the Node.js runtime because the OpenAI client and server-side environment variables are used there.

## Full AI System Prompt

The system prompt is assembled in `buildMessages` and sent as a newline-joined string:

```text
You extract lead records from messy CSV exports into the GrowEasy CRM schema.
The source CSV can have arbitrary and inconsistent column names from Facebook Lead Export, Google Ads, real estate CRMs, and manual spreadsheets.
Infer intent from headers, sample values, and surrounding context: Contact No, Ph., Phone, Mobile, WhatsApp map to mobile_without_country_code; Locality, Area, Location map to city; campaign/adset/source columns can map to lead_source_campaign or data_source when clearly known.
crm_status enum values are: GOOD_LEAD_FOLLOW_UP, DID_NOT_CONNECT, BAD_LEAD, SALE_DONE. Leave crm_status blank when uncertain.
data_source enum values are: leads_on_demand, meridian_tower, eden_park, varah_swamy, sarjapur_plots. Leave data_source blank when uncertain.
Notes, extra identifiers, ambiguous free text, original row IDs, and anything that does not fit a named field must go into crm_note, not be discarded.
Keep each record on a single CSV row. Do not emit raw line breaks inside field values; if a line break is needed in crm_note, escape it as \n.
If a row has neither an email nor a phone number, return record as null and provide a concise skip_reason.
Use the first email and the first phone number you find. Put any remaining emails or phone numbers into crm_note.
If multiple emails or phones appear, use the first obvious one in the primary field and note the rest in crm_note. The server will re-check this.
Do not invent enum values, dates, names, sources, phone numbers, or emails.
```

## AI User Payload

For every batch, the user message is JSON. It asks the model to return one item per source row and includes the original row object:

```json
{
  "instructions": "Return one item for every source row by source_row_index. Keep strings concise and preserve original useful details in crm_note.",
  "rows": [
    {
      "source_row_index": 0,
      "row": {
        "Name": "Anika Rao",
        "Contact No": "+91 98765 43210",
        "Email": "anika@example.com",
        "Locality": "Sarjapur"
      }
    }
  ]
}
```

`source_row_index` is batch-local. The server uses it to match each AI result back to the original row in that batch.

## AI Tool Call Contract

The first AI request forces a function/tool call named `submit_crm_records`.

```ts
{
  name: "submit_crm_records",
  description: "Submit normalized CRM records extracted from arbitrary CSV rows.",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["records"],
    properties: {
      records: [
        {
          source_row_index: number;
          record: CrmRecord | null;
          skip_reason?: string;
        }
      ]
    }
  }
}
```

The model must return a `records` array. Each item must include:

- `source_row_index`: the original index from the batch payload.
- `record`: a full CRM record object, or `null` when the row should be skipped.
- `skip_reason`: optional explanation, mainly used when `record` is `null`.

If the tool-call arguments are missing or invalid, the server sends a fallback request:

```text
The previous response was not valid. Respond with ONLY a JSON object matching {"records":[...]}. No prose and no markdown fences.
```

## Deterministic Safeguards

The AI output is not trusted directly. The server applies these checks after the model responds:

- Zod validates the overall response shape and all CRM fields.
- Unknown `crm_status` and `data_source` values are replaced with blank strings.
- Invalid `created_at` values are replaced with a blank string.
- Phone numbers are normalized to digits only; if more than 10 digits are found, the last 10 digits are kept.
- The first detected email and phone from the original row win over the model output.
- Extra emails and phone numbers are appended to `crm_note`.
- Raw newlines in `crm_note` are escaped as `\n`.
- Rows without both email and phone are skipped.
- Rows omitted by the AI response are skipped with `AI did not return this row`.
- Failed batches are retried twice; if they still fail, every row in that batch is skipped with `AI processing failed after retries`.

AI raw responses are logged for debugging, but emails and phone numbers are masked before logging.

## Project Structure

```text
app/
  api/import/route.ts      Server route that validates import requests and runs AI extraction.
  layout.tsx               Root layout.
  page.tsx                 Main upload, preview, confirm, and result workflow.
components/
  dropzone.tsx             CSV drag-and-drop input.
  preview-table.tsx        Raw CSV preview table.
  progress-indicator.tsx   Batch progress UI.
  result-table.tsx         Imported/skipped result display.
  theme-toggle.tsx         Theme control.
lib/
  ai/
    extract.ts             NVIDIA/OpenAI-compatible prompt, tool call, retry, and parsing logic.
    normalize.ts           Deterministic CRM cleanup and contact merging.
    normalize.test.ts      Unit tests for normalization.
    schema.ts              Zod schemas, environment schema, and AI tool JSON schema.
  csv/
    export.ts              Result export helpers.
    parse.ts               Browser CSV parsing with Papa Parse.
    validate.ts            CSV file validation.
types/
  crm.ts                   Shared CRM enums and TypeScript types.
```

## Messy CSV Smoke Sample

Use a sample like this to exercise the full flow:

```csv
Name,Contact No,Email,Locality,Campaign,Notes
Anika Rao,"+91 98765 43210 / 080-4567-1234","anika@example.com; alt@example.com",Sarjapur,FB July,"Looking for 2BHK"
Missing Person,,,Unknown,,No contact details
R. Menon,9988776655,,Whitefield,Google Search,"Asked about Eden Park"
```

With valid NVIDIA credentials, the first and third rows should import, and the second should be skipped for missing email and phone.
