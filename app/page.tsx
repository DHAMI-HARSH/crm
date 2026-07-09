"use client";

import { useEffect, useMemo, useState } from "react";
import { CsvDropzone } from "@/components/dropzone";
import { PreviewTable } from "@/components/preview-table";
import { ProgressIndicator } from "@/components/progress-indicator";
import { ResultTable } from "@/components/result-table";
import { ThemeToggle } from "@/components/theme-toggle";
import { parseCsvFile } from "@/lib/csv/parse";
import { hasDetectedRows, validateCsvFile } from "@/lib/csv/validate";
import type { CsvRow, ImportResponse } from "@/types/crm";

type Step = "upload" | "preview" | "confirm" | "result";

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [fields, setFields] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(0);

  const totalBatches = useMemo(() => Math.max(1, Math.ceil(rows.length / 20)), [rows]);

  useEffect(() => {
    if (!isImporting) {
      return;
    }

    const timer = window.setInterval(() => {
      setCurrentBatch((current) => Math.min(totalBatches, current + 1));
    }, 1200);

    return () => window.clearInterval(timer);
  }, [isImporting, totalBatches]);

  async function handleFile(file: File) {
    setError("");
    setResult(null);
    const validation = validateCsvFile(file);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    const parsed = await parseCsvFile(file);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    const rowCheck = hasDetectedRows(parsed.rows);
    if (!rowCheck.valid) {
      setError(rowCheck.error);
      return;
    }

    setFileName(file.name);
    setRows(parsed.rows);
    setFields(parsed.fields);
    setStep("preview");
  }

  async function confirmImport() {
    setError("");
    setResult(null);
    setIsImporting(true);
    setCurrentBatch(1);
    setStep("confirm");

    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const body: unknown = await response.json();

      if (!response.ok) {
        const message =
          body &&
          typeof body === "object" &&
          "error" in body &&
          typeof body.error === "string"
            ? body.error
            : "Import failed.";
        throw new Error(message);
      }

      setResult(body as ImportResponse);
      setCurrentBatch(totalBatches);
      setStep("result");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed.");
    } finally {
      setIsImporting(false);
    }
  }

  function resetFlow() {
    setStep("upload");
    setFileName("");
    setRows([]);
    setFields([]);
    setError("");
    setResult(null);
    setIsImporting(false);
    setCurrentBatch(0);
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-5 text-[var(--ink)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[var(--line-strong)] pb-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              GrowEasy CRM
            </p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
              AI CSV Importer
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ThemeToggle />
            <StepRail step={step} />
          </div>
        </header>

        {step === "upload" ? (
          <CsvDropzone
            onFileAccepted={handleFile}
            onError={setError}
            error={error}
          />
        ) : null}

        {step !== "upload" ? (
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--line-strong)] bg-[var(--surface-raised)] p-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.15em] text-[var(--muted)]">
                    Source file
                  </p>
                  <p className="mt-1 font-mono text-sm">{fileName}</p>
                </div>
                <button
                  type="button"
                  onClick={resetFlow}
                  className="border border-[var(--line-strong)] px-3 py-2 font-mono text-xs outline-none hover:bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
                >
                  New file
                </button>
              </div>

              {step === "preview" || step === "confirm" ? (
                <PreviewTable rows={rows} fields={fields} />
              ) : null}

              {step === "result" && result ? (
                <ResultTable result={result} sourceFileName={fileName} />
              ) : null}
            </div>

            <aside className="space-y-5">
              <div className="border border-[var(--line-strong)] bg-[var(--surface)] p-4">
                <p className="font-mono text-xs uppercase tracking-[0.15em] text-[var(--muted)]">
                  Confirm
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  Backend AI extraction starts only when you confirm this preview.
                </p>
                <button
                  type="button"
                  disabled={isImporting || step === "result"}
                  onClick={confirmImport}
                  className="primary-action mt-5"
                >
                  <span>{isImporting ? "Processing..." : "Confirm Import"}</span>
                </button>
                {error ? (
                  <p className="mt-4 border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
                    {error}
                  </p>
                ) : null}
              </div>

              <ProgressIndicator
                currentBatch={currentBatch}
                totalBatches={totalBatches}
                state={
                  error && step === "confirm"
                    ? "error"
                    : isImporting
                      ? "processing"
                      : step === "result"
                        ? "complete"
                        : "idle"
                }
              />
            </aside>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function StepRail({ step }: { step: Step }) {
  const steps: Step[] = ["upload", "preview", "confirm", "result"];
  const activeIndex = steps.indexOf(step);

  return (
    <ol className="flex flex-wrap gap-2 font-mono text-xs">
      {steps.map((item, index) => (
        <li
          key={item}
          className={[
            "border px-2 py-1 uppercase tracking-[0.12em]",
            index <= activeIndex
              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]"
              : "border-[var(--line)] text-[var(--muted)]",
          ].join(" ")}
        >
          {index + 1}. {item}
        </li>
      ))}
    </ol>
  );
}
