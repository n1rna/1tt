import type { AppDefinition } from "../types";

function indent(n: number): string {
  return "    ".repeat(n);
}

export const nginx: AppDefinition = {
  id: "nginx",
  name: "nginx",
  configFileName: "nginx.conf",
  version: "1.27",
  format: "nginx",
  icon: "Server",
  description: "nginx web server configuration",
  docsUrl: "https://nginx.org/en/docs/",
  sections: [
    {
      id: "server",
      label: "Server",
      description: "Listening port, hostnames, and document root.",
      fields: [
        {
          id: "listen",
          label: "listen",
          description: "Port (or address:port) to listen on.",
          type: "string",
          defaultValue: "80",
          placeholder: "80",
          enabledByDefault: true,
        },
        {
          id: "serverName",
          label: "server_name",
          description: "Virtual host names this server block responds to.",
          type: "string",
          defaultValue: "example.com",
          placeholder: "example.com",
          enabledByDefault: true,
        },
        {
          id: "root",
          label: "root",
          description: "Root directory for serving static files.",
          type: "string",
          defaultValue: "/var/www/html",
          placeholder: "/var/www/html",
          enabledByDefault: true,
        },
        {
          id: "index",
          label: "index",
          description: "Default index file(s) to serve.",
          type: "string",
          defaultValue: "index.html index.htm",
          placeholder: "index.html index.htm",
          enabledByDefault: true,
        },
      ],
    },
    {
      id: "ssl",
      label: "SSL",
      description: "HTTPS listener and certificate paths.",
      fields: [
        {
          id: "sslEnabled",
          label: "Enable SSL (listen 443 ssl)",
          description: "Adds an SSL listener on port 443.",
          type: "boolean",
          defaultValue: false,
        },
        {
          id: "sslCertificate",
          label: "ssl_certificate",
          description: "Path to the PEM-encoded certificate file.",
          type: "string",
          defaultValue: "",
          placeholder: "/etc/nginx/ssl/cert.pem",
        },
        {
          id: "sslCertificateKey",
          label: "ssl_certificate_key",
          description: "Path to the private key file.",
          type: "string",
          defaultValue: "",
          placeholder: "/etc/nginx/ssl/key.pem",
        },
        {
          id: "sslProtocols",
          label: "ssl_protocols",
          description: "Allowed TLS protocol versions.",
          type: "string",
          defaultValue: "TLSv1.2 TLSv1.3",
          placeholder: "TLSv1.2 TLSv1.3",
        },
      ],
    },
    {
      id: "proxy",
      label: "Proxy",
      description: "Reverse proxy settings for upstream applications.",
      fields: [
        {
          id: "proxyPass",
          label: "proxy_pass",
          description: "Upstream URL to proxy requests to.",
          type: "string",
          defaultValue: "",
          placeholder: "http://localhost:3000",
        },
        {
          id: "proxySetHeaderHost",
          label: "proxy_set_header Host",
          description: "Passes the original Host header to the upstream.",
          type: "boolean",
          defaultValue: true,
        },
        {
          id: "proxySetHeaderXReal",
          label: "proxy_set_header X-Real-IP",
          description: "Passes the client IP to the upstream.",
          type: "boolean",
          defaultValue: true,
        },
        {
          id: "proxySetHeaderXForwarded",
          label: "proxy_set_header X-Forwarded-For",
          description: "Appends client IP to the X-Forwarded-For chain.",
          type: "boolean",
          defaultValue: true,
        },
        {
          id: "proxyWebSocket",
          label: "WebSocket upgrade headers",
          description: "Adds proxy_http_version 1.1 and Upgrade/Connection headers for WebSocket support.",
          type: "boolean",
          defaultValue: false,
        },
      ],
    },
    {
      id: "loggingPerformance",
      label: "Logging & Performance",
      description: "Access/error logs, gzip compression, and request limits.",
      fields: [
        {
          id: "accessLog",
          label: "access_log",
          description: "Path to the access log file.",
          type: "string",
          defaultValue: "/var/log/nginx/access.log",
          placeholder: "/var/log/nginx/access.log",
          enabledByDefault: true,
        },
        {
          id: "errorLog",
          label: "error_log",
          description: "Path to the error log file.",
          type: "string",
          defaultValue: "/var/log/nginx/error.log",
          placeholder: "/var/log/nginx/error.log",
          enabledByDefault: true,
        },
        {
          id: "gzip",
          label: "gzip",
          description: "Enable gzip compression for responses.",
          type: "boolean",
          defaultValue: true,
          enabledByDefault: true,
        },
        {
          id: "clientMaxBodySize",
          label: "client_max_body_size",
          description: "Maximum allowed size of the client request body.",
          type: "string",
          defaultValue: "10m",
          placeholder: "10m",
        },
        {
          id: "workerConnections",
          label: "worker_connections",
          description: "Maximum number of simultaneous connections per worker process.",
          type: "number",
          defaultValue: 1024,
          min: 128,
          max: 65535,
        },
      ],
    },
  ],

  serialize(values, enabledFields) {
    const get = (key: string): unknown =>
      enabledFields.has(key) ? values[key] : undefined;

    const lines: string[] = [];
    const i1 = indent(1);
    const i2 = indent(2);

    // Optional worker_connections in an events block
    const workerConnections = get("workerConnections");
    if (workerConnections !== undefined) {
      lines.push("events {");
      lines.push(`${i1}worker_connections ${workerConnections};`);
      lines.push("}");
      lines.push("");
    }

    lines.push("server {");

    const listen = get("listen");
    if (listen !== undefined) lines.push(`${i1}listen ${listen};`);

    const sslEnabled = get("sslEnabled");
    if (sslEnabled) lines.push(`${i1}listen 443 ssl;`);

    const serverName = get("serverName");
    if (serverName) lines.push(`${i1}server_name ${serverName};`);

    const root = get("root");
    if (root) lines.push(`${i1}root ${root};`);

    const index = get("index");
    if (index) lines.push(`${i1}index ${index};`);

    const accessLog = get("accessLog");
    if (accessLog) lines.push(`${i1}access_log ${accessLog};`);

    const errorLog = get("errorLog");
    if (errorLog) lines.push(`${i1}error_log ${errorLog};`);

    const gzip = get("gzip");
    if (gzip === true) lines.push(`${i1}gzip on;`);
    else if (gzip === false) lines.push(`${i1}gzip off;`);

    const clientMaxBodySize = get("clientMaxBodySize");
    if (clientMaxBodySize) lines.push(`${i1}client_max_body_size ${clientMaxBodySize};`);

    // SSL directives
    if (sslEnabled) {
      const cert = get("sslCertificate");
      if (cert) lines.push(`${i1}ssl_certificate ${cert};`);
      const key = get("sslCertificateKey");
      if (key) lines.push(`${i1}ssl_certificate_key ${key};`);
      const protocols = get("sslProtocols");
      if (protocols) lines.push(`${i1}ssl_protocols ${protocols};`);
    }

    // location / block - only include if proxy settings are enabled
    const proxyPass = get("proxyPass");
    const hasProxyHeaders =
      get("proxySetHeaderHost") ||
      get("proxySetHeaderXReal") ||
      get("proxySetHeaderXForwarded") ||
      get("proxyWebSocket");

    if (proxyPass || hasProxyHeaders) {
      lines.push("");
      lines.push(`${i1}location / {`);

      if (get("proxyWebSocket")) {
        lines.push(`${i2}proxy_http_version 1.1;`);
        lines.push(`${i2}proxy_set_header Upgrade $http_upgrade;`);
        lines.push(`${i2}proxy_set_header Connection "upgrade";`);
      }

      if (proxyPass) lines.push(`${i2}proxy_pass ${proxyPass};`);
      if (get("proxySetHeaderHost")) lines.push(`${i2}proxy_set_header Host $host;`);
      if (get("proxySetHeaderXReal")) lines.push(`${i2}proxy_set_header X-Real-IP $remote_addr;`);
      if (get("proxySetHeaderXForwarded"))
        lines.push(`${i2}proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`);

      lines.push(`${i1}}`);
    }

    lines.push("}");

    return lines.join("\n");
  },

  deserialize(raw) {
    const values: Record<string, unknown> = {};
    const enabledFields: string[] = [];

    const listenMatches = [...raw.matchAll(/^\s*listen\s+(.+?);/gm)];
    for (const m of listenMatches) {
      const val = m[1].trim();
      if (val === "443 ssl" || val === "443 ssl http2") {
        values["sslEnabled"] = true;
        enabledFields.push("sslEnabled");
      } else {
        values["listen"] = val;
        enabledFields.push("listen");
      }
    }

    const simpleDirectives: Array<[string, string]> = [
      ["server_name", "serverName"],
      ["root", "root"],
      ["index", "index"],
      ["access_log", "accessLog"],
      ["error_log", "errorLog"],
      ["client_max_body_size", "clientMaxBodySize"],
      ["ssl_certificate ", "sslCertificate"],
      ["ssl_certificate_key", "sslCertificateKey"],
      ["ssl_protocols", "sslProtocols"],
      ["proxy_pass", "proxyPass"],
    ];

    for (const [directive, fieldId] of simpleDirectives) {
      const m = raw.match(new RegExp(`^\\s*${directive}\\s+(.+?);`, "m"));
      if (m) {
        values[fieldId] = m[1].trim();
        enabledFields.push(fieldId);
      }
    }

    const gzipMatch = raw.match(/^\s*gzip\s+(on|off);/m);
    if (gzipMatch) {
      values["gzip"] = gzipMatch[1] === "on";
      enabledFields.push("gzip");
    }

    const wcMatch = raw.match(/^\s*worker_connections\s+(\d+);/m);
    if (wcMatch) {
      values["workerConnections"] = parseInt(wcMatch[1], 10);
      enabledFields.push("workerConnections");
    }

    if (raw.includes("proxy_set_header Host")) {
      values["proxySetHeaderHost"] = true;
      enabledFields.push("proxySetHeaderHost");
    }
    if (raw.includes("proxy_set_header X-Real-IP")) {
      values["proxySetHeaderXReal"] = true;
      enabledFields.push("proxySetHeaderXReal");
    }
    if (raw.includes("proxy_set_header X-Forwarded-For")) {
      values["proxySetHeaderXForwarded"] = true;
      enabledFields.push("proxySetHeaderXForwarded");
    }
    if (raw.includes("proxy_set_header Upgrade")) {
      values["proxyWebSocket"] = true;
      enabledFields.push("proxyWebSocket");
    }

    return { values, enabledFields };
  },

  validate(raw) {
    const trimmed = raw.trim();
    if (trimmed === "") return { valid: true };
    if (!trimmed.includes("{")) {
      return { valid: false, error: "Missing block structure" };
    }
    const opens = (trimmed.match(/\{/g) || []).length;
    const closes = (trimmed.match(/\}/g) || []).length;
    if (opens !== closes) {
      return { valid: false, error: `Unbalanced braces: ${opens} open, ${closes} close` };
    }
    if (!trimmed.includes("server")) {
      return { valid: false, error: "Missing server block" };
    }
    return { valid: true };
  },
};