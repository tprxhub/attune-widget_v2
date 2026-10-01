import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  DOMAINS,
  PLAY_PULSE_GOALS,
  type AgeBandId,
  type PlayPulseDomain,
} from "@/features/play-pulse/data";
import {
  emptyAnswers,
  type AnswerValue,
  type PlayPulseAnswers,
} from "@/features/play-pulse/scoring";

export type PlayPulseScreen = "intro" | "goal" | "quiz" | "gate" | "results";

export interface PlayPulseState {
  screen: PlayPulseScreen;
  childName: string;
  band: AgeBandId | null;
  goalId: string | null;
  domainIndex: number;
  answers: PlayPulseAnswers;
  hydrated: boolean;
}

export const initialPlayPulseState: PlayPulseState = {
  screen: "intro",
  childName: "",
  band: null,
  goalId: null,
  domainIndex: 0,
  answers: emptyAnswers(),
  hydrated: false,
};

const screens: PlayPulseScreen[] = ["intro", "goal", "quiz", "gate", "results"];
const bands: AgeBandId[] = ["toddler", "preschool", "school"];
const validAnswer = (value: unknown): value is AnswerValue =>
  value === null || value === "skipped" || [15, 40, 65, 90].includes(value as number);

const playPulseSlice = createSlice({
  name: "playPulse",
  initialState: initialPlayPulseState,
  reducers: {
    childNameChanged(state, action: PayloadAction<string>) {
      state.childName = action.payload;
    },
    ageBandSelected(state, action: PayloadAction<AgeBandId>) {
      state.band = action.payload;
    },
    basicsCompleted(state) {
      if (state.childName.trim() && state.band) state.screen = "goal";
    },
    goalSelected(state, action: PayloadAction<string>) {
      state.goalId = action.payload;
    },
    questionsStarted(state) {
      if (!state.goalId) return;
      state.answers = emptyAnswers();
      state.domainIndex = 0;
      state.screen = "quiz";
    },
    answerSelected(
      state,
      action: PayloadAction<{
        domain: PlayPulseDomain;
        questionIndex: 0 | 1;
        value: Exclude<AnswerValue, null>;
      }>,
    ) {
      state.answers[action.payload.domain][action.payload.questionIndex] = action.payload.value;
    },
    quizAdvanced(state, action: PayloadAction<{ revealResult: boolean }>) {
      if (state.domainIndex < DOMAINS.length - 1) state.domainIndex += 1;
      else state.screen = action.payload.revealResult ? "results" : "gate";
    },
    movedBack(state) {
      if (state.screen === "goal") state.screen = "intro";
      else if (state.screen === "quiz" && state.domainIndex > 0) state.domainIndex -= 1;
      else if (state.screen === "quiz") state.screen = "goal";
      else if (state.screen === "gate" || state.screen === "results") {
        state.screen = "quiz";
        state.domainIndex = DOMAINS.length - 1;
      }
    },
    resultsRevealed(state) {
      state.screen = "results";
    },
    assessmentReset() {
      return { ...initialPlayPulseState, hydrated: true, answers: emptyAnswers() };
    },
    assessmentHydrated(state, action: PayloadAction<Partial<PlayPulseState> | null>) {
      const saved = action.payload;
      if (saved) {
        if (saved.screen && screens.includes(saved.screen)) state.screen = saved.screen;
        if (typeof saved.childName === "string") state.childName = saved.childName.slice(0, 80);
        if (saved.band && bands.includes(saved.band)) state.band = saved.band;
        if (
          typeof saved.goalId === "string" &&
          PLAY_PULSE_GOALS.some((goal) => goal.id === saved.goalId)
        ) {
          state.goalId = saved.goalId;
        }
        if (typeof saved.domainIndex === "number") {
          state.domainIndex = Math.max(0, Math.min(DOMAINS.length - 1, saved.domainIndex));
        }
        for (const domain of DOMAINS) {
          const values = saved.answers?.[domain];
          if (values && validAnswer(values[0]) && validAnswer(values[1])) {
            state.answers[domain] = [values[0], values[1]];
          }
        }
        if (state.screen !== "intro" && !state.band) state.screen = "intro";
        if (["quiz", "gate", "results"].includes(state.screen) && !state.goalId) {
          state.screen = "goal";
        }
      }
      state.hydrated = true;
    },
  },
});

export const {
  ageBandSelected,
  answerSelected,
  assessmentHydrated,
  assessmentReset,
  basicsCompleted,
  childNameChanged,
  goalSelected,
  movedBack,
  questionsStarted,
  quizAdvanced,
  resultsRevealed,
} = playPulseSlice.actions;
export const playPulseReducer = playPulseSlice.reducer;

export const selectPlayPulse = (state: { playPulse: PlayPulseState }) => state.playPulse;
