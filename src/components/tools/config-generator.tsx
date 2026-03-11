"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
} from "react";
import {
  Settings,
  Copy,
  Check,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  X,
  Plus,
  FileCode2,
  CircleCheck,
  CircleX,
  Search,
  Share2,
  FolderOpen,
  Loader2,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/auth-client";
import { PublishDialog } from "@/components/layout/publish-dialog";
import { apps, getApp } from "@/lib/tools/config-generator/apps";
import type {
  AppDefinition,
  ConfigSection,
  ConfigField,
  BooleanField,
  StringField,
  NumberField,
  SelectField,
  MultiSelectField,
  StringArrayField,
} from "@/lib/tools/config-generator/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDefaults(app: AppDefinition): {
  values: Record<string, unknown>;
  enabledFields: Set<string>;
} {
  const values: Record<string, unknown> = {};
  const enabledFields = new Set<string>();
  for (const section of app.sections) {
    for (const field of section.fields) {
      values[field.id] = field.defaultValue;
      if (field.enabledByDefault) enabledFields.add(field.id);
    }
  }
  return { values, enabledFields };
}

// ---------------------------------------------------------------------------
// ResizeHandle
// ---------------------------------------------------------------------------

function ResizeHandle({
  index,
  onResize,
}: {
  index: number;
  onResize: (index: number, delta: number, containerWidth: number) => void;
}) {
  const handleRef = useRef<HTMLDivElement>(null);
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      let lastX = e.clientX;
      const container = handleRef.current?.parentElement;
      if (!container) return;
      const containerWidth = container.getBoundingClientRect().width;
      const onMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - lastX;
        lastX = e.clientX;
        onResize(index, delta, containerWidth);
      };
      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [index, onResize]
  );
  return (
    <div
      ref={handleRef}
      onMouseDown={onMouseDown}
      className="w-1 cursor-col-resize bg-border hover:bg-primary/30 transition-colors shrink-0"
    />
  );
}

// ---------------------------------------------------------------------------
// AppSelectorDropdown
// ---------------------------------------------------------------------------

function AppSelectorDropdown({
  apps,
  selectedId,
  onSelect,
}: {
  apps: AppDefinition[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const selected = apps.find((a) => a.id === selectedId);

  const filtered = query
    ? apps.filter((a) => {
        const q = query.toLowerCase();
        return (
          a.name.toLowerCase().includes(q) ||
          a.configFileName.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
        );
      })
    : apps;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-border bg-muted/40 hover:bg-muted/70 transition-colors"
      >
        <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">
          {selected ? selected.name : "Select app"}
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground ml-0.5" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-64 rounded-md border border-border bg-popover shadow-lg overflow-hidden">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border">
            <Search className="h-3 w-3 text-muted-foreground/60 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools..."
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none min-w-0"
              onKeyDown={(e) => {
                if (e.key === "Enter" && filtered.length === 1) {
                  onSelect(filtered[0].id);
                  setOpen(false);
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                No matching tools
              </div>
            ) : (
              filtered.map((app) => (
                <button
                  key={app.id}
                  onClick={() => {
                    onSelect(app.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-muted/50 transition-colors ${
                    app.id === selectedId ? "bg-muted/40" : ""
                  }`}
                >
                  <span className="text-xs font-medium flex-1 truncate">{app.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                    {app.configFileName}
                  </span>
                  <span className="text-[10px] text-muted-foreground border border-border rounded px-1 shrink-0">
                    v{app.version}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field controls
// ---------------------------------------------------------------------------

function BooleanControl({
  field,
  value,
  onChange,
}: {
  field: BooleanField;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0 ${
        value ? "bg-primary" : "bg-border"
      }`}
    >
      <span
        className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${
          value ? "translate-x-3.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function StringControl({
  field,
  value,
  onChange,
}: {
  field: StringField;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder ?? ""}
      className="h-6 text-xs font-mono px-2"
    />
  );
}

function NumberControl({
  field,
  value,
  onChange,
}: {
  field: NumberField;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Input
      type="number"
      value={value}
      min={field.min}
      max={field.max}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-6 text-xs font-mono px-2 w-24"
    />
  );
}

function SelectControl({
  field,
  value,
  onChange,
}: {
  field: SelectField;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-6 text-xs font-mono px-1.5 rounded border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {field.options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function MultiSelectControl({
  field,
  value,
  onChange,
}: {
  field: MultiSelectField;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = useCallback(
    (optValue: string) => {
      onChange(
        value.includes(optValue)
          ? value.filter((v) => v !== optValue)
          : [...value, optValue]
      );
    },
    [value, onChange]
  );

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
      {field.options.map((opt) => (
        <label
          key={opt.value}
          className="flex items-center gap-1 text-xs cursor-pointer select-none"
        >
          <input
            type="checkbox"
            checked={value.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            className="h-3 w-3 accent-primary"
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

function StringArrayControl({
  field,
  value,
  onChange,
}: {
  field: StringArrayField;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [inputVal, setInputVal] = useState("");

  const add = useCallback(() => {
    const trimmed = inputVal.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setInputVal("");
  }, [inputVal, value, onChange]);

  const remove = useCallback(
    (item: string) => onChange(value.filter((v) => v !== item)),
    [value, onChange]
  );

  return (
    <div className="flex flex-col gap-1 mt-1">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 text-[11px] font-mono bg-muted/60 border border-border rounded px-1.5 py-0.5"
            >
              {item}
              <button
                onClick={() => remove(item)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label={`Remove ${item}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1">
        <Input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={field.placeholder ?? "Add item and press Enter"}
          className="h-6 text-xs font-mono px-2 flex-1"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={add}
          className="h-6 w-6 p-0 shrink-0"
          aria-label="Add item"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: ConfigField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.type) {
    case "boolean":
      return (
        <BooleanControl
          field={field}
          value={value as boolean}
          onChange={onChange}
        />
      );
    case "string":
      return (
        <StringControl
          field={field}
          value={value as string}
          onChange={onChange}
        />
      );
    case "number":
      return (
        <NumberControl
          field={field}
          value={value as number}
          onChange={onChange}
        />
      );
    case "select":
      return (
        <SelectControl
          field={field}
          value={value as string}
          onChange={onChange}
        />
      );
    case "multi-select":
      return (
        <MultiSelectControl
          field={field}
          value={value as string[]}
          onChange={onChange}
        />
      );
    case "string-array":
      return (
        <StringArrayControl
          field={field}
          value={value as string[]}
          onChange={onChange}
        />
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// FieldRow
// ---------------------------------------------------------------------------

function FieldRow({
  field,
  value,
  enabled,
  onToggle,
  onValueChange,
}: {
  field: ConfigField;
  value: unknown;
  enabled: boolean;
  onToggle: (id: string) => void;
  onValueChange: (id: string, v: unknown) => void;
}) {
  const isInline =
    field.type === "boolean" ||
    field.type === "string" ||
    field.type === "number" ||
    field.type === "select";

  return (
    <div className={`px-3 py-2 border-b border-border/40 last:border-0 ${!enabled ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-2">
        {/* Enable toggle */}
        <button
          onClick={() => onToggle(field.id)}
          className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-sm border transition-colors ${
            enabled
              ? "bg-primary border-primary"
              : "border-border bg-background"
          }`}
          aria-label={enabled ? `Disable ${field.label}` : `Enable ${field.label}`}
          aria-pressed={enabled}
        >
          {enabled && (
            <Check className="h-2.5 w-2.5 text-primary-foreground mx-auto" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          {isInline ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium shrink-0">{field.label}</span>
              <div className={!enabled ? "pointer-events-none" : ""}>
                <FieldControl
                  field={field}
                  value={value}
                  onChange={(v) => onValueChange(field.id, v)}
                />
              </div>
            </div>
          ) : (
            <>
              <span className="text-xs font-medium block mb-1">{field.label}</span>
              <div className={!enabled ? "pointer-events-none" : ""}>
                <FieldControl
                  field={field}
                  value={value}
                  onChange={(v) => onValueChange(field.id, v)}
                />
              </div>
            </>
          )}
          {field.description && (
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              {field.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionGroup
// ---------------------------------------------------------------------------

function SectionGroup({
  section,
  values,
  enabledFields,
  onToggle,
  onValueChange,
  searchQuery,
}: {
  section: ConfigSection;
  values: Record<string, unknown>;
  enabledFields: Set<string>;
  onToggle: (id: string) => void;
  onValueChange: (id: string, v: unknown) => void;
  searchQuery: string;
}) {
  const [manualExpanded, setManualExpanded] = useState(true);

  const isSearching = searchQuery.length > 0;
  const filteredFields = isSearching
    ? section.fields.filter((f) => {
        const q = searchQuery.toLowerCase();
        return (
          f.id.toLowerCase().includes(q) ||
          f.label.toLowerCase().includes(q) ||
          (f.description?.toLowerCase().includes(q) ?? false)
        );
      })
    : section.fields;

  // Hide section entirely if no fields match during search
  if (isSearching && filteredFields.length === 0) return null;

  // When searching, always expand; otherwise use manual toggle
  const expanded = isSearching ? true : manualExpanded;

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => !isSearching && setManualExpanded((v) => !v)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${isSearching ? "" : "hover:bg-muted/30"}`}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="text-xs font-semibold">{section.label}</span>
        {section.description && !expanded && (
          <span className="text-[11px] text-muted-foreground truncate">
            {section.description}
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
          {isSearching
            ? `${filteredFields.length} match${filteredFields.length !== 1 ? "es" : ""}`
            : `${section.fields.filter((f) => enabledFields.has(f.id)).length}/${section.fields.length}`}
        </span>
      </button>
      {section.description && expanded && !isSearching && (
        <p className="px-3 pb-1.5 text-[11px] text-muted-foreground">
          {section.description}
        </p>
      )}
      {expanded && (
        <div>
          {filteredFields.map((field) => (
            <FieldRow
              key={field.id}
              field={field}
              value={values[field.id] ?? field.defaultValue}
              enabled={enabledFields.has(field.id)}
              onToggle={onToggle}
              onValueChange={onValueChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
      <FileCode2 className="h-8 w-8 text-muted-foreground/40" />
      <div>
        <p className="text-sm font-medium text-muted-foreground">No apps registered</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Add app definitions to{" "}
          <code className="font-mono text-[11px] bg-muted/60 px-1 rounded">
            src/lib/tools/config-generator/apps/index.ts
          </code>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface SavedConfig {
  id: string;
  title: string;
  format: string;
  visibility: string;
  size: number;
  createdAt: string;
  url: string;
}

export function ConfigGenerator({ initialAppId, pasteId }: { initialAppId?: string; pasteId?: string } = {}) {
  const resolvedInitialApp = initialAppId ? getApp(initialAppId) ?? null : null;
  const [selectedAppId, setSelectedAppId] = useState<string>(
    resolvedInitialApp?.id ?? ""
  );
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    if (!resolvedInitialApp) return {};
    return buildDefaults(resolvedInitialApp).values;
  });
  const [enabledFields, setEnabledFields] = useState<Set<string>>(() => {
    if (!resolvedInitialApp) return new Set();
    return buildDefaults(resolvedInitialApp).enabledFields;
  });
  const [rawConfig, setRawConfig] = useState<string>(() => {
    if (!resolvedInitialApp) return "";
    const defaults = buildDefaults(resolvedInitialApp);
    return resolvedInitialApp.serialize(defaults.values, defaults.enabledFields);
  });
  const [widths, setWidths] = useState<[number, number]>([40, 60]);
  const [copied, setCopied] = useState(false);
  const [validation, setValidation] = useState<{ valid: boolean; error?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const { data: session } = useSession();

  // ----- Paste / saved config state -----
  const [activePasteId, setActivePasteId] = useState<string | undefined>(pasteId);
  const [configTitle, setConfigTitle] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
  const [savedConfigsOpen, setSavedConfigsOpen] = useState(false);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [loadingPaste, setLoadingPaste] = useState(!!pasteId);
  const savedConfigsRef = useRef<HTMLDivElement>(null);

  // Tracks which direction the last sync came from to prevent loops
  const syncSourceRef = useRef<"form" | "editor" | null>(null);
  const editorDebounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const app = selectedAppId ? getApp(selectedAppId) ?? null : null;

  // ----- Load paste on mount if pasteId is provided -----
  useEffect(() => {
    if (!pasteId) return;
    async function loadPaste() {
      try {
        const res = await fetch(`/api/proxy/pastes/${pasteId}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setConfigTitle(data.title ?? "");
        setRawConfig(data.content ?? "");
        setActivePasteId(pasteId);
        // Try to detect which app this config belongs to by trying each deserializer
        for (const a of apps) {
          try {
            const result = a.deserialize(data.content ?? "");
            if (result.enabledFields.length > 0) {
              setSelectedAppId(a.id);
              setValues(result.values);
              setEnabledFields(new Set(result.enabledFields));
              syncSourceRef.current = "editor";
              break;
            }
          } catch { /* try next */ }
        }
      } finally {
        setLoadingPaste(false);
      }
    }
    loadPaste();
  }, [pasteId]);

  // ----- Fetch saved configs -----
  const fetchSavedConfigs = useCallback(async () => {
    if (!session) return;
    setLoadingConfigs(true);
    try {
      const res = await fetch("/api/proxy/pastes", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const all: SavedConfig[] = data.pastes ?? data ?? [];
        setSavedConfigs(all.filter((p) => p.format === "code"));
      }
    } catch { /* ignore */ } finally {
      setLoadingConfigs(false);
    }
  }, [session]);

  // ----- Load a saved config -----
  const handleLoadConfig = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/proxy/pastes/${id}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setConfigTitle(data.title ?? "");
      setRawConfig(data.content ?? "");
      setActivePasteId(id);
      // Detect app
      for (const a of apps) {
        try {
          const result = a.deserialize(data.content ?? "");
          if (result.enabledFields.length > 0) {
            setSelectedAppId(a.id);
            setValues(result.values);
            setEnabledFields(new Set(result.enabledFields));
            syncSourceRef.current = "editor";
            break;
          }
        } catch { /* try next */ }
      }
      window.history.replaceState(null, "", `/tools/config/${id}`);
    } catch { /* ignore */ }
    setSavedConfigsOpen(false);
  }, []);

  // ----- Update existing paste -----
  const handleUpdate = useCallback(async () => {
    if (!activePasteId || !rawConfig.trim()) return;
    setUpdating(true);
    setUpdateError(null);
    setUpdateSuccess(false);
    try {
      const res = await fetch(`/api/proxy/pastes/${activePasteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: configTitle.trim(), content: rawConfig }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 2000);
    } catch (e) {
      setUpdateError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setUpdating(false);
    }
  }, [activePasteId, rawConfig, configTitle]);

  // ----- Post-publish: redirect to edit mode -----
  const handlePublished = useCallback((id: string) => {
    setActivePasteId(id);
    setPublishOpen(false);
    window.history.replaceState(null, "", `/tools/config/${id}`);
    setTimeout(() => fetchSavedConfigs(), 500);
  }, [fetchSavedConfigs]);

  // ----- Close saved configs dropdown on outside click -----
  useEffect(() => {
    if (!savedConfigsOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (!savedConfigsRef.current?.contains(e.target as Node)) setSavedConfigsOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [savedConfigsOpen]);

  // ----- Sync: form -> editor -----
  useLayoutEffect(() => {
    if (syncSourceRef.current === "editor") {
      syncSourceRef.current = null;
      return;
    }
    if (!app) return;
    const serialized = app.serialize(values, enabledFields);
    syncSourceRef.current = "form";
    setRawConfig(serialized);
    // Reset after render
    const t = setTimeout(() => {
      syncSourceRef.current = null;
    }, 0);
    return () => clearTimeout(t);
  }, [values, enabledFields, app]);

  // ----- Field toggle -----
  const handleToggle = useCallback((id: string) => {
    setEnabledFields((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleValueChange = useCallback((id: string, v: unknown) => {
    setValues((prev) => ({ ...prev, [id]: v }));
  }, []);

  // ----- Editor change -> form -----
  const handleEditorChange = useCallback(
    (text: string) => {
      setRawConfig(text);
      if (editorDebounceRef.current) clearTimeout(editorDebounceRef.current);
      editorDebounceRef.current = setTimeout(() => {
        if (!app) return;
        // Run validation
        if (app.validate) {
          setValidation(app.validate(text));
        } else {
          // Fallback: try deserialize to check validity
          try {
            const result = app.deserialize(text);
            const hasContent = result.enabledFields.length > 0 || text.trim() === "";
            setValidation(hasContent ? { valid: true } : { valid: false, error: "Could not parse config" });
          } catch {
            setValidation({ valid: false, error: "Could not parse config" });
          }
        }
        syncSourceRef.current = "editor";
        try {
          const { values: newValues, enabledFields: newEnabled } =
            app.deserialize(text);
          setValues(newValues);
          setEnabledFields(new Set(newEnabled));
        } catch {
          // ignore parse errors while typing
        }
      }, 500);
    },
    [app]
  );

  // ----- App switching -----
  const handleSelectApp = useCallback((id: string) => {
    const nextApp = getApp(id);
    if (!nextApp) return;
    setSelectedAppId(id);
    const defaults = buildDefaults(nextApp);
    setValues(defaults.values);
    setEnabledFields(defaults.enabledFields);
    syncSourceRef.current = null;
    setValidation(null);
    setSearchQuery("");
    setActivePasteId(undefined);
    setConfigTitle("");
    setUpdateError(null);
    setUpdateSuccess(false);
    window.history.replaceState(null, "", `/tools/config/${id}`);
  }, []);

  // ----- Resize -----
  const handleResize = useCallback(
    (index: number, delta: number, containerWidth: number) => {
      setWidths((prev) => {
        const next = [...prev] as [number, number];
        const deltaPct = (delta / containerWidth) * 100;
        const newLeft = next[index] + deltaPct;
        const newRight = next[index + 1] - deltaPct;
        if (newLeft < 15 || newRight < 15) return prev;
        next[index] = newLeft;
        next[index + 1] = newRight;
        return next;
      });
    },
    []
  );

  // ----- Copy -----
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(rawConfig);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [rawConfig]);

  // ----- Download -----
  const handleDownload = useCallback(() => {
    if (!app) return;
    const blob = new Blob([rawConfig], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = app.configFileName;
    a.click();
    URL.revokeObjectURL(url);
  }, [app, rawConfig]);

  // ----- Keyboard shortcut: Ctrl/Cmd+S -> save (if editing paste) or copy -----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (activePasteId && session) {
          handleUpdate();
        } else {
          navigator.clipboard.writeText(rawConfig).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [rawConfig, activePasteId, session, handleUpdate]);

  // ----- Cleanup debounce on unmount -----
  useEffect(() => {
    return () => {
      if (editorDebounceRef.current) clearTimeout(editorDebounceRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0 flex-wrap">
        <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold shrink-0">Config Generator</span>

        {apps.length > 0 && (
          <>
            <div className="w-px h-4 bg-border shrink-0" />
            <AppSelectorDropdown
              apps={apps}
              selectedId={selectedAppId}
              onSelect={handleSelectApp}
            />
            {app && (
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                  v{app.version}
                </Badge>
                <a
                  href={app.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span className="hidden sm:inline">Docs</span>
                </a>
              </div>
            )}
          </>
        )}

        <div className="flex items-center gap-1 ml-auto">
          {/* My Configs dropdown */}
          {session && (
            <div ref={savedConfigsRef} className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  const next = !savedConfigsOpen;
                  setSavedConfigsOpen(next);
                  if (next) fetchSavedConfigs();
                }}
              >
                <FolderOpen className="h-3.5 w-3.5 mr-1" />
                My Configs
              </Button>
              {savedConfigsOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-md border border-border bg-popover shadow-lg overflow-hidden">
                  <div className="px-3 py-2 border-b border-border text-xs font-medium text-muted-foreground">
                    Saved Configs
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {loadingConfigs ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : savedConfigs.length === 0 ? (
                      <div className="px-3 py-6 text-xs text-muted-foreground text-center">
                        No saved configs yet
                      </div>
                    ) : (
                      savedConfigs.map((cfg) => (
                        <button
                          key={cfg.id}
                          onClick={() => handleLoadConfig(cfg.id)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors ${
                            activePasteId === cfg.id ? "bg-accent/30" : ""
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">
                              {cfg.title || <span className="italic text-muted-foreground">Untitled</span>}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(cfg.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <a
                            href={`/p/${cfg.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="w-px h-4 bg-border shrink-0" />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2 text-xs"
            disabled={!app}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 mr-1" />
            ) : (
              <Copy className="h-3.5 w-3.5 mr-1" />
            )}
            Copy
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-7 px-2 text-xs"
            disabled={!app}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Download
          </Button>

          {/* Share or Update */}
          {session && activePasteId ? (
            <div className="flex items-center gap-1">
              {updateError && <span className="text-[10px] text-destructive">{updateError}</span>}
              <a
                href={`/p/${activePasteId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 h-7 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUpdate}
                className="h-7 px-2 text-xs"
                disabled={updating || !rawConfig.trim()}
              >
                {updating ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : updateSuccess ? (
                  <Check className="h-3.5 w-3.5 mr-1" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1" />
                )}
                {updating ? "Saving..." : updateSuccess ? "Saved!" : "Save"}
              </Button>
            </div>
          ) : session && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPublishOpen(true)}
              className="h-7 px-2 text-xs"
              disabled={!app || !rawConfig.trim()}
            >
              <Share2 className="h-3.5 w-3.5 mr-1" />
              Share
            </Button>
          )}
        </div>
      </div>

      {app && (
        <PublishDialog
          open={publishOpen}
          onOpenChange={setPublishOpen}
          content={rawConfig}
          format="code"
          defaultTitle={app ? `${app.name} — ${app.configFileName}` : ""}
          onPublished={handlePublished}
        />
      )}

      {/* Content */}
      {loadingPaste ? (
        <div className="flex-1 flex items-center justify-center min-h-0">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading config...</span>
          </div>
        </div>
      ) : !app ? (
        <div className="flex-1 flex items-center justify-center min-h-0">
          <div className="flex flex-col items-center gap-6 text-center px-6 max-w-md">
            <FileCode2 className="h-10 w-10 text-muted-foreground/30" />
            <div>
              <p className="text-sm font-medium text-foreground">Select a tool to get started</p>
              <p className="text-xs text-muted-foreground mt-1.5">
                Pick a tool from the dropdown above to generate its configuration file.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full">
              {apps.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleSelectApp(a.id)}
                  className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-md border border-border bg-muted/20 hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="text-xs font-medium truncate w-full">{a.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono truncate w-full">{a.configFileName}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Left pane - Settings form */}
          <div
            style={{ width: `${widths[0]}%` }}
            className="flex flex-col min-h-0 border-r"
          >
            <div className="h-8 flex items-center px-2 gap-1.5 text-xs text-muted-foreground border-b bg-muted/30 shrink-0">
              <Search className="h-3 w-3 text-muted-foreground/60 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search settings..."
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none min-w-0"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {app.sections.map((section) => (
                <SectionGroup
                  key={section.id}
                  section={section}
                  values={values}
                  enabledFields={enabledFields}
                  onToggle={handleToggle}
                  onValueChange={handleValueChange}
                  searchQuery={searchQuery}
                />
              ))}
            </div>
          </div>

          <ResizeHandle index={0} onResize={handleResize} />

          {/* Right pane - Config editor */}
          <div
            style={{ width: `${widths[1]}%` }}
            className="flex flex-col min-h-0"
          >
            <div className="h-8 flex items-center px-3 text-xs text-muted-foreground border-b bg-muted/30 shrink-0 font-medium gap-2">
              <span>{app.configFileName}</span>
              {validation && (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    validation.valid
                      ? "text-emerald-400 bg-emerald-500/10"
                      : "text-red-400 bg-red-500/10"
                  }`}
                  title={validation.error}
                >
                  {validation.valid ? (
                    <CircleCheck className="h-3 w-3" />
                  ) : (
                    <CircleX className="h-3 w-3" />
                  )}
                  {validation.valid ? "Valid" : "Invalid"}
                </span>
              )}
            </div>
            <div className="flex-1 min-h-0 relative">
              <textarea
                value={rawConfig}
                onChange={(e) => handleEditorChange(e.target.value)}
                spellCheck={false}
                placeholder={`# ${app.configFileName}`}
                className="absolute inset-0 w-full h-full resize-none bg-muted/20 font-mono text-sm leading-relaxed px-4 py-3 border-0 outline-none text-foreground placeholder:text-muted-foreground/40 focus:bg-muted/30 transition-colors"
                style={{ tabSize: 2 }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
