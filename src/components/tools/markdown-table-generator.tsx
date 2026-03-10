"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Trash2,
  Copy,
  Check,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";

type Alignment = "left" | "center" | "right";

interface TableState {
  headers: string[];
  rows: string[][];
  alignments: Alignment[];
}

const ALIGNMENT_CYCLE: Alignment[] = ["left", "center", "right"];

const AlignmentIcon = ({ alignment }: { alignment: Alignment }) => {
  if (alignment === "center") return <AlignCenter className="w-3 h-3" />;
  if (alignment === "right") return <AlignRight className="w-3 h-3" />;
  return <AlignLeft className="w-3 h-3" />;
};

function generateMarkdown(state: TableState): string {
  const { headers, rows, alignments } = state;
  const colCount = headers.length;

  // Compute column widths
  const colWidths: number[] = headers.map((h, ci) => {
    const cellMax = rows.reduce((max, row) => {
      const cell = row[ci] ?? "";
      return Math.max(max, cell.length);
    }, 0);
    return Math.max(3, h.length, cellMax);
  });

  const padCell = (text: string, width: number, align: Alignment) => {
    if (align === "right") return text.padStart(width);
    if (align === "center") {
      const total = width - text.length;
      const left = Math.floor(total / 2);
      const right = total - left;
      return " ".repeat(left) + text + " ".repeat(right);
    }
    return text.padEnd(width);
  };

  const headerRow =
    "| " +
    headers
      .map((h, ci) => padCell(h, colWidths[ci], alignments[ci] ?? "left"))
      .join(" | ") +
    " |";

  const separatorRow =
    "| " +
    Array.from({ length: colCount }, (_, ci) => {
      const align = alignments[ci] ?? "left";
      const inner = "-".repeat(Math.max(1, colWidths[ci] - (align === "center" ? 2 : align === "right" ? 1 : 1)));
      if (align === "center") return ":" + inner + ":";
      if (align === "right") return inner + ":";
      return ":" + inner;
    }).join(" | ") +
    " |";

  const dataRows = rows.map(
    (row) =>
      "| " +
      Array.from({ length: colCount }, (_, ci) => {
        const cell = row[ci] ?? "";
        return padCell(cell, colWidths[ci], alignments[ci] ?? "left");
      }).join(" | ") +
      " |"
  );

  return [headerRow, separatorRow, ...dataRows].join("\n");
}

function parseCSV(text: string): string[][] | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return null;

  // Detect delimiter: count tabs vs commas
  const tabCount = lines.reduce((n, l) => n + (l.match(/\t/g) ?? []).length, 0);
  const commaCount = lines.reduce((n, l) => n + (l.match(/,/g) ?? []).length, 0);

  // Require at least one delimiter per line on average to treat as CSV
  const delim = tabCount > commaCount ? "\t" : ",";
  const totalDelims = delim === "\t" ? tabCount : commaCount;
  if (totalDelims < lines.length) return null;

  return lines.map((l) => l.split(delim));
}

const INITIAL_STATE: TableState = {
  headers: ["Header 1", "Header 2", "Header 3"],
  rows: [
    ["", "", ""],
    ["", "", ""],
  ],
  alignments: ["left", "left", "left"],
};

export function MarkdownTableGenerator() {
  const [state, setState] = useState<TableState>(INITIAL_STATE);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [rowMeasurements, setRowMeasurements] = useState<{ top: number; height: number }[]>([]);

  const markdown = useMemo(() => generateMarkdown(state), [state]);

  // Measure body row positions relative to the table container
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    const containerTop = table.getBoundingClientRect().top;
    const measurements = Array.from(tbody.rows).map((tr) => {
      const rect = tr.getBoundingClientRect();
      return { top: rect.top - containerTop, height: rect.height };
    });
    setRowMeasurements(measurements);
  }, [state]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const updateHeader = useCallback((ci: number, value: string) => {
    setState((s) => {
      const headers = [...s.headers];
      headers[ci] = value;
      return { ...s, headers };
    });
  }, []);

  const updateCell = useCallback((ri: number, ci: number, value: string) => {
    setState((s) => {
      const rows = s.rows.map((r, i) => (i === ri ? [...r] : r));
      rows[ri][ci] = value;
      return { ...s, rows };
    });
  }, []);

  const addColumn = useCallback(() => {
    setState((s) => ({
      headers: [...s.headers, `Header ${s.headers.length + 1}`],
      rows: s.rows.map((r) => [...r, ""]),
      alignments: [...s.alignments, "left"],
    }));
  }, []);

  const removeColumn = useCallback((ci: number) => {
    setState((s) => {
      if (s.headers.length <= 1) return s;
      return {
        headers: s.headers.filter((_, i) => i !== ci),
        rows: s.rows.map((r) => r.filter((_, i) => i !== ci)),
        alignments: s.alignments.filter((_, i) => i !== ci),
      };
    });
  }, []);

  const addRow = useCallback(() => {
    setState((s) => ({
      ...s,
      rows: [...s.rows, Array(s.headers.length).fill("")],
    }));
  }, []);

  const insertRowAt = useCallback((at: number) => {
    setState((s) => {
      const newRows = [...s.rows];
      newRows.splice(at, 0, Array(s.headers.length).fill(""));
      return { ...s, rows: newRows };
    });
  }, []);

  const removeRow = useCallback((ri: number) => {
    setState((s) => {
      if (s.rows.length <= 1) return s;
      return { ...s, rows: s.rows.filter((_, i) => i !== ri) };
    });
  }, []);

  const cycleAlignment = useCallback((ci: number) => {
    setState((s) => {
      const alignments = [...s.alignments];
      const idx = ALIGNMENT_CYCLE.indexOf(alignments[ci] ?? "left");
      alignments[ci] = ALIGNMENT_CYCLE[(idx + 1) % ALIGNMENT_CYCLE.length];
      return { ...s, alignments };
    });
  }, []);

  const setAllAlignments = useCallback((alignment: Alignment) => {
    setState((s) => ({
      ...s,
      alignments: s.alignments.map(() => alignment),
    }));
  }, []);

  const clearTable = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  // ── Paste handler ─────────────────────────────────────────────────────────

  const handlePaste = useCallback(
    (
      e: React.ClipboardEvent<HTMLInputElement>,
      target: { area: "header"; ci: number } | { area: "body"; ri: number; ci: number }
    ) => {
      const text = e.clipboardData.getData("text");
      const parsed = parseCSV(text);
      if (!parsed) return; // let normal paste happen

      e.preventDefault();

      setState((s) => {
        const newHeaders = [...s.headers];
        let newRows = s.rows.map((r) => [...r]);
        let newAlignments = [...s.alignments];

        let headerData: string[] | null = null;
        let bodyData: string[][];
        let startCi: number;
        let startRi: number;

        if (target.area === "header") {
          // First parsed row → headers, rest → body rows starting at row 0
          startCi = target.ci;
          headerData = parsed[0];
          bodyData = parsed.slice(1);
          startRi = 0;
        } else {
          // All parsed rows → body cells
          startCi = target.ci;
          startRi = target.ri;
          bodyData = parsed;
        }

        // Determine needed columns
        const maxCols = Math.max(
          ...(headerData ? [headerData.length] : []),
          ...bodyData.map((r) => r.length)
        );
        const neededCols = startCi + maxCols;

        // Expand columns
        while (newHeaders.length < neededCols) {
          newHeaders.push(`Header ${newHeaders.length + 1}`);
          newAlignments.push("left");
          newRows = newRows.map((r) => [...r, ""]);
        }

        // Fill headers if pasted into header
        if (headerData) {
          headerData.forEach((cell, pci) => {
            const ci = startCi + pci;
            if (ci < newHeaders.length) newHeaders[ci] = cell.trim();
          });
        }

        // Expand rows for body data
        const neededRows = startRi + bodyData.length;
        while (newRows.length < neededRows) {
          newRows.push(Array(newHeaders.length).fill(""));
        }

        // Fill body cells
        bodyData.forEach((parsedRow, pri) => {
          parsedRow.forEach((cell, pci) => {
            const ri = startRi + pri;
            const ci = startCi + pci;
            if (ri < newRows.length && ci < newHeaders.length) {
              newRows[ri][ci] = cell.trim();
            }
          });
        });

        return { headers: newHeaders, rows: newRows, alignments: newAlignments };
      });
    },
    []
  );

  // ── Copy ─────────────────────────────────────────────────────────────────

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [markdown]);

  // ── Render ────────────────────────────────────────────────────────────────

  const colCount = state.headers.length;

  return (
    <div className="flex flex-col gap-5">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={addColumn} className="h-7 text-xs gap-1.5">
          <Plus className="w-3 h-3" />
          Column
        </Button>
        <Button variant="outline" size="sm" onClick={addRow} className="h-7 text-xs gap-1.5">
          <Plus className="w-3 h-3" />
          Row
        </Button>

        <div className="w-px h-4 bg-border" />

        {/* Align all columns */}
        <div className="flex items-center gap-0.5">
          {(["left", "center", "right"] as Alignment[]).map((a) => (
            <button
              key={a}
              onClick={() => setAllAlignments(a)}
              className={`p-1 rounded transition-colors ${
                state.alignments.every((al) => al === a)
                  ? "text-foreground bg-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
              title={`Align all ${a}`}
            >
              <AlignmentIcon alignment={a} />
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border" />

        <Button
          variant="outline"
          size="sm"
          onClick={clearTable}
          className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-3 h-3" />
          Clear
        </Button>

        <span className="text-xs text-muted-foreground ml-auto">
          {colCount} col{colCount !== 1 ? "s" : ""} · {state.rows.length} row{state.rows.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table grid */}
      <div className="relative shrink-0">
        {/* Insert-row gutter (between rows, to the left) */}
        <div className="absolute -left-5 top-0 w-5" style={{ height: "100%" }}>
          {rowMeasurements.map((m, ri) => (
            <div
              key={ri}
              className="absolute inset-x-0 flex items-center justify-center group/insert"
              style={{ top: m.top + m.height - 9, height: 18 }}
            >
              <button
                onClick={() => insertRowAt(ri + 1)}
                className="opacity-0 group-hover/insert:opacity-100 transition-opacity z-10"
                title="Insert row below"
              >
                <Plus className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-foreground transition-colors" />
              </button>
            </div>
          ))}
        </div>

        {/* Remove-row gutter (centered on each row, to the right) */}
        <div className="absolute -right-5 top-0 w-5" style={{ height: "100%" }}>
          {rowMeasurements.map((m, ri) => (
            <div
              key={ri}
              className="absolute inset-x-0 flex items-center justify-center group/remove"
              style={{ top: m.top, height: m.height }}
            >
              <button
                onClick={() => removeRow(ri)}
                disabled={state.rows.length <= 1}
                className="opacity-0 group-hover/remove:opacity-100 disabled:opacity-0 transition-opacity"
                title="Remove row"
              >
                <Trash2 className="w-3 h-3 text-muted-foreground/60 hover:text-destructive transition-colors" />
              </button>
            </div>
          ))}
        </div>

        {/* Scrollable table */}
        <div className="overflow-x-auto rounded-md border border-border">
          <table ref={tableRef} className="border-collapse text-sm min-w-full">
            <thead>
              <tr>
                {state.headers.map((header, ci) => (
                  <th
                    key={ci}
                    className="border-b border-r last:border-r-0 border-border bg-muted p-0"
                  >
                    <div className="flex items-center group">
                      <button
                        onClick={() => cycleAlignment(ci)}
                        className="flex-shrink-0 p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title={`Align: ${state.alignments[ci] ?? "left"}`}
                      >
                        <AlignmentIcon alignment={state.alignments[ci] ?? "left"} />
                      </button>

                      <input
                        type="text"
                        value={header}
                        onChange={(e) => updateHeader(ci, e.target.value)}
                        onPaste={(e) => handlePaste(e, { area: "header", ci })}
                        className="flex-1 min-w-0 bg-transparent px-1 py-1.5 text-xs font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:ring-inset rounded-sm"
                        placeholder={`Col ${ci + 1}`}
                      />

                      <button
                        onClick={() => removeColumn(ci)}
                        disabled={state.headers.length <= 1}
                        className="flex-shrink-0 p-1.5 text-muted-foreground/50 hover:text-destructive hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        title="Remove column"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.rows.map((row, ri) => (
                <tr key={ri} className="group/row">
                  {Array.from({ length: colCount }, (_, ci) => (
                    <td
                      key={ci}
                      className="border-b border-r last:border-r-0 border-border p-0 min-w-[100px]"
                    >
                      <input
                        type="text"
                        value={row[ci] ?? ""}
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                        onPaste={(e) => handlePaste(e, { area: "body", ri, ci })}
                        className="w-full bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-ring rounded-sm"
                        placeholder="—"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Markdown output */}
      <div className="flex-shrink-0 relative rounded-md border border-border bg-muted overflow-hidden">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted">
          <span className="text-xs text-muted-foreground font-medium">Markdown output</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Copy markdown"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-green-500" />
                <span className="text-green-500">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                Copy
              </>
            )}
          </button>
        </div>
        <pre className="overflow-x-auto p-3 text-xs font-mono text-foreground leading-relaxed whitespace-pre">
          <code>{markdown}</code>
        </pre>
      </div>
    </div>
  );
}
