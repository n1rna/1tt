import type { AppDefinition } from "../types";

export const ohmyzsh: AppDefinition = {
  id: "ohmyzsh",
  name: "Oh My Zsh",
  configFileName: ".zshrc",
  version: "latest",
  format: "text",
  icon: "Terminal",
  description: "Oh My Zsh framework configuration for Zsh",
  docsUrl: "https://github.com/ohmyzsh/ohmyzsh/wiki/Settings",
  sections: [
    {
      id: "core",
      label: "Core",
      description: "Theme, plugins, and custom directory.",
      fields: [
        {
          id: "ZSH_THEME",
          label: "ZSH_THEME",
          description: "Oh My Zsh theme to load on startup.",
          type: "select",
          options: [
            { value: "robbyrussell", label: "robbyrussell" },
            { value: "agnoster", label: "agnoster" },
            { value: "powerlevel10k/powerlevel10k", label: "powerlevel10k" },
            { value: "af-magic", label: "af-magic" },
            { value: "bira", label: "bira" },
            { value: "clean", label: "clean" },
            { value: "dst", label: "dst" },
            { value: "fino", label: "fino" },
            { value: "gentoo", label: "gentoo" },
            { value: "half-life", label: "half-life" },
            { value: "lambda", label: "lambda" },
            { value: "minimal", label: "minimal" },
            { value: "refined", label: "refined" },
            { value: "simple", label: "simple" },
            { value: "ys", label: "ys" },
            { value: "random", label: "random" },
          ],
          defaultValue: "robbyrussell",
          enabledByDefault: true,
        },
        {
          id: "plugins",
          label: "plugins",
          description: "Oh My Zsh plugins to load.",
          type: "string-array",
          defaultValue: ["git"],
          placeholder: "Add plugin name",
          enabledByDefault: true,
        },
        {
          id: "ZSH_CUSTOM",
          label: "ZSH_CUSTOM",
          description: "Path to a custom directory for themes and plugins.",
          type: "string",
          defaultValue: "",
          placeholder: "$HOME/.oh-my-zsh/custom",
        },
      ],
    },
    {
      id: "update",
      label: "Update",
      description: "Automatic update mode and frequency.",
      fields: [
        {
          id: "update_mode",
          label: "Update mode",
          description: "How Oh My Zsh checks for updates.",
          type: "select",
          options: [
            { value: "disabled", label: "disabled" },
            { value: "auto", label: "auto" },
            { value: "reminder", label: "reminder" },
          ],
          defaultValue: "auto",
          enabledByDefault: true,
        },
        {
          id: "update_frequency",
          label: "Update frequency (days)",
          description: "Number of days between update checks.",
          type: "number",
          defaultValue: 13,
          min: 1,
          max: 365,
          enabledByDefault: true,
        },
      ],
    },
    {
      id: "completion",
      label: "Completion",
      description: "Tab-completion behavior and matching rules.",
      fields: [
        {
          id: "CASE_SENSITIVE",
          label: "CASE_SENSITIVE",
          description: "Use case-sensitive completion matching.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "HYPHEN_INSENSITIVE",
          label: "HYPHEN_INSENSITIVE",
          description: "Treat hyphens and underscores as interchangeable.",
          type: "boolean",
          defaultValue: true,
          enabledByDefault: true,
        },
        {
          id: "COMPLETION_WAITING_DOTS",
          label: "COMPLETION_WAITING_DOTS",
          description: "Show dots while waiting for completion to load.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "DISABLE_MAGIC_FUNCTIONS",
          label: "DISABLE_MAGIC_FUNCTIONS",
          description: "Disable magic functions that interfere with pasted URLs.",
          type: "boolean",
          defaultValue: false,
        },
      ],
    },
    {
      id: "display",
      label: "Display",
      description: "Terminal title, auto-correction, and listing options.",
      fields: [
        {
          id: "DISABLE_AUTO_TITLE",
          label: "DISABLE_AUTO_TITLE",
          description: "Prevent Oh My Zsh from setting the terminal title.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "ENABLE_CORRECTION",
          label: "ENABLE_CORRECTION",
          description: "Enable command auto-correction suggestions.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "DISABLE_UNTRACKED_FILES_DIRTY",
          label: "DISABLE_UNTRACKED_FILES_DIRTY",
          description: "Treat untracked files as clean in git status checks.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "DISABLE_LS_COLORS",
          label: "DISABLE_LS_COLORS",
          description: "Disable colorized output for ls commands.",
          type: "boolean",
          defaultValue: false,
        },
      ],
    },
    {
      id: "history",
      label: "History",
      description: "Command history timestamp format.",
      fields: [
        {
          id: "HIST_STAMPS",
          label: "HIST_STAMPS",
          description: "Date format shown in the history command output.",
          type: "select",
          options: [
            { value: "yyyy-mm-dd", label: "yyyy-mm-dd" },
            { value: "mm/dd/yyyy", label: "mm/dd/yyyy" },
            { value: "dd.mm.yyyy", label: "dd.mm.yyyy" },
          ],
          defaultValue: "yyyy-mm-dd",
          enabledByDefault: true,
        },
      ],
    },
    {
      id: "environment",
      label: "Environment",
      description: "Editor and locale environment variables.",
      fields: [
        {
          id: "EDITOR",
          label: "EDITOR",
          description: "Default text editor for terminal sessions.",
          type: "string",
          defaultValue: "vim",
          placeholder: "vim",
          enabledByDefault: true,
        },
        {
          id: "LANG",
          label: "LANG",
          description: "Locale setting for language and encoding.",
          type: "select",
          options: [
            { value: "en_US.UTF-8", label: "en_US.UTF-8" },
            { value: "en_GB.UTF-8", label: "en_GB.UTF-8" },
            { value: "de_DE.UTF-8", label: "de_DE.UTF-8" },
            { value: "fr_FR.UTF-8", label: "fr_FR.UTF-8" },
            { value: "ja_JP.UTF-8", label: "ja_JP.UTF-8" },
            { value: "zh_CN.UTF-8", label: "zh_CN.UTF-8" },
          ],
          defaultValue: "en_US.UTF-8",
        },
      ],
    },
  ],

  serialize(values, enabledFields) {
    const get = (key: string): unknown =>
      enabledFields.has(key) ? values[key] : undefined;

    const lines: string[] = [];

    // Header
    lines.push('export ZSH="$HOME/.oh-my-zsh"');
    lines.push("");

    // Theme
    const theme = get("ZSH_THEME");
    if (theme !== undefined) {
      lines.push("# Theme");
      lines.push(`ZSH_THEME="${theme}"`);
      lines.push("");
    }

    // Plugins
    const plugins = get("plugins");
    if (plugins !== undefined) {
      const list = plugins as string[];
      lines.push("# Plugins");
      lines.push(`plugins=(${list.join(" ")})`);
      lines.push("");
    }

    // Custom directory
    const zshCustom = get("ZSH_CUSTOM");
    if (zshCustom !== undefined && zshCustom !== "") {
      lines.push(`ZSH_CUSTOM="${zshCustom}"`);
      lines.push("");
    }

    // Update
    const updateMode = get("update_mode");
    const updateFrequency = get("update_frequency");
    if (updateMode !== undefined || updateFrequency !== undefined) {
      lines.push("# Update");
      if (updateMode !== undefined) {
        lines.push(`zstyle ':omz:update' mode ${updateMode}`);
      }
      if (updateFrequency !== undefined) {
        lines.push(`zstyle ':omz:update' frequency ${updateFrequency}`);
      }
      lines.push("");
    }

    // Completion
    const completionFields = [
      "CASE_SENSITIVE",
      "HYPHEN_INSENSITIVE",
      "COMPLETION_WAITING_DOTS",
      "DISABLE_MAGIC_FUNCTIONS",
    ];
    const completionLines: string[] = [];
    for (const id of completionFields) {
      const val = get(id);
      if (val !== undefined) {
        completionLines.push(`${id}="${val ? "true" : "false"}"`);
      }
    }
    if (completionLines.length > 0) {
      lines.push("# Completion");
      lines.push(...completionLines);
      lines.push("");
    }

    // Display
    const displayFields = [
      "DISABLE_AUTO_TITLE",
      "ENABLE_CORRECTION",
      "DISABLE_UNTRACKED_FILES_DIRTY",
      "DISABLE_LS_COLORS",
    ];
    const displayLines: string[] = [];
    for (const id of displayFields) {
      const val = get(id);
      if (val !== undefined) {
        displayLines.push(`${id}="${val ? "true" : "false"}"`);
      }
    }
    if (displayLines.length > 0) {
      lines.push("# Display");
      lines.push(...displayLines);
      lines.push("");
    }

    // History
    const histStamps = get("HIST_STAMPS");
    if (histStamps !== undefined) {
      lines.push("# History");
      lines.push(`HIST_STAMPS="${histStamps}"`);
      lines.push("");
    }

    // Source oh-my-zsh
    lines.push("source $ZSH/oh-my-zsh.sh");
    lines.push("");

    // Environment
    const editor = get("EDITOR");
    const lang = get("LANG");
    if (editor !== undefined || lang !== undefined) {
      lines.push("# Environment");
      if (editor !== undefined) {
        lines.push(`export EDITOR="${editor}"`);
      }
      if (lang !== undefined) {
        lines.push(`export LANG="${lang}"`);
      }
      lines.push("");
    }

    return lines.join("\n").trimEnd() + "\n";
  },

  deserialize(raw) {
    const values: Record<string, unknown> = {};
    const enabledFields: string[] = [];

    try {
      // Theme
      const themeMatch = raw.match(/^ZSH_THEME="(.*)"/m);
      if (themeMatch) {
        values["ZSH_THEME"] = themeMatch[1];
        enabledFields.push("ZSH_THEME");
      }

      // Plugins
      const pluginsMatch = raw.match(/^plugins=\(([^)]*)\)/m);
      if (pluginsMatch) {
        const list = pluginsMatch[1].trim().split(/\s+/).filter(Boolean);
        values["plugins"] = list;
        enabledFields.push("plugins");
      }

      // Custom directory
      const customMatch = raw.match(/^ZSH_CUSTOM="?([^"\n]+)"?/m);
      if (customMatch) {
        values["ZSH_CUSTOM"] = customMatch[1];
        enabledFields.push("ZSH_CUSTOM");
      }

      // Update mode
      const modeMatch = raw.match(/zstyle\s+':omz:update'\s+mode\s+(\S+)/);
      if (modeMatch) {
        values["update_mode"] = modeMatch[1];
        enabledFields.push("update_mode");
      }

      // Update frequency
      const freqMatch = raw.match(/zstyle\s+':omz:update'\s+frequency\s+(\d+)/);
      if (freqMatch) {
        values["update_frequency"] = parseInt(freqMatch[1], 10);
        enabledFields.push("update_frequency");
      }

      // Boolean settings
      const booleanFields = [
        "CASE_SENSITIVE",
        "HYPHEN_INSENSITIVE",
        "COMPLETION_WAITING_DOTS",
        "DISABLE_MAGIC_FUNCTIONS",
        "DISABLE_AUTO_TITLE",
        "ENABLE_CORRECTION",
        "DISABLE_UNTRACKED_FILES_DIRTY",
        "DISABLE_LS_COLORS",
      ];
      for (const field of booleanFields) {
        const m = raw.match(new RegExp(`^${field}="(true|false)"`, "m"));
        if (m) {
          values[field] = m[1] === "true";
          enabledFields.push(field);
        }
      }

      // History stamps
      const histMatch = raw.match(/^HIST_STAMPS="(.*)"/m);
      if (histMatch) {
        values["HIST_STAMPS"] = histMatch[1];
        enabledFields.push("HIST_STAMPS");
      }

      // Editor
      const editorMatch = raw.match(/^export\s+EDITOR="(.*)"/m);
      if (editorMatch) {
        values["EDITOR"] = editorMatch[1];
        enabledFields.push("EDITOR");
      }

      // Lang
      const langMatch = raw.match(/^export\s+LANG="(.*)"/m);
      if (langMatch) {
        values["LANG"] = langMatch[1];
        enabledFields.push("LANG");
      }
    } catch {
      return { values: {}, enabledFields: [] };
    }

    return { values, enabledFields };
  },

  validate(raw) {
    const trimmed = raw.trim();
    if (trimmed === "") return { valid: true };

    // Check balanced quotes on assignment lines
    for (const line of trimmed.split("\n")) {
      const stripped = line.trim();
      if (!stripped || stripped.startsWith("#")) continue;

      if (stripped.includes("=") && !stripped.startsWith("zstyle") && !stripped.startsWith("source") && !stripped.startsWith("export ZSH=")) {
        const afterEquals = stripped.slice(stripped.indexOf("=") + 1);
        const quoteCount = (afterEquals.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          return { valid: false, error: `Unbalanced quotes: ${stripped.slice(0, 50)}` };
        }
      }
    }

    // Check balanced parens in plugins
    const pluginsMatch = trimmed.match(/^plugins=(.*)$/m);
    if (pluginsMatch) {
      const val = pluginsMatch[1];
      const opens = (val.match(/\(/g) || []).length;
      const closes = (val.match(/\)/g) || []).length;
      if (opens !== closes) {
        return { valid: false, error: "Unbalanced parentheses in plugins" };
      }
    }

    return { valid: true };
  },
};
