import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Session } from "@/lib/types";

const anonymousSession: Session = {
  personaId: "anonymous",
  personaLabel: "Anonymous",
  userId: "anon",
  name: "Visitor",
  email: "",
  role: "anonymous",
  accountType: "none",
  tier: "none",
  childIds: [],
  homePath: "/",
};

export interface SessionState {
  current: Session | null;
  hydrated: boolean;
}

const initialState: SessionState = { current: null, hydrated: false };

const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    authenticated(state, action: PayloadAction<Session>) {
      state.current = action.payload;
      state.hydrated = true;
    },
    signedOut(state) {
      state.current = null;
      state.hydrated = true;
    },
    hydrated(state, action: PayloadAction<Session | null>) {
      state.current = action.payload;
      state.hydrated = true;
    },
  },
});

export const { authenticated, signedOut, hydrated } = sessionSlice.actions;
export const sessionReducer = sessionSlice.reducer;

export const selectHydrated = (state: { session: SessionState }) => state.session.hydrated;
export const selectSession = (state: { session: SessionState }) =>
  state.session.current ?? anonymousSession;

export interface Capabilities {
  isAnonymous: boolean;
  isFreeGated: boolean;
  isReadOnlyParent: boolean;
  canLogAttempts: boolean;
  canInviteSupporter: boolean;
  canManageSubscription: boolean;
  canEnrollChildren: boolean;
  canLeaveConsultNotes: boolean;
  isOrgUser: boolean;
  isAdmin: boolean;
}

export const selectCapabilities = createSelector([selectSession], (session): Capabilities => {
  const isAnonymous = session.role === "anonymous";
  const isAdmin = session.role === "super_admin";
  const isFreeGated = session.accountType === "b2c" && session.tier === "free";
  const isReadOnlyParent = session.accountType === "b2b" && session.role === "parent";
  return {
    isAnonymous,
    isFreeGated,
    isReadOnlyParent,
    canLogAttempts:
      !isAnonymous &&
      !isReadOnlyParent &&
      !isFreeGated &&
      (isAdmin ||
        session.role === "parent" ||
        session.role === "supporter" ||
        session.role === "educator"),
    canInviteSupporter:
      session.accountType === "b2c" && session.role === "parent" && session.tier === "subscribed",
    canManageSubscription: isAdmin || (session.accountType === "b2c" && session.role === "parent"),
    canEnrollChildren: isAdmin || (session.accountType === "b2b" && session.role === "educator"),
    canLeaveConsultNotes: isAdmin || session.role === "educator" || session.role === "supporter",
    isOrgUser: session.accountType === "b2b",
    isAdmin,
  };
});
