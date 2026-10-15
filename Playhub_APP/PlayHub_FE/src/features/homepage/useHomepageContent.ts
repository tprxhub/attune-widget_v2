import { useQuery } from "@tanstack/react-query";
import { DEFAULT_HOMEPAGE_CONTENT, HOMEPAGE_QUERY_KEY, loadHomepage } from "@/api/homepage";

/** Public content uses the same cache as the admin editor, with built-in fallbacks. */
export function useHomepageContent() {
  const { data } = useQuery({
    queryKey: HOMEPAGE_QUERY_KEY,
    queryFn: loadHomepage,
    staleTime: 60_000,
    retry: false,
  });
  return data?.content ?? DEFAULT_HOMEPAGE_CONTENT;
}
