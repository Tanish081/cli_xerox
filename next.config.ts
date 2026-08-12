import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js resolves its worker script with a dynamic require() at
  // runtime; bundling it (webpack or Turbopack) breaks that path
  // resolution, so it needs to stay a plain native require instead.
  // tesseract.js-core ships the actual WASM engine as a separate package.
  serverExternalPackages: ["tesseract.js", "tesseract.js-core"],
  // Being external means Vercel's build has to trace which files of these
  // packages to actually copy into the deployed function. Its automatic
  // tracer misses tesseract.js's worker-script file (it's only reachable
  // via a runtime-constructed worker_threads path, not a statically
  // analyzable require), which crashes every OCR call in production with
  // "Cannot find module '..'" — force-including both full package
  // directories is the documented fix for exactly this class of gap.
  outputFileTracingIncludes: {
    "/api/orders/[id]/payment-proof": ["./node_modules/tesseract.js/**", "./node_modules/tesseract.js-core/**"],
  },
};

export default nextConfig;
