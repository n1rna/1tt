import type { AppDefinition } from "../types";

const REQUEST_TTY_OPTIONS = [
  { value: "auto", label: "auto" },
  { value: "no", label: "no" },
  { value: "yes", label: "yes" },
  { value: "force", label: "force" },
];

function hostFields(prefix: string, defaults: { alias: string; hostName: string; user: string; identityFile: string }) {
  return [
    {
      id: `${prefix}.alias`,
      label: "Host",
      description: "Alias used to reference this host in ssh commands.",
      type: "string" as const,
      defaultValue: defaults.alias,
      placeholder: "alias",
      enabledByDefault: prefix === "host1",
    },
    {
      id: `${prefix}.HostName`,
      label: "HostName",
      description: "Actual hostname or IP address to connect to.",
      type: "string" as const,
      defaultValue: defaults.hostName,
      placeholder: "example.com",
      enabledByDefault: prefix === "host1",
    },
    {
      id: `${prefix}.User`,
      label: "User",
      description: "Username for the remote connection.",
      type: "string" as const,
      defaultValue: defaults.user,
      placeholder: "username",
      enabledByDefault: prefix === "host1",
    },
    {
      id: `${prefix}.Port`,
      label: "Port",
      description: "Port number on the remote host.",
      type: "number" as const,
      defaultValue: 22,
      min: 1,
      max: 65535,
      enabledByDefault: prefix === "host1",
    },
    {
      id: `${prefix}.IdentityFile`,
      label: "IdentityFile",
      description: "Path to the private key file.",
      type: "string" as const,
      defaultValue: defaults.identityFile,
      placeholder: "~/.ssh/id_ed25519",
      enabledByDefault: prefix === "host1",
    },
    {
      id: `${prefix}.ForwardAgent`,
      label: "ForwardAgent",
      description: "Forward the authentication agent to the remote machine.",
      type: "boolean" as const,
      defaultValue: false,
    },
    {
      id: `${prefix}.ProxyJump`,
      label: "ProxyJump",
      description: "Intermediate host to jump through.",
      type: "string" as const,
      defaultValue: "",
      placeholder: "bastion",
    },
    {
      id: `${prefix}.LocalForward`,
      label: "LocalForward",
      description: "Forward a local port to a remote address.",
      type: "string" as const,
      defaultValue: "",
      placeholder: "8080 localhost:80",
    },
    {
      id: `${prefix}.RemoteForward`,
      label: "RemoteForward",
      description: "Forward a remote port to a local address.",
      type: "string" as const,
      defaultValue: "",
      placeholder: "9090 localhost:9090",
    },
    {
      id: `${prefix}.RequestTTY`,
      label: "RequestTTY",
      description: "Controls pseudo-terminal allocation.",
      type: "select" as const,
      options: REQUEST_TTY_OPTIONS,
      defaultValue: "auto",
    },
  ];
}

const GLOBAL_BOOLEAN_FIELDS = new Set([
  "AddKeysToAgent",
  "IdentitiesOnly",
  "ForwardAgent",
  "ForwardX11",
  "Compression",
  "HashKnownHosts",
]);

const HOST_BOOLEAN_FIELDS = new Set(["ForwardAgent"]);

const NUMERIC_FIELDS = new Set([
  "ServerAliveInterval",
  "ServerAliveCountMax",
  "Port",
]);

const HOST_FIELD_KEYS = [
  "HostName",
  "User",
  "Port",
  "IdentityFile",
  "ForwardAgent",
  "ProxyJump",
  "LocalForward",
  "RemoteForward",
  "RequestTTY",
];

const HOST_PREFIXES = ["host1", "host2", "host3"];

export const ssh: AppDefinition = {
  id: "ssh",
  name: "SSH",
  configFileName: "config",
  version: "9.9",
  format: "text",
  icon: "KeyRound",
  description: "OpenSSH client configuration for remote connections.",
  docsUrl: "https://man.openbsd.org/ssh_config",
  sections: [
    {
      id: "global",
      label: "Global Defaults",
      description: "Default settings applied to all hosts via Host *.",
      fields: [
        {
          id: "global.AddKeysToAgent",
          label: "AddKeysToAgent",
          description: "Automatically add keys to the running ssh-agent.",
          type: "boolean",
          defaultValue: true,
          enabledByDefault: true,
        },
        {
          id: "global.IdentitiesOnly",
          label: "IdentitiesOnly",
          description: "Only use identity files explicitly configured.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "global.ServerAliveInterval",
          label: "ServerAliveInterval",
          description: "Seconds between keepalive messages to the server.",
          type: "number",
          defaultValue: 0,
          min: 0,
          max: 3600,
          enabledByDefault: true,
        },
        {
          id: "global.ServerAliveCountMax",
          label: "ServerAliveCountMax",
          description: "Number of missed keepalives before disconnecting.",
          type: "number",
          defaultValue: 3,
          min: 0,
          max: 100,
        },
        {
          id: "global.ForwardAgent",
          label: "ForwardAgent",
          description: "Forward the authentication agent to remote machines.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "global.ForwardX11",
          label: "ForwardX11",
          description: "Forward X11 display connections.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "global.Compression",
          label: "Compression",
          description: "Enable compression on the connection.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "global.HashKnownHosts",
          label: "HashKnownHosts",
          description: "Hash hostnames in the known_hosts file.",
          type: "boolean",
          defaultValue: true,
        },
        {
          id: "global.StrictHostKeyChecking",
          label: "StrictHostKeyChecking",
          description: "Policy for unknown or changed host keys.",
          type: "select",
          options: [
            { value: "ask", label: "ask" },
            { value: "yes", label: "yes" },
            { value: "no", label: "no" },
            { value: "accept-new", label: "accept-new" },
          ],
          defaultValue: "ask",
        },
        {
          id: "global.PreferredAuthentications",
          label: "PreferredAuthentications",
          description: "Authentication methods tried in order.",
          type: "select",
          options: [
            { value: "publickey", label: "publickey" },
            { value: "password", label: "password" },
            { value: "keyboard-interactive", label: "keyboard-interactive" },
            { value: "publickey,password", label: "publickey,password" },
          ],
          defaultValue: "publickey",
        },
        {
          id: "global.LogLevel",
          label: "LogLevel",
          description: "Verbosity of client-side logging.",
          type: "select",
          options: [
            { value: "QUIET", label: "QUIET" },
            { value: "FATAL", label: "FATAL" },
            { value: "ERROR", label: "ERROR" },
            { value: "INFO", label: "INFO" },
            { value: "VERBOSE", label: "VERBOSE" },
            { value: "DEBUG", label: "DEBUG" },
          ],
          defaultValue: "INFO",
        },
      ],
    },
    {
      id: "host1",
      label: "Host 1",
      description: "First remote host entry.",
      fields: hostFields("host1", {
        alias: "dev",
        hostName: "",
        user: "",
        identityFile: "~/.ssh/id_ed25519",
      }),
    },
    {
      id: "host2",
      label: "Host 2",
      description: "Second remote host entry.",
      fields: hostFields("host2", {
        alias: "prod",
        hostName: "",
        user: "",
        identityFile: "~/.ssh/id_rsa",
      }),
    },
    {
      id: "host3",
      label: "Host 3",
      description: "Third remote host entry.",
      fields: hostFields("host3", {
        alias: "github.com",
        hostName: "github.com",
        user: "git",
        identityFile: "~/.ssh/id_ed25519",
      }),
    },
  ],

  serialize(values, enabledFields) {
    const lines: string[] = [];

    // --- Global defaults (Host *) ---
    const globalLines: string[] = [];
    const globalFieldKeys = [
      "AddKeysToAgent",
      "IdentitiesOnly",
      "ServerAliveInterval",
      "ServerAliveCountMax",
      "ForwardAgent",
      "ForwardX11",
      "Compression",
      "HashKnownHosts",
      "StrictHostKeyChecking",
      "PreferredAuthentications",
      "LogLevel",
    ];

    for (const key of globalFieldKeys) {
      const id = `global.${key}`;
      if (!enabledFields.has(id)) continue;
      const val = values[id];
      if (val === undefined || val === null) continue;

      let serialized: string;
      if (typeof val === "boolean") {
        serialized = val ? "yes" : "no";
      } else {
        serialized = String(val);
      }
      globalLines.push(`    ${key} ${serialized}`);
    }

    if (globalLines.length > 0) {
      lines.push("Host *");
      lines.push(...globalLines);
    }

    // --- Individual host blocks ---
    for (const prefix of HOST_PREFIXES) {
      const aliasId = `${prefix}.alias`;
      const alias = enabledFields.has(aliasId) ? String(values[aliasId] ?? "") : "";
      if (!alias) continue;

      const hostLines: string[] = [];

      for (const key of HOST_FIELD_KEYS) {
        const id = `${prefix}.${key}`;
        if (!enabledFields.has(id)) continue;
        const val = values[id];
        if (val === undefined || val === null) continue;

        // Skip empty strings
        if (typeof val === "string" && val === "") continue;

        let serialized: string;
        if (typeof val === "boolean") {
          serialized = val ? "yes" : "no";
        } else {
          serialized = String(val);
        }
        hostLines.push(`    ${key} ${serialized}`);
      }

      // Only emit block if there are fields beyond the alias
      if (hostLines.length === 0) continue;

      if (lines.length > 0) {
        lines.push("");
      }
      lines.push(`Host ${alias}`);
      lines.push(...hostLines);
    }

    if (lines.length === 0) return "";
    return lines.join("\n") + "\n";
  },

  deserialize(raw) {
    const values: Record<string, unknown> = {};
    const enabledFields: string[] = [];

    let currentBlock: "global" | "host1" | "host2" | "host3" | null = null;
    let hostIndex = 0;

    try {
      for (const rawLine of raw.split("\n")) {
        const trimmed = rawLine.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith("#")) continue;

        // Detect Host lines
        const hostMatch = trimmed.match(/^Host\s+(.+)$/);
        if (hostMatch) {
          const alias = hostMatch[1].trim();
          if (alias === "*") {
            currentBlock = "global";
          } else if (hostIndex < 3) {
            const prefix = HOST_PREFIXES[hostIndex] as "host1" | "host2" | "host3";
            currentBlock = prefix;
            hostIndex++;
            values[`${prefix}.alias`] = alias;
            enabledFields.push(`${prefix}.alias`);
          } else {
            currentBlock = null;
          }
          continue;
        }

        if (!currentBlock) continue;

        // Parse indented key-value lines
        const spaceIdx = trimmed.search(/\s/);
        if (spaceIdx === -1) continue;

        const key = trimmed.slice(0, spaceIdx).trim();
        const val = trimmed.slice(spaceIdx).trim();
        if (!key || !val) continue;

        if (currentBlock === "global") {
          const id = `global.${key}`;
          if (GLOBAL_BOOLEAN_FIELDS.has(key)) {
            values[id] = val === "yes";
          } else if (NUMERIC_FIELDS.has(key)) {
            const num = parseInt(val, 10);
            if (!isNaN(num)) {
              values[id] = num;
            } else {
              values[id] = val;
            }
          } else {
            values[id] = val;
          }
          enabledFields.push(id);
        } else {
          const id = `${currentBlock}.${key}`;
          if (HOST_BOOLEAN_FIELDS.has(key)) {
            values[id] = val === "yes";
          } else if (NUMERIC_FIELDS.has(key)) {
            const num = parseInt(val, 10);
            if (!isNaN(num)) {
              values[id] = num;
            } else {
              values[id] = val;
            }
          } else {
            values[id] = val;
          }
          enabledFields.push(id);
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
      const line = rawLine.trimEnd();

      // Empty lines and comments are fine
      if (!line.trim() || line.trim().startsWith("#")) continue;

      // Host declaration (no indentation required but allowed)
      if (line.trim().match(/^Host\s+\S/)) continue;

      // Indented key-value pair (at least one leading space/tab)
      if (/^\s+\S+\s+\S/.test(line)) continue;

      // Non-indented key-value pair (top-level directives are valid too)
      if (/^\S+\s+\S/.test(line)) continue;

      return {
        valid: false,
        error: `Invalid line: "${line.trim().slice(0, 50)}"`,
      };
    }

    return { valid: true };
  },
};
