export const AGE_BANDS = [
  {
    id: "toddler",
    label: "Toddler",
    range: "1 – 2.5 years",
  },
  {
    id: "preschool",
    label: "Preschooler",
    range: "2.5 – 5 years",
  },
  {
    id: "school",
    label: "School Age",
    range: "5 – 8 years",
  },
] as const;

export const DOMAINS = ["Sensory", "Motor", "Cognition", "Engagement"] as const;

export type AgeBandId = (typeof AGE_BANDS)[number]["id"];
export type PlayPulseDomain = (typeof DOMAINS)[number];

export interface PlayPulseOption {
  label: string;
  score: 15 | 40 | 65 | 90;
}

export interface PlayPulseQuestion {
  text: string;
  options: PlayPulseOption[];
}

export interface PlayPulseGoal {
  id: string;
  name: string;
  clinical: string;
  formula: Record<AgeBandId, Record<PlayPulseDomain, number>>;
  questions: Record<AgeBandId, Record<PlayPulseDomain, Array<string | PlayPulseQuestion>>>;
}

export const DEFAULT_OPTIONS: PlayPulseOption[] = [
  {
    label: "Yes, does this consistently on their own",
    score: 90,
  },
  {
    label: "Yes, but only sometimes, or needs a reminder",
    score: 65,
  },
  {
    label: "Not yet, but starting to try",
    score: 40,
  },
  {
    label: "Not yet",
    score: 15,
  },
];

export const PLAY_PULSE_GOALS: PlayPulseGoal[] = [
  {
    id: "pencil-grip",
    name: "Fix the Pencil Grip",
    clinical: "Pinch & Grip Development",
    formula: {
      toddler: {
        Sensory: 25,
        Motor: 45,
        Cognition: 5,
        Engagement: 25,
      },
      preschool: {
        Sensory: 20,
        Motor: 45,
        Cognition: 20,
        Engagement: 15,
      },
      school: {
        Sensory: 15,
        Motor: 40,
        Cognition: 30,
        Engagement: 15,
      },
    },
    questions: {
      toddler: {
        Sensory: [
          {
            text: "When your child holds a crayon, spoon or chunky toy, how do they handle different textures and weights in their hand?",
            options: [
              {
                label: "Handles a range of textures and weights comfortably",
                score: 90,
              },
              {
                label: "Handles most things fine, occasionally reacts to something new",
                score: 65,
              },
              {
                label: "Reacts strongly to certain textures or weights (too heavy, too rough)",
                score: 40,
              },
              {
                label: "Consistently avoids holding textured or weighted objects",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child notice or fuss about the size or shape of the crayon or utensil they're holding?",
            options: [
              {
                label: "No, picks up any size or shape without fuss",
                score: 90,
              },
              {
                label: "Occasionally fusses, but settles quickly",
                score: 65,
              },
              {
                label: "Often fusses about size or shape",
                score: 40,
              },
              {
                label: "Refuses items that aren't a specific size or shape",
                score: 15,
              },
            ],
          },
        ],
        Motor: [
          {
            text: "How does your child currently hold a crayon or chunky marker?",
            options: [
              {
                label: "Whole-hand (fisted/palmar) grasp",
                score: 90,
              },
              {
                label: "Starting to use fingers, but grip still loose or shifting",
                score: 65,
              },
              {
                label: "Grasps briefly, then drops or switches hands often",
                score: 40,
              },
              {
                label: "Doesn't yet pick up and hold a crayon",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child stack blocks or manipulate small chunky toys using thumb and fingers, not just a whole-hand grab?",
            options: [
              {
                label: "Yes, uses thumb and fingers with control",
                score: 90,
              },
              {
                label: "Does this sometimes, still relies on a whole-hand grab often",
                score: 65,
              },
              {
                label: "Attempts it but mostly uses a whole-hand grab",
                score: 40,
              },
              {
                label: "Not yet able to use thumb and fingers this way",
                score: 15,
              },
            ],
          },
        ],
        Cognition: [
          "Does your child imitate you making a scribble or mark right after watching you do it?",
          "Does your child repeat an action with a crayon, like tapping or dragging, to see the same mark appear again?",
        ],
        Engagement: [
          {
            text: "When you point to a crayon or hold one up, does your child look where you're pointing or reach for it in response?",
            options: [
              {
                label: "Yes, follows my point or reach right away",
                score: 90,
              },
              {
                label: "Sometimes follows it, sometimes seems to miss it",
                score: 65,
              },
              {
                label: "Only responds if I also say the word out loud",
                score: 40,
              },
              {
                label: "Doesn't yet follow a point or a held-up object",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child follow a simple one-step direction like 'give me the crayon' or point to ask for a specific color?",
            options: [
              {
                label: "Yes, follows the direction or points to ask, reliably",
                score: 90,
              },
              {
                label: "Sometimes follows it, or points inconsistently",
                score: 65,
              },
              {
                label: "Only with the direction repeated or demonstrated",
                score: 40,
              },
              {
                label: "Not yet able to follow or point to ask",
                score: 15,
              },
            ],
          },
        ],
      },
      preschool: {
        Sensory: [
          {
            text: "When your child picks up a pencil or crayon, how well do they sense how tightly to hold it?",
            options: [
              {
                label: "Grips with just the right amount of pressure",
                score: 90,
              },
              {
                label: "Usually about right, sometimes too tight or too loose",
                score: 65,
              },
              {
                label: "Often grips too tightly or too loosely",
                score: 40,
              },
              {
                label: "Seems unaware of how hard they're gripping",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child notice when a pencil feels awkward in their hand and try to reposition it?",
            options: [
              {
                label: "Yes, notices and repositions on their own",
                score: 90,
              },
              {
                label: "Notices sometimes, but doesn't always fix it",
                score: 65,
              },
              {
                label: "Only repositions if I point it out",
                score: 40,
              },
              {
                label: "Doesn't seem to notice or reposition",
                score: 15,
              },
            ],
          },
        ],
        Motor: [
          {
            text: "How does your child hold a pencil or crayon most of the time?",
            options: [
              {
                label: "Mature tripod grasp (thumb, index and middle finger)",
                score: 90,
              },
              {
                label: "Emerging tripod grasp, sometimes reverts to a fist",
                score: 65,
              },
              {
                label: "Whole-hand (palmar) grasp most of the time",
                score: 40,
              },
              {
                label: "Doesn't yet hold a pencil in a functional grasp",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child use a pincer grasp — thumb and index finger — to pick up small objects like beads or crayons?",
            options: [
              {
                label: "Yes, uses a precise pincer grasp",
                score: 90,
              },
              {
                label: "Uses it sometimes, still developing precision",
                score: 65,
              },
              {
                label: "Attempts it but mostly uses the whole hand",
                score: 40,
              },
              {
                label: "Not yet able to use a pincer grasp",
                score: 15,
              },
            ],
          },
        ],
        Cognition: [
          "Does your child copy a simple shape, like a straight line or circle, after watching you draw it?",
          "Does your child correct their own crayon grip after you remind them, without you physically adjusting it?",
        ],
        Engagement: [
          {
            text: "Does your child watch your hand closely and copy your grip when you show them how to hold a pencil?",
            options: [
              {
                label: "Yes, watches closely and copies straight away",
                score: 90,
              },
              {
                label: "Watches sometimes, copies with a reminder",
                score: 65,
              },
              {
                label: "Watches but doesn't yet copy the grip",
                score: 40,
              },
              {
                label: "Doesn't seem to watch or attempt to copy",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child tell you, in words or gestures, which color or crayon they want before starting to draw?",
            options: [
              {
                label: "Yes, tells or shows me clearly what they want",
                score: 90,
              },
              {
                label: "Sometimes tells me, other times I have to guess",
                score: 65,
              },
              {
                label: "Only points or reaches without words",
                score: 40,
              },
              {
                label: "Doesn't yet indicate a preference",
                score: 15,
              },
            ],
          },
        ],
      },
      school: {
        Sensory: [
          {
            text: "When writing, does your child adjust their pencil grip pressure appropriately — not pressing too hard or too soft?",
            options: [
              {
                label: "Yes, uses appropriate pressure consistently",
                score: 90,
              },
              {
                label: "Mostly appropriate, occasionally too hard or too soft",
                score: 65,
              },
              {
                label: "Often presses too hard or too soft",
                score: 40,
              },
              {
                label:
                  "Consistently uses inappropriate pressure — tears the paper or too faint to read",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child's hand tire or cramp quickly during short writing tasks, or can they sustain a comfortable grip?",
            options: [
              {
                label: "Sustains a comfortable grip through a full task",
                score: 90,
              },
              {
                label: "Tires a little on longer tasks, but manages",
                score: 65,
              },
              {
                label: "Tires or cramps during short writing tasks",
                score: 40,
              },
              {
                label: "Cramps or complains of pain almost immediately",
                score: 15,
              },
            ],
          },
        ],
        Motor: [
          {
            text: "Can your child hold a pencil in a mature tripod grip for writing tasks?",
            options: [
              {
                label: "Yes, uses a mature tripod grip consistently",
                score: 90,
              },
              {
                label: "Uses it most of the time, occasionally slips into another grip",
                score: 65,
              },
              {
                label: "Attempts it but reverts to an immature grip quickly",
                score: 40,
              },
              {
                label: "Not yet able to use a tripod grip",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child sustain a tripod grip for an extended writing task without switching to a fisted grip?",
            options: [
              {
                label: "Yes, sustains it for the full task",
                score: 90,
              },
              {
                label: "Sustains it for a while, then switches",
                score: 65,
              },
              {
                label: "Switches to a fisted grip fairly quickly",
                score: 40,
              },
              {
                label: "Can't sustain a tripod grip at all",
                score: 15,
              },
            ],
          },
        ],
        Cognition: [
          "Does your child copy a specific letter or shape accurately from a printed model?",
          "Does your child know the difference between upper case and lower case letters when writing?",
        ],
        Engagement: [
          {
            text: "Does your child pick up on non-verbal feedback, like a nod or a puzzled look, when you're helping with handwriting?",
            options: [
              {
                label: "Yes, notices and adjusts based on my expression",
                score: 90,
              },
              {
                label: "Notices sometimes, but doesn't always adjust",
                score: 65,
              },
              {
                label: "Only responds if I say something out loud",
                score: 40,
              },
              {
                label: "Doesn't seem to notice my expressions",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child ask for help with a written task using clear words, like 'I don't know how to make this letter'?",
            options: [
              {
                label: "Yes, explains clearly what they're stuck on",
                score: 90,
              },
              {
                label: "Asks for help, but not always clearly",
                score: 65,
              },
              {
                label: "Shows frustration but doesn't say what's wrong",
                score: 40,
              },
              {
                label: "Doesn't yet ask for help with words",
                score: 15,
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "button-shirt",
    name: "Learn to Button a Shirt",
    clinical: "Bilateral Coordination & Midline Crossing",
    formula: {
      toddler: {
        Sensory: 20,
        Motor: 45,
        Cognition: 5,
        Engagement: 30,
      },
      preschool: {
        Sensory: 15,
        Motor: 50,
        Cognition: 15,
        Engagement: 20,
      },
      school: {
        Sensory: 10,
        Motor: 55,
        Cognition: 20,
        Engagement: 15,
      },
    },
    questions: {
      toddler: {
        Sensory: [
          {
            text: "When your child plays with buttons, snaps or zippers, how do they respond to the small parts and textures?",
            options: [
              {
                label: "Handles small parts and textures comfortably",
                score: 90,
              },
              {
                label: "Handles them fine, occasionally reacts to something new",
                score: 65,
              },
              {
                label: "Reacts strongly to small or fiddly textures",
                score: 40,
              },
              {
                label: "Consistently avoids or refuses small fasteners",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child avoid or get frustrated by clothing with fasteners during dressing?",
            options: [
              {
                label: "No, dressing with fasteners doesn't bother them",
                score: 90,
              },
              {
                label: "Occasionally frustrated, but gets through it",
                score: 65,
              },
              {
                label: "Often frustrated or resistant",
                score: 40,
              },
              {
                label: "Consistently avoids or refuses clothing with fasteners",
                score: 15,
              },
            ],
          },
        ],
        Motor: [
          {
            text: "Does your child use both hands together during play, like holding one toy while manipulating another?",
            options: [
              {
                label: "Yes, coordinates both hands together well",
                score: 90,
              },
              {
                label: "Does this sometimes",
                score: 65,
              },
              {
                label: "Attempts it but hands don't coordinate well yet",
                score: 40,
              },
              {
                label: "Mostly uses one hand at a time",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child pull off loose clothing items like socks or a hat by themselves?",
            options: [
              {
                label: "Yes, pulls these off independently",
                score: 90,
              },
              {
                label: "Can do this with a little help",
                score: 65,
              },
              {
                label: "Attempts it but needs a lot of help",
                score: 40,
              },
              {
                label: "Not yet able to do this",
                score: 15,
              },
            ],
          },
        ],
        Cognition: [
          "Does your child imitate a simple two-step action, like opening then closing a lid?",
          "Does your child know which arm or leg goes where when getting dressed, like offering the correct arm for a sleeve?",
        ],
        Engagement: [
          {
            text: "Does your child look at your hands or face when you're helping them get dressed, following what you're doing?",
            options: [
              {
                label: "Yes, watches closely and follows along",
                score: 90,
              },
              {
                label: "Watches sometimes, gets distracted easily",
                score: 65,
              },
              {
                label: "Only looks if I get their attention first",
                score: 40,
              },
              {
                label: "Doesn't tend to watch my hands or face",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child respond to simple dressing instructions like 'lift your arms' or 'put your arm in'?",
            options: [
              {
                label: "Yes, responds to the instruction right away",
                score: 90,
              },
              {
                label: "Responds sometimes, needs it repeated",
                score: 65,
              },
              {
                label: "Only responds with a physical prompt too",
                score: 40,
              },
              {
                label: "Doesn't yet respond to the instruction",
                score: 15,
              },
            ],
          },
        ],
      },
      preschool: {
        Sensory: [
          {
            text: "How aware does your child seem of where their fingers are when handling small fasteners like buttons?",
            options: [
              {
                label: "Very aware — finds and positions fingers precisely",
                score: 90,
              },
              {
                label: "Reasonably aware, fumbles occasionally",
                score: 65,
              },
              {
                label: "Often fumbles or misjudges finger position",
                score: 40,
              },
              {
                label: "Seems unaware of where their fingers are",
                score: 15,
              },
            ],
          },
          {
            text: "How does your child react to the resistance of pushing a button through a tight buttonhole?",
            options: [
              {
                label: "Pushes through calmly, adjusts pressure as needed",
                score: 90,
              },
              {
                label: "Manages it, gets briefly frustrated",
                score: 65,
              },
              {
                label: "Reacts strongly to the resistance (frustration, giving up)",
                score: 40,
              },
              {
                label: "Avoids or refuses tight buttonholes altogether",
                score: 15,
              },
            ],
          },
        ],
        Motor: [
          {
            text: "Can your child hold fabric steady with one hand while attempting to push a button through with the other?",
            options: [
              {
                label: "Yes, holds fabric steady while the other hand works",
                score: 90,
              },
              {
                label: "Can do this with some effort",
                score: 65,
              },
              {
                label: "Attempts it but fabric slips or moves",
                score: 40,
              },
              {
                label: "Not yet able to coordinate both hands this way",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child manage large buttons or snaps, like on a coat, even if small shirt buttons are still tricky?",
            options: [
              {
                label: "Yes, manages large fasteners independently",
                score: 90,
              },
              {
                label: "Can do this with a little help",
                score: 65,
              },
              {
                label: "Attempts it but needs a lot of support",
                score: 40,
              },
              {
                label: "Not yet able to manage large fasteners",
                score: 15,
              },
            ],
          },
        ],
        Cognition: [
          "Does your child understand the order needed to fasten something — line up the hole, then push the button through?",
          "Does your child know which side of a shirt the buttons go on, or that a shirt has a front and back?",
        ],
        Engagement: [
          {
            text: "Does your child watch closely and imitate your hand movements when you demonstrate buttoning slowly?",
            options: [
              {
                label: "Yes, watches and imitates the movement",
                score: 90,
              },
              {
                label: "Watches, but copies only part of it",
                score: 65,
              },
              {
                label: "Watches but doesn't attempt to copy",
                score: 40,
              },
              {
                label: "Doesn't watch closely when I demonstrate",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child tell you or show you which step of dressing they're stuck on?",
            options: [
              {
                label: "Yes, points to or explains exactly where they're stuck",
                score: 90,
              },
              {
                label: "Shows frustration but not the exact spot",
                score: 65,
              },
              {
                label: "Only communicates this with a lot of prompting",
                score: 40,
              },
              {
                label: "Doesn't yet show or tell me where they're stuck",
                score: 15,
              },
            ],
          },
        ],
      },
      school: {
        Sensory: [
          {
            text: "Can your child adjust their finger positioning to line up a button and buttonhole without looking closely?",
            options: [
              {
                label: "Yes, positions fingers accurately by feel",
                score: 90,
              },
              {
                label: "Manages this most of the time",
                score: 65,
              },
              {
                label: "Needs to look closely most of the time",
                score: 40,
              },
              {
                label: "Can't line things up without looking directly and carefully",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child tolerate working with small, fiddly buttons for a full task without frustration?",
            options: [
              {
                label: "Yes, stays calm through the whole task",
                score: 90,
              },
              {
                label: "Tolerates it, with some visible frustration",
                score: 65,
              },
              {
                label: "Gets frustrated partway through",
                score: 40,
              },
              {
                label: "Can't tolerate small, fiddly buttons at all",
                score: 15,
              },
            ],
          },
        ],
        Motor: [
          {
            text: "Can your child button and unbutton a shirt using both hands in a coordinated way?",
            options: [
              {
                label: "Yes, does this smoothly with both hands",
                score: 90,
              },
              {
                label: "Can do this with some effort",
                score: 65,
              },
              {
                label: "Attempts it but hands don't coordinate well",
                score: 40,
              },
              {
                label: "Not yet able to do this",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child manage a full row of shirt buttons top to bottom without losing their place?",
            options: [
              {
                label: "Yes, completes the full row without losing their place",
                score: 90,
              },
              {
                label: "Usually manages, occasionally skips one",
                score: 65,
              },
              {
                label: "Loses their place partway through most times",
                score: 40,
              },
              {
                label: "Not yet able to manage a full row",
                score: 15,
              },
            ],
          },
        ],
        Cognition: [
          "Does your child solve it themselves when a button gets stuck or misaligned, without asking for help right away?",
          "Does your child notice on their own when a button is done up wrong, like a skipped hole, and fix it?",
        ],
        Engagement: [
          {
            text: "Does your child notice your facial cues, like frustration or encouragement, while practicing buttoning together?",
            options: [
              {
                label: "Yes, picks up on my expression and reacts to it",
                score: 90,
              },
              {
                label: "Notices sometimes, but not consistently",
                score: 65,
              },
              {
                label: "Only responds if I say it out loud",
                score: 40,
              },
              {
                label: "Doesn't seem to notice my expressions",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child explain in words what's going wrong when a button won't fasten?",
            options: [
              {
                label: "Yes, describes the problem clearly",
                score: 90,
              },
              {
                label: "Explains it, but vaguely",
                score: 65,
              },
              {
                label: "Says they're stuck but can't describe why",
                score: 40,
              },
              {
                label: "Doesn't yet explain what's wrong",
                score: 15,
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "reading",
    name: "Make Reading Easy",
    clinical: "Visual-Motor Integration & Eye-Hand Coordination",
    formula: {
      toddler: {
        Sensory: 30,
        Motor: 10,
        Cognition: 10,
        Engagement: 50,
      },
      preschool: {
        Sensory: 20,
        Motor: 10,
        Cognition: 35,
        Engagement: 35,
      },
      school: {
        Sensory: 15,
        Motor: 10,
        Cognition: 55,
        Engagement: 20,
      },
    },
    questions: {
      toddler: {
        Sensory: [
          {
            text: "How does your child respond to picture books — do they look at and follow pictures or movement on the page?",
            options: [
              {
                label: "Looks at and follows pictures closely",
                score: 90,
              },
              {
                label: "Looks sometimes, attention comes and goes",
                score: 65,
              },
              {
                label: "Glances briefly, rarely stays focused on the page",
                score: 40,
              },
              {
                label: "Doesn't seem to look at or follow pictures",
                score: 15,
              },
            ],
          },
          {
            text: "How does your child respond to sitting still for a story — do they seem restless or settled?",
            options: [
              {
                label: "Settles easily and sits through a story",
                score: 90,
              },
              {
                label: "Settles for a bit, then gets restless",
                score: 65,
              },
              {
                label: "Restless most of the time during stories",
                score: 40,
              },
              {
                label: "Can't settle for a story at all",
                score: 15,
              },
            ],
          },
        ],
        Motor: [
          {
            text: "Can your child turn board book pages, even clumsily, or point to pictures?",
            options: [
              {
                label: "Yes, turns pages and points independently",
                score: 90,
              },
              {
                label: "Can do this with some effort",
                score: 65,
              },
              {
                label: "Attempts it but needs a lot of help",
                score: 40,
              },
              {
                label: "Not yet able to do this",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child hold a book the right way up and open it from the front?",
            options: [
              {
                label: "Yes, holds and opens it correctly",
                score: 90,
              },
              {
                label: "Does this most of the time",
                score: 65,
              },
              {
                label: "Attempts it but often upside down or from the back",
                score: 40,
              },
              {
                label: "Not yet able to do this",
                score: 15,
              },
            ],
          },
        ],
        Cognition: [
          "Does your child recognize a familiar picture or object in a book and react to it?",
          "Does your child understand a simple story sequence, like turning the page to see what happens next?",
        ],
        Engagement: [
          {
            text: "Does your child follow your gaze or pointing finger to look at a picture you're both looking at?",
            options: [
              {
                label: "Yes, follows my gaze or point every time",
                score: 90,
              },
              {
                label: "Follows it sometimes",
                score: 65,
              },
              {
                label: "Only follows if I also tap the picture",
                score: 40,
              },
              {
                label: "Doesn't yet follow my gaze or point",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child babble, point, or use single words to react to a picture in a book?",
            options: [
              {
                label: "Yes, reacts with sounds, points or words",
                score: 90,
              },
              {
                label: "Reacts sometimes, but not consistently",
                score: 65,
              },
              {
                label: "Reacts only if I prompt them first",
                score: 40,
              },
              {
                label: "Doesn't yet react to pictures this way",
                score: 15,
              },
            ],
          },
        ],
      },
      preschool: {
        Sensory: [
          {
            text: "Can your child's eyes follow a moving object, or a finger tracing left to right?",
            options: [
              {
                label: "Yes, tracks smoothly left to right",
                score: 90,
              },
              {
                label: "Tracks most of the time, loses it occasionally",
                score: 65,
              },
              {
                label: "Tracks briefly, then loses focus",
                score: 40,
              },
              {
                label: "Not yet able to track this way",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child seem to lose their visual place easily on a page with a lot going on?",
            options: [
              {
                label: "No, stays oriented even on busy pages",
                score: 90,
              },
              {
                label: "Loses their place occasionally",
                score: 65,
              },
              {
                label: "Loses their place often on busy pages",
                score: 40,
              },
              {
                label: "Gets overwhelmed and disengages on busy pages",
                score: 15,
              },
            ],
          },
        ],
        Motor: [
          {
            text: "Can your child point to and follow along with words or pictures as you read?",
            options: [
              {
                label: "Yes, points and follows along consistently",
                score: 90,
              },
              {
                label: "Does this sometimes",
                score: 65,
              },
              {
                label: "Attempts it but loses track quickly",
                score: 40,
              },
              {
                label: "Not yet able to do this",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child point to individual words as they're read aloud, roughly keeping pace?",
            options: [
              {
                label: "Yes, keeps pace reasonably well",
                score: 90,
              },
              {
                label: "Keeps pace for a little while, then falls behind",
                score: 65,
              },
              {
                label: "Points, but well behind or ahead of the words",
                score: 40,
              },
              {
                label: "Not yet able to do this",
                score: 15,
              },
            ],
          },
        ],
        Cognition: [
          "Does your child match two identical pictures, letters, or shapes when looking at a page?",
          "Does your child answer a simple question about a story you just read, like 'who was in it?'",
        ],
        Engagement: [
          {
            text: "Does your child share attention with you during a book — looking between the page and your face — rather than only looking at the book alone?",
            options: [
              {
                label: "Yes, checks in with me regularly while we read",
                score: 90,
              },
              {
                label: "Does this sometimes, mostly looks at the book",
                score: 65,
              },
              {
                label: "Only looks at me if I say their name",
                score: 40,
              },
              {
                label: "Stays focused on the book, doesn't look up",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child answer a simple 'what' or 'where' question about a picture using words?",
            options: [
              {
                label: "Yes, answers clearly in words",
                score: 90,
              },
              {
                label: "Answers sometimes, or with just a point",
                score: 65,
              },
              {
                label: "Only answers with a lot of prompting",
                score: 40,
              },
              {
                label: "Doesn't yet answer this kind of question",
                score: 15,
              },
            ],
          },
        ],
      },
      school: {
        Sensory: [
          {
            text: "Does your child's gaze track smoothly along a line of text without losing their place?",
            options: [
              {
                label: "Yes, tracks smoothly along the line",
                score: 90,
              },
              {
                label: "Tracks fairly well, loses their place occasionally",
                score: 65,
              },
              {
                label: "Often loses their place mid-line",
                score: 40,
              },
              {
                label: "Struggles to track a line of text at all",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child complain of tired eyes, or lose their place, during longer reading sessions?",
            options: [
              {
                label: "No, reads for a good stretch without issue",
                score: 90,
              },
              {
                label: "Mentions tired eyes occasionally on long sessions",
                score: 65,
              },
              {
                label: "Often complains of tired eyes or loses their place",
                score: 40,
              },
              {
                label: "Can't sustain more than a couple of minutes before this happens",
                score: 15,
              },
            ],
          },
        ],
        Motor: [
          {
            text: "Can your child use a finger or a bookmark to track their place while reading?",
            options: [
              {
                label: "Yes, uses a finger or bookmark effectively",
                score: 90,
              },
              {
                label: "Uses it sometimes",
                score: 65,
              },
              {
                label: "Attempts it but still loses their place",
                score: 40,
              },
              {
                label: "Not yet able to use this strategy",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child hold a book and turn pages while maintaining their place, without help?",
            options: [
              {
                label: "Yes, manages this independently",
                score: 90,
              },
              {
                label: "Manages with occasional help",
                score: 65,
              },
              {
                label: "Needs help most of the time",
                score: 40,
              },
              {
                label: "Not yet able to do this independently",
                score: 15,
              },
            ],
          },
        ],
        Cognition: [
          "Does your child recognize familiar letters or sight words and connect them to their sounds?",
          "Does your child sound out an unfamiliar word using letter sounds, rather than guessing from the picture?",
        ],
        Engagement: [
          {
            text: "Does your child pick up on your tone of voice or expression to understand a story's mood?",
            options: [
              {
                label: "Yes, picks up on tone and reacts to the mood",
                score: 90,
              },
              {
                label: "Picks up on it sometimes",
                score: 65,
              },
              {
                label: "Only understands if I explain the mood directly",
                score: 40,
              },
              {
                label: "Doesn't seem to pick up on tone or expression",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child retell part of a story in their own words, or ask a relevant question about it?",
            options: [
              {
                label: "Yes, retells or asks a relevant question easily",
                score: 90,
              },
              {
                label: "Can do this with some prompting",
                score: 65,
              },
              {
                label: "Only repeats a word or phrase, not a full idea",
                score: 40,
              },
              {
                label: "Doesn't yet retell or ask about the story",
                score: 15,
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "scissors",
    name: "Learn to Use Scissors",
    clinical: "Tool Use Foundations & Functional Grasp",
    formula: {
      toddler: {
        Sensory: 25,
        Motor: 50,
        Cognition: 5,
        Engagement: 20,
      },
      preschool: {
        Sensory: 15,
        Motor: 55,
        Cognition: 15,
        Engagement: 15,
      },
      school: {
        Sensory: 10,
        Motor: 55,
        Cognition: 25,
        Engagement: 10,
      },
    },
    questions: {
      toddler: {
        Sensory: [
          {
            text: "How does your child respond to squeezing textured toys, playdough, or tearing paper?",
            options: [
              {
                label: "Enjoys and engages comfortably with these textures",
                score: 90,
              },
              {
                label: "Engages fine, occasionally reacts to something new",
                score: 65,
              },
              {
                label: "Reacts strongly to certain textures (avoids or overreacts)",
                score: 40,
              },
              {
                label: "Consistently avoids textured or resistant materials",
                score: 15,
              },
            ],
          },
          {
            text: "How does your child react to the sound or resistance of paper tearing near their hands?",
            options: [
              {
                label: "Unbothered by the sound or resistance",
                score: 90,
              },
              {
                label: "Reacts briefly, then settles",
                score: 65,
              },
              {
                label: "Reacts strongly (covers ears, pulls away)",
                score: 40,
              },
              {
                label: "Avoids the activity altogether because of this",
                score: 15,
              },
            ],
          },
        ],
        Motor: [
          {
            text: "Can your child use two hands together, like pulling apart playdough or tearing paper?",
            options: [
              {
                label: "Yes, coordinates both hands well",
                score: 90,
              },
              {
                label: "Can do this with some effort",
                score: 65,
              },
              {
                label: "Attempts it but hands don't coordinate well",
                score: 40,
              },
              {
                label: "Not yet able to do this",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child snip with safety scissors even once or twice, with hand-over-hand help?",
            options: [
              {
                label: "Yes, manages a snip or two with help",
                score: 90,
              },
              {
                label: "Attempts it with a lot of hand-over-hand support",
                score: 65,
              },
              {
                label: "Holds the scissors but can't yet snip, even with help",
                score: 40,
              },
              {
                label: "Not yet willing or able to try",
                score: 15,
              },
            ],
          },
        ],
        Cognition: [
          "Does your child imitate a simple tool action, like pretending to cut or stir?",
          "Does your child understand that scissors are for cutting, different from other toys or tools?",
        ],
        Engagement: [
          {
            text: "Does your child watch your hands closely when you demonstrate tearing or squeezing something?",
            options: [
              {
                label: "Yes, watches closely every time",
                score: 90,
              },
              {
                label: "Watches sometimes, gets distracted",
                score: 65,
              },
              {
                label: "Only watches if I get their attention first",
                score: 40,
              },
              {
                label: "Doesn't tend to watch closely",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child respond to a simple instruction like 'give it to me' or 'like this' during play with tools?",
            options: [
              {
                label: "Yes, responds to the instruction right away",
                score: 90,
              },
              {
                label: "Responds sometimes, needs it repeated",
                score: 65,
              },
              {
                label: "Only responds with a gesture prompt too",
                score: 40,
              },
              {
                label: "Doesn't yet respond to this instruction",
                score: 15,
              },
            ],
          },
        ],
      },
      preschool: {
        Sensory: [
          {
            text: "How does your child react to the feel and resistance of paper when tearing or attempting to cut it?",
            options: [
              {
                label: "Comfortable with the resistance, adjusts easily",
                score: 90,
              },
              {
                label: "Manages it fine, occasionally frustrated",
                score: 65,
              },
              {
                label: "Reacts strongly to the resistance",
                score: 40,
              },
              {
                label: "Avoids tearing or cutting activities because of this",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child avoid activities involving cutting or tearing textured materials?",
            options: [
              {
                label: "No, joins in without hesitation",
                score: 90,
              },
              {
                label: "Joins in, but hesitates at first",
                score: 65,
              },
              {
                label: "Often avoids these activities",
                score: 40,
              },
              {
                label: "Consistently refuses to take part",
                score: 15,
              },
            ],
          },
        ],
        Motor: [
          {
            text: "Can your child open and close child-safe scissors with one hand while the other holds the paper?",
            options: [
              {
                label: "Yes, coordinates both hands well",
                score: 90,
              },
              {
                label: "Can do this with some effort",
                score: 65,
              },
              {
                label: "Attempts it but one hand does most of the work",
                score: 40,
              },
              {
                label: "Not yet able to coordinate both hands this way",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child make small snips into the edge of a piece of paper independently?",
            options: [
              {
                label: "Yes, makes clean snips independently",
                score: 90,
              },
              {
                label: "Can do this with a little help",
                score: 65,
              },
              {
                label: "Attempts it but needs a lot of support",
                score: 40,
              },
              {
                label: "Not yet able to do this",
                score: 15,
              },
            ],
          },
        ],
        Cognition: [
          "Does your child understand how to hold paper so the scissors can cut it, not just hold the scissors?",
          "Does your child turn the paper, rather than just the scissors, to follow a curved line?",
        ],
        Engagement: [
          {
            text: "Does your child look to you for guidance — checking your face or hands — before attempting to cut?",
            options: [
              {
                label: "Yes, checks in with me before trying",
                score: 90,
              },
              {
                label: "Checks sometimes, other times just tries",
                score: 65,
              },
              {
                label: "Only checks if I remind them to look first",
                score: 40,
              },
              {
                label: "Doesn't check in, just goes ahead",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child tell you which part they want to cut, or ask for help when scissors won't work?",
            options: [
              {
                label: "Yes, tells me clearly what they need",
                score: 90,
              },
              {
                label: "Sometimes tells me, other times gets frustrated instead",
                score: 65,
              },
              {
                label: "Only communicates this with a lot of prompting",
                score: 40,
              },
              {
                label: "Doesn't yet ask or explain",
                score: 15,
              },
            ],
          },
        ],
      },
      school: {
        Sensory: [
          {
            text: "Does your child sense how much pressure to apply when cutting different types of paper?",
            options: [
              {
                label: "Yes, adjusts pressure appropriately for the material",
                score: 90,
              },
              {
                label: "Mostly appropriate, occasionally too much or too little",
                score: 65,
              },
              {
                label: "Often uses too much or too little pressure",
                score: 40,
              },
              {
                label: "Seems unaware of how much pressure they're using",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child tolerate the resistance of scissors cutting thicker materials like cardstock?",
            options: [
              {
                label: "Yes, cuts through thicker materials without issue",
                score: 90,
              },
              {
                label: "Manages it, with some extra effort",
                score: 65,
              },
              {
                label: "Gets frustrated with thicker materials",
                score: 40,
              },
              {
                label: "Avoids or refuses thicker materials",
                score: 15,
              },
            ],
          },
        ],
        Motor: [
          {
            text: "Can your child cut along a straight or curved line with scissors?",
            options: [
              {
                label: "Yes, cuts accurately along the line",
                score: 90,
              },
              {
                label: "Cuts close to the line most of the time",
                score: 65,
              },
              {
                label: "Attempts it but drifts noticeably from the line",
                score: 40,
              },
              {
                label: "Not yet able to follow a line while cutting",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child cut out complex shapes with curves and corners with control?",
            options: [
              {
                label: "Yes, manages complex shapes with control",
                score: 90,
              },
              {
                label: "Manages simple curves, struggles with sharp corners",
                score: 65,
              },
              {
                label: "Attempts it but the shape comes out quite rough",
                score: 40,
              },
              {
                label: "Not yet able to cut complex shapes",
                score: 15,
              },
            ],
          },
        ],
        Cognition: [
          "Does your child follow a printed line accurately when cutting out a shape?",
          "Does your child plan the order to cut a shape out so pieces don't fall or get lost?",
        ],
        Engagement: [
          {
            text: "Does your child notice non-verbal safety cues, like you moving their hand away from the blade?",
            options: [
              {
                label: "Yes, notices and adjusts right away",
                score: 90,
              },
              {
                label: "Notices sometimes, but not always",
                score: 65,
              },
              {
                label: "Only stops if I say something out loud",
                score: 40,
              },
              {
                label: "Doesn't seem to notice this cue",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child explain in words what went wrong if a cut doesn't come out right?",
            options: [
              {
                label: "Yes, explains clearly what happened",
                score: 90,
              },
              {
                label: "Explains it, but vaguely",
                score: 65,
              },
              {
                label: "Says it's wrong but can't say why",
                score: 40,
              },
              {
                label: "Doesn't yet explain what went wrong",
                score: 15,
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "colour-lines",
    name: "Colour Inside the Lines",
    clinical: "Pre-Handwriting Patterns & Line Mastery",
    formula: {
      toddler: {
        Sensory: 30,
        Motor: 40,
        Cognition: 5,
        Engagement: 25,
      },
      preschool: {
        Sensory: 20,
        Motor: 40,
        Cognition: 25,
        Engagement: 15,
      },
      school: {
        Sensory: 10,
        Motor: 35,
        Cognition: 45,
        Engagement: 10,
      },
    },
    questions: {
      toddler: {
        Sensory: [
          {
            text: "Does your child notice edges or boundaries on a page during scribbling, like the page edge?",
            options: [
              {
                label: "Yes, notices and stays within the page",
                score: 90,
              },
              {
                label: "Notices sometimes, scribbles off the edge occasionally",
                score: 65,
              },
              {
                label: "Rarely notices, often scribbles off the page",
                score: 40,
              },
              {
                label: "Doesn't seem to notice the page edge at all",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child show a strong preference or aversion to certain crayon or marker textures?",
            options: [
              {
                label: "No, comfortable with a range of textures",
                score: 90,
              },
              {
                label: "Mild preferences, but uses most textures fine",
                score: 65,
              },
              {
                label: "Strong preference or aversion to certain textures",
                score: 40,
              },
              {
                label: "Refuses to use anything outside one preferred texture",
                score: 15,
              },
            ],
          },
        ],
        Motor: [
          {
            text: "How controlled are your child's scribbles — can they make back-and-forth or circular motions?",
            options: [
              {
                label: "Makes controlled back-and-forth and circular motions",
                score: 90,
              },
              {
                label: "Makes these motions sometimes, still fairly random",
                score: 65,
              },
              {
                label: "Scribbles are mostly random, little controlled motion",
                score: 40,
              },
              {
                label: "Not yet making purposeful scribble motions",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child hold a crayon with a whole-hand grasp and make a variety of scribble patterns?",
            options: [
              {
                label: "Yes, makes a variety of patterns",
                score: 90,
              },
              {
                label: "Makes one or two patterns repeatedly",
                score: 65,
              },
              {
                label: "Attempts it but patterns are very limited",
                score: 40,
              },
              {
                label: "Not yet making varied scribble patterns",
                score: 15,
              },
            ],
          },
        ],
        Cognition: [
          "Does your child understand a simple instruction like 'color the ball'?",
          "Does your child point out or name colors while coloring, even roughly?",
        ],
        Engagement: [
          {
            text: "Does your child look at you for reactions, like smiling or pointing, while scribbling together?",
            options: [
              {
                label: "Yes, checks in with me regularly",
                score: 90,
              },
              {
                label: "Checks in sometimes",
                score: 65,
              },
              {
                label: "Only looks up if I say something",
                score: 40,
              },
              {
                label: "Stays focused on the page, doesn't look up",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child respond to simple requests like 'color the ball' with a gesture or attempt?",
            options: [
              {
                label: "Yes, responds with an attempt right away",
                score: 90,
              },
              {
                label: "Responds sometimes, needs it repeated",
                score: 65,
              },
              {
                label: "Only responds if I point to the spot too",
                score: 40,
              },
              {
                label: "Doesn't yet respond to this request",
                score: 15,
              },
            ],
          },
        ],
      },
      preschool: {
        Sensory: [
          {
            text: "Does your child seem to notice when their coloring goes outside a shape's outline?",
            options: [
              {
                label: "Yes, notices and tries to correct it",
                score: 90,
              },
              {
                label: "Notices sometimes",
                score: 65,
              },
              {
                label: "Rarely notices going outside the lines",
                score: 40,
              },
              {
                label: "Doesn't seem to notice at all",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child notice or react to the pressure needed to make a mark show up on the page?",
            options: [
              {
                label: "Yes, adjusts pressure appropriately",
                score: 90,
              },
              {
                label: "Adjusts most of the time",
                score: 65,
              },
              {
                label: "Often presses too hard or too lightly",
                score: 40,
              },
              {
                label: "Seems unaware of the pressure needed",
                score: 15,
              },
            ],
          },
        ],
        Motor: [
          {
            text: "Can your child color with some control, staying mostly within a large shape?",
            options: [
              {
                label: "Yes, stays mostly within the shape",
                score: 90,
              },
              {
                label: "Stays within it partially, drifts outside sometimes",
                score: 65,
              },
              {
                label: "Attempts it but colors outside the shape often",
                score: 40,
              },
              {
                label: "Not yet able to stay within a large shape",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child stay on a large picture for more than a minute without wandering off the page?",
            options: [
              {
                label: "Yes, stays focused on the picture for a while",
                score: 90,
              },
              {
                label: "Stays on it for about a minute",
                score: 65,
              },
              {
                label: "Wanders off the page fairly quickly",
                score: 40,
              },
              {
                label: "Can't stay on the picture even briefly",
                score: 15,
              },
            ],
          },
        ],
        Cognition: [
          "Does your child understand the goal of staying inside a shape's lines when coloring?",
          "Does your child pick colors that make sense for the picture, like blue for the sky?",
        ],
        Engagement: [
          {
            text: "Does your child check your face for approval or reaction while coloring a picture?",
            options: [
              {
                label: "Yes, checks my reaction regularly",
                score: 90,
              },
              {
                label: "Checks sometimes",
                score: 65,
              },
              {
                label: "Only checks once they've finished",
                score: 40,
              },
              {
                label: "Doesn't tend to check in while coloring",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child tell you what they're coloring or ask which color to use?",
            options: [
              {
                label: "Yes, tells me or asks clearly",
                score: 90,
              },
              {
                label: "Does this sometimes",
                score: 65,
              },
              {
                label: "Only responds if I ask them directly",
                score: 40,
              },
              {
                label: "Doesn't yet tell me or ask",
                score: 15,
              },
            ],
          },
        ],
      },
      school: {
        Sensory: [
          {
            text: "Can your child sense, without much looking, how close their crayon is to a line's edge?",
            options: [
              {
                label: "Yes, senses this well without looking closely",
                score: 90,
              },
              {
                label: "Manages this most of the time",
                score: 65,
              },
              {
                label: "Needs to look closely most of the time",
                score: 40,
              },
              {
                label: "Can't judge this without looking directly and carefully",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child regulate the pressure needed for a light sketch vs a solid fill?",
            options: [
              {
                label: "Yes, adjusts pressure for each purpose",
                score: 90,
              },
              {
                label: "Adjusts most of the time",
                score: 65,
              },
              {
                label: "Uses about the same pressure regardless of purpose",
                score: 40,
              },
              {
                label: "Can't yet vary their pressure this way",
                score: 15,
              },
            ],
          },
        ],
        Motor: [
          {
            text: "Can your child color within the lines of a smaller, more detailed shape consistently?",
            options: [
              {
                label: "Yes, stays within detailed shapes consistently",
                score: 90,
              },
              {
                label: "Stays within them most of the time",
                score: 65,
              },
              {
                label: "Attempts it but drifts outside often on smaller shapes",
                score: 40,
              },
              {
                label: "Not yet able to color within detailed shapes",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child switch between filling large areas and outlining small details with equal control?",
            options: [
              {
                label: "Yes, switches between both with equal control",
                score: 90,
              },
              {
                label: "Manages one better than the other, but does both",
                score: 65,
              },
              {
                label: "Struggles noticeably with one of the two",
                score: 40,
              },
              {
                label: "Not yet able to do either with good control",
                score: 15,
              },
            ],
          },
        ],
        Cognition: [
          "Does your child plan which direction to stroke the crayon to fill a shape neatly?",
          "Does your child decide which section of a picture to color first to avoid smudging?",
        ],
        Engagement: [
          {
            text: "Does your child notice if you seem impressed or concerned about their coloring, without you saying so directly?",
            options: [
              {
                label: "Yes, picks up on my reaction without me saying anything",
                score: 90,
              },
              {
                label: "Notices sometimes",
                score: 65,
              },
              {
                label: "Only notices if I say it out loud",
                score: 40,
              },
              {
                label: "Doesn't seem to pick up on this",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child describe their finished picture or explain a choice they made while coloring?",
            options: [
              {
                label: "Yes, describes it or explains their choices clearly",
                score: 90,
              },
              {
                label: "Can do this with some prompting",
                score: 65,
              },
              {
                label: "Only gives a one-word answer",
                score: 40,
              },
              {
                label: "Doesn't yet describe or explain",
                score: 15,
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "copy-words",
    name: "Copy Words Correctly",
    clinical: "Visual Scanning, Tracking & Matching",
    formula: {
      toddler: {
        Sensory: 25,
        Motor: 15,
        Cognition: 15,
        Engagement: 45,
      },
      preschool: {
        Sensory: 15,
        Motor: 15,
        Cognition: 40,
        Engagement: 30,
      },
      school: {
        Sensory: 10,
        Motor: 15,
        Cognition: 60,
        Engagement: 15,
      },
    },
    questions: {
      toddler: {
        Sensory: [
          {
            text: "Does your child notice differences between similar objects or pictures — big vs small, same vs different?",
            options: [
              {
                label: "Yes, notices these differences reliably",
                score: 90,
              },
              {
                label: "Notices sometimes",
                score: 65,
              },
              {
                label: "Rarely notices without help",
                score: 40,
              },
              {
                label: "Doesn't yet notice these differences",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child seem overwhelmed by busy visual pages with lots of small pictures or text?",
            options: [
              {
                label: "No, engages with busy pages just fine",
                score: 90,
              },
              {
                label: "Manages it, but takes a little longer to settle",
                score: 65,
              },
              {
                label: "Often seems overwhelmed by busy pages",
                score: 40,
              },
              {
                label: "Avoids or disengages from busy pages entirely",
                score: 15,
              },
            ],
          },
        ],
        Motor: [
          {
            text: "Can your child make purposeful marks that resemble what they're looking at, even roughly?",
            options: [
              {
                label: "Yes, makes marks that clearly relate to what they see",
                score: 90,
              },
              {
                label: "Makes an attempt, roughly related",
                score: 65,
              },
              {
                label: "Marks are mostly unrelated to what they're looking at",
                score: 40,
              },
              {
                label: "Not yet making purposeful marks",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child imitate a simple gesture or hand motion right after seeing it?",
            options: [
              {
                label: "Yes, imitates the motion right away",
                score: 90,
              },
              {
                label: "Imitates it with a little practice",
                score: 65,
              },
              {
                label: "Attempts it but the motion is quite different",
                score: 40,
              },
              {
                label: "Not yet able to imitate the motion",
                score: 15,
              },
            ],
          },
        ],
        Cognition: [
          "Does your child notice when two pictures or objects are different from each other?",
          "Does your child scan across a row of pictures with their eyes, from one side to the other?",
        ],
        Engagement: [
          {
            text: "Does your child look between you and an object when you point something out for them to notice?",
            options: [
              {
                label: "Yes, looks back and forth to check",
                score: 90,
              },
              {
                label: "Does this sometimes",
                score: 65,
              },
              {
                label: "Only looks if I say their name first",
                score: 40,
              },
              {
                label: "Doesn't yet look back and forth this way",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child use a word or gesture to show you they've spotted something the same or different?",
            options: [
              {
                label: "Yes, points or says something to show me",
                score: 90,
              },
              {
                label: "Does this sometimes",
                score: 65,
              },
              {
                label: "Only reacts if I ask them directly",
                score: 40,
              },
              {
                label: "Doesn't yet show me this way",
                score: 15,
              },
            ],
          },
        ],
      },
      preschool: {
        Sensory: [
          {
            text: "Can your child spot the difference between two similar shapes or letters placed side by side?",
            options: [
              {
                label: "Yes, spots the difference reliably",
                score: 90,
              },
              {
                label: "Spots it most of the time",
                score: 65,
              },
              {
                label: "Needs help spotting the difference",
                score: 40,
              },
              {
                label: "Not yet able to spot the difference",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child squint, tilt their head, or get frustrated looking at small print or shapes?",
            options: [
              {
                label: "No, looks at small print or shapes comfortably",
                score: 90,
              },
              {
                label: "Occasionally squints or tilts their head",
                score: 65,
              },
              {
                label: "Often squints, tilts, or gets frustrated",
                score: 40,
              },
              {
                label: "Avoids small print or shapes altogether",
                score: 15,
              },
            ],
          },
        ],
        Motor: [
          {
            text: "Can your child copy a simple shape, like a circle or cross, with reasonable accuracy?",
            options: [
              {
                label: "Yes, copies the shape accurately",
                score: 90,
              },
              {
                label: "Copies it reasonably well, with some wobble",
                score: 65,
              },
              {
                label: "Attempts it but the shape is quite different",
                score: 40,
              },
              {
                label: "Not yet able to copy the shape",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child trace over a dotted shape or letter, staying mostly on the line?",
            options: [
              {
                label: "Yes, stays mostly on the line",
                score: 90,
              },
              {
                label: "Stays on it partially, drifts sometimes",
                score: 65,
              },
              {
                label: "Attempts it but drifts off the line often",
                score: 40,
              },
              {
                label: "Not yet able to trace along a dotted line",
                score: 15,
              },
            ],
          },
        ],
        Cognition: [
          "Does your child find a matching shape or letter among a group of similar-looking ones?",
          "Does your child scan left to right in a consistent way when looking at a row of items?",
        ],
        Engagement: [
          {
            text: "Does your child glance at you to check they're copying correctly?",
            options: [
              {
                label: "Yes, checks in with me regularly",
                score: 90,
              },
              {
                label: "Checks sometimes",
                score: 65,
              },
              {
                label: "Only checks once they're finished",
                score: 40,
              },
              {
                label: "Doesn't tend to check in while copying",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child tell you when they think a copied shape or letter doesn't look right?",
            options: [
              {
                label: "Yes, tells me clearly when something's off",
                score: 90,
              },
              {
                label: "Notices sometimes, but doesn't always say so",
                score: 65,
              },
              {
                label: "Only agrees if I point it out first",
                score: 40,
              },
              {
                label: "Doesn't yet notice or say anything",
                score: 15,
              },
            ],
          },
        ],
      },
      school: {
        Sensory: [
          {
            text: "Can your child visually tell apart similar-looking letters, like b/d or p/q?",
            options: [
              {
                label: "Yes, tells these apart reliably",
                score: 90,
              },
              {
                label: "Tells them apart most of the time",
                score: 65,
              },
              {
                label: "Mixes these up fairly often",
                score: 40,
              },
              {
                label: "Consistently mixes up similar-looking letters",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child lose their place easily when copying from a book or the board?",
            options: [
              {
                label: "No, keeps their place well when copying",
                score: 90,
              },
              {
                label: "Loses their place occasionally",
                score: 65,
              },
              {
                label: "Loses their place often",
                score: 40,
              },
              {
                label: "Struggles to keep their place at all",
                score: 15,
              },
            ],
          },
        ],
        Motor: [
          {
            text: "Can your child copy individual letters or short words with reasonably accurate formation?",
            options: [
              {
                label: "Yes, forms letters and words accurately",
                score: 90,
              },
              {
                label: "Forms them reasonably well, with some inconsistency",
                score: 65,
              },
              {
                label: "Attempts it but formation is hard to read",
                score: 40,
              },
              {
                label: "Not yet able to form letters accurately",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child write a full short word without the letters drifting in size or spacing?",
            options: [
              {
                label: "Yes, keeps size and spacing consistent",
                score: 90,
              },
              {
                label: "Mostly consistent, with occasional drift",
                score: 65,
              },
              {
                label: "Size or spacing drifts noticeably across the word",
                score: 40,
              },
              {
                label: "Not yet able to keep size or spacing consistent",
                score: 15,
              },
            ],
          },
        ],
        Cognition: [
          "Does your child reproduce the letters of a model word in the correct order when copying it?",
          "Does your child notice and correct their own mistake if a copied letter is wrong?",
        ],
        Engagement: [
          {
            text: "Does your child pick up on subtle hints, like you tapping the model, to notice their own mistake?",
            options: [
              {
                label: "Yes, picks up on the hint and self-corrects",
                score: 90,
              },
              {
                label: "Picks up on it sometimes",
                score: 65,
              },
              {
                label: "Only corrects if I point it out directly",
                score: 40,
              },
              {
                label: "Doesn't seem to pick up on subtle hints",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child ask a clarifying question, like 'is this a capital or small letter?'",
            options: [
              {
                label: "Yes, asks specific questions like this",
                score: 90,
              },
              {
                label: "Asks sometimes, but usually just guesses",
                score: 65,
              },
              {
                label: "Only asks with a lot of encouragement",
                score: 40,
              },
              {
                label: "Doesn't yet ask this kind of question",
                score: 15,
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "write-name",
    name: "Write Their Name",
    clinical: "Pre-Writing Shapes & Letter Readiness",
    formula: {
      toddler: {
        Sensory: 20,
        Motor: 45,
        Cognition: 10,
        Engagement: 25,
      },
      preschool: {
        Sensory: 15,
        Motor: 40,
        Cognition: 30,
        Engagement: 15,
      },
      school: {
        Sensory: 10,
        Motor: 30,
        Cognition: 50,
        Engagement: 10,
      },
    },
    questions: {
      toddler: {
        Sensory: [
          {
            text: "How does your child respond to hand-over-hand guidance when making marks on paper?",
            options: [
              {
                label: "Accepts hand-over-hand guidance comfortably",
                score: 90,
              },
              {
                label: "Accepts it for a bit, then wants to pull away",
                score: 65,
              },
              {
                label: "Tolerates it briefly, resists most of the time",
                score: 40,
              },
              {
                label: "Consistently pulls away from hand-over-hand guidance",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child tolerate having their hand guided to help form letters, or pull away?",
            options: [
              {
                label: "Yes, tolerates it well",
                score: 90,
              },
              {
                label: "Tolerates it most of the time",
                score: 65,
              },
              {
                label: "Often pulls away",
                score: 40,
              },
              {
                label: "Consistently pulls away or refuses",
                score: 15,
              },
            ],
          },
        ],
        Motor: [
          {
            text: "Can your child make vertical, horizontal or circular strokes when scribbling?",
            options: [
              {
                label: "Yes, makes a range of these strokes",
                score: 90,
              },
              {
                label: "Makes one or two of these strokes",
                score: 65,
              },
              {
                label: "Attempts it but strokes are mostly random",
                score: 40,
              },
              {
                label: "Not yet making purposeful strokes",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child imitate you drawing a simple shape immediately after watching?",
            options: [
              {
                label: "Yes, imitates the shape right after watching",
                score: 90,
              },
              {
                label: "Imitates part of the shape",
                score: 65,
              },
              {
                label: "Attempts it but the shape is quite different",
                score: 40,
              },
              {
                label: "Not yet able to imitate the shape",
                score: 15,
              },
            ],
          },
        ],
        Cognition: [
          "Does your child recognize their own name when you say it or point to it?",
          "Does your child point to their own name tag or cubby among several others?",
        ],
        Engagement: [
          {
            text: "Does your child look at you or the name card when you point to it and say their name?",
            options: [
              {
                label: "Yes, looks at it right away",
                score: 90,
              },
              {
                label: "Looks sometimes",
                score: 65,
              },
              {
                label: "Only looks if I say their name too",
                score: 40,
              },
              {
                label: "Doesn't yet look at it this way",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child respond in some way — a sound or gesture — when asked 'where's your name?'",
            options: [
              {
                label: "Yes, responds with a sound or gesture",
                score: 90,
              },
              {
                label: "Responds sometimes",
                score: 65,
              },
              {
                label: "Only responds if I point to it first",
                score: 40,
              },
              {
                label: "Doesn't yet respond to this question",
                score: 15,
              },
            ],
          },
        ],
      },
      preschool: {
        Sensory: [
          {
            text: "Does your child seem to sense stroke direction — up, down, across — when making marks?",
            options: [
              {
                label: "Yes, seems to sense direction well",
                score: 90,
              },
              {
                label: "Senses it most of the time",
                score: 65,
              },
              {
                label: "Often unsure of stroke direction",
                score: 40,
              },
              {
                label: "Doesn't seem to sense stroke direction",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child show frustration with the physical effort of forming letter shapes?",
            options: [
              {
                label: "No, forms letter shapes without noticeable effort or frustration",
                score: 90,
              },
              {
                label: "Shows mild effort, but keeps going",
                score: 65,
              },
              {
                label: "Often shows frustration with the physical effort",
                score: 40,
              },
              {
                label: "Avoids letter-forming tasks because of the effort involved",
                score: 15,
              },
            ],
          },
        ],
        Motor: [
          {
            text: "Can your child copy basic pre-writing shapes, like a line, circle, cross or X?",
            options: [
              {
                label: "Yes, copies these shapes accurately",
                score: 90,
              },
              {
                label: "Copies most of them, with some difficulty",
                score: 65,
              },
              {
                label: "Attempts them but shapes are hard to recognize",
                score: 40,
              },
              {
                label: "Not yet able to copy these shapes",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child draw a recognizable circle and cross unprompted?",
            options: [
              {
                label: "Yes, draws both shapes clearly, unprompted",
                score: 90,
              },
              {
                label: "Draws one clearly, the other less so",
                score: 65,
              },
              {
                label: "Attempts both but neither is clearly recognizable",
                score: 40,
              },
              {
                label: "Not yet able to draw either shape unprompted",
                score: 15,
              },
            ],
          },
        ],
        Cognition: [
          "Does your child recognize the first letter of their name when they see it?",
          "Does your child name most or all of the letters in their name when you point to each one?",
        ],
        Engagement: [
          {
            text: "Does your child watch your hand and try to imitate when you write the first letter of their name?",
            options: [
              {
                label: "Yes, watches and attempts to copy",
                score: 90,
              },
              {
                label: "Watches, but doesn't attempt to copy yet",
                score: 65,
              },
              {
                label: "Only attempts with hand-over-hand help",
                score: 40,
              },
              {
                label: "Doesn't watch closely when I write it",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child tell you the letters of their name when asked, or ask 'how do you spell my name?'",
            options: [
              {
                label: "Yes, tells me the letters or asks how to spell it",
                score: 90,
              },
              {
                label: "Knows or asks about some letters, not all",
                score: 65,
              },
              {
                label: "Only responds with a lot of prompting",
                score: 40,
              },
              {
                label: "Doesn't yet tell me or ask about the letters",
                score: 15,
              },
            ],
          },
        ],
      },
      school: {
        Sensory: [
          {
            text: "Does your child sense correct starting points and direction when forming letters, without heavy verbal reminders?",
            options: [
              {
                label: "Yes, starts letters correctly without reminders",
                score: 90,
              },
              {
                label: "Gets it right most of the time",
                score: 65,
              },
              {
                label: "Needs frequent verbal reminders",
                score: 40,
              },
              {
                label: "Consistently starts letters in the wrong place or direction",
                score: 15,
              },
            ],
          },
          {
            text: "Does your child sense when a letter 'feels' wrong — too big, wrong shape — without you pointing it out?",
            options: [
              {
                label: "Yes, notices this on their own",
                score: 90,
              },
              {
                label: "Notices sometimes",
                score: 65,
              },
              {
                label: "Rarely notices without me pointing it out",
                score: 40,
              },
              {
                label: "Doesn't seem to sense this at all",
                score: 15,
              },
            ],
          },
        ],
        Motor: [
          {
            text: "Can your child write the letters of their name with reasonably correct formation?",
            options: [
              {
                label: "Yes, forms the letters correctly",
                score: 90,
              },
              {
                label: "Forms most letters correctly, a few are off",
                score: 65,
              },
              {
                label: "Attempts it but formation is hard to read",
                score: 40,
              },
              {
                label: "Not yet able to form the letters correctly",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child keep letters a consistent size when writing their full name?",
            options: [
              {
                label: "Yes, keeps letter size consistent throughout",
                score: 90,
              },
              {
                label: "Mostly consistent, with some variation",
                score: 65,
              },
              {
                label: "Size varies noticeably across the name",
                score: 40,
              },
              {
                label: "Not yet able to keep letter size consistent",
                score: 15,
              },
            ],
          },
        ],
        Cognition: [
          "Does your child recall and write the letters of their name in the correct order from memory?",
          "Does your child write their name without needing a model to copy from?",
        ],
        Engagement: [
          {
            text: "Does your child notice when you gesture or point out a mistake without you saying anything?",
            options: [
              {
                label: "Yes, notices and self-corrects",
                score: 90,
              },
              {
                label: "Notices sometimes",
                score: 65,
              },
              {
                label: "Only corrects if I say it out loud",
                score: 40,
              },
              {
                label: "Doesn't seem to notice the gesture",
                score: 15,
              },
            ],
          },
          {
            text: "Can your child explain, in their own words, how to spell or write their name to someone else?",
            options: [
              {
                label: "Yes, explains it clearly to someone else",
                score: 90,
              },
              {
                label: "Can explain it with some help",
                score: 65,
              },
              {
                label: "Only spells it themselves, can't explain it to others",
                score: 40,
              },
              {
                label: "Doesn't yet explain this to someone else",
                score: 15,
              },
            ],
          },
        ],
      },
    },
  },
];
