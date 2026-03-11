import type { AppDefinition } from "../types";

export const zellij: AppDefinition = {
  id: "zellij",
  name: "Zellij",
  configFileName: "config.kdl",
  version: "0.42",
  format: "kdl",
  icon: "PanelLeft",
  description: "Zellij terminal multiplexer configuration",
  docsUrl: "https://zellij.dev/documentation/options.html",
  sections: [
    {
      id: "general",
      label: "General",
      description: "Core behavior, shell, layout, and appearance defaults.",
      fields: [
        {
          id: "on_force_close",
          label: "on_force_close",
          description: "Action to take when a force close is triggered.",
          type: "select",
          options: [
            { value: "detach", label: "detach" },
            { value: "quit", label: "quit" },
          ],
          defaultValue: "detach",
          enabledByDefault: true,
        },
        {
          id: "default_shell",
          label: "default_shell",
          description: "Default shell to use for new panes.",
          type: "string",
          defaultValue: "",
          placeholder: "/bin/zsh",
        },
        {
          id: "default_layout",
          label: "default_layout",
          description: "Layout to load on startup.",
          type: "string",
          defaultValue: "default",
          enabledByDefault: true,
        },
        {
          id: "default_mode",
          label: "default_mode",
          description: "Default input mode when Zellij starts.",
          type: "select",
          options: [
            { value: "normal", label: "normal" },
            { value: "locked", label: "locked" },
            { value: "resize", label: "resize" },
            { value: "pane", label: "pane" },
            { value: "tab", label: "tab" },
            { value: "scroll", label: "scroll" },
            { value: "enter_search", label: "enter_search" },
            { value: "search", label: "search" },
            { value: "rename_tab", label: "rename_tab" },
            { value: "rename_pane", label: "rename_pane" },
            { value: "session", label: "session" },
            { value: "move", label: "move" },
            { value: "prompt", label: "prompt" },
          ],
          defaultValue: "normal",
        },
        {
          id: "simplified_ui",
          label: "simplified_ui",
          description: "Remove UI elements for a cleaner look.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "pane_frames",
          label: "pane_frames",
          description: "Draw frames around each pane.",
          type: "boolean",
          defaultValue: true,
          enabledByDefault: true,
        },
        {
          id: "auto_layout",
          label: "auto_layout",
          description: "Automatically adjust pane sizes when new panes are added.",
          type: "boolean",
          defaultValue: true,
          enabledByDefault: true,
        },
        {
          id: "theme",
          label: "theme",
          description: "Color theme to use for the UI.",
          type: "string",
          defaultValue: "default",
          enabledByDefault: true,
        },
      ],
    },
    {
      id: "mouse-ui",
      label: "Mouse & UI",
      description: "Mouse behavior, underline styling, and UI visibility options.",
      fields: [
        {
          id: "mouse_mode",
          label: "mouse_mode",
          description: "Enable mouse support for pane selection and scrolling.",
          type: "boolean",
          defaultValue: true,
          enabledByDefault: true,
        },
        {
          id: "styled_underlines",
          label: "styled_underlines",
          description: "Render styled underlines if the terminal supports them.",
          type: "boolean",
          defaultValue: true,
        },
        {
          id: "rounded_corners",
          label: "rounded_corners",
          description: "Use rounded corners for pane frames.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "hide_session_name",
          label: "hide_session_name",
          description: "Hide the session name in pane frames.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "show_startup_tips",
          label: "show_startup_tips",
          description: "Display tips on startup.",
          type: "boolean",
          defaultValue: true,
        },
        {
          id: "show_release_notes",
          label: "show_release_notes",
          description: "Show release notes after an upgrade.",
          type: "boolean",
          defaultValue: true,
        },
        {
          id: "advanced_mouse_actions",
          label: "advanced_mouse_actions",
          description: "Enable advanced mouse actions like drag to resize.",
          type: "boolean",
          defaultValue: true,
        },
      ],
    },
    {
      id: "scrollback-clipboard",
      label: "Scrollback & Clipboard",
      description: "Scroll buffer size, clipboard integration, and editor settings.",
      fields: [
        {
          id: "scroll_buffer_size",
          label: "scroll_buffer_size",
          description: "Number of lines to keep in the scroll buffer.",
          type: "number",
          defaultValue: 10000,
          min: 0,
          max: 1000000,
          enabledByDefault: true,
        },
        {
          id: "copy_command",
          label: "copy_command",
          description: "External command used for clipboard copy operations.",
          type: "string",
          defaultValue: "",
          placeholder: "wl-copy",
        },
        {
          id: "copy_clipboard",
          label: "copy_clipboard",
          description: "Which clipboard buffer to copy into.",
          type: "select",
          options: [
            { value: "system", label: "system" },
            { value: "primary", label: "primary" },
          ],
          defaultValue: "system",
        },
        {
          id: "copy_on_select",
          label: "copy_on_select",
          description: "Automatically copy text when selected.",
          type: "boolean",
          defaultValue: true,
        },
        {
          id: "scrollback_editor",
          label: "scrollback_editor",
          description: "Editor to open when entering scrollback search.",
          type: "string",
          defaultValue: "",
          placeholder: "/usr/bin/vim",
        },
      ],
    },
    {
      id: "session",
      label: "Session",
      description: "Session persistence, serialization, and mirroring options.",
      fields: [
        {
          id: "session_serialization",
          label: "session_serialization",
          description: "Persist session layout to disk for recovery.",
          type: "boolean",
          defaultValue: true,
          enabledByDefault: true,
        },
        {
          id: "pane_viewport_serialization",
          label: "pane_viewport_serialization",
          description: "Include pane viewport content in serialized sessions.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "scrollback_lines_to_serialize",
          label: "scrollback_lines_to_serialize",
          description: "Number of scrollback lines to include when serializing.",
          type: "number",
          defaultValue: 0,
          min: 0,
          max: 100000,
        },
        {
          id: "disable_session_metadata",
          label: "disable_session_metadata",
          description: "Disable storing session metadata to disk.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "serialization_interval",
          label: "serialization_interval",
          description: "Seconds between automatic session serialization writes.",
          type: "number",
          defaultValue: 60,
          min: 1,
          max: 3600,
        },
        {
          id: "mirror_session",
          label: "mirror_session",
          description: "Mirror input to all panes in the session.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "stacked_resize",
          label: "stacked_resize",
          description: "Use stacked resize mode for panes.",
          type: "boolean",
          defaultValue: true,
        },
      ],
    },
    {
      id: "directories",
      label: "Directories",
      description: "Custom paths for layouts and themes.",
      fields: [
        {
          id: "layout_dir",
          label: "layout_dir",
          description: "Directory to search for layout files.",
          type: "string",
          defaultValue: "",
          placeholder: "/path/to/layouts",
        },
        {
          id: "theme_dir",
          label: "theme_dir",
          description: "Directory to search for theme files.",
          type: "string",
          defaultValue: "",
          placeholder: "/path/to/themes",
        },
      ],
    },
    {
      id: "web-server",
      label: "Web Server",
      description: "Built-in web server for remote control.",
      fields: [
        {
          id: "web_server",
          label: "web_server",
          description: "Enable the built-in web server.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "web_server_ip",
          label: "web_server_ip",
          description: "IP address the web server listens on.",
          type: "string",
          defaultValue: "127.0.0.1",
        },
        {
          id: "web_server_port",
          label: "web_server_port",
          description: "Port number for the web server.",
          type: "number",
          defaultValue: 8082,
          min: 1,
          max: 65535,
        },
      ],
    },
  ],

  serialize(values, enabledFields) {
    const lines: string[] = [];

    const UI_PANE_FRAMES_FIELDS = ["rounded_corners", "hide_session_name"];

    const SECTION_FIELDS = [
      {
        header: "General",
        ids: [
          "on_force_close",
          "default_shell",
          "default_layout",
          "default_mode",
          "simplified_ui",
          "pane_frames",
          "auto_layout",
          "theme",
        ],
      },
      {
        header: "Mouse & UI",
        ids: [
          "mouse_mode",
          "styled_underlines",
          "show_startup_tips",
          "show_release_notes",
          "advanced_mouse_actions",
        ],
      },
      {
        header: "Scrollback & Clipboard",
        ids: [
          "scroll_buffer_size",
          "copy_command",
          "copy_clipboard",
          "copy_on_select",
          "scrollback_editor",
        ],
      },
      {
        header: "Session",
        ids: [
          "session_serialization",
          "pane_viewport_serialization",
          "scrollback_lines_to_serialize",
          "disable_session_metadata",
          "serialization_interval",
          "mirror_session",
          "stacked_resize",
        ],
      },
      {
        header: "Directories",
        ids: ["layout_dir", "theme_dir"],
      },
      {
        header: "Web Server",
        ids: ["web_server", "web_server_ip", "web_server_port"],
      },
    ];

    function formatValue(val: unknown): string {
      if (typeof val === "boolean") return val ? "true" : "false";
      if (typeof val === "number") return String(val);
      return `"${String(val)}"`;
    }

    for (const section of SECTION_FIELDS) {
      const sectionLines: string[] = [];

      for (const id of section.ids) {
        if (!enabledFields.has(id)) continue;
        const val = values[id];
        if (val === undefined || val === null) continue;
        if (typeof val === "string" && val === "") continue;
        sectionLines.push(`${id} ${formatValue(val)}`);
      }

      if (sectionLines.length > 0) {
        lines.push(`// ${section.header}`);
        lines.push(...sectionLines);
        lines.push("");
      }
    }

    // Handle ui { pane_frames { ... } } block
    const uiLines: string[] = [];
    for (const id of UI_PANE_FRAMES_FIELDS) {
      if (!enabledFields.has(id)) continue;
      const val = values[id];
      if (val === undefined || val === null) continue;
      uiLines.push(`        ${id} ${formatValue(val)}`);
    }

    if (uiLines.length > 0) {
      lines.push("ui {");
      lines.push("    pane_frames {");
      lines.push(...uiLines);
      lines.push("    }");
      lines.push("}");
      lines.push("");
    }

    return lines.join("\n").trimEnd() + "\n";
  },

  deserialize(raw) {
    const values: Record<string, unknown> = {};
    const enabledFields: string[] = [];

    const BOOLEAN_FIELDS = new Set([
      "simplified_ui",
      "pane_frames",
      "auto_layout",
      "mouse_mode",
      "styled_underlines",
      "rounded_corners",
      "hide_session_name",
      "show_startup_tips",
      "show_release_notes",
      "advanced_mouse_actions",
      "copy_on_select",
      "session_serialization",
      "pane_viewport_serialization",
      "disable_session_metadata",
      "mirror_session",
      "stacked_resize",
      "web_server",
    ]);

    const NUMBER_FIELDS = new Set([
      "scroll_buffer_size",
      "scrollback_lines_to_serialize",
      "serialization_interval",
      "web_server_port",
    ]);

    try {
      const rawLines = raw.split("\n");
      let insideUi = false;
      let insidePaneFrames = false;
      let braceDepth = 0;

      for (const rawLine of rawLines) {
        const line = rawLine.trim();
        if (!line || line.startsWith("//")) continue;

        // Track nested ui { pane_frames { } } blocks
        if (line === "ui {" || line.startsWith("ui {")) {
          insideUi = true;
          braceDepth++;
          continue;
        }

        if (insideUi && (line === "pane_frames {" || line.startsWith("pane_frames {"))) {
          insidePaneFrames = true;
          braceDepth++;
          continue;
        }

        if (line === "}") {
          if (insidePaneFrames) {
            insidePaneFrames = false;
            braceDepth--;
          } else if (insideUi) {
            insideUi = false;
            braceDepth--;
          }
          continue;
        }

        // Parse key-value pairs
        const spaceIdx = line.search(/\s/);
        if (spaceIdx === -1) continue;

        const key = line.slice(0, spaceIdx).trim();
        let val = line.slice(spaceIdx).trim();

        if (!key || !val) continue;

        // Strip surrounding quotes from strings
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        }

        if (BOOLEAN_FIELDS.has(key)) {
          values[key] = val === "true";
          enabledFields.push(key);
        } else if (NUMBER_FIELDS.has(key)) {
          const num = parseInt(val, 10);
          if (!isNaN(num)) {
            values[key] = num;
            enabledFields.push(key);
          }
        } else {
          values[key] = val;
          enabledFields.push(key);
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

    let braceDepth = 0;
    for (const rawLine of trimmed.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//")) continue;

      for (const ch of line) {
        if (ch === "{") braceDepth++;
        if (ch === "}") braceDepth--;
        if (braceDepth < 0) {
          return { valid: false, error: "Unexpected closing brace" };
        }
      }

      // Lines outside of blocks must be key-value pairs or block openers
      if (braceDepth === 0 && line !== "}") {
        const spaceIdx = line.search(/\s/);
        if (spaceIdx === -1 && !line.endsWith("{") && line !== "}") {
          return { valid: false, error: `Invalid line: "${line.slice(0, 40)}"` };
        }
      }
    }

    if (braceDepth !== 0) {
      return { valid: false, error: "Unbalanced braces in configuration" };
    }

    return { valid: true };
  },
};
