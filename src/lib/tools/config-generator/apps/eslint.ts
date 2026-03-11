import type { AppDefinition } from "../types";

export const eslint: AppDefinition = {
  id: "eslint",
  name: "ESLint",
  configFileName: "eslint.config.json",
  version: "9.0",
  format: "json",
  icon: "ShieldCheck",
  description: "ESLint flat configuration",
  docsUrl: "https://eslint.org/docs/latest/use/configure/",
  sections: [
    {
      id: "language",
      label: "Language",
      description: "Parser and language options.",
      fields: [
        {
          id: "languageOptions.ecmaVersion",
          label: "ecmaVersion",
          description: "The ECMAScript version to use for parsing.",
          type: "select",
          options: [
            { value: "2020", label: "2020" },
            { value: "2022", label: "2022" },
            { value: "2024", label: "2024" },
            { value: "latest", label: "latest" },
          ],
          defaultValue: "2022",
          enabledByDefault: true,
        },
        {
          id: "languageOptions.sourceType",
          label: "sourceType",
          description: "How to treat files - as ES modules, CommonJS, or scripts.",
          type: "select",
          options: [
            { value: "module", label: "module" },
            { value: "commonjs", label: "commonjs" },
            { value: "script", label: "script" },
          ],
          defaultValue: "module",
          enabledByDefault: true,
        },
        {
          id: "languageOptions.parser",
          label: "parser",
          description: "The parser to use for JavaScript/TypeScript files.",
          type: "select",
          options: [
            { value: "default", label: "default (espree)" },
            { value: "@typescript-eslint/parser", label: "@typescript-eslint/parser" },
          ],
          defaultValue: "default",
        },
        {
          id: "languageOptions.parserOptions.jsx",
          label: "jsx",
          description: "Enables parsing JSX syntax.",
          type: "boolean",
          defaultValue: false,
        },
      ],
    },
    {
      id: "rulesBestPractices",
      label: "Rules - Best Practices",
      description: "Core ESLint rules for common code quality issues.",
      fields: [
        {
          id: "rules.no-unused-vars",
          label: "no-unused-vars",
          description: "Disallows unused variables.",
          type: "select",
          options: [
            { value: "off", label: "off" },
            { value: "warn", label: "warn" },
            { value: "error", label: "error" },
          ],
          defaultValue: "warn",
          enabledByDefault: true,
        },
        {
          id: "rules.no-console",
          label: "no-console",
          description: "Disallows calls to console methods.",
          type: "select",
          options: [
            { value: "off", label: "off" },
            { value: "warn", label: "warn" },
            { value: "error", label: "error" },
          ],
          defaultValue: "warn",
        },
        {
          id: "rules.eqeqeq",
          label: "eqeqeq",
          description: "Requires the use of === and !==.",
          type: "select",
          options: [
            { value: "off", label: "off" },
            { value: "warn", label: "warn" },
            { value: "error", label: "error" },
          ],
          defaultValue: "error",
          enabledByDefault: true,
        },
        {
          id: "rules.curly",
          label: "curly",
          description: "Requires curly braces for all control flow statements.",
          type: "select",
          options: [
            { value: "off", label: "off" },
            { value: "warn", label: "warn" },
            { value: "error", label: "error" },
          ],
          defaultValue: "error",
        },
        {
          id: "rules.no-var",
          label: "no-var",
          description: "Requires let or const instead of var.",
          type: "select",
          options: [
            { value: "off", label: "off" },
            { value: "warn", label: "warn" },
            { value: "error", label: "error" },
          ],
          defaultValue: "error",
          enabledByDefault: true,
        },
      ],
    },
    {
      id: "rulesTypeScript",
      label: "Rules - TypeScript",
      description: "Rules from @typescript-eslint/eslint-plugin.",
      fields: [
        {
          id: "rules.@typescript-eslint/no-explicit-any",
          label: "@typescript-eslint/no-explicit-any",
          description: "Disallows the any type.",
          type: "select",
          options: [
            { value: "off", label: "off" },
            { value: "warn", label: "warn" },
            { value: "error", label: "error" },
          ],
          defaultValue: "warn",
        },
        {
          id: "rules.@typescript-eslint/no-unused-vars",
          label: "@typescript-eslint/no-unused-vars",
          description: "Disallows unused variables (TypeScript-aware).",
          type: "select",
          options: [
            { value: "off", label: "off" },
            { value: "warn", label: "warn" },
            { value: "error", label: "error" },
          ],
          defaultValue: "warn",
        },
        {
          id: "rules.@typescript-eslint/explicit-function-return-type",
          label: "@typescript-eslint/explicit-function-return-type",
          description: "Requires explicit return types on functions.",
          type: "select",
          options: [
            { value: "off", label: "off" },
            { value: "warn", label: "warn" },
            { value: "error", label: "error" },
          ],
          defaultValue: "off",
        },
      ],
    },
    {
      id: "files",
      label: "Files",
      description: "Which files this config applies to and which to ignore.",
      fields: [
        {
          id: "files",
          label: "files",
          description: "Glob patterns of files this config applies to.",
          type: "string-array",
          defaultValue: ["**/*.{js,jsx,ts,tsx}"],
          enabledByDefault: true,
        },
        {
          id: "ignores",
          label: "ignores",
          description: "Glob patterns for files to ignore.",
          type: "string-array",
          defaultValue: ["node_modules/", "dist/"],
          enabledByDefault: true,
        },
      ],
    },
  ],

  serialize(values, enabledFields) {
    // ESLint flat config is an array with one config object
    const config: Record<string, unknown> = {};

    const languageOptions: Record<string, unknown> = {};
    const parserOptions: Record<string, unknown> = {};
    const rules: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(values)) {
      if (!enabledFields.has(key)) continue;

      if (key === "files") {
        config["files"] = value;
      } else if (key === "ignores") {
        config["ignores"] = value;
      } else if (key.startsWith("rules.")) {
        const ruleName = key.slice("rules.".length);
        rules[ruleName] = value;
      } else if (key === "languageOptions.parser") {
        if (value !== "default") {
          languageOptions["parser"] = value;
        }
      } else if (key === "languageOptions.parserOptions.jsx") {
        parserOptions["jsx"] = value;
      } else if (key.startsWith("languageOptions.")) {
        const subKey = key.slice("languageOptions.".length);
        languageOptions[subKey] = value;
      }
    }

    if (Object.keys(parserOptions).length > 0) {
      languageOptions["parserOptions"] = parserOptions;
    }
    if (Object.keys(languageOptions).length > 0) {
      config["languageOptions"] = languageOptions;
    }
    if (Object.keys(rules).length > 0) {
      config["rules"] = rules;
    }

    return JSON.stringify([config], null, 2);
  },

  deserialize(raw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { values: {}, enabledFields: [] };
    }

    const values: Record<string, unknown> = {};
    const enabledFields: string[] = [];

    // Flat config is an array; take the first element
    const configArr = Array.isArray(parsed) ? parsed : [parsed];
    const config = configArr[0] as Record<string, unknown> | undefined;
    if (!config) return { values: {}, enabledFields: [] };

    if (config["files"] !== undefined) {
      values["files"] = config["files"];
      enabledFields.push("files");
    }
    if (config["ignores"] !== undefined) {
      values["ignores"] = config["ignores"];
      enabledFields.push("ignores");
    }

    const lo = config["languageOptions"] as Record<string, unknown> | undefined;
    if (lo) {
      for (const [k, v] of Object.entries(lo)) {
        if (k === "parserOptions" && typeof v === "object" && v !== null) {
          for (const [pk, pv] of Object.entries(v as Record<string, unknown>)) {
            const key = `languageOptions.parserOptions.${pk}`;
            values[key] = pv;
            enabledFields.push(key);
          }
        } else {
          const key = `languageOptions.${k}`;
          values[key] = v;
          enabledFields.push(key);
        }
      }
    }

    const rulesObj = config["rules"] as Record<string, unknown> | undefined;
    if (rulesObj) {
      for (const [ruleName, ruleVal] of Object.entries(rulesObj)) {
        const key = `rules.${ruleName}`;
        values[key] = ruleVal;
        enabledFields.push(key);
      }
    }

    return { values, enabledFields };
  },

  validate(raw) {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "[]") return { valid: true };
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) {
        return { valid: false, error: "ESLint flat config must be a JSON array" };
      }
      return { valid: true };
    } catch (e) {
      return { valid: false, error: e instanceof Error ? e.message : "Invalid JSON" };
    }
  },
};