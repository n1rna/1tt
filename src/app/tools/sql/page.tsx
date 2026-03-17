import SqlFormatterTool from "@/components/tools/sql-formatter";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "sql",
  title: "SQL Formatter — Format, Beautify & Minify SQL Online",
  description:
    "Format and beautify SQL queries with dialect support for PostgreSQL, MySQL, SQLite, BigQuery, MSSQL, and more. Adjust indentation, keyword case, and line spacing. Includes AI-powered natural language to SQL generation.",
  keywords: [
    "sql formatter",
    "sql beautifier",
    "format sql",
    "sql minifier",
    "sql pretty print",
    "postgresql formatter",
    "mysql formatter",
    "sqlite formatter",
    "bigquery formatter",
    "transact-sql",
    "plsql",
    "sql syntax highlighter",
    "natural language to sql",
    "ai sql generator",
  ],
});

export default function SqlPage() {
  const jsonLd = toolJsonLd("sql");
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <style>{`body { overflow: hidden; }`}</style>
      <SqlFormatterTool />
    </>
  );
}
