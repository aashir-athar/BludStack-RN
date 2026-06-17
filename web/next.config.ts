import type { NextConfig } from "next";
import path from "node:path";

// Static export for GitHub Pages. The app is a pure client-side SPA (Supabase +
// fetch on the client), so it exports to plain HTML/JS with no server runtime.
// basePath is env-driven: GitHub project pages serve under /<repo>, so the
// deploy workflow sets NEXT_PUBLIC_BASE_PATH=/BludStack; local dev leaves it empty.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  // Static hosts cannot run the Next image optimizer.
  images: { unoptimized: true },
  // Serve /route/ -> /route/index.html, which GitHub Pages resolves cleanly.
  trailingSlash: true,
  // The repo root has its own lockfile (husky tooling); pin Turbopack's root here.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
