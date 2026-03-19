import { GuideLayout } from "@/components/layout/guide-layout";
import { Guide } from "@/components/layout/guide-content";
import { guideMetadata, guideJsonLd } from "@/lib/guides/seo";

const slug = "csv-viewer";

export const metadata = guideMetadata({
  slug,
  title: "CSV Viewer with Dataset Splitting for ML",
  description:
    "Open, filter, sort, and edit CSV files in the browser. Split datasets into train/test sets with preset ratios — perfect for machine learning data preparation.",
  keywords: [
    "csv viewer",
    "csv editor",
    "csv splitter",
    "train test split",
    "dataset split",
    "machine learning data",
    "data preparation",
    "csv filter",
    "csv sort",
    "csv export",
    "80 20 split",
    "70 30 split",
  ],
});

export default function CsvViewerGuide() {
  const jsonLd = guideJsonLd(slug);
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <GuideLayout slug={slug}>
        <Guide.H2>A CSV viewer built for data work</Guide.H2>
        <Guide.P>
          The 1tt.dev CSV Viewer is more than a spreadsheet preview. It&apos;s a
          lightweight data tool that lets you open CSV files of any size, filter
          and sort rows, toggle column visibility, edit cells inline, and export
          subsets of your data — all without leaving the browser. Nothing is
          uploaded to a server; everything runs client-side.
        </Guide.P>
        <Guide.P>
          If you work with datasets for machine learning, analytics, or data
          engineering, the built-in <Guide.Strong>dataset splitting</Guide.Strong>{" "}
          feature is especially useful. You can split a CSV into train/test sets
          with a single click using common ratios like 80/20, 70/30, or any
          custom split you need.
        </Guide.P>

        <Guide.H2>Opening and exploring CSV files</Guide.H2>
        <Guide.P>
          Drag and drop a <Guide.Code>.csv</Guide.Code> file onto the viewer, or
          click to browse. The parser auto-detects the delimiter — commas, tabs,
          semicolons, and pipes are all supported.
        </Guide.P>
        <Guide.P>
          Once loaded, you get a fast, paginated table (100 rows per page) with:
        </Guide.P>
        <Guide.UL>
          <li>
            <Guide.Strong>Column sorting</Guide.Strong> — click any header to
            sort ascending or descending.
          </li>
          <li>
            <Guide.Strong>Search / filter</Guide.Strong> — type in the search
            bar to filter rows across all columns in real time.
          </li>
          <li>
            <Guide.Strong>Column visibility</Guide.Strong> — toggle individual
            columns on/off to focus on the fields that matter. Hidden columns are
            excluded from exports.
          </li>
          <li>
            <Guide.Strong>Row count and stats</Guide.Strong> — the toolbar shows
            total rows, filtered rows, and column count at a glance.
          </li>
        </Guide.UL>

        <Guide.H2>Editing data in place</Guide.H2>
        <Guide.P>
          Click the pencil icon on any row to open the row editor. You can modify
          cell values directly and save changes back to the in-memory dataset.
          You can also add new rows — useful for appending labels, annotations,
          or test cases before exporting.
        </Guide.P>
        <Guide.P>
          All edits stay in the browser. The original file is never modified.
          When you&apos;re done, export the edited data as a new CSV.
        </Guide.P>

        <Guide.H2>Exporting subsets</Guide.H2>
        <Guide.P>
          The export menu gives you precise control over what gets downloaded:
        </Guide.P>
        <Guide.UL>
          <li>
            <Guide.Strong>All rows</Guide.Strong> — export the full dataset
            (respecting column visibility).
          </li>
          <li>
            <Guide.Strong>Current view</Guide.Strong> — export only the rows
            matching your current filter/search.
          </li>
          <li>
            <Guide.Strong>First N / Last N rows</Guide.Strong> — grab the top or
            bottom slice of your data.
          </li>
          <li>
            <Guide.Strong>Random sample</Guide.Strong> — export a random
            percentage of rows (e.g., 10% sample for quick analysis).
          </li>
          <li>
            <Guide.Strong>Row range</Guide.Strong> — export rows between specific
            indices (e.g., rows 500–1000).
          </li>
        </Guide.UL>

        <Guide.H2>Dataset splitting for machine learning</Guide.H2>
        <Guide.P>
          This is the feature that sets the CSV Viewer apart from generic
          spreadsheet tools. When preparing data for machine learning, you
          typically need to split your dataset into training and testing subsets.
          The viewer does this with built-in presets:
        </Guide.P>
        <Guide.UL>
          <li>
            <Guide.Strong>80 / 20 split</Guide.Strong> — the most common ratio.
            80% for training, 20% for testing.
          </li>
          <li>
            <Guide.Strong>70 / 30 split</Guide.Strong> — a more conservative
            split with a larger test set.
          </li>
          <li>
            <Guide.Strong>90 / 10 split</Guide.Strong> — for large datasets
            where you want maximum training data.
          </li>
          <li>
            <Guide.Strong>60 / 40 split</Guide.Strong> — when you need a
            substantial validation set.
          </li>
        </Guide.UL>
        <Guide.P>
          When you select a split preset, the viewer{" "}
          <Guide.Strong>shuffles the data randomly</Guide.Strong> before
          splitting to avoid any ordering bias. It then downloads two separate
          CSV files — for example, <Guide.Code>mydata_train80.csv</Guide.Code>{" "}
          and <Guide.Code>mydata_test20.csv</Guide.Code>.
        </Guide.P>
        <Guide.Callout>
          The shuffle uses a Fisher-Yates algorithm on the entire dataset before
          splitting. This means every row has an equal chance of ending up in
          either subset, regardless of the original row order.
        </Guide.Callout>
        <Guide.P>
          Column visibility is respected during splits — if you&apos;ve hidden
          columns (like an ID column or irrelevant metadata), they won&apos;t
          appear in the exported train/test files. This lets you do feature
          selection visually before splitting.
        </Guide.P>

        <Guide.H2>Typical workflow</Guide.H2>
        <Guide.P>
          Here&apos;s how a data scientist or ML engineer might use the CSV
          Viewer in practice:
        </Guide.P>
        <Guide.OL>
          <li>
            <Guide.Strong>Load the dataset</Guide.Strong> — drag and drop your
            CSV file.
          </li>
          <li>
            <Guide.Strong>Inspect the data</Guide.Strong> — sort columns, search
            for anomalies, check row counts.
          </li>
          <li>
            <Guide.Strong>Clean up</Guide.Strong> — hide irrelevant columns
            (IDs, timestamps, debug fields), edit incorrect values.
          </li>
          <li>
            <Guide.Strong>Filter if needed</Guide.Strong> — use search to focus
            on a subset (e.g., only rows where{" "}
            <Guide.Code>status=active</Guide.Code>), then export the filtered
            view.
          </li>
          <li>
            <Guide.Strong>Split for ML</Guide.Strong> — pick an 80/20 or 70/30
            preset, download the train and test files.
          </li>
          <li>
            <Guide.Strong>Feed into your pipeline</Guide.Strong> — use the
            exported CSVs directly in pandas, scikit-learn, PyTorch, or any ML
            framework.
          </li>
        </Guide.OL>

        <Guide.H2>No upload, no limits</Guide.H2>
        <Guide.P>
          Everything happens in the browser using client-side JavaScript. Your
          data never leaves your machine — there&apos;s no upload, no server
          processing, no file size limits beyond your browser&apos;s memory. This
          makes it safe for sensitive or proprietary datasets.
        </Guide.P>
        <Guide.P>
          The CSV Viewer is free and requires no account. Open it at{" "}
          <Guide.Code>/tools/csv</Guide.Code> and start working with your data
          immediately.
        </Guide.P>
      </GuideLayout>
    </>
  );
}
