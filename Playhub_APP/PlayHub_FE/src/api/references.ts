import { apiRequest } from "./client";
import type { Level } from "@/lib/types";

export interface PlanReference {
  id: string;
  name: string;
  is_active: boolean;
  publication_status: "published" | "invisible" | "locked";
  play_doses: Array<{
    id: string;
    title: string;
    level: "rookie" | "starter" | "pro";
    is_active: boolean;
  }>;
}

export function getAdminReferences() {
  return apiRequest<{
    plans: PlanReference[];
    organisations: Array<{ id: string; name: string; kind: string }>;
  }>("/admin/references");
}

export function referenceDoses(plans: PlanReference[], selectableOnly = false) {
  return plans.flatMap((plan) =>
    !selectableOnly || (plan.is_active && plan.publication_status !== "invisible")
      ? plan.play_doses
          .filter((dose) => !selectableOnly || dose.is_active)
          .map((dose) => ({
            id: dose.id,
            goalId: plan.id,
            title: dose.title,
            level: (dose.level === "rookie"
              ? "Rookie"
              : dose.level === "pro"
                ? "Pro"
                : "Starter") as Level,
          }))
      : [],
  );
}
