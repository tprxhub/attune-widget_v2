import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { ApiError } from "./api/client";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Mutations made by another role, a Stripe webhook, or a second tab must
        // be reflected whenever a screen is revisited. Individual mutation
        // handlers still invalidate active screens for immediate updates.
        staleTime: 0,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status > 0 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
