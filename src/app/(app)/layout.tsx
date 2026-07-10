import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import CopilotFab from "@/components/CopilotFab";
import { getMe, inboxCounts, listClients, listDocuments } from "@/lib/db";
import { computeCompliance } from "@/lib/compliance";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [counts, me, clients, gstReturns] = await Promise.all([
    inboxCounts(),
    getMe(),
    listClients(),
    listDocuments({ classification: "gst_return", limit: 200 }),
  ]);
  // Real "needs attention" count for the Compliance nav: unfiled deadlines
  // (due + overdue) from the rules engine — no invented numbers.
  const pendingCompliance = computeCompliance({ clients, gstReturns }).filter(
    (d) => d.status !== "filed",
  ).length;
  return (
    <div className="flex min-h-screen">
      <Sidebar
        documentsBadge={counts.new}
        complianceBadge={pendingCompliance}
        firmName={me.firmName}
        clientCount={clients.length}
        showSignOut={me.authed}
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar
          userName={me.firstName}
          clients={clients}
          documentsBadge={counts.new}
          complianceBadge={pendingCompliance}
          firmName={me.firmName}
          showSignOut={me.authed}
        />
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-6 lg:px-8">{children}</main>
      </div>
      <CopilotFab />
    </div>
  );
}
