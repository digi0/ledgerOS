import { PageSkeleton } from "@/components/Skeleton";

/** Shown while any app page's server data loads — keeps navigation snappy
 *  instead of blocking on a blank screen. */
export default function AppLoading() {
  return (
    <div className="fade-up">
      <PageSkeleton />
    </div>
  );
}
