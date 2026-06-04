// Shared helpers for the dev DB/storage scripts. No deps beyond node + pg.
import { readFileSync } from "node:fs";

/** Minimal .env.local loader (handles quoted/unquoted values). */
export function loadEnv(path = ".env.local") {
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

/**
 * Parse a postgres URI into pg.Client config WITHOUT requiring the password
 * to be URL-encoded — we split on the LAST '@' so a password containing '@'
 * (or other special chars) still parses correctly.
 */
export function parsePgUrl(url) {
  const rest = url.replace(/^postgres(ql)?:\/\//, "");
  const at = rest.lastIndexOf("@");
  const creds = rest.slice(0, at);
  const hostpart = rest.slice(at + 1);
  const ci = creds.indexOf(":");
  const user = ci === -1 ? creds : creds.slice(0, ci);
  const password = ci === -1 ? "" : creds.slice(ci + 1);
  const slash = hostpart.indexOf("/");
  const hostport = slash === -1 ? hostpart : hostpart.slice(0, slash);
  const database = slash === -1 ? "postgres" : hostpart.slice(slash + 1).split("?")[0];
  const [host, port = "5432"] = hostport.split(":");
  return { user, password, host, port: Number(port), database };
}
