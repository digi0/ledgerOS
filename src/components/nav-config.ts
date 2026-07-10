import {
  BadgePercent,
  Building2,
  CalendarCheck2,
  FileCode,
  FileJson,
  FileText,
  GitCompareArrows,
  LayoutGrid,
  Landmark,
  Receipt,
  Sparkles,
  Users,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

export type NavSection = { title: string; items: NavItem[] };

/** The single source of truth for the CA workspace nav — shared by the desktop
 *  Sidebar and the mobile drawer so they can never drift. Badges are injected
 *  per render (they come from live counts). */
export function navSections({
  documentsBadge = 0,
  complianceBadge = 0,
}: {
  documentsBadge?: number;
  complianceBadge?: number;
} = {}): NavSection[] {
  return [
    {
      title: "Workspace",
      items: [
        { href: "/", label: "Dashboard", icon: LayoutGrid },
        { href: "/documents", label: "Documents", icon: FileText, badge: documentsBadge },
        { href: "/clients", label: "Clients", icon: Users },
      ],
    },
    {
      title: "Compliance",
      items: [
        { href: "/gst", label: "GST", icon: BadgePercent },
        { href: "/tds", label: "TDS", icon: Landmark },
        { href: "/income-tax", label: "Income Tax", icon: Building2 },
        { href: "/compliance", label: "Compliance", icon: CalendarCheck2, badge: complianceBadge },
      ],
    },
    {
      title: "Registers",
      items: [
        { href: "/purchase-register", label: "Purchase Register", icon: Receipt },
        { href: "/tds/register", label: "TDS Register", icon: Landmark },
        { href: "/gst/reconciliation", label: "GSTR-2B Recon", icon: GitCompareArrows },
        { href: "/tds/reconciliation", label: "26AS Recon", icon: GitCompareArrows },
      ],
    },
    {
      title: "Exports",
      items: [
        { href: "/export/tally", label: "Export to Tally", icon: FileCode },
        { href: "/gst/gstr1", label: "Generate GSTR-1", icon: FileJson },
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
