"use server";

/**
 * Business-side identity — the prototype of the two-sided login. On the CA side
 * a `client` IS a business the firm serves; the business-side interface lets
 * that business act for itself (raise its own sales invoices, which flow back
 * to the CA). See docs/pitch-workflow.md ("Business-side login").
 *
 * v1 is interface-first: there is no separate business auth yet, so "which
 * business am I" is a selected client id kept in a cookie — set at the business
 * login screen, read by the business shell. Swapping this for real per-client
 * auth + RLS later means changing only this file and the shell's guard; every
 * page reads the resolved client, not the cookie.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getClient } from "./db";
import type { Client } from "./types";

const BUSINESS_COOKIE = "business_client_id";
const ONE_MONTH = 60 * 60 * 24 * 30;

/** Enter the business area as a given client (the "log in" of the prototype). */
export async function enterAsBusiness(clientId: string): Promise<void> {
  const client = await getClient(clientId);
  if (!client) redirect("/business/login?error=notfound");

  const store = await cookies();
  store.set(BUSINESS_COOKIE, clientId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_MONTH,
  });
  redirect("/business");
}

/** Leave the business area — clears the selected business and returns to login. */
export async function exitBusiness(): Promise<void> {
  const store = await cookies();
  store.delete(BUSINESS_COOKIE);
  redirect("/business/login");
}

/** The selected business's client id, or null if none is set. */
export async function getBusinessClientId(): Promise<string | null> {
  const store = await cookies();
  return store.get(BUSINESS_COOKIE)?.value ?? null;
}

/** Resolve the selected business to a full client row (null if unset/stale). */
export async function getBusinessClient(): Promise<Client | null> {
  const id = await getBusinessClientId();
  if (!id) return null;
  return getClient(id);
}
