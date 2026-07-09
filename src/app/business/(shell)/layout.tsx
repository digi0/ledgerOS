import { redirect } from "next/navigation";
import { getBusinessClient } from "@/lib/business-actions";
import { getMe } from "@/lib/db";
import BusinessShell from "@/components/BusinessShell";

export const dynamic = "force-dynamic";

/**
 * Guard for the business area. No selected business (or a stale cookie) → the
 * login/selection screen. Otherwise render the business shell around the page.
 */
export default async function BusinessAreaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [business, me] = await Promise.all([getBusinessClient(), getMe()]);
  if (!business) redirect("/business/login");

  return (
    <BusinessShell businessName={business.name} gstin={business.gstin} firmName={me.firmName}>
      {children}
    </BusinessShell>
  );
}
