import { PolicyLayout } from "./PolicyLayout";
import { usePolicyContent, type PolicyKey } from "./usePolicyContent";

export function SavedPolicyPage({ policy }: { policy: PolicyKey }) {
  return <PolicyLayout {...usePolicyContent(policy)} />;
}
