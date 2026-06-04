import { AuthShell } from "../login/page";

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Join your firm's LedgerOS workspace"
      mode="signup"
    />
  );
}
