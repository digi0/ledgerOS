/**
 * Match a parsed document to a client within the firm. Cheapest, most
 * specific signal first: GSTIN → PAN → sender email domain. Returns the
 * client id or null (unmatched — the staff member assigns it in the inbox).
 */

import "server-only";
import { readClient } from "./db";

export async function matchClient(
  firmId: string,
  parties: { gstins: string[]; pans: string[] },
  senderDomain?: string | null,
): Promise<string | null> {
  const sb = await readClient();

  for (const gstin of parties.gstins) {
    const { data } = await sb
      .from("client")
      .select("id")
      .eq("firm_id", firmId)
      .eq("gstin", gstin)
      .maybeSingle();
    if (data) return data.id as string;
  }

  for (const pan of parties.pans) {
    const { data } = await sb
      .from("client")
      .select("id")
      .eq("firm_id", firmId)
      .eq("pan", pan)
      .maybeSingle();
    if (data) return data.id as string;
  }

  if (senderDomain) {
    const { data } = await sb
      .from("client")
      .select("id")
      .eq("firm_id", firmId)
      .eq("primary_domain", senderDomain.toLowerCase())
      .maybeSingle();
    if (data) return data.id as string;
  }

  return null;
}
