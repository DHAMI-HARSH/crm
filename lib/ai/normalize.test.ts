import { describe, expect, it } from "vitest";
import {
  applyContactMerge,
  emptyCrmRecord,
  normalizeExtractedRecord,
  sanitizeCrmRecord,
} from "./normalize";

describe("CRM normalization", () => {
  it("blanks invalid enums and invalid created_at values", () => {
    const record = sanitizeCrmRecord({
      ...emptyCrmRecord(),
      crm_status: "MADE_UP_STATUS",
      data_source: "unknown_source",
      created_at: "not a date",
    });

    expect(record.crm_status).toBe("");
    expect(record.data_source).toBe("");
    expect(record.created_at).toBe("");
  });

  it("moves records with neither email nor phone to skipped", () => {
    const result = normalizeExtractedRecord(
      {
        ...emptyCrmRecord(),
        full_name: "No Contact",
      },
      { Name: "No Contact", Notes: "walked in but left no details" },
    );

    expect(result.skipped?.reason).toBe("Missing email and phone");
    expect(result.imported).toBeUndefined();
  });

  it("keeps first email and phone, then appends additional contacts into notes", () => {
    const record = applyContactMerge(
      {
        ...emptyCrmRecord(),
        crm_note: "Original note",
      },
      {
        Contact:
          "primary@example.com, backup@example.com, +91 98765 43210, 080-4567-1234",
      },
    );

    expect(record.email).toBe("primary@example.com");
    expect(record.mobile_without_country_code).toBe("9876543210");
    expect(record.crm_note).toContain("Original note");
    expect(record.crm_note).toContain("Additional email: backup@example.com");
    expect(record.crm_note).toContain("Additional phone: 8045671234");
  });
});
