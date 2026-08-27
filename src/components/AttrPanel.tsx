export function Ctrl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-xs text-muted-foreground">
        {label}
        <span className="font-mono text-foreground/80">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-foreground"
      />
    </label>
  );
}

import { ExportPanel, type ExportHandlers } from "@/components/ExportPanel";

export function PanelShell({
  onReset,
  children,
  export: exportHandlers,
}: {
  onReset: () => void;
  children: React.ReactNode;
  export?: ExportHandlers;
}) {
  return (
    <aside className="rounded-xl border border-border bg-card/40 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
          Attributes
        </h2>
        <button
          onClick={onReset}
          className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Reset
        </button>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
      {exportHandlers ? <ExportPanel export={exportHandlers} /> : null}
    </aside>
  );
}
