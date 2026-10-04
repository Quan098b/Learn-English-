import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  const siteUrl = new URL(
    env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  );

  if (!["http:", "https:"].includes(siteUrl.protocol)) {
    throw new Error("NEXT_PUBLIC_SITE_URL must use the http or https protocol");
  }

  // Inline the public Firebase web config (NEXT_PUBLIC_* only) the same way
  // vinext does, so lib/firebase.ts works in both builds. Unset values stay
  // undefined and the app simply shows that realtime is not configured.
  const define = Object.fromEntries(
    Object.entries(env)
      .filter(([key]) => key.startsWith("NEXT_PUBLIC_"))
      .map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)]),
  );

  return {
    define,
    root: resolve(import.meta.dirname, "firebase-site"),
    publicDir: resolve(import.meta.dirname, "public"),
    base: "/",
    plugins: [
      {
        name: "site-url-html",
        transformIndexHtml(html) {
          return html.replaceAll("%SITE_URL%", siteUrl.origin);
        },
      },
      react(),
    ],
    build: {
      outDir: resolve(import.meta.dirname, "firebase-dist"),
      emptyOutDir: true,
    },
  };
});
