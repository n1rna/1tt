import type { AppDefinition } from "../types";

// Converts a flat dot-path record into a nested object.
// e.g. { "compilerOptions.strict": true } => { compilerOptions: { strict: true } }
function setDotPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof current[part] !== "object" || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

// Flattens a nested object into dot-path keys.
function flattenDotPaths(
  obj: Record<string, unknown>,
  prefix = "",
  result: Record<string, unknown> = {},
): Record<string, unknown> {
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      flattenDotPaths(val as Record<string, unknown>, fullKey, result);
    } else {
      result[fullKey] = val;
    }
  }
  return result;
}

export const tsconfig: AppDefinition = {
  id: "tsconfig",
  name: "TypeScript",
  configFileName: "tsconfig.json",
  version: "5.7",
  format: "json",
  icon: "FileCode2",
  description: "TypeScript compiler configuration",
  docsUrl: "https://www.typescriptlang.org/tsconfig",
  sections: [
    {
      id: "buildTarget",
      label: "Build Target",
      description: "Controls the JavaScript output target and module system.",
      fields: [
        {
          id: "compilerOptions.target",
          label: "Target",
          description: "Sets the JavaScript language version for emitted code.",
          type: "select",
          options: [
            { value: "ES2020", label: "ES2020" },
            { value: "ES2022", label: "ES2022" },
            { value: "ES2023", label: "ES2023" },
            { value: "ESNext", label: "ESNext" },
          ],
          defaultValue: "ES2022",
          enabledByDefault: true,
        },
        {
          id: "compilerOptions.module",
          label: "Module",
          description: "Sets the module system for the compiled output.",
          type: "select",
          options: [
            { value: "NodeNext", label: "NodeNext" },
            { value: "ESNext", label: "ESNext" },
            { value: "CommonJS", label: "CommonJS" },
            { value: "ES2022", label: "ES2022" },
          ],
          defaultValue: "NodeNext",
          enabledByDefault: true,
        },
        {
          id: "compilerOptions.moduleResolution",
          label: "Module Resolution",
          description: "Specifies how TypeScript looks up a file from a module specifier.",
          type: "select",
          options: [
            { value: "NodeNext", label: "NodeNext" },
            { value: "Bundler", label: "Bundler" },
            { value: "Node", label: "Node" },
          ],
          defaultValue: "NodeNext",
          enabledByDefault: true,
        },
        {
          id: "compilerOptions.lib",
          label: "Lib",
          description: "Specifies a set of bundled library declaration files.",
          type: "multi-select",
          options: [
            { value: "ES2020", label: "ES2020" },
            { value: "ES2022", label: "ES2022" },
            { value: "ES2023", label: "ES2023" },
            { value: "ESNext", label: "ESNext" },
            { value: "DOM", label: "DOM" },
            { value: "DOM.Iterable", label: "DOM.Iterable" },
            { value: "WebWorker", label: "WebWorker" },
          ],
          defaultValue: ["ES2022", "DOM", "DOM.Iterable"],
        },
      ],
    },
    {
      id: "strictChecks",
      label: "Strict Checks",
      description: "Type-safety and strictness flags.",
      fields: [
        {
          id: "compilerOptions.strict",
          label: "strict",
          description: "Enables all strict type-checking options.",
          type: "boolean",
          defaultValue: true,
          enabledByDefault: true,
        },
        {
          id: "compilerOptions.noImplicitAny",
          label: "noImplicitAny",
          description: "Raises an error on expressions and declarations with an implied any type.",
          type: "boolean",
          defaultValue: true,
        },
        {
          id: "compilerOptions.strictNullChecks",
          label: "strictNullChecks",
          description: "Ensures null and undefined are not assignable to other types.",
          type: "boolean",
          defaultValue: true,
        },
        {
          id: "compilerOptions.strictFunctionTypes",
          label: "strictFunctionTypes",
          description: "Enables stricter checking of function type parameters.",
          type: "boolean",
          defaultValue: true,
        },
        {
          id: "compilerOptions.noUnusedLocals",
          label: "noUnusedLocals",
          description: "Reports errors on unused local variables.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "compilerOptions.noUnusedParameters",
          label: "noUnusedParameters",
          description: "Reports errors on unused parameters in functions.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "compilerOptions.noImplicitReturns",
          label: "noImplicitReturns",
          description: "Requires that all code paths in a function return a value.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "compilerOptions.noFallthroughCasesInSwitch",
          label: "noFallthroughCasesInSwitch",
          description: "Reports errors for fallthrough cases in switch statements.",
          type: "boolean",
          defaultValue: false,
        },
      ],
    },
    {
      id: "emit",
      label: "Emit",
      description: "Controls the shape of the emitted JavaScript output.",
      fields: [
        {
          id: "compilerOptions.outDir",
          label: "outDir",
          description: "Redirect output structure to the directory.",
          type: "string",
          defaultValue: "./dist",
          placeholder: "./dist",
        },
        {
          id: "compilerOptions.rootDir",
          label: "rootDir",
          description: "Specifies the root folder within your source files.",
          type: "string",
          defaultValue: "./src",
          placeholder: "./src",
        },
        {
          id: "compilerOptions.declaration",
          label: "declaration",
          description: "Generates .d.ts files from TypeScript and JavaScript files.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "compilerOptions.declarationMap",
          label: "declarationMap",
          description: "Creates sourcemaps for .d.ts files.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "compilerOptions.sourceMap",
          label: "sourceMap",
          description: "Creates source map files for emitted JavaScript files.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "compilerOptions.removeComments",
          label: "removeComments",
          description: "Removes all comments from TypeScript files when converting to JavaScript.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "compilerOptions.jsx",
          label: "jsx",
          description: "Controls how JSX is emitted in JavaScript files.",
          type: "select",
          options: [
            { value: "react-jsx", label: "react-jsx" },
            { value: "react-jsxdev", label: "react-jsxdev" },
            { value: "react", label: "react" },
            { value: "preserve", label: "preserve" },
            { value: "react-native", label: "react-native" },
          ],
          defaultValue: "react-jsx",
        },
      ],
    },
    {
      id: "moduleResolution",
      label: "Module Resolution",
      description: "Path mapping and module resolution helpers.",
      fields: [
        {
          id: "compilerOptions.baseUrl",
          label: "baseUrl",
          description: "Lets you set a base directory to resolve non-absolute module names.",
          type: "string",
          defaultValue: ".",
          placeholder: ".",
        },
        {
          id: "compilerOptions.paths",
          label: "paths",
          description: "Path aliases (one per line, e.g. @/* ./src/*).",
          type: "string-array",
          defaultValue: [],
          placeholder: "e.g. @/* ./src/*",
        },
        {
          id: "compilerOptions.resolveJsonModule",
          label: "resolveJsonModule",
          description: "Enables importing .json files.",
          type: "boolean",
          defaultValue: true,
          enabledByDefault: true,
        },
        {
          id: "compilerOptions.esModuleInterop",
          label: "esModuleInterop",
          description: "Emits helpers for CommonJS/ESM interoperability.",
          type: "boolean",
          defaultValue: true,
          enabledByDefault: true,
        },
        {
          id: "compilerOptions.allowImportingTsExtensions",
          label: "allowImportingTsExtensions",
          description: "Allows imports to include TypeScript file extensions.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "compilerOptions.verbatimModuleSyntax",
          label: "verbatimModuleSyntax",
          description: "Forces import/export type elision to be explicit.",
          type: "boolean",
          defaultValue: false,
        },
      ],
    },
    {
      id: "project",
      label: "Project",
      description: "Top-level project structure and incremental build settings.",
      fields: [
        {
          id: "include",
          label: "include",
          description: "Specifies an array of glob patterns to include.",
          type: "string-array",
          defaultValue: ["src"],
          enabledByDefault: true,
        },
        {
          id: "exclude",
          label: "exclude",
          description: "Specifies an array of glob patterns to exclude.",
          type: "string-array",
          defaultValue: ["node_modules", "dist"],
          enabledByDefault: true,
        },
        {
          id: "compilerOptions.composite",
          label: "composite",
          description: "Enables project references and constraints for composite builds.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "compilerOptions.incremental",
          label: "incremental",
          description: "Enables incremental compilation by saving .tsbuildinfo files.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "compilerOptions.tsBuildInfoFile",
          label: "tsBuildInfoFile",
          description: "Specifies the path to .tsbuildinfo incremental compilation file.",
          type: "string",
          defaultValue: ".tsbuildinfo",
          placeholder: ".tsbuildinfo",
        },
      ],
    },
  ],

  serialize(values, enabledFields) {
    const root: Record<string, unknown> = {};
    const compilerOptionsFlat: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(values)) {
      if (!enabledFields.has(key)) continue;
      if (key.startsWith("compilerOptions.")) {
        const subKey = key.slice("compilerOptions.".length);
        // paths is stored as string-array of "alias target" pairs - convert to object
        if (subKey === "paths" && Array.isArray(value)) {
          const pathsObj: Record<string, string[]> = {};
          for (const entry of value as string[]) {
            const parts = entry.trim().split(/\s+/);
            if (parts.length === 2) {
              pathsObj[parts[0]] = [parts[1]];
            }
          }
          compilerOptionsFlat["paths"] = pathsObj;
        } else {
          compilerOptionsFlat[subKey] = value;
        }
      } else {
        root[key] = value;
      }
    }

    if (Object.keys(compilerOptionsFlat).length > 0) {
      // Build nested compilerOptions from flat keys
      const compilerOptions: Record<string, unknown> = {};
      setDotPath(compilerOptions, "", compilerOptionsFlat); // direct assign
      root["compilerOptions"] = compilerOptionsFlat;
    }

    return JSON.stringify(root, null, 2);
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

    const { compilerOptions, include, exclude, ...rest } = parsed as {
      compilerOptions?: Record<string, unknown>;
      include?: unknown;
      exclude?: unknown;
    };

    if (compilerOptions) {
      for (const [key, val] of Object.entries(compilerOptions)) {
        const dotKey = `compilerOptions.${key}`;
        if (key === "paths" && typeof val === "object" && val !== null) {
          // Convert paths object back to string-array
          const arr = Object.entries(val as Record<string, string[]>).map(
            ([alias, targets]) => `${alias} ${targets[0] ?? ""}`,
          );
          values[dotKey] = arr;
        } else {
          values[dotKey] = val;
        }
        enabledFields.push(dotKey);
      }
    }
    if (include !== undefined) {
      values["include"] = include;
      enabledFields.push("include");
    }
    if (exclude !== undefined) {
      values["exclude"] = exclude;
      enabledFields.push("exclude");
    }
    // remaining top-level keys (e.g. extends)
    for (const [key, val] of Object.entries(rest)) {
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
        return { valid: false, error: "tsconfig must be a JSON object" };
      }
      if (parsed.compilerOptions && typeof parsed.compilerOptions !== "object") {
        return { valid: false, error: "compilerOptions must be an object" };
      }
      return { valid: true };
    } catch (e) {
      return { valid: false, error: e instanceof Error ? e.message : "Invalid JSON" };
    }
  },
};