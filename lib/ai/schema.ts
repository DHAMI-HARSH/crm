import { z } from "zod";
import { CRM_STATUSES, DATA_SOURCES } from "@/types/crm";

export const crmStatusSchema = z.enum(CRM_STATUSES);
export const dataSourceSchema = z.enum(DATA_SOURCES);

export const crmRecordSchema = z.object({
  full_name: z.string().catch(""),
  email: z.string().catch(""),
  mobile_without_country_code: z.string().catch(""),
  city: z.string().catch(""),
  crm_status: z.union([crmStatusSchema, z.literal("")]).catch(""),
  data_source: z.union([dataSourceSchema, z.literal("")]).catch(""),
  created_at: z.string().catch(""),
  crm_note: z.string().catch(""),
  project_name: z.string().catch(""),
  property_type: z.string().catch(""),
  budget: z.string().catch(""),
  lead_source_campaign: z.string().catch(""),
  country_code: z.string().catch(""),
  assigned_to: z.string().catch(""),
});

export const aiCrmRecordSchema = z.object({
  source_row_index: z.number().int().nonnegative(),
  record: crmRecordSchema.nullable().optional(),
  skip_reason: z.string().optional(),
});

export const aiBatchOutputSchema = z.object({
  records: z.array(aiCrmRecordSchema),
});

export const importRequestSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(5000),
});

export const envSchema = z.object({
  NVIDIA_API_KEY: z.string().min(1, "NVIDIA_API_KEY is required"),
  NVIDIA_BASE_URL: z
    .string()
    .url()
    .default("https://integrate.api.nvidia.com/v1"),
  AI_MODEL: z.string().min(1).default("nvidia/llama-3.3-nemotron-super-49b-v1"),
});

export const crmToolJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    records: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          source_row_index: { type: "integer", minimum: 0 },
          skip_reason: { type: "string" },
          record: {
            anyOf: [
              { type: "null" },
              {
                type: "object",
                additionalProperties: false,
                properties: {
                  full_name: { type: "string" },
                  email: { type: "string" },
                  mobile_without_country_code: { type: "string" },
                  city: { type: "string" },
                  crm_status: {
                    type: "string",
                    enum: [...CRM_STATUSES, ""],
                  },
                  data_source: {
                    type: "string",
                    enum: [...DATA_SOURCES, ""],
                  },
                  created_at: { type: "string" },
                  crm_note: { type: "string" },
                  project_name: { type: "string" },
                  property_type: { type: "string" },
                  budget: { type: "string" },
                  lead_source_campaign: { type: "string" },
                  country_code: { type: "string" },
                  assigned_to: { type: "string" },
                },
                required: [
                  "full_name",
                  "email",
                  "mobile_without_country_code",
                  "city",
                  "crm_status",
                  "data_source",
                  "created_at",
                  "crm_note",
                  "project_name",
                  "property_type",
                  "budget",
                  "lead_source_campaign",
                  "country_code",
                  "assigned_to",
                ],
              },
            ],
          },
        },
        required: ["source_row_index", "record"],
      },
    },
  },
  required: ["records"],
} as const;
