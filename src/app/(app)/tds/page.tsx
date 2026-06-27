import Link from "next/link";
import { ArrowRight, FileText, ShieldCheck, ClipboardList } from "lucide-react";

export default function TdsPage() {
  const features = [
    {
      href: "/tds/register",
      icon: ClipboardList,
      label: "TDS Register",
      desc: "Auto-built from Form 16, 16A, and 26AS documents — section-wise breakdown with FY and quarter filters.",
      ready: true,
    },
    {
      href: "/tds/reconciliation",
      icon: ShieldCheck,
      label: "26AS Reconciliation",
      desc: "Match your TDS register against Form 26AS to catch unclaimed credits before filing.",
      ready: true,
    },
    {
      href: "#",
      icon: FileText,
      label: "Form 16A Generation",
      desc: "Generate TDS certificates for payments made by the firm to contractors and professionals.",
      ready: false,
    },
  ];

  return (
    <div className="fade-up space-y-5">
      <header>
        <h1 className="font-display text-2xl">TDS · Tax Deducted at Source</h1>
        <p className="mt-1 text-[var(--color-fg-muted)]">
          Track TDS credits, reconcile with TRACES, and prepare for ITR filing
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.label}
              className={`card p-5 ${f.ready ? "hover:ring-1 hover:ring-[var(--color-brand)]/30" : "opacity-60"}`}
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--color-brand-soft)]">
                  <Icon className="h-4.5 w-4.5 text-[var(--color-brand)]" />
                </div>
                {!f.ready && (
                  <span className="glass-pill rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[var(--color-surface-2)] text-[var(--color-fg-dim)]">
                    Coming soon
                  </span>
                )}
              </div>
              <p className="text-[14px] font-semibold text-[var(--color-ink)]">{f.label}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-fg-muted)]">{f.desc}</p>
              {f.ready && (
                <Link
                  href={f.href}
                  className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-brand)] hover:underline"
                >
                  Open <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
