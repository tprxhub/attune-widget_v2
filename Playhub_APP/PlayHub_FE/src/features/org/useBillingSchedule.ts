import { useQuery } from "@tanstack/react-query";
import { getBillingSchedule } from "@/api/billingSchedule";

export const scheduleKey = (orgId: string) => ["billing-schedule", orgId];

/** An organisation's billing schedule; the card, list and full schedule share this one query. */
export function useBillingSchedule(orgId: string) {
  return useQuery({ queryKey: scheduleKey(orgId), queryFn: () => getBillingSchedule(orgId) });
}
