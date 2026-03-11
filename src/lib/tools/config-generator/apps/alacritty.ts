import type { AppDefinition } from "../types";

export const alacritty: AppDefinition = {
  id: "alacritty",
  name: "Alacritty",
  configFileName: "alacritty.toml",
  version: "0.15",
  format: "toml",
  icon: "Terminal",
  description: "Alacritty terminal emulator configuration",
  docsUrl: "https://alacritty.org/config-alacritty.html",
  sections: [
    {
      id: "general",
      label: "General",
      description: "Top-level general settings.",
      fields: [
        {
          id: "general.live_config_reload",
          label: "general.live_config_reload",
          description: "Automatically reload the config when it changes on disk.",
          type: "boolean",
          defaultValue: true,
          enabledByDefault: true,
        },
        {
          id: "general.ipc_socket",
          label: "general.ipc_socket",
          description: "Offer IPC through a unix socket.",
          type: "boolean",
          defaultValue: true,
        },
      ],
    },
    {
      id: "window",
      label: "Window",
      description: "Window dimensions, padding, decorations, and behavior.",
      fields: [
        {
          id: "window.padding.x",
          label: "window.padding.x",
          description: "Horizontal padding around the terminal content in pixels.",
          type: "number",
          defaultValue: 0,
          min: 0,
          max: 100,
        },
        {
          id: "window.padding.y",
          label: "window.padding.y",
          description: "Vertical padding around the terminal content in pixels.",
          type: "number",
          defaultValue: 0,
          min: 0,
          max: 100,
        },
        {
          id: "window.decorations",
          label: "window.decorations",
          description: "Window decorations style.",
          type: "select",
          options: [
            { value: "Full", label: "Full" },
            { value: "None", label: "None" },
            { value: "Transparent", label: "Transparent" },
            { value: "Buttonless", label: "Buttonless" },
          ],
          defaultValue: "Full",
          enabledByDefault: true,
        },
        {
          id: "window.opacity",
          label: "window.opacity",
          description: "Background opacity from fully transparent to fully opaque.",
          type: "number",
          defaultValue: 1.0,
          min: 0.0,
          max: 1.0,
          enabledByDefault: true,
        },
        {
          id: "window.startup_mode",
          label: "window.startup_mode",
          description: "Window mode at startup.",
          type: "select",
          options: [
            { value: "Windowed", label: "Windowed" },
            { value: "Maximized", label: "Maximized" },
            { value: "Fullscreen", label: "Fullscreen" },
            { value: "SimpleFullscreen", label: "SimpleFullscreen" },
          ],
          defaultValue: "Windowed",
        },
        {
          id: "window.title",
          label: "window.title",
          description: "Default window title.",
          type: "string",
          defaultValue: "Alacritty",
          placeholder: "Alacritty",
        },
        {
          id: "window.dynamic_title",
          label: "window.dynamic_title",
          description: "Allow terminal programs to change the window title.",
          type: "boolean",
          defaultValue: true,
        },
        {
          id: "window.dynamic_padding",
          label: "window.dynamic_padding",
          description: "Spread extra padding evenly around the terminal content.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "window.blur",
          label: "window.blur",
          description: "Request compositor to blur content behind transparent windows.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "window.option_as_alt",
          label: "window.option_as_alt",
          description: "Make Option key behave as Alt on macOS.",
          type: "select",
          options: [
            { value: "OnlyLeft", label: "OnlyLeft" },
            { value: "OnlyRight", label: "OnlyRight" },
            { value: "Both", label: "Both" },
            { value: "None", label: "None" },
          ],
          defaultValue: "None",
        },
      ],
    },
    {
      id: "scrolling",
      label: "Scrolling",
      description: "Scrollback buffer and scroll speed.",
      fields: [
        {
          id: "scrolling.history",
          label: "scrolling.history",
          description: "Maximum number of lines in the scrollback buffer.",
          type: "number",
          defaultValue: 10000,
          min: 0,
          max: 100000,
          enabledByDefault: true,
        },
        {
          id: "scrolling.multiplier",
          label: "scrolling.multiplier",
          description: "Number of lines scrolled for each scroll event.",
          type: "number",
          defaultValue: 3,
          min: 1,
          max: 20,
        },
      ],
    },
    {
      id: "font",
      label: "Font",
      description: "Font family, style, and size.",
      fields: [
        {
          id: "font.normal.family",
          label: "font.normal.family",
          description: "Font family for regular weight text.",
          type: "string",
          defaultValue: "monospace",
          placeholder: "monospace",
          enabledByDefault: true,
        },
        {
          id: "font.normal.style",
          label: "font.normal.style",
          description: "Style variant for the normal font.",
          type: "string",
          defaultValue: "Regular",
          placeholder: "Regular",
        },
        {
          id: "font.bold.style",
          label: "font.bold.style",
          description: "Style variant for the bold font.",
          type: "string",
          defaultValue: "Bold",
          placeholder: "Bold",
        },
        {
          id: "font.italic.style",
          label: "font.italic.style",
          description: "Style variant for the italic font.",
          type: "string",
          defaultValue: "Italic",
          placeholder: "Italic",
        },
        {
          id: "font.size",
          label: "font.size",
          description: "Font size in points.",
          type: "number",
          defaultValue: 11.25,
          min: 4,
          max: 72,
          enabledByDefault: true,
        },
        {
          id: "font.builtin_box_drawing",
          label: "font.builtin_box_drawing",
          description: "Use built-in font for box drawing characters.",
          type: "boolean",
          defaultValue: true,
        },
      ],
    },
    {
      id: "colors",
      label: "Colors",
      description: "Terminal color palette.",
      fields: [
        {
          id: "colors.primary.foreground",
          label: "colors.primary.foreground",
          description: "Default foreground color.",
          type: "string",
          defaultValue: "#d8d8d8",
          placeholder: "#d8d8d8",
          enabledByDefault: true,
        },
        {
          id: "colors.primary.background",
          label: "colors.primary.background",
          description: "Default background color.",
          type: "string",
          defaultValue: "#181818",
          placeholder: "#181818",
          enabledByDefault: true,
        },
        {
          id: "colors.draw_bold_text_with_bright_colors",
          label: "colors.draw_bold_text_with_bright_colors",
          description: "Render bold text using bright color variants.",
          type: "boolean",
          defaultValue: false,
        },
      ],
    },
    {
      id: "cursor",
      label: "Cursor",
      description: "Cursor shape, blinking, and appearance.",
      fields: [
        {
          id: "cursor.style.shape",
          label: "cursor.style.shape",
          description: "Shape of the terminal cursor.",
          type: "select",
          options: [
            { value: "Block", label: "Block" },
            { value: "Underline", label: "Underline" },
            { value: "Beam", label: "Beam" },
          ],
          defaultValue: "Block",
          enabledByDefault: true,
        },
        {
          id: "cursor.style.blinking",
          label: "cursor.style.blinking",
          description: "Cursor blinking state.",
          type: "select",
          options: [
            { value: "Never", label: "Never" },
            { value: "Off", label: "Off" },
            { value: "On", label: "On" },
            { value: "Always", label: "Always" },
          ],
          defaultValue: "Off",
        },
        {
          id: "cursor.unfocused_hollow",
          label: "cursor.unfocused_hollow",
          description: "Render cursor as a hollow box when the window is unfocused.",
          type: "boolean",
          defaultValue: true,
        },
        {
          id: "cursor.thickness",
          label: "cursor.thickness",
          description: "Thickness of the cursor relative to the cell width.",
          type: "number",
          defaultValue: 0.15,
          min: 0.0,
          max: 1.0,
        },
      ],
    },
    {
      id: "terminal",
      label: "Terminal",
      description: "Shell program and terminal protocol settings.",
      fields: [
        {
          id: "terminal.shell.program",
          label: "terminal.shell.program",
          description: "Path to the shell program to run.",
          type: "string",
          defaultValue: "",
          placeholder: "/bin/zsh",
        },
        {
          id: "terminal.osc52",
          label: "terminal.osc52",
          description: "Clipboard access through the OSC 52 escape sequence.",
          type: "select",
          options: [
            { value: "Disabled", label: "Disabled" },
            { value: "OnlyCopy", label: "OnlyCopy" },
            { value: "OnlyPaste", label: "OnlyPaste" },
            { value: "CopyPaste", label: "CopyPaste" },
          ],
          defaultValue: "OnlyCopy",
        },
      ],
    },
    {
      id: "bell",
      label: "Bell",
      description: "Visual bell animation and duration.",
      fields: [
        {
          id: "bell.animation",
          label: "bell.animation",
          description: "Visual bell easing function.",
          type: "select",
          options: [
            { value: "Ease", label: "Ease" },
            { value: "EaseOut", label: "EaseOut" },
            { value: "Linear", label: "Linear" },
          ],
          defaultValue: "Linear",
        },
        {
          id: "bell.duration",
          label: "bell.duration",
          description: "Visual bell animation duration in milliseconds.",
          type: "number",
          defaultValue: 0,
          min: 0,
          max: 5000,
        },
      ],
    },
    {
      id: "mouse",
      label: "Mouse",
      description: "Mouse behavior settings.",
      fields: [
        {
          id: "mouse.hide_when_typing",
          label: "mouse.hide_when_typing",
          description: "Hide the mouse cursor while typing.",
          type: "boolean",
          defaultValue: false,
        },
      ],
    },
    {
      id: "selection",
      label: "Selection",
      description: "Text selection behavior.",
      fields: [
        {
          id: "selection.save_to_clipboard",
          label: "selection.save_to_clipboard",
          description: "Copy selected text to the primary clipboard automatically.",
          type: "boolean",
          defaultValue: false,
        },
      ],
    },
  ],

  serialize(values, enabledFields) {
    const lines: string[] = [];

    // TOML tables in output order, each listing the full dot-path field IDs it owns
    const TOML_TABLES: { table: string; fieldIds: string[] }[] = [
      {
        table: "general",
        fieldIds: ["general.live_config_reload", "general.ipc_socket"],
      },
      {
        table: "window",
        fieldIds: [
          "window.decorations",
          "window.opacity",
          "window.startup_mode",
          "window.title",
          "window.dynamic_title",
          "window.dynamic_padding",
          "window.blur",
          "window.option_as_alt",
        ],
      },
      {
        table: "window.padding",
        fieldIds: ["window.padding.x", "window.padding.y"],
      },
      {
        table: "scrolling",
        fieldIds: ["scrolling.history", "scrolling.multiplier"],
      },
      {
        table: "font",
        fieldIds: ["font.size", "font.builtin_box_drawing"],
      },
      {
        table: "font.normal",
        fieldIds: ["font.normal.family", "font.normal.style"],
      },
      {
        table: "font.bold",
        fieldIds: ["font.bold.style"],
      },
      {
        table: "font.italic",
        fieldIds: ["font.italic.style"],
      },
      {
        table: "colors",
        fieldIds: ["colors.draw_bold_text_with_bright_colors"],
      },
      {
        table: "colors.primary",
        fieldIds: ["colors.primary.foreground", "colors.primary.background"],
      },
      {
        table: "cursor",
        fieldIds: ["cursor.unfocused_hollow", "cursor.thickness"],
      },
      {
        table: "cursor.style",
        fieldIds: ["cursor.style.shape", "cursor.style.blinking"],
      },
      {
        table: "terminal",
        fieldIds: ["terminal.osc52"],
      },
      {
        table: "terminal.shell",
        fieldIds: ["terminal.shell.program"],
      },
      {
        table: "bell",
        fieldIds: ["bell.animation", "bell.duration"],
      },
      {
        table: "mouse",
        fieldIds: ["mouse.hide_when_typing"],
      },
      {
        table: "selection",
        fieldIds: ["selection.save_to_clipboard"],
      },
    ];

    function tomlValue(val: unknown): string {
      if (typeof val === "boolean") return val ? "true" : "false";
      if (typeof val === "number") return String(val);
      return `"${String(val)}"`;
    }

    for (const section of TOML_TABLES) {
      const sectionLines: string[] = [];

      for (const fieldId of section.fieldIds) {
        if (!enabledFields.has(fieldId)) continue;
        const val = values[fieldId];
        if (val === undefined || val === null) continue;
        // Skip empty strings (e.g. unset shell program)
        if (typeof val === "string" && val === "") continue;

        // Derive the bare key by stripping the table prefix
        const key = fieldId.slice(section.table.length + 1);
        sectionLines.push(`${key} = ${tomlValue(val)}`);
      }

      if (sectionLines.length > 0) {
        lines.push(`[${section.table}]`);
        lines.push(...sectionLines);
        lines.push("");
      }
    }

    return lines.join("\n").trimEnd() + "\n";
  },

  deserialize(raw) {
    const values: Record<string, unknown> = {};
    const enabledFields: string[] = [];

    const BOOLEAN_FIELDS = new Set([
      "general.live_config_reload",
      "general.ipc_socket",
      "window.dynamic_title",
      "window.dynamic_padding",
      "window.blur",
      "font.builtin_box_drawing",
      "colors.draw_bold_text_with_bright_colors",
      "cursor.unfocused_hollow",
      "mouse.hide_when_typing",
      "selection.save_to_clipboard",
    ]);

    const NUMBER_FIELDS = new Set([
      "window.padding.x",
      "window.padding.y",
      "window.opacity",
      "scrolling.history",
      "scrolling.multiplier",
      "font.size",
      "cursor.thickness",
      "bell.duration",
    ]);

    let currentTable = "";

    try {
      for (const rawLine of raw.split("\n")) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;

        // Table header
        const tableMatch = line.match(/^\[([^\]]+)\]$/);
        if (tableMatch) {
          currentTable = tableMatch[1].trim();
          continue;
        }

        // Key = value
        const eqIdx = line.indexOf("=");
        if (eqIdx === -1) continue;

        const key = line.slice(0, eqIdx).trim();
        let val = line.slice(eqIdx + 1).trim();
        if (!key) continue;

        // Strip inline comments outside of quoted strings
        if (!val.startsWith('"')) {
          const commentIdx = val.indexOf("#");
          if (commentIdx !== -1) {
            val = val.slice(0, commentIdx).trim();
          }
        }

        const fieldId = currentTable ? `${currentTable}.${key}` : key;

        if (BOOLEAN_FIELDS.has(fieldId)) {
          values[fieldId] = val === "true";
          enabledFields.push(fieldId);
        } else if (NUMBER_FIELDS.has(fieldId)) {
          const num = parseFloat(val);
          if (!isNaN(num)) {
            values[fieldId] = num;
            enabledFields.push(fieldId);
          }
        } else {
          // Remove surrounding quotes
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          values[fieldId] = val;
          enabledFields.push(fieldId);
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

    for (const rawLine of trimmed.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      // Table header
      if (line.startsWith("[")) {
        if (!line.endsWith("]")) {
          return {
            valid: false,
            error: `Unclosed table header: "${line.slice(0, 40)}"`,
          };
        }
        const inner = line.slice(1, -1).trim();
        if (!inner || /[[\]]/.test(inner)) {
          return {
            valid: false,
            error: `Invalid table header: "${line.slice(0, 40)}"`,
          };
        }
        continue;
      }

      // Key-value pairs must contain =
      if (!line.includes("=")) {
        return {
          valid: false,
          error: `Invalid line (missing "="): "${line.slice(0, 40)}"`,
        };
      }
    }

    return { valid: true };
  },
};
