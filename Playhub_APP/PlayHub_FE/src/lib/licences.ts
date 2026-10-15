import type { LicenseType, Org } from "@/lib/types";

/** Whether every licence of `kind` is in use, so adding one more would be refused. */
export function licencesFull(org: Org | undefined, kind: LicenseType) {
  return Boolean(
    org && org.licenseType === kind && org.licenses && org.licensesUsed >= org.licenses,
  );
}
