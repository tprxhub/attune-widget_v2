import { ConfirmButton } from "@/components/ConfirmButton";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BRANDING_QUERY_KEY,
  loadBranding,
  resetApplicationLogo,
  uploadApplicationLogo,
  useApplicationLogo,
} from "@/api/branding";
import { useSession } from "@/auth/session";

export function ApplicationLogoEditor() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const logo = useApplicationLogo();
  const branding = useQuery({ queryKey: BRANDING_QUERY_KEY, queryFn: loadBranding });
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const clear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");
    setFile(null);
    if (input.current) input.current.value = "";
  };
  const upload = useMutation({
    mutationFn: uploadApplicationLogo,
    onSuccess: (value) => {
      queryClient.setQueryData(BRANDING_QUERY_KEY, value);
      clear();
      setNotice("Logo updated across Play Hub.");
    },
    onError: (error: Error) => setNotice(error.message),
  });
  const reset = useMutation({
    mutationFn: resetApplicationLogo,
    onSuccess: () => {
      queryClient.setQueryData(BRANDING_QUERY_KEY, { content: null });
      clear();
      setNotice("Original logo restored.");
    },
    onError: (error: Error) => setNotice(error.message),
  });
  if (session.role !== "super_admin") return null;
  const busy = upload.isPending || reset.isPending;
  return (
    <section className="ph-card p-5" aria-labelledby="application-logo-heading">
      <h2 id="application-logo-heading" className="text-lg font-bold">
        Application logo
      </h2>
      <p className="mt-1 text-sm text-navy/65">
        Shown on the homepage, sign-in screens, and throughout Play Hub.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-5">
        <div className="grid h-24 w-44 place-items-center rounded-xl border border-dashed border-gray-300 bg-white p-3">
          <img
            src={preview || logo}
            alt="Application logo preview"
            className="max-h-full max-w-full object-contain"
          />
        </div>
        <div className="space-y-3">
          <label className="block text-xs font-bold text-navy/65">
            PNG, JPG, or WebP · up to 5 MB
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              className="mt-2 block max-w-full text-sm"
              onChange={(event) => {
                const selected = event.target.files?.[0];
                clear();
                setNotice("");
                if (!selected) return;
                if (
                  !["image/png", "image/jpeg", "image/webp"].includes(selected.type) ||
                  selected.size > 5 * 1024 * 1024
                ) {
                  setNotice("Choose a PNG, JPG, or WebP image under 5 MB.");
                  return;
                }
                setFile(selected);
                setPreview(URL.createObjectURL(selected));
              }}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!file || busy}
              onClick={() => file && upload.mutate(file)}
              className="rounded-full bg-coral px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              {upload.isPending ? "Saving…" : "Save logo"}
            </button>
            <ConfirmButton
              confirmationTitle="Reset application logo?"
              confirmationMessage="The original Play Hub logo will be restored throughout the app."
              confirmLabel="Reset logo"
              type="button"
              disabled={!branding.data?.content || busy}
              onClick={() => reset.mutateAsync()}
              className="rounded-full border border-navy/20 px-4 py-2 text-xs font-bold disabled:opacity-40"
            >
              Reset logo
            </ConfirmButton>
          </div>
        </div>
      </div>
      {notice && (
        <p role="status" className="mt-3 text-sm">
          {notice}
        </p>
      )}
    </section>
  );
}
