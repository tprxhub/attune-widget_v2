import { useNavigate } from "@tanstack/react-router";
import { LogOut, type LucideIcon } from "lucide-react";
import { useSession } from "@/auth/session";
import { cn } from "@/lib/utils";
import { ConfirmButton } from "./ConfirmButton";

export function SignOutButton({
  className,
  onSignedOut,
  icon: Icon = LogOut,
}: {
  className?: string;
  onSignedOut?: () => void;
  icon?: LucideIcon;
}) {
  const { signOut } = useSession();
  const navigate = useNavigate();

  return (
    <ConfirmButton
      type="button"
      confirmationTitle="Sign out of Play Hub?"
      confirmationMessage="Are you sure you want to sign out?"
      confirmLabel="Sign out"
      onClick={() => {
        signOut();
        onSignedOut?.();
        void navigate({ to: "/", replace: true });
      }}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-current/15 px-3 text-sm font-semibold transition-colors hover:bg-current/5",
        className,
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      Sign out
    </ConfirmButton>
  );
}
