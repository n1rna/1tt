import type { AppDefinition } from "../types";

const BOOLEAN_FIELDS = new Set([
  "server",
  "listen",
  "testnet",
  "signet",
  "regtest",
  "dns",
  "dnsseed",
  "blocksonly",
  "peerbloomfilters",
  "peerblockfilters",
  "rest",
  "disablewallet",
  "avoidpartialspends",
  "spendzeroconfchange",
  "walletrbf",
  "txindex",
  "blockfilterindex",
  "coinstatsindex",
  "printtoconsole",
  "shrinkdebugfile",
  "logips",
  "logtimestamps",
]);

const NUMBER_FIELDS = new Set([
  "maxconnections",
  "maxuploadtarget",
  "port",
  "bantime",
  "rpcport",
  "rpcthreads",
  "rpcworkqueue",
  "dbcache",
  "maxmempool",
  "par",
  "maxorphantx",
  "prune",
]);

const STRING_ARRAY_FIELDS = new Set([
  "addnode",
  "connect",
  "seednode",
  "rpcallowip",
]);

export const bitcoin: AppDefinition = {
  id: "bitcoin",
  name: "Bitcoin Core",
  configFileName: "bitcoin.conf",
  version: "28.0",
  format: "conf",
  icon: "Coins",
  description: "Bitcoin Core full node configuration",
  docsUrl: "https://github.com/bitcoin/bitcoin/blob/master/doc/bitcoin-conf.md",
  sections: [
    {
      id: "chain",
      label: "Chain Selection",
      description: "Select the network chain to operate on.",
      fields: [
        {
          id: "chain",
          label: "chain",
          description: "Select the chain to use (main, test, signet, regtest).",
          type: "select",
          options: [
            { value: "main", label: "main" },
            { value: "test", label: "test" },
            { value: "signet", label: "signet" },
            { value: "regtest", label: "regtest" },
          ],
          defaultValue: "main",
          enabledByDefault: true,
        },
        {
          id: "testnet",
          label: "testnet",
          description: "Use the test chain.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "signet",
          label: "signet",
          description: "Use the signet chain.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "regtest",
          label: "regtest",
          description: "Enter regression test mode.",
          type: "boolean",
          defaultValue: false,
        },
      ],
    },
    {
      id: "network",
      label: "Network",
      description: "Connection and peer settings.",
      fields: [
        {
          id: "server",
          label: "server",
          description: "Accept JSON-RPC commands.",
          type: "boolean",
          defaultValue: false,
          enabledByDefault: true,
        },
        {
          id: "listen",
          label: "listen",
          description: "Accept incoming connections from peers.",
          type: "boolean",
          defaultValue: true,
          enabledByDefault: true,
        },
        {
          id: "maxconnections",
          label: "maxconnections",
          description: "Maximum number of inbound+outbound connections.",
          type: "number",
          defaultValue: 125,
          min: 0,
          max: 1000,
          enabledByDefault: true,
        },
        {
          id: "maxuploadtarget",
          label: "maxuploadtarget",
          description: "Maximum upload target in MiB per 24h (0 = unlimited).",
          type: "number",
          defaultValue: 0,
          min: 0,
        },
        {
          id: "port",
          label: "port",
          description: "Listen for connections on this port.",
          type: "number",
          defaultValue: 8333,
          min: 1,
          max: 65535,
        },
        {
          id: "bind",
          label: "bind",
          description: "Bind to a given address and always listen on it.",
          type: "string",
          defaultValue: "",
          placeholder: "0.0.0.0",
        },
        {
          id: "externalip",
          label: "externalip",
          description: "Specify your own public address for incoming connections.",
          type: "string",
          defaultValue: "",
          placeholder: "1.2.3.4",
        },
        {
          id: "proxy",
          label: "proxy",
          description: "Connect through a SOCKS5 proxy.",
          type: "string",
          defaultValue: "",
          placeholder: "127.0.0.1:9050",
        },
        {
          id: "onlynet",
          label: "onlynet",
          description: "Only connect to nodes on a specific network.",
          type: "select",
          options: [
            { value: "ipv4", label: "ipv4" },
            { value: "ipv6", label: "ipv6" },
            { value: "onion", label: "onion" },
            { value: "i2p", label: "i2p" },
            { value: "cjdns", label: "cjdns" },
          ],
          defaultValue: "ipv4",
        },
        {
          id: "addnode",
          label: "addnode",
          description: "Add a node to connect to and attempt to keep the connection open.",
          type: "string-array",
          defaultValue: [],
          placeholder: "IP:port",
        },
        {
          id: "connect",
          label: "connect",
          description: "Connect only to the specified nodes (no auto-discovery).",
          type: "string-array",
          defaultValue: [],
          placeholder: "IP:port",
        },
        {
          id: "seednode",
          label: "seednode",
          description: "Connect to a seed node to retrieve peer addresses then disconnect.",
          type: "string-array",
          defaultValue: [],
          placeholder: "IP:port",
        },
        {
          id: "bantime",
          label: "bantime",
          description: "Default duration in seconds to ban misbehaving peers.",
          type: "number",
          defaultValue: 86400,
          min: 0,
        },
        {
          id: "dns",
          label: "dns",
          description: "Allow DNS lookups for addnode, seednode, and connect.",
          type: "boolean",
          defaultValue: true,
        },
        {
          id: "dnsseed",
          label: "dnsseed",
          description: "Query for peer addresses via DNS lookup on startup.",
          type: "boolean",
          defaultValue: true,
        },
        {
          id: "blocksonly",
          label: "blocksonly",
          description: "Relay and mine blocks only, reducing bandwidth usage.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "peerbloomfilters",
          label: "peerbloomfilters",
          description: "Support filtering of blocks and transactions with bloom filters.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "peerblockfilters",
          label: "peerblockfilters",
          description: "Serve compact block filters to peers (BIP 157).",
          type: "boolean",
          defaultValue: false,
        },
      ],
    },
    {
      id: "rpc",
      label: "RPC",
      description: "JSON-RPC server settings.",
      fields: [
        {
          id: "rpcuser",
          label: "rpcuser",
          description: "Username for JSON-RPC connections.",
          type: "string",
          defaultValue: "",
          placeholder: "username",
        },
        {
          id: "rpcpassword",
          label: "rpcpassword",
          description: "Password for JSON-RPC connections.",
          type: "string",
          defaultValue: "",
          placeholder: "password",
        },
        {
          id: "rpcport",
          label: "rpcport",
          description: "Listen for JSON-RPC connections on this port.",
          type: "number",
          defaultValue: 8332,
          min: 1,
          max: 65535,
          enabledByDefault: true,
        },
        {
          id: "rpcbind",
          label: "rpcbind",
          description: "Bind the JSON-RPC server to this address.",
          type: "string",
          defaultValue: "",
          placeholder: "127.0.0.1",
        },
        {
          id: "rpcallowip",
          label: "rpcallowip",
          description: "Allow JSON-RPC connections from specified source.",
          type: "string-array",
          defaultValue: ["127.0.0.1"],
          enabledByDefault: true,
        },
        {
          id: "rpcthreads",
          label: "rpcthreads",
          description: "Number of threads to service RPC calls.",
          type: "number",
          defaultValue: 4,
          min: 1,
          max: 64,
        },
        {
          id: "rpcworkqueue",
          label: "rpcworkqueue",
          description: "Depth of the RPC work queue.",
          type: "number",
          defaultValue: 16,
          min: 1,
          max: 1024,
        },
        {
          id: "rest",
          label: "rest",
          description: "Accept public REST requests.",
          type: "boolean",
          defaultValue: false,
        },
      ],
    },
    {
      id: "wallet",
      label: "Wallet",
      description: "Wallet behavior and address settings.",
      fields: [
        {
          id: "disablewallet",
          label: "disablewallet",
          description: "Do not load the wallet and disable wallet RPC calls.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "addresstype",
          label: "addresstype",
          description: "Default address type for new addresses.",
          type: "select",
          options: [
            { value: "legacy", label: "legacy" },
            { value: "p2sh-segwit", label: "p2sh-segwit" },
            { value: "bech32", label: "bech32" },
            { value: "bech32m", label: "bech32m" },
          ],
          defaultValue: "bech32",
        },
        {
          id: "changetype",
          label: "changetype",
          description: "Default address type for change outputs.",
          type: "select",
          options: [
            { value: "legacy", label: "legacy" },
            { value: "p2sh-segwit", label: "p2sh-segwit" },
            { value: "bech32", label: "bech32" },
            { value: "bech32m", label: "bech32m" },
          ],
          defaultValue: "bech32",
        },
        {
          id: "avoidpartialspends",
          label: "avoidpartialspends",
          description: "Group outputs by address, avoiding partial spends.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "spendzeroconfchange",
          label: "spendzeroconfchange",
          description: "Allow spending unconfirmed change outputs.",
          type: "boolean",
          defaultValue: true,
        },
        {
          id: "walletrbf",
          label: "walletrbf",
          description: "Send transactions with opt-in full replace-by-fee (BIP 125).",
          type: "boolean",
          defaultValue: true,
        },
      ],
    },
    {
      id: "performance",
      label: "Performance",
      description: "Cache sizes and processing threads.",
      fields: [
        {
          id: "dbcache",
          label: "dbcache",
          description: "UTXO database cache size in MiB.",
          type: "number",
          defaultValue: 450,
          min: 4,
          max: 16384,
          enabledByDefault: true,
        },
        {
          id: "maxmempool",
          label: "maxmempool",
          description: "Maximum mempool size in MiB.",
          type: "number",
          defaultValue: 300,
          min: 5,
          max: 4096,
        },
        {
          id: "par",
          label: "par",
          description: "Number of script verification threads (0 = auto).",
          type: "number",
          defaultValue: 0,
          min: -1,
          max: 64,
        },
        {
          id: "maxorphantx",
          label: "maxorphantx",
          description: "Maximum number of orphan transactions kept in memory.",
          type: "number",
          defaultValue: 100,
          min: 0,
        },
      ],
    },
    {
      id: "indexing",
      label: "Indexing & Pruning",
      description: "Transaction index, block filters, and pruning settings.",
      fields: [
        {
          id: "txindex",
          label: "txindex",
          description: "Maintain a full transaction index (used by getrawtransaction).",
          type: "boolean",
          defaultValue: false,
          enabledByDefault: true,
        },
        {
          id: "blockfilterindex",
          label: "blockfilterindex",
          description: "Maintain an index of compact block filters by type.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "coinstatsindex",
          label: "coinstatsindex",
          description: "Maintain coinstats index used by gettxoutsetinfo.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "prune",
          label: "prune",
          description: "Reduce storage by pruning old blocks (0 = disabled, 550+ = target MiB).",
          type: "number",
          defaultValue: 0,
          min: 0,
          max: 999999,
        },
        {
          id: "blocksdir",
          label: "blocksdir",
          description: "Specify a non-default directory to store block data.",
          type: "string",
          defaultValue: "",
          placeholder: "/path/to/blocks",
        },
        {
          id: "datadir",
          label: "datadir",
          description: "Specify a non-default data directory.",
          type: "string",
          defaultValue: "",
          placeholder: "/path/to/data",
        },
      ],
    },
    {
      id: "debug",
      label: "Debug & Logging",
      description: "Logging categories and output settings.",
      fields: [
        {
          id: "debug",
          label: "debug",
          description: "Enable debug logging for a specific category.",
          type: "select",
          options: [
            { value: "", label: "none" },
            { value: "net", label: "net" },
            { value: "tor", label: "tor" },
            { value: "mempool", label: "mempool" },
            { value: "http", label: "http" },
            { value: "rpc", label: "rpc" },
            { value: "validation", label: "validation" },
          ],
          defaultValue: "",
        },
        {
          id: "printtoconsole",
          label: "printtoconsole",
          description: "Send trace/debug info to the console instead of debug.log.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "shrinkdebugfile",
          label: "shrinkdebugfile",
          description: "Shrink debug.log on client startup.",
          type: "boolean",
          defaultValue: true,
        },
        {
          id: "logips",
          label: "logips",
          description: "Include IP addresses in debug output.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "logtimestamps",
          label: "logtimestamps",
          description: "Prepend debug output with timestamps.",
          type: "boolean",
          defaultValue: true,
        },
      ],
    },
    {
      id: "zmq",
      label: "ZeroMQ",
      description: "ZeroMQ notification endpoints.",
      fields: [
        {
          id: "zmqpubrawblock",
          label: "zmqpubrawblock",
          description: "Publish raw block data to this ZMQ address.",
          type: "string",
          defaultValue: "",
          placeholder: "tcp://127.0.0.1:28332",
        },
        {
          id: "zmqpubrawtx",
          label: "zmqpubrawtx",
          description: "Publish raw transaction data to this ZMQ address.",
          type: "string",
          defaultValue: "",
          placeholder: "tcp://127.0.0.1:28333",
        },
        {
          id: "zmqpubhashblock",
          label: "zmqpubhashblock",
          description: "Publish block hashes to this ZMQ address.",
          type: "string",
          defaultValue: "",
          placeholder: "tcp://127.0.0.1:28334",
        },
        {
          id: "zmqpubhashtx",
          label: "zmqpubhashtx",
          description: "Publish transaction hashes to this ZMQ address.",
          type: "string",
          defaultValue: "",
          placeholder: "tcp://127.0.0.1:28335",
        },
      ],
    },
  ],

  serialize(values, enabledFields) {
    const lines: string[] = ["# Bitcoin Core Configuration", ""];

    const SECTION_FIELDS: { header: string; ids: string[] }[] = [
      {
        header: "Chain Selection",
        ids: ["chain", "testnet", "signet", "regtest"],
      },
      {
        header: "Network",
        ids: [
          "server",
          "listen",
          "maxconnections",
          "maxuploadtarget",
          "port",
          "bind",
          "externalip",
          "proxy",
          "onlynet",
          "addnode",
          "connect",
          "seednode",
          "bantime",
          "dns",
          "dnsseed",
          "blocksonly",
          "peerbloomfilters",
          "peerblockfilters",
        ],
      },
      {
        header: "RPC",
        ids: [
          "rpcuser",
          "rpcpassword",
          "rpcport",
          "rpcbind",
          "rpcallowip",
          "rpcthreads",
          "rpcworkqueue",
          "rest",
        ],
      },
      {
        header: "Wallet",
        ids: [
          "disablewallet",
          "addresstype",
          "changetype",
          "avoidpartialspends",
          "spendzeroconfchange",
          "walletrbf",
        ],
      },
      {
        header: "Performance",
        ids: ["dbcache", "maxmempool", "par", "maxorphantx"],
      },
      {
        header: "Indexing & Pruning",
        ids: [
          "txindex",
          "blockfilterindex",
          "coinstatsindex",
          "prune",
          "blocksdir",
          "datadir",
        ],
      },
      {
        header: "Debug & Logging",
        ids: [
          "debug",
          "printtoconsole",
          "shrinkdebugfile",
          "logips",
          "logtimestamps",
        ],
      },
      {
        header: "ZeroMQ",
        ids: [
          "zmqpubrawblock",
          "zmqpubrawtx",
          "zmqpubhashblock",
          "zmqpubhashtx",
        ],
      },
    ];

    for (const section of SECTION_FIELDS) {
      const sectionLines: string[] = [];

      for (const id of section.ids) {
        if (!enabledFields.has(id)) continue;
        const val = values[id];
        if (val === undefined || val === null) continue;

        // String-array fields: repeat the key for each entry
        if (STRING_ARRAY_FIELDS.has(id)) {
          const arr = val as string[];
          for (const entry of arr) {
            if (entry) sectionLines.push(`${id}=${entry}`);
          }
          continue;
        }

        // Skip empty strings
        if (typeof val === "string" && val === "") continue;

        // Booleans: 1 or 0
        if (typeof val === "boolean") {
          sectionLines.push(`${id}=${val ? "1" : "0"}`);
          continue;
        }

        // Numbers and everything else
        sectionLines.push(`${id}=${val}`);
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
    const arrayAccum: Record<string, string[]> = {};

    try {
      for (const rawLine of raw.split("\n")) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#") || line.startsWith("[")) continue;

        const eqIdx = line.indexOf("=");
        if (eqIdx === -1) continue;

        const key = line.slice(0, eqIdx).trim();
        const val = line.slice(eqIdx + 1).trim();

        if (!key) continue;

        // String-array fields: accumulate repeated keys
        if (STRING_ARRAY_FIELDS.has(key)) {
          if (!arrayAccum[key]) arrayAccum[key] = [];
          if (val) arrayAccum[key].push(val);
          continue;
        }

        // Boolean fields
        if (BOOLEAN_FIELDS.has(key)) {
          values[key] = val === "1";
          if (!enabledFields.includes(key)) enabledFields.push(key);
          continue;
        }

        // Number fields
        if (NUMBER_FIELDS.has(key)) {
          const num = parseFloat(val);
          if (!isNaN(num)) {
            values[key] = num;
            if (!enabledFields.includes(key)) enabledFields.push(key);
          }
          continue;
        }

        // String/select fields
        values[key] = val;
        if (!enabledFields.includes(key)) enabledFields.push(key);
      }

      // Merge accumulated arrays
      for (const [key, arr] of Object.entries(arrayAccum)) {
        values[key] = arr;
        enabledFields.push(key);
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
      if (!line || line.startsWith("#") || line.startsWith("[")) continue;
      if (!line.includes("=")) {
        return {
          valid: false,
          error: `Invalid line (missing "="): "${line.slice(0, 50)}"`,
        };
      }
    }

    return { valid: true };
  },
};
