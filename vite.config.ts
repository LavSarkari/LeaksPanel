import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
    },
    plugins: [react()],
    define: {
      "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      // Use array form so we can use a RegExp alias to rewrite refractor internal paths
      alias: [
        { find: '@', replacement: path.resolve(__dirname, '.') },
        // Some packages (notably older bundles of react-syntax-highlighter) import
        // internal refractor paths like `refractor/lib/core` which are blocked by
        // the package `exports` map. Rewrite those imports to the exported
        // entrypoints (e.g. `refractor/core`) so Vite/Rollup can resolve them.
  { find: /^refractor\/lib\/(.*)$/, replacement: 'refractor/$1' },
  // Map explicit language imports (e.g. "refractor/lang/abap.js") to the
  // concrete file under node_modules. This bypasses package export
  // restrictions that can prevent resolving internal paths during
  // build-time bundling.
  { find: /^refractor\/lang\/(.*)\.js$/, replacement: path.resolve(__dirname, 'node_modules/refractor/lang/$1.js') },
      ],
    },
    build: {
      rollupOptions: {
        external: [],
      },
      commonjsOptions: {
        include: [/node_modules/, /refractor/],
      },
    },
    optimizeDeps: {
      include: [
        "react-syntax-highlighter",
        "react-syntax-highlighter/dist/esm/styles/prism",
        "refractor",
      ],
      force: true,
    },
  };
});
