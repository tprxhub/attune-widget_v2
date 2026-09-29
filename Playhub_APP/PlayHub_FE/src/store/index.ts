import { configureStore } from "@reduxjs/toolkit";
import { activeChildReducer } from "./active-child-slice";
import { orgScopeReducer } from "./org-scope-slice";
import { sessionReducer } from "./session-slice";

/** A store per app instance keeps server rendering free of cross-request leakage. */
export const makeStore = () =>
  configureStore({
    reducer: {
      session: sessionReducer,
      activeChild: activeChildReducer,
      orgScope: orgScopeReducer,
    },
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
