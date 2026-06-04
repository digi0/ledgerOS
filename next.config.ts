import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // accounting-parser is a workspace package in TS — let Next compile it.
  transpilePackages: ["accounting-parser"],
  // Keep the PDF engine external (unpdf ships a serverless-safe pdf.js build).
  serverExternalPackages: ["unpdf"],

  // Default server-action body limit is 1 MB. Bank statements / scanned
  // notices can be tens of MB, so raise it to match the Storage bucket cap.
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
