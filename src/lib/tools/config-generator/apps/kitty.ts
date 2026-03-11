import type { AppDefinition } from "../types";

export const kitty: AppDefinition = {
  id: "kitty",
  name: "Kitty",
  configFileName: "kitty.conf",
  version: "0.46",
  format: "text",
  icon: "Terminal",
  description: "Kitty terminal emulator configuration",
  docsUrl: "https://sw.kovidgoyal.net/kitty/conf/",
  sections: [
    {
      id: "fonts",
      label: "Fonts",
      description: "Font family, size, and rendering options.",
      fields: [
        {
          id: "font_family",
          label: "font_family",
          description: "Primary typeface used for terminal text.",
          type: "string",
          defaultValue: "monospace",
          placeholder: "monospace",
          enabledByDefault: true,
        },
        {
          id: "bold_font",
          label: "bold_font",
          description: "Typeface variant used for bold text.",
          type: "string",
          defaultValue: "auto",
          placeholder: "auto",
        },
        {
          id: "italic_font",
          label: "italic_font",
          description: "Typeface variant used for italic text.",
          type: "string",
          defaultValue: "auto",
          placeholder: "auto",
        },
        {
          id: "bold_italic_font",
          label: "bold_italic_font",
          description: "Typeface variant used for bold-italic text.",
          type: "string",
          defaultValue: "auto",
          placeholder: "auto",
        },
        {
          id: "font_size",
          label: "font_size",
          description: "Text size in points.",
          type: "number",
          defaultValue: 11.0,
          min: 1,
          max: 100,
          enabledByDefault: true,
        },
        {
          id: "disable_ligatures",
          label: "disable_ligatures",
          description: "Controls when programming ligatures are disabled.",
          type: "select",
          options: [
            { value: "never", label: "never" },
            { value: "cursor", label: "cursor" },
            { value: "always", label: "always" },
          ],
          defaultValue: "never",
        },
        {
          id: "undercurl_style",
          label: "undercurl_style",
          description: "Appearance style of undercurl decorations.",
          type: "select",
          options: [
            { value: "thin-sparse", label: "thin-sparse" },
            { value: "thin-dense", label: "thin-dense" },
            { value: "thick-sparse", label: "thick-sparse" },
            { value: "thick-dense", label: "thick-dense" },
          ],
          defaultValue: "thin-sparse",
        },
      ],
    },
    {
      id: "cursor",
      label: "Cursor",
      description: "Cursor shape, color, and blink behavior.",
      fields: [
        {
          id: "cursor_shape",
          label: "cursor_shape",
          description: "The shape of the cursor.",
          type: "select",
          options: [
            { value: "block", label: "block" },
            { value: "beam", label: "beam" },
            { value: "underline", label: "underline" },
          ],
          defaultValue: "block",
          enabledByDefault: true,
        },
        {
          id: "cursor_shape_unfocused",
          label: "cursor_shape_unfocused",
          description: "The shape of the cursor when the window is not focused.",
          type: "select",
          options: [
            { value: "hollow", label: "hollow" },
            { value: "block", label: "block" },
            { value: "beam", label: "beam" },
            { value: "underline", label: "underline" },
            { value: "unchanged", label: "unchanged" },
          ],
          defaultValue: "hollow",
        },
        {
          id: "cursor_blink_interval",
          label: "cursor_blink_interval",
          description:
            "Blink interval in seconds; set to 0 to disable blinking, -1 to use system default.",
          type: "number",
          defaultValue: -1,
          min: -1,
          max: 10,
        },
        {
          id: "cursor_stop_blinking_after",
          label: "cursor_stop_blinking_after",
          description: "Seconds of keyboard inactivity after which the cursor stops blinking.",
          type: "number",
          defaultValue: 15.0,
          min: 0,
          max: 3600,
        },
        {
          id: "cursor_beam_thickness",
          label: "cursor_beam_thickness",
          description: "Thickness of the beam cursor in points.",
          type: "number",
          defaultValue: 1.5,
          min: 0.1,
          max: 10,
        },
        {
          id: "cursor_underline_thickness",
          label: "cursor_underline_thickness",
          description: "Thickness of the underline cursor in points.",
          type: "number",
          defaultValue: 2.0,
          min: 0.1,
          max: 10,
        },
      ],
    },
    {
      id: "scrollback",
      label: "Scrollback",
      description: "Scrollback buffer size and pager settings.",
      fields: [
        {
          id: "scrollback_lines",
          label: "scrollback_lines",
          description: "Number of lines retained in the scrollback buffer.",
          type: "number",
          defaultValue: 2000,
          min: 0,
          max: 1000000,
          enabledByDefault: true,
        },
        {
          id: "scrollback_pager",
          label: "scrollback_pager",
          description: "Program used to view the scrollback buffer contents.",
          type: "string",
          defaultValue: "less --chop-long-lines --RAW-CONTROL-CHARS +INPUT_LINE_NUMBER",
          placeholder: "less --chop-long-lines --RAW-CONTROL-CHARS +INPUT_LINE_NUMBER",
        },
        {
          id: "scrollback_pager_history_size",
          label: "scrollback_pager_history_size",
          description: "Size in MB of a separate scrollback history buffer for the pager (0 to disable).",
          type: "number",
          defaultValue: 0,
          min: 0,
          max: 4096,
        },
        {
          id: "wheel_scroll_multiplier",
          label: "wheel_scroll_multiplier",
          description: "Multiplier applied to mouse wheel scroll events.",
          type: "number",
          defaultValue: 5.0,
          min: 0.1,
          max: 100,
        },
        {
          id: "touch_scroll_multiplier",
          label: "touch_scroll_multiplier",
          description: "Multiplier applied to touchpad scroll events.",
          type: "number",
          defaultValue: 1.0,
          min: 0.1,
          max: 100,
        },
      ],
    },
    {
      id: "mouse",
      label: "Mouse",
      description: "Mouse behavior, URL detection, and clipboard settings.",
      fields: [
        {
          id: "mouse_hide_wait",
          label: "mouse_hide_wait",
          description: "Seconds of inactivity before the mouse cursor is hidden (0 to disable, -1 to never hide).",
          type: "number",
          defaultValue: 3.0,
          min: -1,
          max: 3600,
        },
        {
          id: "url_style",
          label: "url_style",
          description: "Underline style used to highlight URLs under the mouse cursor.",
          type: "select",
          options: [
            { value: "none", label: "none" },
            { value: "straight", label: "straight" },
            { value: "double", label: "double" },
            { value: "curly", label: "curly" },
            { value: "dotted", label: "dotted" },
            { value: "dashed", label: "dashed" },
          ],
          defaultValue: "curly",
          enabledByDefault: true,
        },
        {
          id: "open_url_with",
          label: "open_url_with",
          description: "Application used to open clicked URLs.",
          type: "string",
          defaultValue: "default",
          placeholder: "default",
        },
        {
          id: "detect_urls",
          label: "detect_urls",
          description: "Highlight clickable URLs when the mouse cursor hovers over them.",
          type: "boolean",
          defaultValue: true,
        },
        {
          id: "copy_on_select",
          label: "copy_on_select",
          description:
            "Automatically copy selected text to clipboard; set to 'clipboard' or 'primary', or 'no' to disable.",
          type: "select",
          options: [
            { value: "no", label: "no" },
            { value: "clipboard", label: "clipboard" },
            { value: "primary", label: "primary" },
          ],
          defaultValue: "no",
        },
        {
          id: "strip_trailing_spaces",
          label: "strip_trailing_spaces",
          description: "Remove trailing spaces from lines when copying to clipboard.",
          type: "select",
          options: [
            { value: "never", label: "never" },
            { value: "smart", label: "smart" },
            { value: "always", label: "always" },
          ],
          defaultValue: "never",
        },
        {
          id: "focus_follows_mouse",
          label: "focus_follows_mouse",
          description: "Automatically focus the window under the mouse cursor.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "underline_hyperlinks",
          label: "underline_hyperlinks",
          description: "When to underline hyperlinks in the terminal output.",
          type: "select",
          options: [
            { value: "hover", label: "hover" },
            { value: "always", label: "always" },
            { value: "never", label: "never" },
          ],
          defaultValue: "hover",
        },
      ],
    },
    {
      id: "bell",
      label: "Terminal Bell",
      description: "Audio and visual bell settings.",
      fields: [
        {
          id: "enable_audio_bell",
          label: "enable_audio_bell",
          description: "Play an audio bell sound when a bell character is received.",
          type: "boolean",
          defaultValue: true,
        },
        {
          id: "visual_bell_duration",
          label: "visual_bell_duration",
          description: "Duration in seconds of the visual bell flash effect (0 to disable).",
          type: "number",
          defaultValue: 0.0,
          min: 0,
          max: 5,
        },
        {
          id: "visual_bell_color",
          label: "visual_bell_color",
          description: "Color used for the visual bell flash.",
          type: "string",
          defaultValue: "#ffffff",
          placeholder: "#ffffff",
        },
        {
          id: "bell_on_tab",
          label: "bell_on_tab",
          description: "Show a bell indicator in the tab bar when a bell fires in a background tab.",
          type: "boolean",
          defaultValue: true,
        },
        {
          id: "command_on_bell",
          label: "command_on_bell",
          description: "Program to execute when a bell character is received.",
          type: "string",
          defaultValue: "",
          placeholder: "notify-send 'Bell'",
        },
      ],
    },
    {
      id: "window",
      label: "Window Layout",
      description: "Window size, borders, padding, and layout behavior.",
      fields: [
        {
          id: "remember_window_size",
          label: "remember_window_size",
          description: "Restore the previous window size on startup.",
          type: "boolean",
          defaultValue: true,
          enabledByDefault: true,
        },
        {
          id: "initial_window_width",
          label: "initial_window_width",
          description: "Initial window width in character cells (used when remember_window_size is no).",
          type: "number",
          defaultValue: 640,
          min: 80,
          max: 9999,
        },
        {
          id: "initial_window_height",
          label: "initial_window_height",
          description: "Initial window height in character cells (used when remember_window_size is no).",
          type: "number",
          defaultValue: 400,
          min: 24,
          max: 9999,
        },
        {
          id: "window_padding_width",
          label: "window_padding_width",
          description: "Padding in points between window content and edges.",
          type: "number",
          defaultValue: 0,
          min: 0,
          max: 100,
        },
        {
          id: "window_margin_width",
          label: "window_margin_width",
          description: "Margin in points between the window border and the window content.",
          type: "number",
          defaultValue: 0,
          min: 0,
          max: 100,
        },
        {
          id: "window_border_width",
          label: "window_border_width",
          description: "Width of borders between windows (in points).",
          type: "number",
          defaultValue: 0.5,
          min: 0,
          max: 10,
        },
        {
          id: "draw_minimal_borders",
          label: "draw_minimal_borders",
          description: "Draw minimal borders between windows to reduce visual clutter.",
          type: "boolean",
          defaultValue: true,
        },
        {
          id: "confirm_os_window_close",
          label: "confirm_os_window_close",
          description: "Ask for confirmation before closing an OS window that has this many or more terminal tabs (0 to disable).",
          type: "number",
          defaultValue: 0,
          min: -1,
          max: 100,
        },
      ],
    },
    {
      id: "tabs",
      label: "Tab Bar",
      description: "Tab bar position, style, and appearance.",
      fields: [
        {
          id: "tab_bar_edge",
          label: "tab_bar_edge",
          description: "Position of the tab bar on screen.",
          type: "select",
          options: [
            { value: "top", label: "top" },
            { value: "bottom", label: "bottom" },
          ],
          defaultValue: "bottom",
          enabledByDefault: true,
        },
        {
          id: "tab_bar_style",
          label: "tab_bar_style",
          description: "Visual style of the tab bar.",
          type: "select",
          options: [
            { value: "fade", label: "fade" },
            { value: "slant", label: "slant" },
            { value: "separator", label: "separator" },
            { value: "powerline", label: "powerline" },
            { value: "custom", label: "custom" },
            { value: "hidden", label: "hidden" },
          ],
          defaultValue: "fade",
        },
        {
          id: "tab_bar_align",
          label: "tab_bar_align",
          description: "Alignment of tabs within the tab bar.",
          type: "select",
          options: [
            { value: "left", label: "left" },
            { value: "center", label: "center" },
            { value: "right", label: "right" },
          ],
          defaultValue: "left",
        },
        {
          id: "tab_bar_min_tabs",
          label: "tab_bar_min_tabs",
          description: "Minimum number of tabs before the tab bar is displayed.",
          type: "number",
          defaultValue: 2,
          min: 1,
          max: 100,
        },
        {
          id: "tab_title_template",
          label: "tab_title_template",
          description: "Template string for tab titles using Python formatting.",
          type: "string",
          defaultValue: "{fmt.fg.red}{bell_symbol}{activity_symbol}{fmt.fg.tab}{title}",
          placeholder: "{title}",
        },
        {
          id: "active_tab_foreground",
          label: "active_tab_foreground",
          description: "Text color for the active tab.",
          type: "string",
          defaultValue: "#000000",
          placeholder: "#000000",
        },
        {
          id: "active_tab_background",
          label: "active_tab_background",
          description: "Background color for the active tab.",
          type: "string",
          defaultValue: "#eee8d5",
          placeholder: "#eee8d5",
        },
        {
          id: "inactive_tab_foreground",
          label: "inactive_tab_foreground",
          description: "Text color for inactive tabs.",
          type: "string",
          defaultValue: "#444444",
          placeholder: "#444444",
        },
        {
          id: "inactive_tab_background",
          label: "inactive_tab_background",
          description: "Background color for inactive tabs.",
          type: "string",
          defaultValue: "#999999",
          placeholder: "#999999",
        },
      ],
    },
    {
      id: "colors",
      label: "Color Scheme",
      description: "Foreground, background, and the 16 terminal colors.",
      fields: [
        {
          id: "foreground",
          label: "foreground",
          description: "Default foreground (text) color.",
          type: "string",
          defaultValue: "#dddddd",
          placeholder: "#dddddd",
          enabledByDefault: true,
        },
        {
          id: "background",
          label: "background",
          description: "Default background color.",
          type: "string",
          defaultValue: "#000000",
          placeholder: "#000000",
          enabledByDefault: true,
        },
        {
          id: "background_opacity",
          label: "background_opacity",
          description: "Background transparency (1.0 is fully opaque, 0.0 is fully transparent).",
          type: "number",
          defaultValue: 1.0,
          min: 0.0,
          max: 1.0,
        },
        {
          id: "selection_foreground",
          label: "selection_foreground",
          description: "Foreground color for selected text.",
          type: "string",
          defaultValue: "#000000",
          placeholder: "#000000",
        },
        {
          id: "selection_background",
          label: "selection_background",
          description: "Background color for selected text.",
          type: "string",
          defaultValue: "#fffacd",
          placeholder: "#fffacd",
        },
        {
          id: "color0",
          label: "color0",
          description: "Terminal color 0 - black (normal).",
          type: "string",
          defaultValue: "#000000",
          placeholder: "#000000",
        },
        {
          id: "color1",
          label: "color1",
          description: "Terminal color 1 - red (normal).",
          type: "string",
          defaultValue: "#cc0403",
          placeholder: "#cc0403",
        },
        {
          id: "color2",
          label: "color2",
          description: "Terminal color 2 - green (normal).",
          type: "string",
          defaultValue: "#19cb00",
          placeholder: "#19cb00",
        },
        {
          id: "color3",
          label: "color3",
          description: "Terminal color 3 - yellow (normal).",
          type: "string",
          defaultValue: "#cecb00",
          placeholder: "#cecb00",
        },
        {
          id: "color4",
          label: "color4",
          description: "Terminal color 4 - blue (normal).",
          type: "string",
          defaultValue: "#0d73cc",
          placeholder: "#0d73cc",
        },
        {
          id: "color5",
          label: "color5",
          description: "Terminal color 5 - magenta (normal).",
          type: "string",
          defaultValue: "#cb1ed1",
          placeholder: "#cb1ed1",
        },
        {
          id: "color6",
          label: "color6",
          description: "Terminal color 6 - cyan (normal).",
          type: "string",
          defaultValue: "#0dcdcd",
          placeholder: "#0dcdcd",
        },
        {
          id: "color7",
          label: "color7",
          description: "Terminal color 7 - white (normal).",
          type: "string",
          defaultValue: "#dddddd",
          placeholder: "#dddddd",
        },
        {
          id: "color8",
          label: "color8",
          description: "Terminal color 8 - bright black.",
          type: "string",
          defaultValue: "#767676",
          placeholder: "#767676",
        },
        {
          id: "color9",
          label: "color9",
          description: "Terminal color 9 - bright red.",
          type: "string",
          defaultValue: "#f2201f",
          placeholder: "#f2201f",
        },
        {
          id: "color10",
          label: "color10",
          description: "Terminal color 10 - bright green.",
          type: "string",
          defaultValue: "#23fd00",
          placeholder: "#23fd00",
        },
        {
          id: "color11",
          label: "color11",
          description: "Terminal color 11 - bright yellow.",
          type: "string",
          defaultValue: "#fffd00",
          placeholder: "#fffd00",
        },
        {
          id: "color12",
          label: "color12",
          description: "Terminal color 12 - bright blue.",
          type: "string",
          defaultValue: "#1a8fff",
          placeholder: "#1a8fff",
        },
        {
          id: "color13",
          label: "color13",
          description: "Terminal color 13 - bright magenta.",
          type: "string",
          defaultValue: "#fd28ff",
          placeholder: "#fd28ff",
        },
        {
          id: "color14",
          label: "color14",
          description: "Terminal color 14 - bright cyan.",
          type: "string",
          defaultValue: "#14ffff",
          placeholder: "#14ffff",
        },
        {
          id: "color15",
          label: "color15",
          description: "Terminal color 15 - bright white.",
          type: "string",
          defaultValue: "#ffffff",
          placeholder: "#ffffff",
        },
      ],
    },
    {
      id: "advanced",
      label: "Advanced",
      description: "Shell, editor, remote control, and environment settings.",
      fields: [
        {
          id: "shell",
          label: "shell",
          description: "Shell program to launch in new terminal windows (use '.' to use the current shell).",
          type: "string",
          defaultValue: ".",
          placeholder: ".",
          enabledByDefault: true,
        },
        {
          id: "editor",
          label: "editor",
          description: "Text editor used by kittens such as edit-in-kitty (use '.' to use $EDITOR).",
          type: "string",
          defaultValue: ".",
          placeholder: ".",
        },
        {
          id: "term",
          label: "term",
          description: "Value of the TERM environment variable set in child processes.",
          type: "string",
          defaultValue: "xterm-kitty",
          placeholder: "xterm-kitty",
        },
        {
          id: "allow_remote_control",
          label: "allow_remote_control",
          description: "Allow other programs to control kitty via a socket connection.",
          type: "select",
          options: [
            { value: "no", label: "no" },
            { value: "yes", label: "yes" },
            { value: "socket", label: "socket" },
            { value: "socket-only", label: "socket-only" },
            { value: "password", label: "password" },
          ],
          defaultValue: "no",
        },
        {
          id: "listen_on",
          label: "listen_on",
          description: "Socket address on which kitty listens for remote control connections.",
          type: "string",
          defaultValue: "",
          placeholder: "unix:/tmp/kitty.sock",
        },
        {
          id: "update_check_interval",
          label: "update_check_interval",
          description: "Interval in hours between automatic update checks (0 to disable).",
          type: "number",
          defaultValue: 24,
          min: 0,
          max: 8760,
        },
        {
          id: "clipboard_control",
          label: "clipboard_control",
          description:
            "Actions programs running in the terminal are allowed to perform with the clipboard.",
          type: "select",
          options: [
            { value: "write-clipboard write-primary read-clipboard-ask read-primary-ask", label: "default (ask for read)" },
            { value: "write-clipboard write-primary read-clipboard read-primary", label: "allow all" },
            { value: "no-append", label: "no-append" },
          ],
          defaultValue: "write-clipboard write-primary read-clipboard-ask read-primary-ask",
        },
        {
          id: "wayland_titlebar_color",
          label: "wayland_titlebar_color",
          description: "Color of the Wayland window titlebar; use 'system' or a hex color.",
          type: "string",
          defaultValue: "system",
          placeholder: "system",
        },
      ],
    },
  ],

  serialize(values, enabledFields) {
    const lines: string[] = [];

    const SECTION_FIELDS: { header: string; ids: string[] }[] = [
      {
        header: "Fonts",
        ids: [
          "font_family",
          "bold_font",
          "italic_font",
          "bold_italic_font",
          "font_size",
          "disable_ligatures",
          "undercurl_style",
        ],
      },
      {
        header: "Cursor customization",
        ids: [
          "cursor_shape",
          "cursor_shape_unfocused",
          "cursor_blink_interval",
          "cursor_stop_blinking_after",
          "cursor_beam_thickness",
          "cursor_underline_thickness",
        ],
      },
      {
        header: "Scrollback",
        ids: [
          "scrollback_lines",
          "scrollback_pager",
          "scrollback_pager_history_size",
          "wheel_scroll_multiplier",
          "touch_scroll_multiplier",
        ],
      },
      {
        header: "Mouse",
        ids: [
          "mouse_hide_wait",
          "url_style",
          "open_url_with",
          "detect_urls",
          "copy_on_select",
          "strip_trailing_spaces",
          "focus_follows_mouse",
          "underline_hyperlinks",
        ],
      },
      {
        header: "Terminal bell",
        ids: [
          "enable_audio_bell",
          "visual_bell_duration",
          "visual_bell_color",
          "bell_on_tab",
          "command_on_bell",
        ],
      },
      {
        header: "Window layout",
        ids: [
          "remember_window_size",
          "initial_window_width",
          "initial_window_height",
          "window_padding_width",
          "window_margin_width",
          "window_border_width",
          "draw_minimal_borders",
          "confirm_os_window_close",
        ],
      },
      {
        header: "Tab bar",
        ids: [
          "tab_bar_edge",
          "tab_bar_style",
          "tab_bar_align",
          "tab_bar_min_tabs",
          "tab_title_template",
          "active_tab_foreground",
          "active_tab_background",
          "inactive_tab_foreground",
          "inactive_tab_background",
        ],
      },
      {
        header: "Color scheme",
        ids: [
          "foreground",
          "background",
          "background_opacity",
          "selection_foreground",
          "selection_background",
          "color0",
          "color1",
          "color2",
          "color3",
          "color4",
          "color5",
          "color6",
          "color7",
          "color8",
          "color9",
          "color10",
          "color11",
          "color12",
          "color13",
          "color14",
          "color15",
        ],
      },
      {
        header: "Advanced",
        ids: [
          "shell",
          "editor",
          "term",
          "allow_remote_control",
          "listen_on",
          "update_check_interval",
          "clipboard_control",
          "wayland_titlebar_color",
        ],
      },
    ];

    // Serialize a single value to the kitty config string representation
    function serializeValue(id: string, val: unknown): string {
      if (typeof val === "boolean") {
        return val ? "yes" : "no";
      }
      // Numbers stored as JS numbers
      if (typeof val === "number") {
        return String(val);
      }
      // Strings (including color hex values and enums)
      return String(val);
    }

    for (const section of SECTION_FIELDS) {
      const sectionLines: string[] = [];

      for (const id of section.ids) {
        if (!enabledFields.has(id)) continue;
        const val = values[id];
        if (val === undefined || val === null) continue;
        // Skip command_on_bell if empty
        if (id === "command_on_bell" && val === "") continue;
        // Skip listen_on if empty
        if (id === "listen_on" && val === "") continue;
        sectionLines.push(`${id} ${serializeValue(id, val)}`);
      }

      if (sectionLines.length > 0) {
        lines.push(`# ${section.header}`);
        lines.push(...sectionLines);
        lines.push("");
      }
    }

    return lines.join("\n").trimEnd() + "\n";
  },

  deserialize(raw) {
    const values: Record<string, unknown> = {};
    const enabledFields: string[] = [];

    // Build a lookup of all known boolean fields
    const BOOLEAN_FIELDS = new Set([
      "enable_audio_bell",
      "bell_on_tab",
      "remember_window_size",
      "draw_minimal_borders",
      "detect_urls",
      "focus_follows_mouse",
      "scrollback_fill_enlarged_window",
    ]);

    // Build a lookup of all known numeric fields
    const NUMBER_FIELDS = new Set([
      "font_size",
      "cursor_blink_interval",
      "cursor_stop_blinking_after",
      "cursor_beam_thickness",
      "cursor_underline_thickness",
      "scrollback_lines",
      "scrollback_pager_history_size",
      "wheel_scroll_multiplier",
      "touch_scroll_multiplier",
      "mouse_hide_wait",
      "visual_bell_duration",
      "initial_window_width",
      "initial_window_height",
      "window_padding_width",
      "window_margin_width",
      "window_border_width",
      "tab_bar_min_tabs",
      "background_opacity",
      "update_check_interval",
      "confirm_os_window_close",
    ]);

    try {
      for (const rawLine of raw.split("\n")) {
        const line = rawLine.trim();
        // Skip empty lines and comments
        if (!line || line.startsWith("#")) continue;

        // Split on first whitespace to get key and value
        const spaceIdx = line.search(/\s/);
        if (spaceIdx === -1) continue;

        const key = line.slice(0, spaceIdx).trim();
        const val = line.slice(spaceIdx).trim();

        if (!key || !val) continue;

        if (BOOLEAN_FIELDS.has(key)) {
          values[key] = val === "yes";
          enabledFields.push(key);
        } else if (NUMBER_FIELDS.has(key)) {
          const num = parseFloat(val);
          if (!isNaN(num)) {
            values[key] = num;
            enabledFields.push(key);
          }
        } else {
          // String / enum / color fields
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
    let validLines = 0;
    for (const rawLine of trimmed.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const spaceIdx = line.search(/\s/);
      if (spaceIdx === -1) {
        return { valid: false, error: `Invalid line: "${line.slice(0, 40)}"` };
      }
      validLines++;
    }
    if (validLines === 0 && trimmed.length > 0) {
      // Only comments — still valid
    }
    return { valid: true };
  },
};