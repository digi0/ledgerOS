import { CalendarCheck2, FileText, LayoutGrid, Sparkles, Users } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

export type NavSection = { title: string; items: NavItem[] };

/**
 * The single source of truth for the CA workspace nav — shared by the desktop
 * Sidebar and the mobile drawer so they can never drift.
 *
 * Deliberately three destinations. Registers, reconciliations and exports used
 * to sit here as ten more, but none of them is a place you go — they are all
 * things you do to one client's one month. They now live on the client's period
 * screen, next to the numbers that decide whether you need them at all. The
 * work is: documents in → matched → reconciled → filed.
 */
export function navSections({
  documentsBadge = 0,
  complianceBadge = 0,
}: {
  documentsBadge?: number;
  complianceBadge?: number;
}): NavSection[] {
  return [
    {
      title: "Workspace",
      items: [
        { href: "/", label: "Dashboard", icon: LayoutGrid },
        { href: "/documents", label: "Inbox", icon: FileText, badge: documentsBadge },
        { href: "/clients", label: "Clients", icon: Users },
        { href: "/compliance", label: "Calendar", icon: CalendarCheck2, badge: complianceBadge },
      ],
    },
    {
      title: "Firm",
      items: [{ href: "/copilot", label: "AI Copilot", icon: Sparkles }],
    },
  ];
}

export const isNavActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href);
