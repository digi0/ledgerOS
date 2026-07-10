/**
 * Skeleton primitives — shimmer placeholders that mirror the real layout so a
 * page transition feels instant instead of blank. `.skeleton` (globals.css)
 * carries the shimmer + theme-aware surface; these just size it.
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/** A stat/summary card placeholder (matches the .card stat blocks). */
export function SkeletonStat() {
  return (
    <div className="card px-4 py-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2 h-6 w-16" />
      <Skeleton className="mt-2 h-2.5 w-24" />
    </div>
  );
}

/** A list/table row placeholder. */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-9 w-9 rounded-lg" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="mt-1.5 h-2.5 w-1/4" />
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

/**
 * Generic page skeleton — title, a strip of stat cards, and a list card.
 * A reasonable stand-in for most app pages (dashboard, registers, exports).
 */
export function PageSkeleton({ stats = 4, rows = 6 }: { stats?: number; rows?: number }) {
  return (
    <div className="space-y-5">
      <div>
        <Skeleton className="h-7 w-52" />
        <Skeleton className="mt-2 h-3.5 w-72" />
      </div>
      {stats > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: stats }).map((_, i) => (
            <SkeletonStat key={i} />
          ))}
        </div>
      )}
      <div className="card overflow-hidden">
        <div className="border-b border-[var(--color-border)] px-4 py-3">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
