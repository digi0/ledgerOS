import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import CopilotFab from "@/components/CopilotFab";
import { getMe, inboxCounts, listClients } from "@/lib/db";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [counts, me, clients] = await Promise.all([inboxCounts(), getMe(), listClients()]);
  return (
    <div className="flex min-h-screen">
      <Sidebar
        documentsBadge={counts.new}
        firmName={me.firmName}
        clientCount={clients.length}
        showSignOut={me.authed}
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar userName={me.firstName} />
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-6 lg:px-8">{children}</main>
      </div>
      <CopilotFab />
    </div>
  );
}
