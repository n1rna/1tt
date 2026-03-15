"use client";

import { useState, useCallback } from "react";
import { Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { SchemaSidebar } from "./schema-sidebar";
import { TabBar } from "./tab-bar";
import { DataGrid } from "./data-grid";
import { SqlEditor } from "./sql-editor";
import type {
  Tab,
  TableTab,
  SqlTab,
  TableSchema,
  QueryExecutor,
  SqlDialect,
  AiSession,
} from "./types";

let sqlTabCounter = 1;

function makeTableTabId(schema: string, table: string) {
  return `table:${schema}.${table}`;
}

function makeSqlTabId() {
  return `sql:${sqlTabCounter++}`;
}

export interface StudioShellProps {
  queryExecutor: QueryExecutor;
  dialect?: SqlDialect;
  schema: TableSchema[];
  schemaLoading: boolean;
  sidebarHeader: React.ReactNode;
  aiEnabled?: boolean;
  className?: string;
}

export function StudioShell({
  queryExecutor,
  dialect = "postgres",
  schema,
  schemaLoading,
  sidebarHeader,
  aiEnabled = false,
  className,
}: StudioShellProps) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Per-tab view state (data | structure) stored separately to survive tab switching
  const [tabViews, setTabViews] = useState<Record<string, "data" | "structure">>({});
  // Per-tab SQL content stored separately to survive tab switching
  const [tabSqlContent, setTabSqlContent] = useState<Record<string, string>>({});
  // Per-tab AI session state
  const [tabAiSessions, setTabAiSessions] = useState<Record<string, AiSession>>({});

  const openTable = useCallback((schemaName: string, tableName: string) => {
    const id = makeTableTabId(schemaName, tableName);
    setTabs((prev) => {
      if (prev.find((t) => t.id === id)) return prev;
      const tab: TableTab = {
        id,
        type: "table",
        schema: schemaName,
        table: tableName,
        view: "data",
      };
      return [...prev, tab];
    });
    setActiveTabId(id);
  }, []);

  const openSqlTab = useCallback(() => {
    const id = makeSqlTabId();
    const num = sqlTabCounter - 1;
    const tab: SqlTab = {
      id,
      type: "sql",
      title: `Query ${num}`,
    };
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(id);
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      setActiveTabId((current) => {
        if (current === id) {
          return next[Math.min(idx, next.length - 1)]?.id ?? null;
        }
        return current;
      });
      return next;
    });
    setTabSqlContent((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    setTabAiSessions((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  const handleViewChange = useCallback(
    (tabId: string, view: "data" | "structure") => {
      setTabViews((prev) => ({ ...prev, [tabId]: view }));
    },
    []
  );

  const handleSqlContentChange = useCallback(
    (tabId: string, content: string) => {
      setTabSqlContent((prev) => ({ ...prev, [tabId]: content }));
    },
    []
  );

  return (
    <div className={cn("flex h-full overflow-hidden", className)}>
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r flex flex-col overflow-hidden">
        {/* Sidebar header slot */}
        {sidebarHeader}

        {/* Table list */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <SchemaSidebar
            tables={schema}
            loading={schemaLoading}
            onSelectTable={openTable}
            onNewQuery={openSqlTab}
          />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab bar */}
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSwitch={setActiveTabId}
          onClose={closeTab}
          onNewSqlTab={openSqlTab}
        />

        {/* Content area */}
        <div className="flex-1 overflow-hidden">
          {activeTab === null ? (
            <EmptyState onNewQuery={openSqlTab} />
          ) : activeTab.type === "table" ? (
            (() => {
              const tableData = schema.find(
                (t) =>
                  t.schema === activeTab.schema && t.name === activeTab.table
              );
              if (!tableData) {
                return (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    Table schema not found
                  </div>
                );
              }
              const currentView = tabViews[activeTab.id] ?? "data";
              return (
                <DataGrid
                  key={activeTab.id}
                  queryExecutor={queryExecutor}
                  dialect={dialect}
                  tableSchema={tableData}
                  view={currentView}
                  onViewChange={(v) => handleViewChange(activeTab.id, v)}
                />
              );
            })()
          ) : (
            <SqlEditor
              key={activeTab.id}
              queryExecutor={queryExecutor}
              dialect={dialect}
              schema={schema}
              aiEnabled={aiEnabled}
              initialValue={tabSqlContent[activeTab.id]}
              onContentChange={(content) => handleSqlContentChange(activeTab.id, content)}
              aiSession={tabAiSessions[activeTab.id]}
              onAiSessionChange={(session) =>
                setTabAiSessions((prev) => ({ ...prev, [activeTab.id]: session }))
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onNewQuery }: { onNewQuery: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
      <Database className="h-10 w-10 text-muted-foreground/30" />
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          Select a table from the sidebar
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          or{" "}
          <button
            onClick={onNewQuery}
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            open a SQL editor
          </button>
        </p>
      </div>
    </div>
  );
}
