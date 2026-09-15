/// <reference types="vitest/config" />
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves the project under /hordbook/. The installed home-screen
// app's start URL is derived from this, so it must not change after launch.
export const BASE_PATH = "/hordbook/";

export default defineConfig({
  base: BASE_PATH,
  plugins: [
    preact(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Hordbook",
        short_name: "Hordbook",
        description: "A personal word hoard: rank-ordered vocabulary collections for English learners.",
        lang: "en",
        start_url: BASE_PATH,
        scope: BASE_PATH,
        display: "standalone",
        orientation: "portrait",
        background_color: "#111318",
        theme_color: "#111318",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precache everything the build emits, including the collection JSON
        // chunk, so the app is fully usable offline after the first visit.
        globPatterns: ["**/*.{js,css,html,svg,png,json,woff2}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.tsx", "src/**/*.test.ts"],
  },
});
