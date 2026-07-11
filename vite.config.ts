// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: {
      // Unique per deployment. Baked into BOTH the client bundle and the SSR
      // server (same build run = same value). The client compares its baked id
      // against the live server's id to detect a new deployment. See
      // src/lib/build-info.ts and src/components/AutoUpdater.tsx.
      __BUILD_ID__: JSON.stringify(
        process.env.LOVABLE_BUILD_ID ??
          process.env.CF_PAGES_COMMIT_SHA ??
          String(Date.now()),
      ),
    },
  },
});
