"use client";

type ProgressIndicatorProps = {
  currentBatch: number;
  totalBatches: number;
  state: "idle" | "processing" | "complete" | "error";
};

export function ProgressIndicator({
  currentBatch,
  totalBatches,
  state,
}: ProgressIndicatorProps) {
  const lines = buildLines(currentBatch, totalBatches, state);

  return (
    <div className="border border-[var(--line-strong)] bg-[var(--terminal)] p-4 font-mono text-xs text-[var(--terminal-ink)]">
      <div className="mb-3 flex items-center justify-between border-b border-[var(--terminal-line)] pb-2">
        <span>import.log</span>
        <span>{state}</span>
      </div>
      <div
        className="max-h-36 space-y-1 overflow-hidden"
        aria-live="polite"
        aria-busy={state === "processing"}
      >
        {lines.map((line) => (
          <p key={line} className="truncate">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

function buildLines(
  currentBatch: number,
  totalBatches: number,
  state: ProgressIndicatorProps["state"],
): string[] {
  if (state === "idle") {
    return ["> awaiting confirm import"];
  }

  if (state === "complete") {
    return [
      `> processed ${totalBatches} of ${totalBatches} batches`,
      "> response validated",
      "> import report ready",
    ];
  }

  if (state === "error") {
    return ["> import request failed", "> check API configuration and retry"];
  }

  const visible = Array.from({ length: Math.max(currentBatch, 1) }, (_, index) => {
    const batch = index + 1;
    return batch < currentBatch
      ? `> batch ${batch}/${totalBatches} settled`
      : `> processing batch ${batch} of ${totalBatches}`;
  });

  return visible.slice(-6);
}
