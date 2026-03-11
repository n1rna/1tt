import type { AppDefinition } from "../types";

const PRESETS: Record<string, { label: string; patterns: string[] }> = {
  node: {
    label: "Node",
    patterns: [
      "node_modules/",
      "npm-debug.log*",
      "yarn-debug.log*",
      "yarn-error.log*",
      "pnpm-debug.log*",
      ".npm",
      ".yarn/cache",
      ".pnp.*",
      "*.tgz",
      ".env",
      ".env.local",
      ".env.*.local",
      "dist/",
      "build/",
      ".cache/",
    ],
  },
  python: {
    label: "Python",
    patterns: [
      "__pycache__/",
      "*.py[cod]",
      "*$py.class",
      "*.so",
      ".Python",
      "env/",
      "venv/",
      ".venv/",
      "ENV/",
      "*.egg-info/",
      "dist/",
      "build/",
      ".pytest_cache/",
      ".mypy_cache/",
      ".ruff_cache/",
      "*.pyc",
    ],
  },
  rust: {
    label: "Rust",
    patterns: [
      "target/",
      "Cargo.lock",
      "**/*.rs.bk",
      "*.pdb",
    ],
  },
  go: {
    label: "Go",
    patterns: [
      "*.exe",
      "*.exe~",
      "*.dll",
      "*.so",
      "*.dylib",
      "*.test",
      "*.out",
      "vendor/",
      "/bin/",
    ],
  },
  java: {
    label: "Java",
    patterns: [
      "*.class",
      "*.jar",
      "*.war",
      "*.ear",
      "*.log",
      "target/",
      "build/",
      ".gradle/",
      "gradle-app.setting",
      "*.gradle",
      ".classpath",
      ".project",
      ".settings/",
    ],
  },
  macos: {
    label: "macOS",
    patterns: [
      ".DS_Store",
      ".AppleDouble",
      ".LSOverride",
      "._*",
      ".Spotlight-V100",
      ".Trashes",
      "__MACOSX/",
    ],
  },
  windows: {
    label: "Windows",
    patterns: [
      "Thumbs.db",
      "Thumbs.db:encryptable",
      "ehthumbs.db",
      "ehthumbs_vista.db",
      "*.stackdump",
      "[Dd]esktop.ini",
      "$RECYCLE.BIN/",
      "*.lnk",
    ],
  },
  linux: {
    label: "Linux",
    patterns: [
      "*~",
      ".fuse_hidden*",
      ".directory",
      ".Trash-*",
      ".nfs*",
    ],
  },
  ide: {
    label: "IDE / Editor",
    patterns: [
      ".vscode/",
      "!.vscode/extensions.json",
      ".idea/",
      "*.suo",
      "*.ntvs*",
      "*.njsproj",
      "*.sln",
      "*.sw?",
      ".vim/",
      "*.iml",
      "*.iws",
      ".fleet/",
    ],
  },
};

export const gitignore: AppDefinition = {
  id: "gitignore",
  name: ".gitignore",
  configFileName: ".gitignore",
  version: "n/a",
  format: "text",
  icon: "GitBranch",
  description: "Git ignore file for common project types",
  docsUrl: "https://git-scm.com/docs/gitignore",
  sections: [
    {
      id: "presets",
      label: "Presets",
      description: "Enable preset blocks for common languages and environments.",
      fields: [
        {
          id: "node",
          label: "Node.js",
          description: "node_modules, dist, .env files, npm/yarn/pnpm logs.",
          type: "boolean",
          defaultValue: true,
          enabledByDefault: true,
        },
        {
          id: "python",
          label: "Python",
          description: "__pycache__, venv, .pyc files, pytest/mypy caches.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "rust",
          label: "Rust",
          description: "target/, Cargo.lock (for libraries), backup files.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "go",
          label: "Go",
          description: "Compiled binaries, test binaries, vendor directory.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "java",
          label: "Java",
          description: "Compiled classes, JARs, Gradle and Maven build output.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "macos",
          label: "macOS",
          description: ".DS_Store, Spotlight, Trash metadata.",
          type: "boolean",
          defaultValue: true,
          enabledByDefault: true,
        },
        {
          id: "windows",
          label: "Windows",
          description: "Thumbs.db, desktop.ini, Recycle Bin entries.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "linux",
          label: "Linux",
          description: "Backup tildes, hidden desktop files, NFS leftovers.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "ide",
          label: "IDE / Editor",
          description: ".vscode/, .idea/, Vim swap files, JetBrains files.",
          type: "boolean",
          defaultValue: true,
          enabledByDefault: true,
        },
      ],
    },
    {
      id: "custom",
      label: "Custom",
      description: "Additional patterns to append.",
      fields: [
        {
          id: "customPatterns",
          label: "Custom patterns",
          description: "One glob pattern per line.",
          type: "string-array",
          defaultValue: [],
          placeholder: "e.g. *.log",
        },
      ],
    },
  ],

  serialize(values, enabledFields) {
    const sections: string[] = [];

    for (const [presetId, preset] of Object.entries(PRESETS)) {
      if (enabledFields.has(presetId) && values[presetId] === true) {
        sections.push(`# ${preset.label}`);
        sections.push(preset.patterns.join("\n"));
        sections.push("");
      }
    }

    if (enabledFields.has("customPatterns")) {
      const customs = values["customPatterns"] as string[] | undefined;
      if (Array.isArray(customs) && customs.length > 0) {
        sections.push("# Custom");
        sections.push(customs.join("\n"));
        sections.push("");
      }
    }

    return sections.join("\n").trimEnd() + "\n";
  },

  deserialize(raw) {
    const values: Record<string, unknown> = {};
    const enabledFields: string[] = [];

    // Detect active presets by checking for characteristic patterns
    const presetSignatures: Record<string, string> = {
      node: "node_modules/",
      python: "__pycache__/",
      rust: "target/",
      go: "vendor/",
      java: "*.class",
      macos: ".DS_Store",
      windows: "Thumbs.db",
      linux: ".fuse_hidden*",
      ide: ".vscode/",
    };

    for (const [presetId, signature] of Object.entries(presetSignatures)) {
      const active = raw.includes(signature);
      values[presetId] = active;
      if (active) enabledFields.push(presetId);
    }

    // Extract custom patterns - lines that don't start with # and aren't part of known presets
    const knownPatterns = new Set(
      Object.values(PRESETS).flatMap((p) => p.patterns),
    );
    const customPatterns: string[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (trimmed === "" || trimmed.startsWith("#")) continue;
      if (!knownPatterns.has(trimmed)) {
        customPatterns.push(trimmed);
      }
    }
    if (customPatterns.length > 0) {
      values["customPatterns"] = customPatterns;
      enabledFields.push("customPatterns");
    }

    return { values, enabledFields };
  },

  validate(raw) {
    const trimmed = raw.trim();
    if (trimmed === "") return { valid: true };
    // .gitignore is very permissive — just check for obviously invalid content
    for (const line of trimmed.split("\n")) {
      const l = line.trim();
      if (l === "" || l.startsWith("#")) continue;
      if (l.includes("\0")) {
        return { valid: false, error: "Pattern contains null byte" };
      }
    }
    return { valid: true };
  },
};