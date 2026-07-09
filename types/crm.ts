export const CRM_STATUSES = [
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE",
] as const;

export const DATA_SOURCES = [
  "leads_on_demand",
  "meridian_tower",
  "eden_park",
  "varah_swamy",
  "sarjapur_plots",
] as const;

export type CrmStatus = (typeof CRM_STATUSES)[number];
export type DataSource = (typeof DATA_SOURCES)[number];

export type CsvRow = Record<string, unknown>;

export type CrmRecord = {
  full_name: string;
  email: string;
  mobile_without_country_code: string;
  city: string;
  crm_status: CrmStatus | "";
  data_source: DataSource | "";
  created_at: string;
  crm_note: string;
  project_name: string;
  property_type: string;
  budget: string;
  lead_source_campaign: string;
  country_code: string;
  assigned_to: string;
};

export type SkippedRecord = {
  row: CsvRow;
  reason: string;
};

export type ImportResponse = {
  imported: CrmRecord[];
  skipped: SkippedRecord[];
  totalImported: number;
  totalSkipped: number;
};
