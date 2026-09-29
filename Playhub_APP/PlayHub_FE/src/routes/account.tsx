import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Mail,
  ImageUp,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  changePassword,
  chooseProfileSticker,
  getAccount,
  removeProfileAvatar,
  uploadProfilePhoto,
} from "@/api/account";
import { Protected } from "@/auth/guards";
import { useCapabilities, useSession } from "@/auth/session";
import { PageHeader } from "@/components/AppShell";
import { HeroStat as SharedHeroStat } from "@/components/HeroStat";
import { ModalPortal } from "@/components/ModalPortal";
import { PROFILE_STICKERS, ProfileAvatar } from "@/components/ProfileAvatar";
import { CardSkeleton } from "@/components/Skeletons";
import { fmtDate } from "@/lib/format";
import { accountLabel, roleLabel } from "@/lib/roles";
import type { AvatarSticker } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My account — Play Hub" },
      {
        name: "description",
        content:
          "See your Play Hub profile, role, organisation and children, and change your password.",
      },
      { property: "og:title", content: "My account — Play Hub" },
      {
        property: "og:description",
        content: "Your Play Hub profile details and password settings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <Protected>
      <AccountPage />
    </Protected>
  ),
});

function HeroStat(props: Omit<ComponentProps<typeof SharedHeroStat>, "variant">) {
  return <SharedHeroStat variant="text" {...props} />;
}

function Row({
  icon: Icon,
  label,
  value,
  action,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  action?: React.ReactNode | undefined;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue/12 text-blue">
        <Icon className="h-4.5 w-4.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold tracking-[0.12em] text-navy/50 uppercase">
          {label}
        </span>
        <span className="block truncate text-sm font-bold">{value}</span>
      </span>
      {action}
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  title,
  sub,
}: {
  to: string;
  icon: typeof UserRound;
  title: string;
  sub: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-navy/10 bg-card p-3.5 transition hover:-translate-y-0.5 hover:border-blue/40 hover:shadow-[var(--shadow-card)]"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy/6 text-navy transition group-hover:bg-blue/12 group-hover:text-blue">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{title}</span>
        <span className="block truncate text-xs text-navy/60">{sub}</span>
      </span>
    </Link>
  );
}

function strengthOf(value: string) {
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  const capped = Math.min(score, 4);
  const labels = ["Too short", "Weak", "Okay", "Strong", "Very strong"];
  const colours = ["bg-coral", "bg-coral", "bg-amber", "bg-blue", "bg-blue"];
  return { score: capped, label: labels[capped]!, colour: colours[capped]! };
}

function AccountPage() {
  const { session, refreshSession } = useSession();
  const caps = useCapabilities();
  const account = useQuery({
    queryKey: ["account", session.personaId],
    queryFn: () => getAccount(session),
  });

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pwOpen, setPwOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [selectedSticker, setSelectedSticker] = useState<AvatarSticker | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState("");

  const strength = useMemo(() => strengthOf(next), [next]);

  const save = useMutation({
    mutationFn: () => changePassword({ current, next }),
    onSuccess: (res) => {
      if (res.ok) {
        setCurrent("");
        setNext("");
        setConfirm("");
        setErrors({});
      } else {
        setErrors({ current: res.message });
      }
    },
  });

  const avatarMutation = useMutation({
    mutationFn: (
      action:
        | { type: "photo"; file: File }
        | { type: "sticker"; sticker: AvatarSticker }
        | { type: "remove" },
    ) => {
      if (action.type === "photo") return uploadProfilePhoto(action.file).then(() => undefined);
      if (action.type === "sticker")
        return chooseProfileSticker(action.sticker).then(() => undefined);
      return removeProfileAvatar();
    },
    onSuccess: async () => {
      await refreshSession();
      await account.refetch();
      setAvatarOpen(false);
      setAvatarError("");
      setPhotoFile(null);
      setPhotoPreview(null);
    },
    onError: (reason) => {
      setAvatarError(
        reason instanceof Error ? reason.message : "Could not update the profile picture.",
      );
    },
  });

  useEffect(
    () => () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview],
  );

  const inputCls =
    "min-h-12 w-full rounded-2xl border border-navy/15 bg-card px-4 pr-12 text-sm outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/25";

  const data = account.data;
  const email = data?.email || session.email;

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const openAvatarEditor = () => {
    setSelectedSticker(session.avatarSticker ?? null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setAvatarError("");
    setAvatarOpen(true);
  };

  const choosePhoto = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarError("Choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Profile photos must be 5 MB or smaller.");
      return;
    }
    setAvatarError("");
    setSelectedSticker(null);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="My account"
        description="Everything Play Hub knows about you, and where to change your password."
      />

      <div className="mt-5 space-y-5">
        {/* Profile hero */}
        <section className="ph-card overflow-hidden bg-navy p-5 text-cream sm:p-6">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={openAvatarEditor}
              aria-label="Change profile picture"
              className="group relative shrink-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
            >
              <ProfileAvatar
                name={session.name}
                photoUrl={session.avatarUrl}
                sticker={session.avatarSticker}
                className="h-16 w-16 text-2xl ring-1 ring-white/15 sm:h-20 sm:w-20"
              />
              <span className="absolute -right-1.5 -bottom-1.5 grid h-8 w-8 place-items-center rounded-full border-2 border-navy bg-amber text-navy shadow-sm transition-transform group-hover:scale-105">
                <Camera className="h-4 w-4" aria-hidden />
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-2xl font-bold sm:text-3xl">{session.name}</h2>
              <p className="mt-1 truncate text-sm text-cream/70">
                {session.guardianName
                  ? `Child account · run by ${session.guardianName}`
                  : accountLabel(session)}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-[11px] font-bold">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                  {roleLabel(session.role, session.accountType)}
                </span>
                {session.guardianName && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-[11px] font-bold">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    Managed by {session.guardianName}
                  </span>
                )}
                {session.accountType === "b2c" && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold",
                      session.tier === "subscribed"
                        ? "bg-blue text-white"
                        : "bg-white/12 text-cream",
                    )}
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    {session.tier === "subscribed" ? "Subscribed" : "Free plan"}
                  </span>
                )}
                {session.accountType === "b2b" && data?.orgName && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-[11px] font-bold">
                    <Building2 className="h-3.5 w-3.5" aria-hidden />
                    {data.orgName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <HeroStat
              icon={Users}
              label="Children"
              value={data ? String(data.childCount) : "—"}
              sub={data && data.childCount > 0 ? data.childNames.join(", ") : "None linked yet"}
            />
            <HeroStat
              icon={Mail}
              label="Email"
              value={email || "Not set"}
              sub={session.guardianName ? "Child's sign-in email" : "Used to sign in"}
            />
            <HeroStat
              icon={session.accountType === "b2b" ? Building2 : ShieldCheck}
              label={session.accountType === "b2b" ? "Organisation" : "Plan"}
              value={
                session.accountType === "b2b"
                  ? data?.orgName || "Not assigned"
                  : session.tier === "subscribed"
                    ? "Subscribed"
                    : "Free"
              }
              sub={
                session.accountType === "b2b"
                  ? data?.orgKind || "Organisation account"
                  : "Family account"
              }
            />
            {data?.memberSince ? (
              <HeroStat
                icon={CalendarDays}
                label="Member since"
                value={fmtDate(data.memberSince)}
                sub="On Play Hub"
              />
            ) : (
              <HeroStat
                icon={ShieldCheck}
                label="Access"
                value={roleLabel(session.role, session.accountType)}
                sub="What you can do here"
              />
            )}
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          {/* Details */}
          <section className="ph-card min-w-0 p-5 sm:p-6">
            <h2 className="text-lg font-bold">Your details</h2>
            {account.isLoading || !data ? (
              <div className="mt-4">
                <CardSkeleton lines={5} />
              </div>
            ) : (
              <div className="mt-2 divide-y divide-navy/8">
                <Row
                  icon={Mail}
                  label="Email"
                  value={email || "Not set"}
                  action={
                    email ? (
                      <button
                        type="button"
                        onClick={copyEmail}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-navy/6 px-3 py-1.5 text-[11px] font-bold text-navy transition hover:bg-navy/10"
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <Copy className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    ) : undefined
                  }
                />
                <Row
                  icon={ShieldCheck}
                  label="Role"
                  value={roleLabel(session.role, session.accountType)}
                />
                {session.accountType === "b2b" && (
                  <Row
                    icon={Building2}
                    label="Organisation"
                    value={
                      data.orgName
                        ? `${data.orgName}${data.orgKind ? ` · ${data.orgKind}` : ""}`
                        : "Not assigned"
                    }
                  />
                )}
                {session.accountType === "b2c" && (
                  <Row
                    icon={Sparkles}
                    label="Plan"
                    value={session.tier === "subscribed" ? "Subscribed" : "Free"}
                  />
                )}
                <Row
                  icon={Users}
                  label="Children"
                  value={data.childCount > 0 ? data.childNames.join(", ") : "None yet"}
                />
                {data.memberSince && (
                  <Row icon={CalendarDays} label="Member since" value={fmtDate(data.memberSince)} />
                )}
              </div>
            )}
          </section>

          {/* Quick links */}
          <section className="ph-card min-w-0 p-5 sm:p-6">
            <h2 className="text-lg font-bold">Jump back in</h2>
            <p className="mt-1 text-xs text-navy/60">The places you use most, one tap away.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {caps.isAdmin ? (
                <>
                  <QuickLink
                    to="/admin"
                    icon={LayoutDashboard}
                    title="Overview"
                    sub="Platform at a glance"
                  />
                  <QuickLink
                    to="/admin/progress"
                    icon={TrendingUp}
                    title="Progress"
                    sub="Every account's trend"
                  />
                  <QuickLink
                    to="/admin/orgs"
                    icon={Building2}
                    title="Organisations"
                    sub="Schools and clinics"
                  />
                </>
              ) : caps.isOrgUser ? (
                <>
                  <QuickLink
                    to="/org"
                    icon={LayoutDashboard}
                    title="Caseload"
                    sub="Your children"
                  />
                  <QuickLink
                    to="/progress"
                    icon={TrendingUp}
                    title="Progress"
                    sub="Attempts and trends"
                  />
                  <QuickLink
                    to="/plans"
                    icon={Sparkles}
                    title="Play Plans"
                    sub="Browse every plan"
                  />
                </>
              ) : (
                <>
                  <QuickLink
                    to="/dashboard"
                    icon={LayoutDashboard}
                    title="Dashboard"
                    sub="Today's Play Dose"
                  />
                  <QuickLink
                    to="/progress"
                    icon={TrendingUp}
                    title="Progress"
                    sub="Attempts and trends"
                  />
                  <QuickLink
                    to="/plans"
                    icon={Sparkles}
                    title="Play Plans"
                    sub="Browse every plan"
                  />
                  {caps.canManageSubscription && (
                    <QuickLink
                      to="/subscription"
                      icon={CreditCard}
                      title="Subscription"
                      sub="Plan and billing"
                    />
                  )}
                  {caps.canInviteSupporter && (
                    <QuickLink
                      to="/invite"
                      icon={UserPlus}
                      title="Invite a Moderator"
                      sub="Share view-only access"
                    />
                  )}
                </>
              )}

              <button
                type="button"
                onClick={() => setPwOpen(true)}
                className="group flex items-center gap-3 rounded-2xl border border-coral/25 bg-coral/8 p-3.5 text-left transition hover:-translate-y-0.5 hover:border-coral/50 hover:shadow-[var(--shadow-card)] sm:col-span-2"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-coral/15 text-coral">
                  <KeyRound className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">Change password</span>
                  <span className="block truncate text-xs text-navy/60">
                    Update your sign-in password
                  </span>
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>

      {avatarOpen && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-navy/50 p-4 backdrop-blur-sm sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="avatar-modal-title"
            onClick={(event) => event.target === event.currentTarget && setAvatarOpen(false)}
          >
            <div className="my-auto w-full max-w-xl rounded-3xl bg-card p-5 shadow-[0_28px_70px_-20px_rgba(15,42,74,0.5)] sm:p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue/12 text-blue">
                  <Camera className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id="avatar-modal-title" className="text-xl font-bold">
                    Profile picture
                  </h2>
                  <p className="mt-0.5 text-sm text-navy/60">
                    Upload a photo or choose a Play Hub sticker.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAvatarOpen(false)}
                  aria-label="Close profile picture editor"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-navy/55 transition hover:bg-navy/6 hover:text-navy"
                >
                  <X className="h-4.5 w-4.5" aria-hidden />
                </button>
              </div>

              <div className="mt-5 flex flex-col items-center rounded-2xl bg-navy/[0.035] p-4 text-center sm:flex-row sm:text-left">
                <ProfileAvatar
                  name={session.name}
                  photoUrl={photoPreview ?? (selectedSticker ? null : session.avatarUrl)}
                  sticker={selectedSticker}
                  className="h-24 w-24 rounded-3xl text-3xl ring-4 ring-white"
                />
                <div className="mt-3 min-w-0 sm:mt-0 sm:ml-4">
                  <p className="font-bold">Preview</p>
                  <p className="mt-1 text-xs leading-relaxed text-navy/60">
                    Square images work best. JPG, PNG and WebP files up to 5 MB are supported.
                  </p>
                  <label className="mt-3 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-navy px-4 text-xs font-bold text-white transition hover:bg-navy/90">
                    <ImageUp className="h-4 w-4" aria-hidden />
                    Choose a photo
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(event) => choosePhoto(event.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>

              <fieldset className="mt-5">
                <legend className="text-sm font-bold">Or choose a sticker</legend>
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {PROFILE_STICKERS.map((sticker) => {
                    const active = selectedSticker === sticker.id && !photoFile;
                    return (
                      <button
                        key={sticker.id}
                        type="button"
                        aria-label={sticker.name}
                        aria-pressed={active}
                        onClick={() => {
                          setSelectedSticker(sticker.id);
                          setPhotoFile(null);
                          setPhotoPreview(null);
                          setAvatarError("");
                        }}
                        className={cn(
                          "rounded-2xl p-1.5 outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-blue",
                          active ? "bg-blue/12 ring-2 ring-blue" : "bg-navy/[0.035]",
                        )}
                      >
                        <ProfileAvatar
                          name={session.name}
                          sticker={sticker.id}
                          className="mx-auto h-12 w-12 rounded-xl"
                        />
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {avatarError && (
                <p
                  role="alert"
                  className="mt-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-semibold text-coral"
                >
                  {avatarError}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-navy/8 pt-4">
                <button
                  type="button"
                  onClick={() => avatarMutation.mutate({ type: "remove" })}
                  disabled={
                    avatarMutation.isPending || (!session.avatarUrl && !session.avatarSticker)
                  }
                  className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-xs font-bold text-coral transition hover:bg-coral/8 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> Remove
                </button>
                <button
                  type="button"
                  disabled={avatarMutation.isPending || (!photoFile && !selectedSticker)}
                  onClick={() => {
                    if (photoFile) avatarMutation.mutate({ type: "photo", file: photoFile });
                    else if (selectedSticker)
                      avatarMutation.mutate({ type: "sticker", sticker: selectedSticker });
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {avatarMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="h-4 w-4" aria-hidden />
                  )}
                  Save profile picture
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Password modal */}
      {pwOpen && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-navy/45 p-4 backdrop-blur-sm sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pw-modal-title"
            onClick={(e) => e.target === e.currentTarget && setPwOpen(false)}
          >
            <form
              className="my-auto w-full max-w-md space-y-4 rounded-3xl bg-card p-5 shadow-[0_28px_70px_-20px_rgba(15,42,74,0.5)] sm:p-6"
              onSubmit={(e) => {
                e.preventDefault();
                const errs: Record<string, string> = {};
                if (current.trim().length === 0) errs["current"] = "Enter your current password.";
                if (next.length < 8) errs["next"] = "Use at least 8 characters.";
                if (next !== confirm) errs["confirm"] = "The two passwords don't match.";
                setErrors(errs);
                if (Object.keys(errs).length === 0) save.mutate();
              }}
            >
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-coral/12 text-coral">
                  <KeyRound className="h-4.5 w-4.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id="pw-modal-title" className="text-lg leading-tight font-bold">
                    Change password
                  </h2>
                  <p className="text-xs text-navy/60">Use at least 8 characters.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPwOpen(false)}
                  aria-label="Close"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-navy/55 transition hover:bg-navy/6 hover:text-navy"
                >
                  <X className="h-4.5 w-4.5" aria-hidden />
                </button>
              </div>

              <div>
                <label htmlFor="pw-current" className="text-sm font-bold">
                  Current password
                </label>
                <div className="relative mt-2">
                  <input
                    id="pw-current"
                    type={show ? "text" : "password"}
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? "Hide passwords" : "Show passwords"}
                    className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1.5 text-navy/55 transition hover:bg-navy/6 hover:text-navy"
                  >
                    {show ? (
                      <EyeOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
                {errors["current"] && (
                  <p className="mt-1.5 text-xs font-semibold text-coral">{errors["current"]}</p>
                )}
              </div>

              <div>
                <label htmlFor="pw-next" className="text-sm font-bold">
                  New password
                </label>
                <input
                  id="pw-next"
                  type={show ? "text" : "password"}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  className={cn(inputCls, "mt-2")}
                />
                {next.length > 0 && (
                  <div className="mt-2 flex items-center gap-3">
                    <span className="flex h-1.5 min-w-0 flex-1 gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={cn(
                            "h-full flex-1 rounded-full",
                            i < strength.score ? strength.colour : "bg-navy/10",
                          )}
                        />
                      ))}
                    </span>
                    <span className="shrink-0 text-[11px] font-bold text-navy/60">
                      {strength.label}
                    </span>
                  </div>
                )}
                {errors["next"] && (
                  <p className="mt-1.5 text-xs font-semibold text-coral">{errors["next"]}</p>
                )}
              </div>

              <div>
                <label htmlFor="pw-confirm" className="text-sm font-bold">
                  Confirm new password
                </label>
                <input
                  id="pw-confirm"
                  type={show ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={cn(inputCls, "mt-2")}
                />
                {confirm.length > 0 && !errors["confirm"] && confirm === next && (
                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-blue">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Passwords match
                  </p>
                )}
                {errors["confirm"] && (
                  <p className="mt-1.5 text-xs font-semibold text-coral">{errors["confirm"]}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={save.isPending}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-coral px-6 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                {save.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <KeyRound className="h-4 w-4" aria-hidden />
                )}
                Update password
              </button>

              {save.data?.ok && (
                <p className="flex items-center gap-2 rounded-2xl bg-blue/10 px-4 py-3 text-sm font-semibold text-blue">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> {save.data.message}
                </p>
              )}
            </form>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
