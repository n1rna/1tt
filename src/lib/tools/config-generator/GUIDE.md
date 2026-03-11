# Config Generator - App Definition Guide

Use this guide to create a new app definition for the Config Generator tool. Give this guide along with the tool's documentation URL to an AI assistant to generate the complete app definition file.

---

## Prompt Template

Copy and fill in this prompt, then give it to the AI assistant:

```
I need you to create a config generator app definition for [TOOL NAME].

Documentation: [URL TO OFFICIAL DOCS]

Follow the guide exactly as written in this file. Read the documentation URL to understand all available configuration options, their types, allowed values, and defaults. Then produce a single TypeScript file that exports an AppDefinition.
```

---

## Architecture

Each supported app is a single TypeScript file in `src/lib/tools/config-generator/apps/`. It exports a const that satisfies the `AppDefinition` interface. After creating the file, register it in `apps/index.ts`.

The UI renders a two-pane layout: a form on the left built from the `sections` and `fields` arrays, and a live code editor on the right showing the serialized config. The `serialize` and `deserialize` functions handle bidirectional sync between the form and the editor.

## Type Reference

```typescript
// src/lib/tools/config-generator/types.ts

type ConfigFormat = "json" | "yaml" | "toml" | "ini" | "nginx" | "text" | "env";

interface AppDefinition {
  id: string;              // Unique identifier, lowercase, e.g. "tsconfig"
  name: string;            // Display name, e.g. "TypeScript"
  configFileName: string;  // Actual filename, e.g. "tsconfig.json"
  version: string;         // Version of the tool this config targets, e.g. "5.7"
  format: ConfigFormat;    // Determines editor syntax highlighting
  icon: string;            // Lucide icon name (not used in dropdown currently)
  description: string;     // One-line description
  docsUrl: string;         // Link to official documentation
  sections: ConfigSection[];
  serialize: (values: Record<string, unknown>, enabledFields: Set<string>) => string;
  deserialize: (raw: string) => { values: Record<string, unknown>; enabledFields: string[] };
}

interface ConfigSection {
  id: string;              // Unique within the app, e.g. "strictChecks"
  label: string;           // Section heading shown in the form
  description?: string;    // Optional subtext below the heading
  fields: ConfigField[];
}

// Discriminated union - the `type` field determines which control renders
type ConfigField =
  | BooleanField      // Toggle switch
  | StringField       // Text input
  | NumberField       // Number input with optional min/max
  | SelectField       // Single-select dropdown
  | MultiSelectField  // Checkbox grid
  | StringArrayField; // Tag input (badges + Enter to add)

// Every field has these base properties:
// - id: string           Unique key, usually matching the config key path.
//                         Use dot-paths for nested configs: "compilerOptions.strict"
// - label: string        Shown next to the control
// - description?: string Small muted text below the field
// - enabledByDefault?: boolean  If true, field is toggled on initially
//                               (included in the generated config from the start)
```

## Field Type Usage

Pick the right field type based on the config option:

| Config option type | Field type | When to use |
|---|---|---|
| `true`/`false` | `boolean` | On/off flags |
| Free-form text | `string` | Paths, names, URLs, freeform values |
| Numeric value | `number` | Ports, counts, sizes. Set `min`/`max` when the docs specify bounds |
| One of N choices | `select` | Enum-like options where exactly one value is picked |
| Multiple of N choices | `multi-select` | Array fields with a known set of valid values (e.g. `lib` in tsconfig) |
| Array of arbitrary strings | `string-array` | Glob patterns, file lists, custom entries |

## How to Write an App Definition

### Step 1: Determine the config format

Read the tool's docs to find what file format the config uses. Map it:

- `.json`, `.eslintrc.json`, `tsconfig.json` -> `"json"`
- `.yml`, `.yaml` -> `"yaml"`
- `.toml` -> `"toml"`
- `.ini`, `.cfg` -> `"ini"`
- `nginx.conf` -> `"nginx"`
- `.gitignore`, `.env`, line-based -> `"text"` or `"env"`

### Step 2: Identify sections and fields

Group related options into 3-6 sections. Common groupings:

- By functional area (e.g. "Build Target", "Strict Checks", "Emit")
- By config nesting (e.g. "Server", "SSL", "Proxy")
- By importance (most commonly changed options first)

For each option, determine:
1. The config key (use dot-paths for nesting)
2. The correct field type (see table above)
3. The default value (from the tool's docs)
4. Whether it should be enabled by default (common options people usually set)
5. A one-line description (copy/adapt from the docs)

### Step 3: Write serialize

The `serialize` function converts form values into the config file text. Rules:

- Only include fields present in `enabledFields`
- Produce clean, idiomatic output (proper indentation, comments where conventional)
- Handle special cases (e.g. tsconfig `paths` is stored as string-array in the form but needs to be an object in JSON)

For JSON configs, the pattern is simple:
```typescript
serialize(values, enabledFields) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!enabledFields.has(key)) continue;
    out[key] = value;
  }
  return JSON.stringify(out, null, 2);
}
```

For nested JSON configs (like tsconfig), use a `setDotPath` helper to build the nested structure from dot-path keys.

For non-JSON formats (YAML, nginx, text), write a custom serializer. Do NOT use external libraries - write a minimal formatter that handles only what this specific config needs.

### Step 4: Write deserialize

The `deserialize` function parses raw config text back into form values. Rules:

- Return `{ values, enabledFields }` where `enabledFields` lists the IDs of fields found in the text
- Handle parse errors gracefully - return `{ values: {}, enabledFields: [] }` on failure
- For JSON: `JSON.parse` then flatten/map keys to field IDs
- For non-JSON: use targeted regex or line-by-line parsing

### Step 5: Register the app

Add to `apps/index.ts`:
```typescript
import { myApp } from "./my-app";
// Add to the apps array
// Add to the named exports
```

## Complete Examples

### Example 1: Flat JSON config (Prettier)

Simplest pattern - flat key-value JSON with no nesting.

```typescript
import type { AppDefinition } from "../types";

export const prettier: AppDefinition = {
  id: "prettier",
  name: "Prettier",
  configFileName: ".prettierrc",
  version: "3.4",
  format: "json",
  icon: "Paintbrush",
  description: "Prettier code formatter configuration",
  docsUrl: "https://prettier.io/docs/en/options",
  sections: [
    {
      id: "formatting",
      label: "Formatting",
      description: "Core formatting rules for line length, indentation, and quotes.",
      fields: [
        {
          id: "printWidth",          // flat key - matches JSON key directly
          label: "printWidth",
          description: "Specify the line length that the printer will wrap on.",
          type: "number",
          defaultValue: 80,
          min: 40,
          max: 200,
          enabledByDefault: true,    // commonly set option
        },
        {
          id: "semi",
          label: "semi",
          description: "Print semicolons at the end of statements.",
          type: "boolean",
          defaultValue: true,
          enabledByDefault: true,
        },
        {
          id: "singleQuote",
          label: "singleQuote",
          description: "Use single quotes instead of double quotes.",
          type: "boolean",
          defaultValue: false,
          enabledByDefault: true,
        },
        // ... more fields
      ],
    },
    // ... more sections
  ],

  serialize(values, enabledFields) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      if (!enabledFields.has(key)) continue;
      out[key] = value;
    }
    return JSON.stringify(out, null, 2);
  },

  deserialize(raw) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { values: {}, enabledFields: [] };
    }
    const values: Record<string, unknown> = {};
    const enabledFields: string[] = [];
    for (const [key, val] of Object.entries(parsed)) {
      values[key] = val;
      enabledFields.push(key);
    }
    return { values, enabledFields };
  },
};
```

### Example 2: Nested JSON config (tsconfig)

Uses dot-path field IDs to represent nested keys like `compilerOptions.strict`.

Key patterns:
- Field IDs use dots: `"compilerOptions.target"`, `"compilerOptions.strict"`
- Top-level keys like `"include"` have no dots
- `serialize` builds a nested object from the dot-paths
- `deserialize` flattens the nested object back to dot-paths

```typescript
// Helper to set nested value from dot-path
function setDotPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof current[parts[i]] !== "object" || current[parts[i]] === null) {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

// In serialize: group by prefix, build nested structure
serialize(values, enabledFields) {
  const root: Record<string, unknown> = {};
  const compilerOptions: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(values)) {
    if (!enabledFields.has(key)) continue;
    if (key.startsWith("compilerOptions.")) {
      compilerOptions[key.slice("compilerOptions.".length)] = value;
    } else {
      root[key] = value;
    }
  }

  if (Object.keys(compilerOptions).length > 0) {
    root["compilerOptions"] = compilerOptions;
  }
  return JSON.stringify(root, null, 2);
}
```

### Example 3: Custom format (nginx)

For non-JSON formats, write a format-specific serializer. No external dependencies.

Key patterns:
- Field IDs are flat camelCase keys (no dots needed since the nesting is handled by the serializer)
- `serialize` builds the format line by line with proper indentation
- `deserialize` uses regex to extract values from the raw text

```typescript
serialize(values, enabledFields) {
  const get = (key: string): unknown =>
    enabledFields.has(key) ? values[key] : undefined;

  const lines: string[] = [];
  lines.push("server {");

  const listen = get("listen");
  if (listen !== undefined) lines.push(`    listen ${listen};`);

  const serverName = get("serverName");
  if (serverName) lines.push(`    server_name ${serverName};`);

  // Conditional nested block
  const proxyPass = get("proxyPass");
  if (proxyPass) {
    lines.push("");
    lines.push("    location / {");
    lines.push(`        proxy_pass ${proxyPass};`);
    lines.push("    }");
  }

  lines.push("}");
  return lines.join("\n");
}

deserialize(raw) {
  const values: Record<string, unknown> = {};
  const enabledFields: string[] = [];

  // Use regex for each directive
  const m = raw.match(/^\s*listen\s+(.+?);/m);
  if (m) {
    values["listen"] = m[1].trim();
    enabledFields.push("listen");
  }
  // ... repeat for each field

  return { values, enabledFields };
}
```

### Example 4: Text/line-based format (.gitignore)

For line-based formats, use preset blocks with comment headers.

Key patterns:
- Boolean fields act as preset toggles (on/off for a group of patterns)
- A `string-array` field for custom entries
- `serialize` concatenates preset blocks with `# Label` comment headers
- `deserialize` detects presets by checking for signature patterns

```typescript
const PRESETS: Record<string, { label: string; patterns: string[] }> = {
  node: {
    label: "Node",
    patterns: ["node_modules/", "dist/", ".env", ".env.local"],
  },
  // ...
};

serialize(values, enabledFields) {
  const sections: string[] = [];
  for (const [presetId, preset] of Object.entries(PRESETS)) {
    if (enabledFields.has(presetId) && values[presetId] === true) {
      sections.push(`# ${preset.label}`);
      sections.push(preset.patterns.join("\n"));
      sections.push("");
    }
  }
  // Append custom patterns
  const customs = values["customPatterns"] as string[] | undefined;
  if (enabledFields.has("customPatterns") && customs?.length) {
    sections.push("# Custom");
    sections.push(customs.join("\n"));
    sections.push("");
  }
  return sections.join("\n").trimEnd() + "\n";
}
```

## Conventions

1. **Field IDs must be unique** across all sections within an app
2. **Use dot-paths** for nested config keys: `"compilerOptions.strict"`, `"rules.no-var"`
3. **Use flat IDs** for custom/non-JSON formats: `"listen"`, `"proxyPass"`, `"gzip"`
4. **Set `enabledByDefault: true`** for options that most users will want in their config (the most common, opinionated defaults)
5. **Don't enable everything by default** - a clean config with fewer options is better. Only enable the 5-10 most important options
6. **Descriptions should be one sentence**, adapted from the official docs
7. **Field labels** should match the actual config key name when possible (e.g. `"printWidth"` not `"Print Width"`)
8. **Section labels** should be short (1-3 words) and descriptive
9. **No external dependencies** for serialization - write inline helpers
10. **Order sections** from most important/common to least
11. **Order fields within sections** from most important/common to least
12. **Version** should be the latest stable major.minor of the tool

## Checklist

Before submitting a new app definition:

- [ ] File is at `src/lib/tools/config-generator/apps/<id>.ts`
- [ ] Exports a named const matching the id (e.g. `export const prettier`)
- [ ] All fields have correct types and default values matching the tool's docs
- [ ] `enabledByDefault` is set on the 5-10 most common options
- [ ] `serialize` only includes fields in `enabledFields`
- [ ] `serialize` produces valid, idiomatic config output
- [ ] `deserialize` gracefully handles parse errors
- [ ] `deserialize` returns all detected field IDs in `enabledFields`
- [ ] No external dependencies imported
- [ ] Registered in `apps/index.ts` (import, add to array, add to named exports)
- [ ] `docsUrl` points to the official configuration reference
- [ ] `version` matches the latest stable release of the tool
- [ ] TypeScript compiles with no errors (`npx tsc --noEmit`)
