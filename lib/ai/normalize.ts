import {
  CRM_STATUSES,
  DATA_SOURCES,
  type CrmStatus,
  type CrmRecord,
  type CsvRow,
  type DataSource,
  type SkippedRecord,
} from "@/types/crm";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN =
  /(?:\+?\d[\d\s().-]{7,}\d)/g;

export type NormalizedRecordResult =
  | { imported: CrmRecord; skipped?: never }
  | { imported?: never; skipped: SkippedRecord };

export function sanitizeCrmRecord(record: CrmRecord): CrmRecord {
  return {
    ...record,
    crm_status: isCrmStatus(record.crm_status)
      ? record.crm_status
      : "",
    data_source: isDataSource(record.data_source)
      ? record.data_source
      : "",
    created_at: isValidDate(record.created_at) ? record.created_at : "",
    email: record.email.trim(),
    mobile_without_country_code: normalizePhone(record.mobile_without_country_code),
    crm_note: escapeNewlines(record.crm_note.trim()),
  };
}

export function applyContactMerge(record: CrmRecord, row: CsvRow): CrmRecord {
  const rowText = Object.values(row).map(stringifyCell).join(" ");
  const emails = unique(rowText.match(EMAIL_PATTERN) ?? []);
  const phones = unique(
    (rowText.match(PHONE_PATTERN) ?? [])
      .map(normalizePhone)
      .filter((phone) => phone.length >= 7),
  );

  const primaryEmail = emails[0] ?? record.email;
  const primaryPhone = phones[0] ?? record.mobile_without_country_code;
  const additions: string[] = [];

  for (const email of emails.slice(1)) {
    additions.push(`Additional email: ${email}`);
  }

  for (const phone of phones.slice(1)) {
    additions.push(`Additional phone: ${phone}`);
  }

  return {
    ...record,
    email: primaryEmail,
    mobile_without_country_code: primaryPhone,
    crm_note: escapeNewlines(joinNotes(record.crm_note, additions)),
  };
}

export function normalizeExtractedRecord(
  record: CrmRecord,
  row: CsvRow,
): NormalizedRecordResult {
  const withContacts = applyContactMerge(sanitizeCrmRecord(record), row);

  if (!withContacts.email && !withContacts.mobile_without_country_code) {
    return {
      skipped: {
        row,
        reason: "Missing email and phone",
      },
    };
  }

  return { imported: withContacts };
}

export function emptyCrmRecord(): CrmRecord {
  return {
    full_name: "",
    email: "",
    mobile_without_country_code: "",
    city: "",
    crm_status: "",
    data_source: "",
    created_at: "",
    crm_note: "",
    project_name: "",
    property_type: "",
    budget: "",
    lead_source_campaign: "",
    country_code: "",
    assigned_to: "",
  };
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length > 10) {
    return digits.slice(-10);
  }

  return digits;
}

function joinNotes(existing: string, additions: string[]): string {
  const cleanAdditions = additions.filter(Boolean);
  if (cleanAdditions.length === 0) {
    return existing;
  }

  return [existing, ...cleanAdditions].filter(Boolean).join(" | ");
}

function isValidDate(value: string): boolean {
  if (!value.trim()) {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
}

function isCrmStatus(value: string): value is CrmStatus {
  return CRM_STATUSES.some((status) => status === value);
}

function isDataSource(value: string): value is DataSource {
  return DATA_SOURCES.some((source) => source === value);
}

function escapeNewlines(value: string): string {
  return value.replace(/\r\n|\r|\n/g, "\\n");
}
