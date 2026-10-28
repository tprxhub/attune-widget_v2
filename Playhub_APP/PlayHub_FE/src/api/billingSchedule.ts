import { apiDownload, apiRequest } from "./client";

/** One paid period in an organisation's billing schedule. Money is in dirhams. */
export interface BillingPeriod {
  id: string;
  sequence: number;
  startsOn: string;
  endsOn: string;
  months: number;
  licenses: number;
  licensePrice: number;
  amount: number;
  note: string | null;
  status: "past" | "current" | "upcoming";
  addedByName: string | null;
  createdAt: string;
  /** The first day this period may start: the day after the one before it ends. */
  earliestStart: string | null;
  canEdit: boolean;
  canRemove: boolean;
}

export interface BillingSchedule {
  organisationId: string;
  organisationName: string;
  startsOn: string | null;
  endsOn: string | null;
  totalMonths: number;
  totalAmount: number;
  currentSequence: number | null;
  nextStartsOn: string;
  /** Billing 1 starts from the organisation's licence count, price (AED) and cycle. */
  suggested: { months: number; licenses: number; licensePrice: number };
  periods: BillingPeriod[];
}

export interface BillingPeriodInput {
  months: number;
  licenses: number;
  licensePrice: number;
  amount: number;
  /** Left empty, the period starts the day after the previous one ends. */
  startsOn?: string | undefined;
  note: string;
}

interface ApiBillingPeriod {
  id: string;
  sequence: number;
  starts_on: string;
  ends_on: string;
  months: number;
  licenses: number;
  license_price: number;
  amount: number;
  note: string | null;
  status: BillingPeriod["status"];
  added_by_name: string | null;
  created_at: string;
  earliest_start: string | null;
  can_edit: boolean;
  can_remove: boolean;
}

interface ApiBillingSchedule {
  organisation_id: string;
  organisation_name: string;
  starts_on: string | null;
  ends_on: string | null;
  total_months: number;
  total_amount: number;
  current_sequence: number | null;
  next_starts_on: string;
  suggested_months: number;
  suggested_licenses: number;
  suggested_license_price: number;
  periods: ApiBillingPeriod[];
}

const toFils = (aed: number) => Math.round(aed * 100);

function mapSchedule(schedule: ApiBillingSchedule): BillingSchedule {
  return {
    organisationId: schedule.organisation_id,
    organisationName: schedule.organisation_name,
    startsOn: schedule.starts_on,
    endsOn: schedule.ends_on,
    totalMonths: schedule.total_months,
    totalAmount: schedule.total_amount / 100,
    currentSequence: schedule.current_sequence,
    nextStartsOn: schedule.next_starts_on,
    suggested: {
      months: schedule.suggested_months,
      licenses: schedule.suggested_licenses,
      licensePrice: schedule.suggested_license_price / 100,
    },
    periods: schedule.periods.map((period) => ({
      id: period.id,
      sequence: period.sequence,
      startsOn: period.starts_on,
      endsOn: period.ends_on,
      months: period.months,
      licenses: period.licenses,
      licensePrice: period.license_price / 100,
      amount: period.amount / 100,
      note: period.note,
      status: period.status,
      addedByName: period.added_by_name,
      createdAt: period.created_at,
      earliestStart: period.earliest_start,
      canEdit: period.can_edit,
      canRemove: period.can_remove,
    })),
  };
}

function toBody(input: BillingPeriodInput) {
  return {
    months: input.months,
    licenses: input.licenses,
    license_price: toFils(input.licensePrice),
    amount: toFils(input.amount),
    note: input.note,
    ...(input.startsOn ? { starts_on: input.startsOn } : {}),
  };
}

export async function getBillingSchedule(orgId: string) {
  return mapSchedule(await apiRequest<ApiBillingSchedule>(`/organisations/${orgId}/billing`));
}

export async function addBillingPeriod(orgId: string, input: BillingPeriodInput) {
  return mapSchedule(
    await apiRequest<ApiBillingSchedule>(`/organisations/${orgId}/billing`, {
      method: "POST",
      body: JSON.stringify(toBody(input)),
    }),
  );
}

export async function updateBillingPeriod(
  orgId: string,
  periodId: string,
  input: BillingPeriodInput,
) {
  return mapSchedule(
    await apiRequest<ApiBillingSchedule>(`/organisations/${orgId}/billing/${periodId}`, {
      method: "PATCH",
      body: JSON.stringify(toBody(input)),
    }),
  );
}

export async function removeBillingPeriod(orgId: string, periodId: string) {
  return mapSchedule(
    await apiRequest<ApiBillingSchedule>(`/organisations/${orgId}/billing/${periodId}`, {
      method: "DELETE",
    }),
  );
}

export async function exportBillingSchedule(orgId: string) {
  await apiDownload(`/organisations/${orgId}/billing/export`, "billing.xlsx");
}

export async function exportAllBilling() {
  await apiDownload("/billing/organisations/export", "billing-all-organisations.xlsx");
}
