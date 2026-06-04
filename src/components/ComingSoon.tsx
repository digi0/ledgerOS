import Link from "next/link";

/** Styled placeholder for modules that land on later rungs of the build. */
export default function ComingSoon({
  title,
  subtitle,
  rung,
}: {
  title: string;
  subtitle: string;
  rung: string;
}) {
  return (
    <div className="fade-up space-y-5">
      <header>
        <h1 className="font-display text-2xl">{title}</h1>
        <p className="mt-1 text-[var(--color-fg-muted)]">{subtitle}</p>
      </header>
      <div className="card grid place-items-center p-16 text-center">
        <div className="max-w-md">
          <span className="inline-flex rounded-full bg-[var(--color-brand-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-brand-strong)]">
            On the roadmap
          </span>
          <h2 className="font-display mt-3 text-lg">{title} module</h2>
          <p className="mt-2 text-[var(--color-fg-muted)]">{rung}</p>
          <Link
            href="/documents"
            className="mt-5 inline-flex rounded-[10px] bg-[var(--color-brand)] px-4 py-2 text-[13px] font-medium text-white hover:bg-[var(--color-brand-strong)]"
          >
            Go to the live inbox
          </Link>
        </div>
      </div>
    </div>
  );
}
