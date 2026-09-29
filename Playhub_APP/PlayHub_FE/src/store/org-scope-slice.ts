import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/** "all", organisation, individual, a specific organisation, or `subscriber:<childId>`. */
export type OrgScopeId = string;

export interface OrgScopeState {
  scopeId: OrgScopeId;
}

const initialState: OrgScopeState = { scopeId: "all" };

const orgScopeSlice = createSlice({
  name: "orgScope",
  initialState,
  reducers: {
    orgScopeSelected(state, action: PayloadAction<OrgScopeId>) {
      state.scopeId = action.payload;
    },
  },
});

export const { orgScopeSelected } = orgScopeSlice.actions;
export const orgScopeReducer = orgScopeSlice.reducer;

export const selectOrgScope = (state: { orgScope?: OrgScopeState }) =>
  state.orgScope?.scopeId ?? "all";
