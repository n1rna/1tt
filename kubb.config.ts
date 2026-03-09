import { defineConfig } from "@kubb/core";
import { pluginOas } from "@kubb/plugin-oas";
import { pluginTs } from "@kubb/plugin-ts";
import { pluginReactQuery } from "@kubb/plugin-react-query";
import { pluginClient } from "@kubb/plugin-client";

export default defineConfig({
  root: ".",
  input: {
    path: "./api/openapi.yaml",
  },
  output: {
    path: "./src/lib/api/generated",
    clean: true,
  },
  plugins: [
    pluginOas(),
    pluginTs({
      output: { path: "types" },
    }),
    pluginClient({
      output: { path: "clients" },
      importPath: "@/lib/api/client",
    }),
    pluginReactQuery({
      output: { path: "hooks" },
      client: {
        importPath: "@/lib/api/client",
      },
      query: {
        methods: ["get"],
      },
      mutation: {
        methods: ["post", "put", "patch", "delete"],
      },
    }),
  ],
});
