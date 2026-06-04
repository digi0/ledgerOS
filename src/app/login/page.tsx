import AuthForm from "@/components/AuthForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <AuthShell title="Welcome back" subtitle="Sign in to your LedgerOS workspace" mode="signin" next={next} />;
}

export function AuthShell({
  title,
  subtitle,
  mode,
  next,
}: {
  title: string;
  subtitle: string;
  mode: "signin" | "signup";
  next?: string;
}) {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--color-brand)] font-display text-white">
            L
          </span>
          <span className="font-display text-xl">
            Ledger<span className="text-[var(--color-brand)]">OS</span>
          </span>
        </div>
        <div className="card p-6">
          <h1 className="font-display text-lg">{title}</h1>
          <p className="mb-4 mt-0.5 text-[13px] text-[var(--color-fg-muted)]">{subtitle}</p>
          <AuthForm mode={mode} next={next} />
        </div>
        <p className="mt-4 text-center text-[11px] text-[var(--color-fg-dim)]">
          LedgerOS by Precedal · for modern CA practices
        </p>
      </div>
    </div>
  );
}
