"use client";

import type { CsvRow } from "@/types/crm";

type PreviewTableProps = {
  rows: CsvRow[];
  fields: string[];
};

export function PreviewTable({ rows, fields }: PreviewTableProps) {
  if (rows.length === 0) {
    return (
      <div className="border border-[var(--line)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
        No rows detected in this file.
      </div>
    );
  }

  return (
    <div className="border border-[var(--line-strong)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-[0.12em]">
          Preview
        </h2>
        <p className="font-mono text-xs text-[var(--muted)]">
          {rows.length} rows / {fields.length} columns
        </p>
      </div>
      <div className="max-h-[55vh] overflow-auto">
        <table className="min-w-full border-separate border-spacing-0 font-mono text-xs">
          <thead className="sticky top-0 z-10 bg-[var(--table-head)]">
            <tr>
              <th className="border-b-2 border-r border-[var(--line-strong)] px-3 py-2 text-left font-semibold">
                #
              </th>
              {fields.map((field) => (
                <th
                  key={field}
                  className="whitespace-nowrap border-b-2 border-r border-[var(--line-strong)] px-3 py-2 text-left font-semibold"
                >
                  {field || "(blank header)"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="odd:bg-[var(--stripe)]">
                <td className="border-b border-r border-[var(--line)] px-3 py-2 text-[var(--muted)]">
                  {rowIndex + 1}
                </td>
                {fields.map((field) => (
                  <td
                    key={`${rowIndex}-${field}`}
                    className="max-w-72 whitespace-nowrap border-b border-r border-[var(--line)] px-3 py-2"
                    title={formatCell(row[field])}
                  >
                    <span className="block overflow-hidden text-ellipsis">
                      {formatCell(row[field]) || "-"}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}
