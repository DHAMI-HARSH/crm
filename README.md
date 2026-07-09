# GrowEasy CRM CSV Importer

AI-powered CSV importer for messy real estate lead exports. The app parses a CSV in the browser, previews it without an AI call, then sends confirmed rows to a Next.js route handler that batches rows and asks NVIDIA NIM to normalize them into the GrowEasy CRM schema.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`.

## Environment

- `NVIDIA_API_KEY`: API key from NVIDIA NIM at build.nvidia.com.
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

## Prompt Design

The extraction prompt tells the model that headers are arbitrary and may come from Facebook, Google Ads, real estate CRMs, or hand-written spreadsheets. It gives concrete mapping hints such as `Contact No`/`Ph.` to `mobile_without_country_code` and `Locality`/`Area` to `city`, includes the allowed `crm_status` and `data_source` enum values, and instructs the model to leave uncertain enum fields blank. Extra IDs, notes, campaign fragments, and ambiguous text are preserved in `crm_note`.

The server first requests a structured `submit_crm_records` tool call. If the model does not return valid tool-call JSON, it retries with a strict JSON-only fallback prompt. Every response is Zod-validated, enums and dates are re-checked in deterministic code, rows without both email and phone are skipped, and extra emails/phones are merged into notes.

## Messy CSV Smoke Sample

Use a sample like this to exercise the full flow:

```csv
Name,Contact No,Email,Locality,Campaign,Notes
Anika Rao,"+91 98765 43210 / 080-4567-1234","anika@example.com; alt@example.com",Sarjapur,FB July,"Looking for 2BHK"
Missing Person,,,Unknown,,No contact details
R. Menon,9988776655,,Whitefield,Google Search,"Asked about Eden Park"
```

With valid NVIDIA credentials, the first and third rows should import, and the second should be skipped for missing email and phone.
