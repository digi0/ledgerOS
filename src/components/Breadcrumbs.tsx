import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string; // omit on the current (last) page
}

/**
 * Breadcrumb trail for deep pages — shows absolute position in the hierarchy
 * (and the first crumb doubles as the back affordance). The last crumb is the
 * current page and isn't a link. Truncates long labels (filenames, names).
 */
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" data-noprint>
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-[var(--color-fg-muted)]">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1">
              {c.href && !last ? (
                <Link href={c.href} className="max-w-[220px] truncate hover:text-[var(--color-ink)]">
                  {c.label}
                </Link>
              ) : (
                <span className={`max-w-[280px] truncate ${last ? "font-medium text-[var(--color-ink)]" : ""}`} aria-current={last ? "page" : undefined}>
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-fg-dim)]" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
