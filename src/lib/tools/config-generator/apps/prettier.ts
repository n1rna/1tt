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
          id: "printWidth",
          label: "printWidth",
          description: "Specify the line length that the printer will wrap on.",
          type: "number",
          defaultValue: 80,
          min: 40,
          max: 200,
          enabledByDefault: true,
        },
        {
          id: "tabWidth",
          label: "tabWidth",
          description: "Specify the number of spaces per indentation level.",
          type: "number",
          defaultValue: 2,
          min: 1,
          max: 8,
          enabledByDefault: true,
        },
        {
          id: "useTabs",
          label: "useTabs",
          description: "Indent lines with tabs instead of spaces.",
          type: "boolean",
          defaultValue: false,
          enabledByDefault: true,
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
        {
          id: "quoteProps",
          label: "quoteProps",
          description: "Change when properties in objects are quoted.",
          type: "select",
          options: [
            { value: "as-needed", label: "as-needed" },
            { value: "consistent", label: "consistent" },
            { value: "preserve", label: "preserve" },
          ],
          defaultValue: "as-needed",
        },
        {
          id: "jsxSingleQuote",
          label: "jsxSingleQuote",
          description: "Use single quotes instead of double quotes in JSX.",
          type: "boolean",
          defaultValue: false,
        },
      ],
    },
    {
      id: "trailingSpacing",
      label: "Trailing & Spacing",
      description: "Trailing commas, bracket spacing, and arrow functions.",
      fields: [
        {
          id: "trailingComma",
          label: "trailingComma",
          description: "Print trailing commas wherever possible in multi-line constructs.",
          type: "select",
          options: [
            { value: "all", label: "all" },
            { value: "es5", label: "es5" },
            { value: "none", label: "none" },
          ],
          defaultValue: "all",
          enabledByDefault: true,
        },
        {
          id: "bracketSpacing",
          label: "bracketSpacing",
          description: "Print spaces between brackets in object literals.",
          type: "boolean",
          defaultValue: true,
          enabledByDefault: true,
        },
        {
          id: "bracketSameLine",
          label: "bracketSameLine",
          description: "Put the > of a multi-line HTML element at the end of the last line.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "arrowParens",
          label: "arrowParens",
          description: "Include parentheses around sole arrow function arguments.",
          type: "select",
          options: [
            { value: "always", label: "always" },
            { value: "avoid", label: "avoid" },
          ],
          defaultValue: "always",
          enabledByDefault: true,
        },
      ],
    },
    {
      id: "proseSpecial",
      label: "Prose & Special",
      description: "Markdown, line endings, and HTML handling.",
      fields: [
        {
          id: "proseWrap",
          label: "proseWrap",
          description: "How to wrap prose in Markdown files.",
          type: "select",
          options: [
            { value: "preserve", label: "preserve" },
            { value: "always", label: "always" },
            { value: "never", label: "never" },
          ],
          defaultValue: "preserve",
        },
        {
          id: "endOfLine",
          label: "endOfLine",
          description: "Which end of line characters to apply.",
          type: "select",
          options: [
            { value: "lf", label: "lf" },
            { value: "crlf", label: "crlf" },
            { value: "cr", label: "cr" },
            { value: "auto", label: "auto" },
          ],
          defaultValue: "lf",
          enabledByDefault: true,
        },
        {
          id: "singleAttributePerLine",
          label: "singleAttributePerLine",
          description: "Enforce single attribute per line in HTML, Vue, and JSX.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "htmlWhitespaceSensitivity",
          label: "htmlWhitespaceSensitivity",
          description: "How to handle whitespace in HTML global files.",
          type: "select",
          options: [
            { value: "css", label: "css" },
            { value: "strict", label: "strict" },
            { value: "ignore", label: "ignore" },
          ],
          defaultValue: "css",
        },
      ],
    },
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

  validate(raw) {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "{}") return { valid: true };
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return { valid: false, error: "Config must be a JSON object" };
      }
      return { valid: true };
    } catch (e) {
      return { valid: false, error: e instanceof Error ? e.message : "Invalid JSON" };
    }
  },
};