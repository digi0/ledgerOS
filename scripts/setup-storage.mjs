// Create the private `documents` Storage bucket (idempotent).
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./lib.mjs";

const env = loadEnv();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: buckets, error: listErr } = await sb.storage.listBuckets();
if (listErr) {
  console.error("listBuckets failed:", listErr.message);
  process.exit(1);
}

if (buckets.some((b) => b.name === "documents")) {
  console.log("bucket exists: documents");
} else {
  const { error } = await sb.storage.createBucket("documents", {
    public: false,
    fileSizeLimit: "50MB",
  });
  if (error) {
    console.error("createBucket failed:", error.message);
    process.exit(1);
  }
  console.log("✓ created private bucket: documents");
}
