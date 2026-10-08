import { useQuery } from "@tanstack/react-query";
import defaultLogo from "@/assets/PlayHub_Logo .svg";
import { apiAssetUrl, apiRequest } from "./client";

export const BRANDING_QUERY_KEY = ["site-branding"] as const;
export interface Branding {
  content: { logo_url: string } | null;
}
export function loadBranding() {
  return apiRequest<Branding>("/site-content/branding", { authenticated: false });
}
export function useApplicationLogo() {
  const query = useQuery({
    queryKey: BRANDING_QUERY_KEY,
    queryFn: loadBranding,
    staleTime: 60_000,
  });
  return apiAssetUrl(query.data?.content?.logo_url) || defaultLogo;
}
export function uploadApplicationLogo(file: File) {
  const body = new FormData();
  body.append("file", file);
  return apiRequest<Branding>("/site-content/branding/logo", { method: "POST", body });
}
export function resetApplicationLogo() {
  return apiRequest<void>("/site-content/branding/logo", { method: "DELETE" });
}
