import { describe, expect, test } from "bun:test";
import { DEFAULT_HOMEPAGE_CONTENT, mergeHomepageContent } from "./homepage";

const legacySteps = [
  {
    when: "Day 0",
    title: "Introduction",
    body: "Watch the short intro, then run the first Play Dose the same day.",
  },
  {
    when: "Days 1–2",
    title: "Finding the rhythm",
    body: "Two more Play Doses, scored as you go.",
  },
  {
    when: "Days 3–5",
    title: "Redo Day",
    body: "The same Activity comes back so the skill sticks, then two fresh Play Doses.",
  },
  {
    when: "Week end",
    title: "Level-Up Prompt",
    body: "The Final Redo Day closes the week and Play Hub suggests the next level.",
  },
];

describe("homepage content migration", () => {
  test("older saved homepages receive image and policy defaults", () => {
    const content = mergeHomepageContent({ hero: { title: "Our existing homepage" } });
    expect(content.hero.title).toBe("Our existing homepage");
    expect(content.hero.mobile_image_url).toBe("");
    expect(content.auth).toEqual({
      login_image_url: "",
      signup_image_url: "",
      password_image_url: "",
    });
    expect(content.policies).toEqual(DEFAULT_HOMEPAGE_CONTENT.policies);
  });

  test("preserves separate images and policy text when merging a saved response", () => {
    const stored = {
      hero: { mobile_image_url: "/uploads/phone.jpg" },
      auth: {
        login_image_url: "/uploads/login.jpg",
        signup_image_url: "/uploads/signup.jpg",
        password_image_url: "/uploads/password.jpg",
      },
      policies: { privacy: { title: "Your privacy", body: "## Information\n\nYour choices." } },
    };
    const content = mergeHomepageContent(stored);
    expect(content.hero.mobile_image_url).toBe(stored.hero.mobile_image_url);
    expect(content.auth).toEqual(stored.auth);
    expect(content.policies.privacy).toEqual(stored.policies.privacy);
    expect(content.policies.terms).toEqual(DEFAULT_HOMEPAGE_CONTENT.policies.terms);
  });

  test("replaces the unchanged legacy week structure", () => {
    const content = mergeHomepageContent({
      week: {
        steps: legacySteps,
        stats: [
          { value: "9", label: "entries in every Play Plan week" },
          { value: "7", label: "loggable sessions, scored 1–5" },
          { value: "3", label: "levels for every skill area" },
          { value: "1", label: "Fine Motor Play Kit throughout" },
        ],
      },
    });

    expect(content.week.steps).toEqual(DEFAULT_HOMEPAGE_CONTENT.week.steps);
    expect(content.week.stats).toEqual(DEFAULT_HOMEPAGE_CONTENT.week.stats);
  });

  test("preserves intentionally customised week copy", () => {
    const customSteps = legacySteps.map((step) => ({ ...step }));
    customSteps[1]!.body = "Our custom Activity explanation.";

    const content = mergeHomepageContent({ week: { steps: customSteps } });

    expect(content.week.steps[1]?.body).toBe("Our custom Activity explanation.");
  });
});
