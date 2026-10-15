import { useHomepageContent } from "@/features/homepage/useHomepageContent";
import { parsePolicyText } from "./policyText";

export type PolicyKey = "terms" | "privacy";

export function usePolicyContent(key: PolicyKey) {
  const { policies } = useHomepageContent();
  const policy = policies[key];
  return { title: policy.title, ...parsePolicyText(policy.body) };
}
