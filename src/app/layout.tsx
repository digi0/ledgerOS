import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import CopilotFab from "@/components/CopilotFab";
import { inboxCounts } from "@/lib/db";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LedgerOS — The Operating System for Modern CA Practices",
  description:
    "LedgerOS by Precedal — unified compliance, reconciliation, and advisory workbench for Chartered Accountants.",
  applicationName: "LedgerOS",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const counts = await inboxCounts();
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar documentsBadge={counts.new} />
          <div className="flex min-h-screen min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-6 lg:px-8">
              {children}
            </main>
          </div>
          <CopilotFab />
        </div>
      </body>
    </html>
  );
}
