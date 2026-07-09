import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { z } from "zod";
import {
  aiBatchOutputSchema,
  crmToolJsonSchema,
  envSchema,
} from "@/lib/ai/schema";
import { normalizeExtractedRecord } from "@/lib/ai/normalize";
import {
  CRM_STATUSES,
  DATA_SOURCES,
  type CsvRow,
  type ImportResponse,
} from "@/types/crm";

export const IMPORT_BATCH_SIZE = 20;
const RETRY_DELAYS_MS = [500, 1500] as const;

type BatchResult = Pick<ImportResponse, "imported" | "skipped">;

export async function extractCrmRecords(rows: CsvRow[]): Promise<ImportResponse> {
  const env = envSchema.parse(process.env);
  const client = new OpenAI({
    apiKey: env.NVIDIA_API_KEY,
    baseURL: env.NVIDIA_BASE_URL,
  });

  const batches = chunk(rows, IMPORT_BATCH_SIZE);
  const settled = await Promise.allSettled(
    batches.map((batch, batchIndex) =>
      processBatchWithRetry(client, env.AI_MODEL, batch, batchIndex),
    ),
  );

  const imported = settled.flatMap((result, batchIndex) => {
    if (result.status === "fulfilled") {
      return result.value.imported;
    }

    console.error(`Import batch ${batchIndex + 1} failed unexpectedly`, result.reason);
    return [];
  });

  const skipped = settled.flatMap((result, batchIndex) => {
    if (result.status === "fulfilled") {
      return result.value.skipped;
    }

    return batches[batchIndex].map((row) => ({
      row,
      reason: "AI processing failed after retries",
    }));
  });

  return {
    imported,
    skipped,
    totalImported: imported.length,
    totalSkipped: skipped.length,
  };
}

async function processBatchWithRetry(
  client: OpenAI,
  model: string,
  batch: CsvRow[],
  batchIndex: number,
): Promise<BatchResult> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await processBatch(client, model, batch, batchIndex);
    } catch (error) {
      if (attempt === RETRY_DELAYS_MS.length) {
        console.error(`Batch ${batchIndex + 1} failed after retries`, error);
        return {
          imported: [],
          skipped: batch.map((row) => ({
            row,
            reason: "AI processing failed after retries",
          })),
        };
      }

      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  return { imported: [], skipped: [] };
}

async function processBatch(
  client: OpenAI,
  model: string,
  batch: CsvRow[],
  batchIndex: number,
): Promise<BatchResult> {
  const messages = buildMessages(batch);
  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: 0,
    tools: [
      {
        type: "function",
        function: {
          name: "submit_crm_records",
          description:
            "Submit normalized CRM records extracted from arbitrary CSV rows.",
          parameters: crmToolJsonSchema,
        },
      },
    ],
    tool_choice: {
      type: "function",
      function: { name: "submit_crm_records" },
    },
  });

  const message = response.choices[0]?.message;
  const toolCall = message?.tool_calls?.find(
    (call) => call.type === "function",
  );
  const rawPayload =
    toolCall?.type === "function"
      ? toolCall.function.arguments
      : message?.content ?? "";

  logMaskedRawResponse(batchIndex, rawPayload);

  let parsed = parseAiPayload(rawPayload);

  if (!parsed.success) {
    const fallback = await client.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        ...messages,
        {
          role: "user",
          content:
            "The previous response was not valid. Respond with ONLY a JSON object matching {\"records\":[...]}. No prose and no markdown fences.",
        },
      ],
    });
    const fallbackRaw = fallback.choices[0]?.message.content ?? "";
    logMaskedRawResponse(batchIndex, fallbackRaw);
    parsed = parseAiPayload(fallbackRaw);
  }

  if (!parsed.success) {
    throw new Error(parsed.error);
  }

  const imported: BatchResult["imported"] = [];
  const skipped: BatchResult["skipped"] = [];

  for (const item of parsed.records) {
    const row = batch[item.source_row_index];
    if (!row) {
      continue;
    }

    if (!item.record) {
      skipped.push({
        row,
        reason: item.skip_reason || "AI skipped row",
      });
      continue;
    }

    const normalized = normalizeExtractedRecord(item.record, row);
    if (normalized.imported) {
      imported.push(normalized.imported);
    } else {
      skipped.push(normalized.skipped);
    }
  }

  const returnedIndexes = new Set(parsed.records.map((item) => item.source_row_index));
  batch.forEach((row, index) => {
    if (!returnedIndexes.has(index)) {
      skipped.push({ row, reason: "AI did not return this row" });
    }
  });

  return { imported, skipped };
}

function buildMessages(batch: CsvRow[]): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: [
        "You extract lead records from messy CSV exports into the GrowEasy CRM schema.",
        "The source CSV can have arbitrary and inconsistent column names from Facebook Lead Export, Google Ads, real estate CRMs, and manual spreadsheets.",
        "Infer intent from headers, sample values, and surrounding context: Contact No, Ph., Phone, Mobile, WhatsApp map to mobile_without_country_code; Locality, Area, Location map to city; campaign/adset/source columns can map to lead_source_campaign or data_source when clearly known.",
        `crm_status enum values are: ${CRM_STATUSES.join(", ")}. Leave crm_status blank when uncertain.`,
        `data_source enum values are: ${DATA_SOURCES.join(", ")}. Leave data_source blank when uncertain.`,
        "Notes, extra identifiers, ambiguous free text, original row IDs, and anything that does not fit a named field must go into crm_note, not be discarded.",
        "Keep each record on a single CSV row. Do not emit raw line breaks inside field values; if a line break is needed in crm_note, escape it as \\n.",
        "If a row has neither an email nor a phone number, return record as null and provide a concise skip_reason.",
        "Use the first email and the first phone number you find. Put any remaining emails or phone numbers into crm_note.",
        "If multiple emails or phones appear, use the first obvious one in the primary field and note the rest in crm_note. The server will re-check this.",
        "Do not invent enum values, dates, names, sources, phone numbers, or emails.",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        instructions:
          "Return one item for every source row by source_row_index. Keep strings concise and preserve original useful details in crm_note.",
        rows: batch.map((row, source_row_index) => ({ source_row_index, row })),
      }),
    },
  ];
}

function parseAiPayload(raw: string):
  | { success: true; records: z.infer<typeof aiBatchOutputSchema>["records"] }
  | { success: false; error: string } {
  try {
    const cleaned = stripJsonFences(raw);
    const parsedUnknown: unknown = JSON.parse(cleaned);
    const parsed =
      Array.isArray(parsedUnknown)
        ? aiBatchOutputSchema.parse({ records: parsedUnknown })
        : aiBatchOutputSchema.parse(parsedUnknown);
    return { success: true, records: parsed.records };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid AI JSON",
    };
  }
}

function stripJsonFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
}

function logMaskedRawResponse(batchIndex: number, raw: string): void {
  const masked = raw
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone]")
    .slice(0, 1200);
  console.info(`AI batch ${batchIndex + 1} raw response: ${masked}`);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
