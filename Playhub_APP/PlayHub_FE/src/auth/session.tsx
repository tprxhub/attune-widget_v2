import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Provider } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";
import {
  apiRequest,
  getAccessToken,
  getApiChildren,
  getCurrentUser,
  login,
  loginWithProvider,
  refreshAccessToken,
  registerFamily as registerFamilyRequest,
  registerFamilyWithProvider,
  type SocialProvider,
  setAccessToken,
  type ApiToken,
} from "@/api/client";
import { sessionFromApi } from "@/api/mappers";
import { invalidatePlanCatalog } from "@/api/plans";
import { makeStore, type AppStore } from "@/store";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  authenticated,
  hydrated as hydratedAction,
  selectCapabilities,
  selectHydrated,
  selectSession,
  signedOut,
} from "@/store/session-slice";

export interface FamilySignupInput {
  childName: string;
  childAge: number;
  guardianName: string;
  email: string;
  password: string;
}

async function loadSession() {
  const [user, children] = await Promise.all([getCurrentUser(), getApiChildren()]);
  return sessionFromApi(user, children);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore>(null);
  if (!storeRef.current) storeRef.current = makeStore();

  return (
    <Provider store={storeRef.current}>
      <SessionPersistence />
      {children}
    </Provider>
  );
}

function SessionPersistence() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      if (!getAccessToken()) {
        dispatch(hydratedAction(null));
        return;
      }
      try {
        const session = await loadSession();
        keepAlive();
        if (active) dispatch(hydratedAction(session));
      } catch {
        setAccessToken(null);
        if (active) dispatch(hydratedAction(null));
      }
    };
    void hydrate();
    const unauthorized = () => {
      invalidatePlanCatalog();
      queryClient.clear();
      dispatch(signedOut());
    };
    window.addEventListener("playhub:unauthorized", unauthorized);

    // Sliding session: swap the token for a fresh one on load, every 30 minutes, and when the
    // tab regains focus (at most every 5 minutes), so an active user is never signed out.
    let lastRefresh = 0;
    const keepAlive = () => {
      if (!getAccessToken() || Date.now() - lastRefresh < 5 * 60_000) return;
      lastRefresh = Date.now();
      refreshAccessToken().catch(() => undefined);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") keepAlive();
    };
    const timer = window.setInterval(keepAlive, 30 * 60_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", keepAlive);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", keepAlive);
      active = false;
      window.removeEventListener("playhub:unauthorized", unauthorized);
    };
  }, [dispatch, queryClient]);

  return null;
}

interface SessionContextValue {
  session: ReturnType<typeof selectSession>;
  signIn: (email: string, password: string) => Promise<ReturnType<typeof selectSession>>;
  /** Google, Apple or Microsoft; `name` is the one Apple shares with the browser on first sign-in. */
  signInWithProvider: (
    provider: SocialProvider,
    credential: string,
    name?: string,
  ) => Promise<ReturnType<typeof selectSession>>;
  registerWithProvider: (input: {
    provider: SocialProvider;
    credential: string;
    name?: string | undefined;
    childName: string;
    childAge: number;
  }) => Promise<ReturnType<typeof selectSession>>;
  registerFamily: (input: FamilySignupInput) => Promise<ReturnType<typeof selectSession>>;
  switchPersona: (id: string) => Promise<ReturnType<typeof selectSession>>;
  refreshSession: () => Promise<ReturnType<typeof selectSession>>;
  signOut: () => void;
  hydrated: boolean;
}

export function useSession(): SessionContextValue {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const session = useAppSelector(selectSession);
  const isHydrated = useAppSelector(selectHydrated);

  const refreshSession = useCallback(async () => {
    const next = await loadSession();
    invalidatePlanCatalog();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["plans"] }),
      queryClient.invalidateQueries({ queryKey: ["goals"] }),
    ]);
    dispatch(authenticated(next));
    return next;
  }, [dispatch, queryClient]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await login(email, password);
      invalidatePlanCatalog();
      const next = await loadSession();
      queryClient.clear();
      dispatch(authenticated(next));
      return next;
    },
    [dispatch, queryClient],
  );

  const registerFamily = useCallback(
    async (input: FamilySignupInput) => {
      const birth = new Date();
      birth.setFullYear(birth.getFullYear() - input.childAge);
      await registerFamilyRequest({
        email: input.email,
        password: input.password,
        guardianName: input.guardianName,
        childName: input.childName,
        childDateOfBirth: birth.toISOString().slice(0, 10),
      });
      invalidatePlanCatalog();
      const next = await loadSession();
      queryClient.clear();
      dispatch(authenticated(next));
      return next;
    },
    [dispatch, queryClient],
  );

  const signInWithProvider = useCallback(
    async (provider: SocialProvider, credential: string, name?: string) => {
      await loginWithProvider(provider, credential, name);
      invalidatePlanCatalog();
      const next = await loadSession();
      queryClient.clear();
      dispatch(authenticated(next));
      return next;
    },
    [dispatch, queryClient],
  );

  const registerWithProvider = useCallback(
    async (input: {
      provider: SocialProvider;
      credential: string;
      name?: string | undefined;
      childName: string;
      childAge: number;
    }) => {
      const birth = new Date();
      birth.setFullYear(birth.getFullYear() - input.childAge);
      await registerFamilyWithProvider({
        provider: input.provider,
        credential: input.credential,
        name: input.name,
        childName: input.childName,
        childDateOfBirth: birth.toISOString().slice(0, 10),
      });
      invalidatePlanCatalog();
      const next = await loadSession();
      queryClient.clear();
      dispatch(authenticated(next));
      return next;
    },
    [dispatch, queryClient],
  );

  const switchPersona = useCallback(
    async (id: string) => {
      const token = await apiRequest<ApiToken>(`/developer/personas/${id}/switch`, {
        method: "POST",
      });
      setAccessToken(token.access_token);
      invalidatePlanCatalog();
      const next = await loadSession();
      queryClient.clear();
      dispatch(authenticated(next));
      return next;
    },
    [dispatch, queryClient],
  );

  const signOut = useCallback(() => {
    setAccessToken(null);
    invalidatePlanCatalog();
    queryClient.clear();
    dispatch(signedOut());
  }, [dispatch, queryClient]);

  return useMemo(
    () => ({
      session,
      signIn,
      signInWithProvider,
      registerWithProvider,
      registerFamily,
      switchPersona,
      refreshSession,
      signOut,
      hydrated: isHydrated,
    }),
    [
      session,
      signIn,
      signInWithProvider,
      registerWithProvider,
      registerFamily,
      switchPersona,
      refreshSession,
      signOut,
      isHydrated,
    ],
  );
}

export function useCapabilities() {
  return useAppSelector(selectCapabilities);
}
