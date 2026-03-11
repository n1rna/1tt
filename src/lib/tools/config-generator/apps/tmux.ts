import type { AppDefinition } from "../types";

const WINDOW_OPTIONS = new Set(["pane-base-index", "aggressive-resize"]);

function quote(val: string): string {
  if (val.includes(" ") || val.includes(",") || val.includes("#")) {
    return `"${val}"`;
  }
  return val;
}

export const tmux: AppDefinition = {
  id: "tmux",
  name: "tmux",
  configFileName: "tmux.conf",
  version: "3.5",
  format: "text",
  icon: "SquareSplitHorizontal",
  description: "tmux terminal multiplexer configuration",
  docsUrl: "https://man.openbsd.org/tmux",
  sections: [
    {
      id: "general",
      label: "General",
      description: "Terminal defaults, scrollback, and numbering.",
      fields: [
        {
          id: "default-terminal",
          label: "default-terminal",
          description: "Terminal type used for color and capability detection.",
          type: "string",
          defaultValue: "tmux-256color",
          placeholder: "tmux-256color",
          enabledByDefault: true,
        },
        {
          id: "default-shell",
          label: "default-shell",
          description: "Default shell for new windows.",
          type: "string",
          defaultValue: "",
          placeholder: "/bin/zsh",
        },
        {
          id: "history-limit",
          label: "history-limit",
          description: "Maximum number of scrollback lines per pane.",
          type: "number",
          defaultValue: 50000,
          min: 0,
          max: 1000000,
          enabledByDefault: true,
        },
        {
          id: "escape-time",
          label: "escape-time",
          description: "Time in milliseconds to wait for an escape sequence.",
          type: "number",
          defaultValue: 500,
          min: 0,
          max: 5000,
          enabledByDefault: true,
        },
        {
          id: "base-index",
          label: "base-index",
          description: "Starting index for window numbering.",
          type: "number",
          defaultValue: 0,
          min: 0,
          max: 10,
          enabledByDefault: true,
        },
        {
          id: "pane-base-index",
          label: "pane-base-index",
          description: "Starting index for pane numbering.",
          type: "number",
          defaultValue: 0,
          min: 0,
          max: 10,
          enabledByDefault: true,
        },
        {
          id: "renumber-windows",
          label: "renumber-windows",
          description: "Automatically renumber windows when one is closed.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "set-titles",
          label: "set-titles",
          description: "Allow tmux to set the terminal title.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "set-titles-string",
          label: "set-titles-string",
          description: "Format string for the terminal title.",
          type: "string",
          defaultValue: "#T",
          placeholder: "#S:#W",
        },
        {
          id: "focus-events",
          label: "focus-events",
          description: "Pass through focus events to applications.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "buffer-limit",
          label: "buffer-limit",
          description: "Maximum number of paste buffers kept.",
          type: "number",
          defaultValue: 20,
          min: 1,
          max: 100,
        },
        {
          id: "display-time",
          label: "display-time",
          description: "Duration in milliseconds to show status messages.",
          type: "number",
          defaultValue: 750,
          min: 0,
          max: 10000,
        },
      ],
    },
    {
      id: "mouse",
      label: "Mouse",
      description: "Mouse input and scrolling behavior.",
      fields: [
        {
          id: "mouse",
          label: "mouse",
          description: "Enable mouse support for pane selection, resizing, and scrolling.",
          type: "boolean",
          defaultValue: false,
          enabledByDefault: true,
        },
      ],
    },
    {
      id: "statusBar",
      label: "Status Bar",
      description: "Status line position, content, and styling.",
      fields: [
        {
          id: "status",
          label: "status",
          description: "Show the status bar.",
          type: "boolean",
          defaultValue: true,
          enabledByDefault: true,
        },
        {
          id: "status-position",
          label: "status-position",
          description: "Place the status bar at the top or bottom.",
          type: "select",
          options: [
            { value: "top", label: "top" },
            { value: "bottom", label: "bottom" },
          ],
          defaultValue: "bottom",
        },
        {
          id: "status-interval",
          label: "status-interval",
          description: "Refresh interval in seconds for the status bar.",
          type: "number",
          defaultValue: 15,
          min: 0,
          max: 3600,
        },
        {
          id: "status-justify",
          label: "status-justify",
          description: "Alignment of the window list in the status bar.",
          type: "select",
          options: [
            { value: "left", label: "left" },
            { value: "centre", label: "centre" },
            { value: "right", label: "right" },
          ],
          defaultValue: "left",
        },
        {
          id: "status-style",
          label: "status-style",
          description: "Style string for the status bar background and foreground.",
          type: "string",
          defaultValue: "",
          placeholder: "bg=#1e1e2e,fg=#cdd6f4",
        },
        {
          id: "status-left",
          label: "status-left",
          description: "Content shown on the left side of the status bar.",
          type: "string",
          defaultValue: " #S ",
          placeholder: " #S ",
        },
        {
          id: "status-right",
          label: "status-right",
          description: "Content shown on the right side of the status bar.",
          type: "string",
          defaultValue: " %H:%M %d-%b-%y ",
          placeholder: " %H:%M ",
        },
        {
          id: "status-left-length",
          label: "status-left-length",
          description: "Maximum character width of the left status area.",
          type: "number",
          defaultValue: 10,
          min: 0,
          max: 200,
        },
        {
          id: "status-right-length",
          label: "status-right-length",
          description: "Maximum character width of the right status area.",
          type: "number",
          defaultValue: 40,
          min: 0,
          max: 200,
        },
      ],
    },
    {
      id: "keyBindings",
      label: "Key Bindings",
      description: "Prefix key, split shortcuts, and navigation.",
      fields: [
        {
          id: "prefix",
          label: "prefix",
          description: "Key combination used as the tmux command prefix.",
          type: "select",
          options: [
            { value: "C-a", label: "C-a" },
            { value: "C-b", label: "C-b" },
            { value: "C-Space", label: "C-Space" },
            { value: "C-s", label: "C-s" },
          ],
          defaultValue: "C-b",
          enabledByDefault: true,
        },
        {
          id: "vi-mode",
          label: "vi-mode",
          description: "Use vi-style key bindings in copy mode.",
          type: "boolean",
          defaultValue: false,
          enabledByDefault: true,
        },
        {
          id: "split-h-bind",
          label: "split-h-bind",
          description: "Key to split the current pane horizontally.",
          type: "string",
          defaultValue: "|",
          placeholder: "|",
        },
        {
          id: "split-v-bind",
          label: "split-v-bind",
          description: "Key to split the current pane vertically.",
          type: "string",
          defaultValue: "-",
          placeholder: "-",
        },
        {
          id: "vim-pane-nav",
          label: "vim-pane-nav",
          description: "Use h/j/k/l keys for pane navigation.",
          type: "boolean",
          defaultValue: false,
          enabledByDefault: true,
        },
        {
          id: "reload-bind",
          label: "reload-bind",
          description: "Bind r to reload the tmux configuration file.",
          type: "boolean",
          defaultValue: true,
        },
      ],
    },
    {
      id: "display",
      label: "Display",
      description: "Window sizing and pane display options.",
      fields: [
        {
          id: "aggressive-resize",
          label: "aggressive-resize",
          description: "Resize windows to the size of the smallest active session.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "display-panes-time",
          label: "display-panes-time",
          description: "Duration in milliseconds to show pane numbers.",
          type: "number",
          defaultValue: 750,
          min: 0,
          max: 10000,
        },
      ],
    },
    {
      id: "appearance",
      label: "Appearance",
      description: "Pane borders, window status, and message styling.",
      fields: [
        {
          id: "pane-border-style",
          label: "pane-border-style",
          description: "Style string for inactive pane borders.",
          type: "string",
          defaultValue: "",
          placeholder: "fg=#313244",
        },
        {
          id: "pane-active-border-style",
          label: "pane-active-border-style",
          description: "Style string for the active pane border.",
          type: "string",
          defaultValue: "",
          placeholder: "fg=#89b4fa",
        },
        {
          id: "window-status-current-style",
          label: "window-status-current-style",
          description: "Style string for the currently active window in the status bar.",
          type: "string",
          defaultValue: "",
          placeholder: "bold",
        },
        {
          id: "message-style",
          label: "message-style",
          description: "Style string for tmux command prompt messages.",
          type: "string",
          defaultValue: "",
          placeholder: "bg=#1e1e2e,fg=#cdd6f4",
        },
      ],
    },
  ],

  serialize(values, enabledFields) {
    const get = (key: string): unknown =>
      enabledFields.has(key) ? values[key] : undefined;

    const lines: string[] = [];

    function emitSet(id: string, val: unknown): string {
      const cmd = WINDOW_OPTIONS.has(id) ? "setw -g" : "set -g";
      if (typeof val === "boolean") return `${cmd} ${id} ${val ? "on" : "off"}`;
      if (typeof val === "number") return `${cmd} ${id} ${val}`;
      return `${cmd} ${id} ${quote(String(val))}`;
    }

    // --- General ---
    const GENERAL_FIELDS = [
      "default-terminal",
      "default-shell",
      "history-limit",
      "escape-time",
      "base-index",
      "pane-base-index",
      "renumber-windows",
      "set-titles",
      "set-titles-string",
      "focus-events",
      "buffer-limit",
      "display-time",
    ];
    const generalLines: string[] = [];
    for (const id of GENERAL_FIELDS) {
      const val = get(id);
      if (val === undefined || val === "") continue;
      generalLines.push(emitSet(id, val));
    }
    if (generalLines.length > 0) {
      lines.push("# General", ...generalLines, "");
    }

    // --- Mouse ---
    const mouseVal = get("mouse");
    if (mouseVal !== undefined) {
      lines.push("# Mouse", `set -g mouse ${mouseVal ? "on" : "off"}`, "");
    }

    // --- Status Bar ---
    const STATUS_FIELDS = [
      "status",
      "status-position",
      "status-interval",
      "status-justify",
      "status-style",
      "status-left",
      "status-right",
      "status-left-length",
      "status-right-length",
    ];
    const statusLines: string[] = [];
    for (const id of STATUS_FIELDS) {
      const val = get(id);
      if (val === undefined || val === "") continue;
      statusLines.push(emitSet(id, val));
    }
    if (statusLines.length > 0) {
      lines.push("# Status Bar", ...statusLines, "");
    }

    // --- Key Bindings ---
    const keyLines: string[] = [];

    const prefix = get("prefix");
    if (prefix !== undefined) {
      keyLines.push(`set -g prefix ${prefix}`);
      if (prefix !== "C-b") {
        keyLines.push("unbind C-b");
        keyLines.push(`bind ${prefix} send-prefix`);
      }
    }

    const viMode = get("vi-mode");
    if (viMode === true) {
      keyLines.push("setw -g mode-keys vi");
      keyLines.push("bind -T copy-mode-vi v send-keys -X begin-selection");
      keyLines.push(
        "bind -T copy-mode-vi y send-keys -X copy-selection-and-cancel",
      );
    }

    const splitH = get("split-h-bind");
    if (splitH !== undefined && splitH !== "") {
      keyLines.push(
        `bind ${splitH} split-window -h -c "#{pane_current_path}"`,
      );
    }

    const splitV = get("split-v-bind");
    if (splitV !== undefined && splitV !== "") {
      keyLines.push(
        `bind ${splitV} split-window -v -c "#{pane_current_path}"`,
      );
    }

    if (get("vim-pane-nav") === true) {
      keyLines.push("bind h select-pane -L");
      keyLines.push("bind j select-pane -D");
      keyLines.push("bind k select-pane -U");
      keyLines.push("bind l select-pane -R");
    }

    if (get("reload-bind") === true) {
      keyLines.push('bind r source-file ~/.tmux.conf \\; display "Reloaded"');
    }

    if (keyLines.length > 0) {
      lines.push("# Key Bindings", ...keyLines, "");
    }

    // --- Display ---
    const displayLines: string[] = [];
    const aggressiveResize = get("aggressive-resize");
    if (aggressiveResize !== undefined) {
      displayLines.push(emitSet("aggressive-resize", aggressiveResize));
    }
    const displayPanesTime = get("display-panes-time");
    if (displayPanesTime !== undefined) {
      displayLines.push(`set -g display-panes-time ${displayPanesTime}`);
    }
    if (displayLines.length > 0) {
      lines.push("# Display", ...displayLines, "");
    }

    // --- Appearance ---
    const APPEARANCE_FIELDS = [
      "pane-border-style",
      "pane-active-border-style",
      "window-status-current-style",
      "message-style",
    ];
    const appearanceLines: string[] = [];
    for (const id of APPEARANCE_FIELDS) {
      const val = get(id);
      if (val === undefined || val === "") continue;
      appearanceLines.push(`set -g ${id} ${quote(String(val))}`);
    }
    if (appearanceLines.length > 0) {
      lines.push("# Appearance", ...appearanceLines, "");
    }

    const result = lines.join("\n").trimEnd();
    return result ? result + "\n" : "";
  },

  deserialize(raw) {
    const values: Record<string, unknown> = {};
    const enabledFields: string[] = [];

    const BOOLEAN_FIELDS = new Set([
      "mouse",
      "status",
      "renumber-windows",
      "set-titles",
      "focus-events",
    ]);

    const NUMBER_FIELDS = new Set([
      "history-limit",
      "escape-time",
      "base-index",
      "pane-base-index",
      "buffer-limit",
      "display-time",
      "status-interval",
      "status-left-length",
      "status-right-length",
      "display-panes-time",
    ]);

    const STRING_FIELDS = new Set([
      "default-terminal",
      "default-shell",
      "set-titles-string",
      "status-position",
      "status-justify",
      "status-style",
      "status-left",
      "status-right",
      "pane-border-style",
      "pane-active-border-style",
      "window-status-current-style",
      "message-style",
    ]);

    try {
      for (const rawLine of raw.split("\n")) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;

        // set -g key value / setw -g key value
        const setMatch = line.match(
          /^(?:set|setw)\s+-g\s+([\w-]+)\s+(.+)$/,
        );
        if (setMatch) {
          const key = setMatch[1];
          const rawVal = setMatch[2].replace(/^"(.*)"$/, "$1");

          if (key === "prefix") {
            if (["C-a", "C-b", "C-Space", "C-s"].includes(rawVal)) {
              values["prefix"] = rawVal;
              enabledFields.push("prefix");
            }
            continue;
          }

          if (key === "mode-keys" && rawVal === "vi") {
            values["vi-mode"] = true;
            enabledFields.push("vi-mode");
            continue;
          }

          if (key === "aggressive-resize") {
            values["aggressive-resize"] = rawVal === "on";
            enabledFields.push("aggressive-resize");
            continue;
          }

          if (BOOLEAN_FIELDS.has(key)) {
            values[key] = rawVal === "on";
            enabledFields.push(key);
          } else if (NUMBER_FIELDS.has(key)) {
            const num = parseInt(rawVal, 10);
            if (!isNaN(num)) {
              values[key] = num;
              enabledFields.push(key);
            }
          } else if (STRING_FIELDS.has(key)) {
            values[key] = rawVal;
            enabledFields.push(key);
          }
          continue;
        }

        // bind h select-pane -L → vim pane navigation
        if (/^bind\s+h\s+select-pane\s+-L/.test(line)) {
          values["vim-pane-nav"] = true;
          enabledFields.push("vim-pane-nav");
          continue;
        }

        // bind <key> split-window -h → horizontal split bind
        const splitHMatch = line.match(
          /^bind\s+(\S+)\s+split-window\s+-h/,
        );
        if (splitHMatch) {
          values["split-h-bind"] = splitHMatch[1];
          enabledFields.push("split-h-bind");
          continue;
        }

        // bind <key> split-window -v → vertical split bind
        const splitVMatch = line.match(
          /^bind\s+(\S+)\s+split-window\s+-v/,
        );
        if (splitVMatch) {
          values["split-v-bind"] = splitVMatch[1];
          enabledFields.push("split-v-bind");
          continue;
        }

        // bind r source-file → reload bind
        if (/^bind\s+r\s+source-file/.test(line)) {
          values["reload-bind"] = true;
          enabledFields.push("reload-bind");
          continue;
        }
      }
    } catch {
      return { values: {}, enabledFields: [] };
    }

    return { values, enabledFields };
  },

  validate(raw) {
    const trimmed = raw.trim();
    if (trimmed === "") return { valid: true };

    const validStart = /^(set|setw|bind|unbind|source-file)\b/;

    for (const rawLine of trimmed.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      if (!validStart.test(line)) {
        return {
          valid: false,
          error: `Unrecognized directive: "${line.slice(0, 50)}"`,
        };
      }
    }

    return { valid: true };
  },
};
