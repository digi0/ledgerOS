import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the PDF engine external (unpdf ships a serverless-safe pdf.js build);
  // the parser itself lives in src/lib/parser and is compiled with the app.
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
