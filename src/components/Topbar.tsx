import CommandPalette from "./CommandPalette";

/** Top bar: the ⌘K command palette + a greeting. */
export default function Topbar({
  userName = "there",
  clients = [],
}: {
  userName?: string;
  clients?: { id: string; name: string; gstin: string | null }[];
}) {
  const now = new Date();
  const greeting =
    now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const date = now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1280px] items-center gap-4 px-6 py-3 lg:px-8">
        <CommandPalette clients={clients} />
        <p className="ml-auto hidden text-[13px] text-[var(--color-fg-muted)] sm:block">
          {greeting}, <span className="font-semibold text-[var(--color-ink)]">{userName}</span> ·{" "}
          {date}
        </p>
      </div>
    </header>
  );
}
