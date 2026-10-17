import { useQuery, type QueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import {
  DEFAULT_HOMEPAGE_CONTENT,
  HOMEPAGE_QUERY_KEY,
  loadHomepage,
  type HomepageState,
} from "@/api/homepage";

/** How long a page waits for saved content before it renders with the built-in text. */
const LOADER_TIMEOUT_MS = 3000;

/**
 * Route loader for pages that show editable content. It fetches the saved content before the page
 * renders, so the server-rendered HTML already carries it and the built-in text never flashes.
 * A slow or failing API falls back to the built-in text rather than holding the page.
 */
export async function loadHomepageForRoute(
  queryClient: QueryClient,
): Promise<{ homepage: HomepageState | null }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const homepage = await Promise.race([
      queryClient.ensureQueryData({ queryKey: HOMEPAGE_QUERY_KEY, queryFn: loadHomepage }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), LOADER_TIMEOUT_MS);
      }),
    ]);
    return { homepage };
  } catch {
    return { homepage: null };
  } finally {
    clearTimeout(timer);
  }
}

function loadedHomepage(loaderData: unknown): HomepageState | undefined {
  if (loaderData && typeof loaderData === "object" && "homepage" in loaderData) {
    return (loaderData as { homepage: HomepageState | null }).homepage ?? undefined;
  }
  return undefined;
}

/**
 * Public content uses the same cache as the admin editor, with built-in fallbacks. Content a route
 * loader fetched seeds the cache, so the first render (on the server and in the browser) matches.
 */
export function useHomepageContent() {
  const initial = useRouterState({
    select: (state) => state.matches.map((match) => loadedHomepage(match.loaderData)).find(Boolean),
  });
  const { data } = useQuery({
    queryKey: HOMEPAGE_QUERY_KEY,
    queryFn: loadHomepage,
    staleTime: 60_000,
    retry: false,
    ...(initial ? { initialData: initial } : {}),
  });
  return data?.content ?? DEFAULT_HOMEPAGE_CONTENT;
}
