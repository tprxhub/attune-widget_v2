import type { Goal, Level, PlanEntry, PlayPlan } from "@/lib/types";
import { LEVELS } from "@/lib/types";

/**
 * Domain data mirrors the September Play Hub reference build:
 * seven goals, each with a Rookie / Starter / Pro Play Plan of nine checkpoints.
 */

export const GOALS: Goal[] = [
  {
    id: "pinch",
    name: "Pinch & Grip Development",
    short: "Pinch & Grip",
    icon: "pinch",
    color: "coral",
    kit: "Fine Motor Play Kit",
    blurb: "Builds the small-muscle strength behind a comfortable, controlled pencil grip.",
  },
  {
    id: "bilateral",
    name: "Bilateral Coordination & Midline Crossing",
    short: "Bilateral Coordination",
    icon: "bilateral",
    color: "blue",
    kit: "Fine Motor Play Kit",
    blurb: "Teaches both hands to work as a team and to cross the body's midline with ease.",
  },
  {
    id: "visual",
    name: "Visual-Motor Integration & Eye-Hand Coordination",
    short: "Visual-Motor",
    icon: "visual",
    color: "amber",
    kit: "Fine Motor Play Kit",
    blurb: "Links what the eyes see to what the hands do — copying, tracing and aiming.",
  },
  {
    id: "tool",
    name: "Tool Use Foundations & Functional Grasp",
    short: "Tool Use",
    icon: "tool",
    color: "coral",
    kit: "Fine Motor Play Kit",
    blurb: "Builds the strength and control needed to pick up and use everyday tools.",
  },
  {
    id: "prewrite",
    name: "Pre-Handwriting Patterns & Line Mastery",
    short: "Pre-Handwriting",
    icon: "prewrite",
    color: "blue",
    kit: "Fine Motor Play Kit",
    blurb: "Lays down the line patterns that underpin all early handwriting.",
  },
  {
    id: "scanning",
    name: "Visual Scanning, Tracking & Matching",
    short: "Visual Scanning",
    icon: "scanning",
    color: "amber",
    kit: "Fine Motor Play Kit",
    blurb: "Trains the eyes to follow, match and locate quickly and accurately.",
  },
  {
    id: "letters",
    name: "Pre-Writing Shapes & Letter Readiness",
    short: "Letter Readiness",
    icon: "letters",
    color: "coral",
    kit: "Fine Motor Play Kit",
    blurb: "Bridges the gap between drawing shapes and forming real letters.",
  },
];

export const goalById = (id: string) => GOALS.find((g) => g.id === id);

/** Every plan under one goal shares an outcome-led title, as in the reference build. */
const PLAN_TITLE: Record<string, string> = {
  pinch: "Fix the Pencil Grip",
  bilateral: "Learn to Button a Shirt",
  visual: "Make Reading Easy",
  tool: "Learn to Use Scissors",
  prewrite: "Color Inside the Lines",
  scanning: "Copy Correctly",
  letters: "Write Their Name",
};

const PLAN_BLURB: Record<string, Record<Level, string>> = {
  pinch: {
    Rookie: "Warm up grip strength and hand-eye basics before tackling a pencil.",
    Starter:
      "The recommended starting point for pinch and grip. Move down to Rookie if it's tricky, or up to Pro if it's a breeze.",
    Pro: "Refine tripod grip and control for real pre-writing tasks.",
  },
  bilateral: {
    Rookie: "Build the first cross-body movement patterns that both hands need to work together.",
    Starter: "Level up cross-body coordination with faster, trickier two-hand challenges.",
    Pro: "Combine coordination, balance and rhythm into complex cross-body sequences.",
  },
  visual: {
    Rookie:
      "The first visual-tracking and targeting games that connect what kids see to what they do.",
    Starter: "Sharper targeting and pattern-copying for kids ready to move past the basics.",
    Pro: "Fine-tune eye-hand precision with tasks that mirror early handwriting and craft skills.",
  },
  tool: {
    Rookie: "Build the hand strength and control needed to pick up and use everyday tools.",
    Starter: "Step-by-step activities for building a confident functional grasp on everyday tools.",
    Pro: "Precision tool-use activities for children ready for more complex functional tasks.",
  },
  prewrite: {
    Rookie: "Build the foundational line patterns that underpin all early handwriting.",
    Starter: "Structured line and pattern tracing activities to build pre-writing readiness.",
    Pro: "Complex pattern and line activities for children approaching letter formation.",
  },
  scanning: {
    Rookie: "Early scanning and tracking games that train the eye to follow, match and locate.",
    Starter: "Sharper scanning and matching activities to build visual accuracy and speed.",
    Pro: "Advanced visual tracking and decode activities for strong visual-motor precision.",
  },
  letters: {
    Rookie: "Foundational shape and line activities that prepare children for letter formation.",
    Starter: "Shape and pattern activities that bridge between drawing and early letter writing.",
    Pro: "Advanced letter-readiness activities for children on the threshold of writing.",
  },
};

const PLAN_AGE: Record<string, Record<Level, string>> = {
  pinch: { Rookie: "18m+", Starter: "3+", Pro: "4+" },
  bilateral: { Rookie: "2+", Starter: "3+", Pro: "4+" },
  visual: { Rookie: "2.5+", Starter: "3.5+", Pro: "4.5+" },
  tool: { Rookie: "2+", Starter: "3+", Pro: "4+" },
  prewrite: { Rookie: "2.5+", Starter: "3+", Pro: "4+" },
  scanning: { Rookie: "2+", Starter: "3+", Pro: "4+" },
  letters: { Rookie: "2.5+", Starter: "3+", Pro: "4+" },
};

const ACTIVITIES: Record<string, Record<Level, string[]>> = {
  pinch: {
    Rookie: [
      "Peg Push Party",
      "PathPad Fun",
      "Stack Click Blocks",
      "Twist and Turn",
      "Trace the Track",
    ],
    Starter: [
      "Tangram Match",
      "Peg Patterns",
      "Build and Bump",
      "Bolt Match Race",
      "Letter Trail Maker",
    ],
    Pro: [
      "Tangram Trail Challenge",
      "Peg Board Blueprint",
      "Block Builder Designs",
      "Bolt & Label Lab",
      "Obstacle Letter Dash",
    ],
  },
  bilateral: {
    Rookie: [
      "Tap & Slide Stretch",
      "Peg Hand Switch",
      "Block Buddy Tap",
      "Twist Pair Dance",
      "Mirror Maze Draw",
    ],
    Starter: [
      "Peg Color Match Switch",
      "Click-Together Creatures",
      "Tangram Flip Match",
      "Bolt Sort Station",
      "Crossing Shapes",
    ],
    Pro: [
      "Tangram Design Swap",
      "Peg Blueprint Build",
      "Block Balance Battle",
      "Bolt Order Game",
      "Trace & Erase Relay",
    ],
  },
  visual: {
    Rookie: [
      "Dot-to-Dot Dash",
      "Tangram Treasure Hunt",
      "Peg Path Filler",
      "Click & Copy Towers",
      "Trace the Weave",
    ],
    Starter: [
      "Shadow Match Grid",
      "Peg Pattern Builder",
      "Click Count & Stack",
      "Shape Maze Draw",
      "Weave Copy Lines",
    ],
    Pro: [
      "Precision Peg Blueprint",
      "Advanced Tangram Puzzle Build",
      "Design the Tower",
      "Mirror Drawing Challenge",
      "Weave Sequence Memory",
    ],
  },
  tool: {
    Rookie: [
      "Dot Stamp Squish",
      "Nutty Turner Practice",
      "Lace Loop Push",
      "Block Push Pattern",
      "Peg Puller Challenge",
    ],
    Starter: [
      "Bolt Match by Size",
      "Peg Push-Down Build",
      "Line Copy Drawing",
      "Build and Break Stack",
      "Lace Trace Pattern",
    ],
    Pro: [
      "Precision Trace Maze",
      "Bolt Speed Round",
      "Pattern Stack Copy",
      "Tricky Trace Replication",
      "Peg Pull & Pinch Sort",
    ],
  },
  prewrite: {
    Rookie: [
      "Line Drive",
      "Trace the Rainbow",
      "Tangram Trail",
      "Dot to Dot Start",
      "Block Line Match",
    ],
    Starter: [
      "Pattern Tracing Lines",
      "Line Shapes Copy",
      "Shape Match Build",
      "Maze Marker Path",
      "Color Trail Build",
    ],
    Pro: [
      "Symmetry Flip Challenge",
      "Block Tower Blueprint",
      "Shape Maze Writing",
      "Zigzag Speed Run",
      "Tangram Letter Challenge",
    ],
  },
  scanning: {
    Rookie: [
      "Color Spot Search",
      "Shape Match Puzzle",
      "Track the Loop",
      "Color Peg Hunt",
      "Shape Match Stack",
    ],
    Starter: [
      "Line Loop Challenge",
      "Peg Pattern Copy",
      "Tangram Shadow Match",
      "Zigzag Pathpad Race",
      "Thread & Follow Pattern",
    ],
    Pro: [
      "Tangram Rotation Race",
      "Thread Maze Builder",
      "Peg Grid Decode",
      "Whiteboard Visual Trails",
      "Shape Stack Race",
    ],
  },
  letters: {
    Rookie: [
      "Vertical Line Parade",
      "Peg Shapes",
      "Weave a Circle",
      "Trace the Trail",
      "Shape Frame Match",
    ],
    Starter: [
      "Direction Dash",
      "Pattern Copy Stack",
      "Tangram Tracing Map",
      "Lacing Angles",
      "Shape Weaving Cards",
    ],
    Pro: [
      "Shape Sentence Builder",
      "Pattern Peg Paths",
      "Tangram Letter Start",
      "Thread the ABCs",
      "Shape Lock Challenge",
    ],
  },
};

const INSTRUCTIONS: string[][] = [
  [
    "Sit your child at a table with feet flat and elbows supported.",
    "Set out the kit pieces for this Activity within easy reach.",
    "Demonstrate once slowly, then hand over — let them try without help.",
    "Play for about 10 minutes, then stop while it is still fun.",
  ],
  [
    "Clear a calm space and put away other toys.",
    "Name the Activity out loud so your child knows what is coming.",
    "Prompt with words before you prompt with hands.",
    "Finish with a high five and note the one thing that went well.",
  ],
  [
    "Warm up with 30 seconds of hand squeezes.",
    "Run the Activity twice — the second run is usually the better one.",
    "Keep your feedback to what their hands did, not the result.",
    "Log the Attempt straight away while the detail is fresh.",
  ],
];

function makeEntries(goalId: string, level: Level): PlanEntry[] {
  const acts = ACTIVITIES[goalId]![level];
  const base = `${goalId}-${level.toLowerCase()}`;

  /** Each Play Dose contains one focused activity and, when available, one video. */
  const dose = (n: number, day: number): PlanEntry => {
    const main = acts[n - 1]!;
    const activities = [
      {
        id: `${base}-dose-${n}-activity`,
        name: main,
        minutes: 10,
        instructions: INSTRUCTIONS[(n - 1) % INSTRUCTIONS.length]!,
        videoLabel: `${main} — how to run it`,
      },
    ];
    return {
      id: `${base}-dose-${n}`,
      kind: "dose",
      day,
      label: `Activity #${n}`,
      title: `${level} Activity #${n} – ${main}`,
      activity: main,
      loggable: true,
      minutes: 10,
      instructions: INSTRUCTIONS[(n - 1) % INSTRUCTIONS.length]!,
      videoLabel: `${main} — how to run it`,
      activities,
    };
  };

  return [
    {
      id: `${base}-intro`,
      kind: "intro",
      day: 0,
      label: "Introduction",
      title: "Introduction – what this week builds",
      activity: "Watch the Play Plan introduction",
      loggable: false,
      minutes: 3,
      instructions: [
        "Watch the short introduction on your own first.",
        "Lay out the Fine Motor Play Kit pieces you will need this week.",
        "Pick a 10-minute slot in the day you can repeat.",
      ],
      videoLabel: "Play Plan introduction",
    },
    dose(1, 0),
    dose(2, 1),
    dose(3, 2),
    {
      id: `${base}-redo-1`,
      kind: "redo",
      day: 3,
      label: "Redo Day!",
      title: "Redo Day! – run your child's favourite again",
      activity: "Repeat any Play Dose from days 0–2",
      loggable: true,
      minutes: 10,
      instructions: [
        "Ask your child which Activity they want to do again.",
        "Run it exactly as before — repetition is where the skill sticks.",
        "Log the Attempt as a Redo Day.",
      ],
      videoLabel: "Why Redo Days matter",
    },
    dose(4, 4),
    dose(5, 5),
    {
      id: `${base}-redo-2`,
      kind: "redo",
      day: 6,
      label: "Final Redo Day!",
      title: "Final Redo Day! – bring the week together",
      activity: "Repeat the Play Dose that felt hardest",
      loggable: true,
      minutes: 10,
      instructions: [
        "Choose the Play Dose that scored lowest this week.",
        "Run it once, calmly, with no time pressure.",
        "Note the difference against the first Attempt.",
      ],
      videoLabel: "Finishing the week strong",
    },
    {
      id: `${base}-levelup`,
      kind: "levelup",
      day: 7,
      label: "Level-Up Prompt",
      title:
        level === "Pro"
          ? `You've mastered ${PLAN_TITLE[goalId]}!`
          : `${PLAN_TITLE[goalId]} – ${level === "Rookie" ? "Starter" : "Pro"}`,
      activity: "Choose the next Play Plan level",
      loggable: false,
      minutes: 2,
      instructions: [
        "Look at this week's Completion Scores.",
        "Mostly 4s and 5s? Move up a level.",
        "Mostly 1s and 2s? Repeat the week or move down a level.",
      ],
      videoLabel: "Choosing the next level",
    },
  ];
}

export const PLAY_PLANS: PlayPlan[] = GOALS.flatMap((goal) =>
  LEVELS.map((level) => ({
    id: `${goal.id}-${level.toLowerCase()}`,
    goalId: goal.id,
    level,
    title: PLAN_TITLE[goal.id]!,
    summary: PLAN_BLURB[goal.id]![level],
    kit: goal.kit,
    age: PLAN_AGE[goal.id]![level],
    entries: makeEntries(goal.id, level),
  })),
);

export const planById = (id: string) => PLAY_PLANS.find((p) => p.id === id);
export const planByGoalAndLevel = (goalId: string, level: Level) =>
  PLAY_PLANS.find((plan) => plan.goalId === goalId && plan.level === level);

export const LEVEL_GUIDANCE =
  "Start at Starter — move down to Rookie if it's difficult, or up to Pro if it feels easy.";
