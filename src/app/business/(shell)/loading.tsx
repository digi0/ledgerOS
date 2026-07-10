import { PageSkeleton } from "@/components/Skeleton";

/** Business-area loading placeholder. */
export default function BusinessLoading() {
  return (
    <div className="fade-up">
      <PageSkeleton stats={2} rows={5} />
    </div>
  );
}
