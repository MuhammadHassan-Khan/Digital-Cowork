import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components (PPR) is intentionally OFF for this MVP.
  // This app reads the Supabase session via cookies() on nearly every route
  // (auth pages, protected layouts, onboarding, discovery). With cacheComponents
  // enabled, those reads must sit behind <Suspense> boundaries or the build fails,
  // which adds plumbing without product value for this staged demo.
  // Revisit if we later want a static shell + streaming for public pages.
  cacheComponents: false,
  // Note: partialPrefetching requires cacheComponents — revisit both together.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
