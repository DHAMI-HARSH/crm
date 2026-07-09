"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { validateCsvFile } from "@/lib/csv/validate";

type DropzoneProps = {
  onFileAccepted: (file: File) => void;
  onError: (message: string) => void;
  error: string;
};

export function CsvDropzone({ onFileAccepted, onError, error }: DropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      const result = validateCsvFile(file);
      if (!result.valid) {
        onError(result.error);
        return;
      }

      onFileAccepted(file);
    },
    [onFileAccepted, onError],
  );

  const { getRootProps, getInputProps, inputRef, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
    noClick: true,
    useFsAccessApi: false,
    validator: (file) => {
      const result = validateCsvFile(file);
      return result.valid ? null : { code: "csv-invalid", message: result.error };
    },
    onDropRejected: (rejections) => {
      const message = rejections[0]?.errors[0]?.message;
      if (message) {
        onError(message);
      }
    },
  });

  return (
    <section
      {...getRootProps()}
      className={[
        "grid min-h-72 place-items-center border-2 border-dashed px-6 py-10 text-center transition-colors",
        isDragActive
          ? "border-[var(--accent)] bg-[var(--surface-raised)]"
          : "border-[var(--line-strong)] bg-[var(--surface)]",
      ].join(" ")}
    >
      <input {...getInputProps()} />
      <div className="max-w-xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
          Upload
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--ink)] sm:text-4xl">
          GrowEasy Lead Import Console
        </h1>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
          Drop a messy CRM export here, or use the picker. CSV only, up to 10MB.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-7 border border-[var(--accent)] bg-[var(--accent)] px-5 py-3 font-mono text-sm font-semibold text-[var(--accent-ink)] outline-none transition-colors hover:bg-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
        >
          Select CSV
        </button>
        {error ? (
          <p className="mt-5 border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
