import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface ActiveChildState {
  /** Explicit user choice; when unset the first child in the list is used. */
  overrideId: string | undefined;
}

const initialState: ActiveChildState = { overrideId: undefined };

const activeChildSlice = createSlice({
  name: "activeChild",
  initialState,
  reducers: {
    activeChildSelected(state, action: PayloadAction<string>) {
      state.overrideId = action.payload;
    },
    activeChildCleared(state) {
      state.overrideId = undefined;
    },
  },
});

export const { activeChildSelected, activeChildCleared } = activeChildSlice.actions;
export const activeChildReducer = activeChildSlice.reducer;

export const selectActiveChildOverride = (state: { activeChild: ActiveChildState }) =>
  state.activeChild.overrideId;
