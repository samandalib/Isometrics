import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { downloadFile } from "@/lib/diagram-export";

export type ExportHandlers = {
  filename: string;
  getJson: () => string;
  getHtml: () => string;
};

export function ExportPanel({ export: handlers }: { export: ExportHandlers }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="mt-6 border-t border-border pt-5">
      <h2 className="text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
        Export
      </h2>
      <div className="mt-3 space-y-2">
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(handlers.getJson());
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          }}
          className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? "Copied config" : "Copy config JSON"}
        </button>
        <button
          onClick={() =>
            downloadFile(
              handlers.filename,
              "text/html",
              handlers.getHtml(),
            )
          }
          className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
        >
          <Download className="size-3.5" />
          Download interactive HTML
        </button>
      </div>
      <p className="mt-3 text-[0.65rem] leading-relaxed text-muted-foreground/70">
        The HTML file is self-contained — open it directly or embed it in an
        iframe.
      </p>
    </div>
  );
}
