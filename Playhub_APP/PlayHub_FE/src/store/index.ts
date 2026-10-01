import { configureStore } from "@reduxjs/toolkit";
import { activeChildReducer } from "./active-child-slice";
import { orgScopeReducer } from "./org-scope-slice";
import { playPulseReducer } from "./play-pulse-slice";
import { sessionReducer } from "./session-slice";

/** A store per app instance keeps server rendering free of cross-request leakage. */
export const makeStore = () =>
  configureStore({
    reducer: {
      session: sessionReducer,
      activeChild: activeChildReducer,
      orgScope: orgScopeReducer,
      playPulse: playPulseReducer,
    },
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
