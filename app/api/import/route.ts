import { extractCrmRecords } from "@/lib/ai/extract";
import { envSchema, importRequestSchema } from "@/lib/ai/schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = importRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid import request.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const env = envSchema.safeParse(process.env);
    if (!env.success) {
      return Response.json(
        {
          error: "Importer is not configured.",
          details: env.error.flatten().fieldErrors,
        },
        { status: 500 },
      );
    }

    const result = await extractCrmRecords(parsed.data.rows);
    return Response.json(result);
  } catch (error) {
    console.error("Import route failed", error);
    return Response.json(
      {
        error: "Import failed.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
