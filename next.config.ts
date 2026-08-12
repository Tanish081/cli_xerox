import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js resolves its worker script with a dynamic require() at
  // runtime; bundling it (webpack or Turbopack) breaks that path
  // resolution, so it needs to stay a plain native require instead.
  serverExternalPackages: ["tesseract.js"],
};

export default nextConfig;
