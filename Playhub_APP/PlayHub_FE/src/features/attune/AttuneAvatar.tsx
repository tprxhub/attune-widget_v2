import avatar from "@/assets/attune-avatar.png";
import mascot from "@/assets/attune-mascot.png";
import { cn } from "@/lib/utils";

/** Attune's face: the Play Hub cat. `thinking` adds a gentle bob and a pulse ring. */
export function AttuneAvatar({
  className,
  thinking = false,
}: {
  className?: string;
  thinking?: boolean;
}) {
  return (
    <span
      className={cn(
        "ph-pill relative inline-grid shrink-0 place-items-center bg-gradient-to-br from-amber/35 to-cream ring-1 ring-amber/40",
        thinking && "attune-bob",
        className,
      )}
      aria-hidden
    >
      {thinking && <span className="ph-pill absolute inset-0 animate-ping bg-amber/25" />}
      <img
        src={avatar}
        alt=""
        className="ph-pill relative h-full w-full object-cover"
        draggable={false}
      />
    </span>
  );
}

/** The full mascot, for welcome screens. */
export function AttuneMascot({ className }: { className?: string }) {
  return (
    <span className={cn("relative grid place-items-center", className)} aria-hidden>
      <span className="ph-pill absolute inset-[6%] bg-gradient-to-br from-amber/45 via-amber/15 to-coral/15 blur-2xl" />
      <span className="ph-pill absolute top-2 right-0 h-2 w-2 bg-amber/75" />
      <span className="ph-pill absolute bottom-5 -left-1 h-1.5 w-1.5 bg-coral/40" />
      <img
        src={mascot}
        alt=""
        className="attune-float relative h-full w-full object-contain"
        draggable={false}
      />
    </span>
  );
}
