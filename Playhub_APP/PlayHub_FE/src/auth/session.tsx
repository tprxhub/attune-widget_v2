import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Provider } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";
import {
  apiRequest,
  getAccessToken,
  getApiChildren,
  getCurrentUser,
  login,
  loginWithGoogle,
  registerFamily as registerFamilyRequest,
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
    return () => {
      active = false;
      window.removeEventListener("playhub:unauthorized", unauthorized);
    };
  }, [dispatch, queryClient]);

  return null;
}

interface SessionContextValue {
  session: ReturnType<typeof selectSession>;
  signIn: (email: string, password: string) => Promise<ReturnType<typeof selectSession>>;
  signInWithGoogle: (credential: string) => Promise<ReturnType<typeof selectSession>>;
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

  const signInWithGoogle = useCallback(
    async (credential: string) => {
      await loginWithGoogle(credential);
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
      signInWithGoogle,
      registerFamily,
      switchPersona,
      refreshSession,
      signOut,
      hydrated: isHydrated,
    }),
    [
      session,
      signIn,
      signInWithGoogle,
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
