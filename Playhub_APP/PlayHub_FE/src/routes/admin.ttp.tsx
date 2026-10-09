import { ConfirmButton } from "@/components/ConfirmButton";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Check, Copy, KeyRound, Loader2, Pencil, Plus, Power, X } from "lucide-react";
import {
  createTtpEmployee,
  listTtpEmployees,
  regenerateTtpActivation,
  setTtpActive,
  updateTtpPermissions,
  type TtpEmployee,
  type TtpInvitationResult,
} from "@/api/admin";
import { Protected } from "@/auth/guards";
import { PageHeader } from "@/components/AppShell";
import { ModalPortal } from "@/components/ModalPortal";
import { CardSkeleton } from "@/components/Skeletons";
import { AUDIT_PERMISSION_OPTIONS, PERMISSION_OPTIONS } from "@/lib/roles";
import type { PermissionKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/admin/ttp")({
  head: () => ({
    meta: [
      { title: "TTP Employees — Play Hub admin" },
      { name: "description", content: "Add TTP employees and choose which pages each can use." },
    ],
  }),
  component: () => (
    <Protected roles={["super_admin"]}>
      <TtpEmployeesPage />
    </Protected>
  ),
});

const inputCls =
  "mt-1.5 min-h-12 w-full rounded-2xl border border-navy/15 bg-white px-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/20";

function TtpEmployeesPage() {
  const queryClient = useQueryClient();
  const employees = useQuery({ queryKey: ["ttp-employees"], queryFn: listTtpEmployees });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TtpEmployee | null>(null);
  const [link, setLink] = useState<TtpInvitationResult | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["ttp-employees"] });

  const toggle = useMutation({
    mutationFn: (employee: TtpEmployee) => setTtpActive(employee.id, !employee.active),
    onSuccess: refresh,
  });
  const regenerate = useMutation({
    mutationFn: (employee: TtpEmployee) => regenerateTtpActivation(employee.id),
    onSuccess: (result) => setLink(result),
  });

  return (
    <>
      <PageHeader
        eyebrow="Super Admin"
        title="TTP Employees"
        description="Add people from The Toy Pharmacy and choose which pages each of them can use. Everything they can open works exactly as it does for you."
        actions={
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add TTP employee
          </button>
        }
      />

      {employees.isLoading ? (
        <div className="grid gap-3">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
        </div>
      ) : employees.isError ? (
        <p role="alert" className="ph-card p-5 text-sm font-semibold text-coral">
          Could not load TTP employees.
        </p>
      ) : (employees.data ?? []).length === 0 ? (
        <div className="ph-card p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-navy/6 text-navy">
            <BadgeCheck className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-3 text-lg font-bold">No TTP employees yet</p>
          <p className="mt-1 text-sm text-navy/65">
            Add one, then tick the pages they should be able to use.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {(employees.data ?? []).map((employee) => (
            <li key={employee.id} className="ph-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold">{employee.name}</p>
                  <p className="truncate text-sm text-navy/65">{employee.email}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold",
                    employee.pending
                      ? "bg-amber/25 text-navy"
                      : employee.active
                        ? "bg-blue/10 text-blue"
                        : "bg-navy/8 text-navy/60",
                  )}
                >
                  {employee.pending ? "Invite pending" : employee.active ? "Active" : "Disabled"}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-navy/6 px-2.5 py-1 text-xs font-semibold">
                  Overview
                </span>
                {PERMISSION_OPTIONS.filter((option) =>
                  employee.permissions.includes(option.key),
                ).map((option) => (
                  <span
                    key={option.key}
                    className="rounded-full bg-blue/10 px-2.5 py-1 text-xs font-semibold text-blue"
                  >
                    {option.key === "audit"
                      ? `${option.label} (${
                          AUDIT_PERMISSION_OPTIONS.filter((log) =>
                            employee.permissions.includes(log.key),
                          )
                            .map((log) => log.label)
                            .join(", ") || "no log types"
                        })`
                      : option.label}
                  </span>
                ))}
                {employee.permissions.length === 0 && (
                  <span className="text-xs text-navy/50">No other pages</span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {employee.pending ? (
                  <button
                    type="button"
                    onClick={() => regenerate.mutate(employee)}
                    disabled={regenerate.isPending}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-navy/20 px-4 text-sm font-bold"
                  >
                    <KeyRound className="h-4 w-4" aria-hidden /> New activation link
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditing(employee)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-navy/20 px-4 text-sm font-bold"
                    >
                      <Pencil className="h-4 w-4" aria-hidden /> Edit access
                    </button>
                    <ConfirmButton
                      confirmationTitle={`Disable ${employee.name}?`}
                      confirmationMessage="This employee will no longer be able to sign in. You can enable the account again later."
                      confirmLabel="Disable account"
                      requireConfirmation={employee.active}
                      type="button"
                      onClick={() =>
                        employee.active ? toggle.mutateAsync(employee) : toggle.mutate(employee)
                      }
                      disabled={toggle.isPending}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-navy/20 px-4 text-sm font-bold"
                    >
                      <Power className="h-4 w-4" aria-hidden />
                      {employee.active ? "Disable" : "Enable"}
                    </ConfirmButton>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <AddModal
          onClose={() => setAdding(false)}
          onCreated={(result) => {
            setAdding(false);
            setLink(result);
            void refresh();
          }}
        />
      )}
      {editing && (
        <EditModal
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}
      {link && <LinkModal result={link} onClose={() => setLink(null)} />}
    </>
  );
}

function Shell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-navy/45 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="my-6 w-full max-w-lg rounded-3xl bg-cream p-5 shadow-2xl sm:p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold">{title}</h2>
              {subtitle && <p className="text-xs text-navy/55">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy/6 text-navy hover:bg-navy/12"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </ModalPortal>
  );
}

function AccessCheckboxes({
  value,
  onChange,
}: {
  value: PermissionKey[];
  onChange: (next: PermissionKey[]) => void;
}) {
  const auditKeys = AUDIT_PERMISSION_OPTIONS.map((option) => option.key);
  const toggle = (key: PermissionKey) => {
    if (key === "audit") {
      // Ticking the Audit log starts with the everyday log types; sensitive ones stay off
      // until the Super Admin chooses them. Unticking it removes every log type.
      onChange(
        value.includes("audit")
          ? value.filter((item) => item !== "audit" && !auditKeys.includes(item))
          : [
              ...value,
              "audit",
              ...AUDIT_PERMISSION_OPTIONS.filter((option) => !option.sensitive).map(
                (option) => option.key,
              ),
            ],
      );
      return;
    }
    onChange(value.includes(key) ? value.filter((item) => item !== key) : [...value, key]);
  };
  return (
    <fieldset>
      <legend className="text-sm font-bold">Pages this person can use</legend>
      <p className="mt-0.5 text-xs text-navy/55">Overview is always included.</p>
      <div className="mt-2 grid gap-2">
        {PERMISSION_OPTIONS.map((option) => (
          <div key={option.key}>
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors",
                value.includes(option.key)
                  ? "border-blue bg-blue/8"
                  : "border-navy/15 bg-card hover:border-navy/35",
              )}
            >
              <input
                type="checkbox"
                checked={value.includes(option.key)}
                onChange={() => toggle(option.key)}
                className="mt-0.5 h-4 w-4 accent-[var(--color-blue)]"
              />
              <span>
                <span className="flex items-center gap-2 text-sm font-bold">
                  {option.label}
                  {option.sensitive && (
                    <span className="rounded-full bg-coral/10 px-2 py-0.5 text-[10px] font-bold text-coral">
                      Sensitive
                    </span>
                  )}
                </span>
                <span className="block text-xs text-navy/60">{option.hint}</span>
              </span>
            </label>
            {option.key === "audit" && value.includes("audit") && (
              <div
                role="group"
                aria-label="Audit log types"
                className="mt-2 ml-5 space-y-2 border-l-2 border-blue/25 pl-3"
              >
                <p className="text-xs font-bold text-navy/65">Log types this person can read</p>
                {AUDIT_PERMISSION_OPTIONS.map((log) => (
                  <label
                    key={log.key}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-2.5 transition-colors",
                      value.includes(log.key)
                        ? "border-blue bg-blue/8"
                        : "border-navy/15 bg-card hover:border-navy/35",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={value.includes(log.key)}
                      onChange={() => toggle(log.key)}
                      className="mt-0.5 h-4 w-4 accent-[var(--color-blue)]"
                    />
                    <span>
                      <span className="flex items-center gap-2 text-sm font-bold">
                        {log.label}
                        {log.sensitive && (
                          <span className="rounded-full bg-coral/10 px-2 py-0.5 text-[10px] font-bold text-coral">
                            Sensitive
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-navy/60">{log.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </fieldset>
  );
}

function AddModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (result: TtpInvitationResult) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [permissions, setPermissions] = useState<PermissionKey[]>([]);
  const [error, setError] = useState("");
  const create = useMutation({
    mutationFn: () => createTtpEmployee({ name: name.trim(), email: email.trim(), permissions }),
    onSuccess: onCreated,
    onError: (reason: Error) => setError(reason.message),
  });

  return (
    <Shell
      title="Add TTP employee"
      subtitle="They get an activation link and choose their own password"
      onClose={onClose}
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length < 2) return setError("Enter their full name.");
          if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
          setError("");
          create.mutate();
        }}
      >
        <div>
          <label htmlFor="ttp-name" className="text-sm font-bold">
            Full name
          </label>
          <input
            id="ttp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="ttp-email" className="text-sm font-bold">
            Email
          </label>
          <input
            id="ttp-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </div>
        <AccessCheckboxes value={permissions} onChange={setPermissions} />
        {error && (
          <p role="alert" className="text-sm font-semibold text-coral">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={create.isPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white disabled:opacity-60"
          >
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Add employee
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center rounded-full border border-navy/20 px-5 text-sm font-bold"
          >
            Cancel
          </button>
        </div>
      </form>
    </Shell>
  );
}

function EditModal({
  employee,
  onClose,
  onSaved,
}: {
  employee: TtpEmployee;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [permissions, setPermissions] = useState<PermissionKey[]>(employee.permissions);
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: () => updateTtpPermissions(employee.id, permissions),
    onSuccess: onSaved,
    onError: (reason: Error) => setError(reason.message),
  });
  return (
    <Shell title="Edit access" subtitle={`${employee.name} · ${employee.email}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <AccessCheckboxes value={permissions} onChange={setPermissions} />
        {error && (
          <p role="alert" className="text-sm font-semibold text-coral">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={save.isPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white disabled:opacity-60"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Save access
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center rounded-full border border-navy/20 px-5 text-sm font-bold"
          >
            Cancel
          </button>
        </div>
      </form>
    </Shell>
  );
}

function LinkModal({ result, onClose }: { result: TtpInvitationResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const token = result.credentials.acceptanceToken;
  const url = token
    ? `${window.location.origin}/accept-invite?token=${encodeURIComponent(token)}`
    : null;
  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(
      `Play Hub account\nEmail: ${result.credentials.email}\nActivate: ${url}`,
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  return (
    <Shell
      title="Activation link ready"
      subtitle="We’ve emailed it to them. You can also share it securely; they choose their own password."
      onClose={onClose}
    >
      <div className="space-y-3">
        <p className="rounded-2xl bg-navy/5 p-3 text-sm break-all">
          <span className="block text-xs font-bold text-navy/55 uppercase">Email</span>
          {result.credentials.email}
        </p>
        {url ? (
          <p className="rounded-2xl bg-navy/5 p-3 text-sm break-all">
            <span className="block text-xs font-bold text-navy/55 uppercase">
              One-time activation link
            </span>
            {url}
          </p>
        ) : (
          <p className="text-sm text-coral">No link was returned. Try "New activation link".</p>
        )}
        <p className="text-xs text-navy/55">
          Expires {fmtDateTime(result.credentials.expiresAt)} and works once.
        </p>
        <div className="flex gap-2">
          {url && (
            <button
              type="button"
              onClick={copy}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-navy px-5 text-sm font-bold text-white"
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
              {copied ? "Copied" : "Copy details"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center rounded-full border border-navy/20 px-5 text-sm font-bold"
          >
            Done
          </button>
        </div>
      </div>
    </Shell>
  );
}
