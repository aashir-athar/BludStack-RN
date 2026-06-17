import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The repo root has its own lockfile (husky tooling). Pin Turbopack's root to
  // this app so it does not infer the monorepo root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
