"use client";

import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { buildCrmCsv, downloadCsvFile, makeExportFileName } from "@/lib/csv/export";
import type { CrmRecord, ImportResponse } from "@/types/crm";

const RESULT_COLUMNS: Array<keyof CrmRecord> = [
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
];

type ResultTableProps = {
  result: ImportResponse;
  sourceFileName: string;
};

export function ResultTable({ result, sourceFileName }: ResultTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [skippedOpen, setSkippedOpen] = useState(false);
  // TanStack Virtual is the required virtualization layer for this table.
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: result.imported.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 42,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows[0]?.start ?? 0;
  const paddingBottom =
    totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0);

  const skippedLabel = useMemo(
    () => `${result.totalSkipped} rows skipped`,
    [result.totalSkipped],
  );

  function handleExport() {
    if (result.imported.length === 0) {
      return;
    }

    const csv = buildCrmCsv(result.imported);
    downloadCsvFile(csv, makeExportFileName(sourceFileName));
  }

  return (
    <section className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Metric label="Imported" value={result.totalImported} />
        <Metric label="Skipped" value={result.totalSkipped} />
      </div>

      <div className="border border-[var(--line-strong)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <div>
            <h2 className="font-mono text-sm font-semibold uppercase tracking-[0.12em]">
              CRM Records
            </h2>
            <p className="mt-1 font-mono text-xs text-[var(--muted)]">
              virtualized table
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={result.imported.length === 0}
            className="border border-[var(--line-strong)] bg-[var(--surface-raised)] px-3 py-2 font-mono text-xs font-semibold text-[var(--ink)] outline-none transition-colors hover:bg-[var(--accent-soft)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:border-[var(--line)] disabled:bg-[var(--disabled)] disabled:text-[var(--muted)]"
          >
            Export Modified CSV
          </button>
        </div>
        <div ref={parentRef} className="max-h-[55vh] overflow-auto">
          <table className="min-w-full border-separate border-spacing-0 font-mono text-xs">
            <thead className="sticky top-0 z-10 bg-[var(--table-head)]">
              <tr>
                {RESULT_COLUMNS.map((column) => (
                  <th
                    key={column}
                    className="whitespace-nowrap border-b-2 border-r border-[var(--line-strong)] px-3 py-2 text-left font-semibold"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paddingTop > 0 ? (
                <tr>
                  <td style={{ height: paddingTop }} />
                </tr>
              ) : null}
              {virtualRows.map((virtualRow) => {
                const record = result.imported[virtualRow.index];
                return (
                  <tr key={virtualRow.key} className="odd:bg-[var(--stripe)]">
                    {RESULT_COLUMNS.map((column) => (
                      <td
                        key={`${virtualRow.key}-${column}`}
                        className="max-w-72 whitespace-nowrap border-b border-r border-[var(--line)] px-3 py-2"
                      title={String(record[column])}
                    >
                        <span className="block overflow-hidden text-ellipsis">
                          {record[column] || "-"}
                        </span>
                      </td>
                    ))}
                  </tr>
                );
              })}
              {paddingBottom > 0 ? (
                <tr>
                  <td style={{ height: paddingBottom }} />
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-[var(--line-strong)] bg-[var(--surface)]">
        <button
          type="button"
          onClick={() => setSkippedOpen((open) => !open)}
          className="flex w-full items-center justify-between px-4 py-3 text-left font-mono text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
          aria-expanded={skippedOpen}
        >
          <span>{skippedLabel}</span>
          <span>{skippedOpen ? "collapse" : "expand"}</span>
        </button>
        {skippedOpen ? (
          <div className="max-h-72 overflow-auto border-t border-[var(--line)]">
            {result.skipped.length === 0 ? (
              <p className="p-4 text-sm text-[var(--muted)]">No skipped rows.</p>
            ) : (
              result.skipped.map((item, index) => (
                <div
                  key={index}
                  className="border-b border-[var(--line)] p-4 font-mono text-xs"
                >
                  <p className="font-semibold text-[var(--danger)]">
                    {index + 1}. {item.reason}
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap break-words text-[var(--muted)]">
                    {JSON.stringify(item.row, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-[var(--line-strong)] bg-[var(--surface-raised)] p-4">
      <p className="font-mono text-xs uppercase tracking-[0.15em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 font-mono text-4xl font-semibold">{value}</p>
    </div>
  );
}
