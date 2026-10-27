import { useState, type ReactNode } from "react";
import { Loader2, Trash2, TriangleAlert, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ModalPortal } from "@/components/ModalPortal";

/**
 * A permanent deletion: shows what will go, then asks for the exact name before the delete button
 * works. Used for organisations, accounts and members (Super Admin only).
 */
export function DeleteConfirmDialog({
  title,
  description,
  confirmText,
  rows,
  loading,
  loadError,
  blocked,
  deleting,
  error,
  deleteLabel = "Delete permanently",
  onDelete,
  onClose,
}: {
  title: string;
  description: ReactNode;
  /** What must be typed to confirm (a name). */
  confirmText: string;
  rows: Array<[string, number | string]>;
  loading: boolean;
  loadError?: string | undefined;
  /** Why it can't be deleted yet; disables the button. */
  blocked?: string | undefined;
  deleting: boolean;
  error?: string | undefined;
  deleteLabel?: string;
  onDelete: (typed: string) => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === confirmText.trim().toLowerCase();
  const ready = !loading && !loadError && !blocked;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 grid place-items-end bg-navy/50 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label={title}
          className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-5 shadow-xl sm:rounded-3xl"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-coral/12 text-coral">
              <TriangleAlert className="h-5 w-5" aria-hidden />
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy/6 hover:bg-navy/12"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <h2 className="mt-3 text-lg font-bold">{title}</h2>
          <div className="mt-1 text-sm text-navy/70">{description}</div>
          {loading ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-navy/60">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Counting what will be
              deleted…
            </p>
          ) : loadError ? (
            <p role="alert" className="mt-4 text-sm font-semibold text-coral">
              {loadError}
            </p>
          ) : (
            rows.length > 0 && (
              <dl
                aria-label="What will be deleted"
                className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-coral/6 p-3 text-sm"
              >
                {rows.map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-2">
                    <dt className="text-navy/65">{label}</dt>
                    <dd className="font-bold">{value}</dd>
                  </div>
                ))}
              </dl>
            )
          )}
          {blocked ? (
            <p role="alert" className="mt-4 rounded-2xl bg-amber/15 p-3 text-sm font-semibold">
              {blocked}
            </p>
          ) : (
            <label className="mt-4 block text-sm font-bold">
              Type <span className="text-coral">{confirmText}</span> to confirm
              <input
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                className="mt-1.5 min-h-11 w-full rounded-xl border border-navy/20 bg-card px-3 text-sm font-normal outline-none focus:border-coral focus:ring-2 focus:ring-coral/25"
              />
            </label>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm font-semibold text-coral">
              {error}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!ready || !matches || deleting}
              onClick={() => onDelete(typed.trim())}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-white disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden />
              )}
              {deleteLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center rounded-full border border-navy/20 px-5 text-sm font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/**
 * DeleteConfirmDialog with its data wired up: loads the preview of what will go, deletes with the
 * typed confirmation, then refreshes everything (people, members and counts all change).
 */
export function PreviewedDeleteDialog<T>({
  queryKey,
  loadPreview,
  remove,
  rows,
  blocked,
  description,
  onClose,
  ...dialog
}: {
  queryKey: readonly unknown[];
  loadPreview: () => Promise<T>;
  remove: (typed: string) => Promise<unknown>;
  rows: (preview: T) => Array<[string, number | string]>;
  blocked?: ((preview: T) => string | undefined) | undefined;
  description: (preview: T | undefined) => ReactNode;
  title: string;
  confirmText: string;
  deleteLabel: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const preview = useQuery({ queryKey, queryFn: loadPreview });
  const deletion = useMutation({
    mutationFn: remove,
    onSuccess: () => {
      void queryClient.invalidateQueries();
      onClose();
    },
  });
  return (
    <DeleteConfirmDialog
      {...dialog}
      description={description(preview.data)}
      rows={preview.data ? rows(preview.data) : []}
      loading={preview.isLoading}
      loadError={
        preview.isError ? errorText(preview.error, "Could not load the details.") : undefined
      }
      blocked={preview.data && blocked ? blocked(preview.data) : undefined}
      deleting={deletion.isPending}
      error={deletion.isError ? errorText(deletion.error, "Could not delete.") : undefined}
      onDelete={(typed) => deletion.mutate(typed)}
      onClose={onClose}
    />
  );
}
