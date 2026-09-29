import { expect, test } from "@playwright/test";

// The dev server for these tests runs with VITE_ENABLE_DEVTOOLS_GUARD=true (playwright.config.ts),
// so the whole suite also proves the guard does not get in the way of normal use.

test("developer-tool shortcuts and the right-click menu are blocked, everyday ones are not", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email Address")).toBeVisible();
  // The guard is installed once the app has hydrated, a moment after the page first paints.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const event = new KeyboardEvent("keydown", {
          code: "F12",
          bubbles: true,
          cancelable: true,
        });
        document.body.dispatchEvent(event);
        return event.defaultPrevented;
      }),
    )
    .toBe(true);

  const result = await page.evaluate(() => {
    const press = (code: string, init: KeyboardEventInit = {}) => {
      const event = new KeyboardEvent("keydown", {
        code,
        bubbles: true,
        cancelable: true,
        ...init,
      });
      document.body.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const rightClick = (target: Element) => {
      const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const field = document.querySelector("input")!;
    return {
      f12: press("F12"),
      inspect: press("KeyI", { ctrlKey: true, shiftKey: true }),
      console: press("KeyJ", { ctrlKey: true, shiftKey: true }),
      picker: press("KeyC", { ctrlKey: true, shiftKey: true }),
      macInspect: press("KeyI", { metaKey: true, altKey: true }),
      viewSource: press("KeyU", { ctrlKey: true }),
      copy: press("KeyC", { ctrlKey: true }),
      altGr: press("KeyI", { ctrlKey: true, altKey: true }),
      pageMenu: rightClick(document.body),
      fieldMenu: rightClick(field),
    };
  });

  expect(result).toEqual({
    f12: true,
    inspect: true,
    console: true,
    picker: true,
    macInspect: true,
    viewSource: true,
    copy: false,
    altGr: false,
    pageMenu: true,
    fieldMenu: false,
  });
});

test("the app is covered while developer tools are open and comes back when they close", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email Address")).toBeVisible();
  const notice = page.getByRole("alertdialog", { name: "Developer tools are switched off" });
  await expect(notice).toHaveCount(0);

  // Attaching the debugger makes `debugger` statements pause the page, exactly as when DevTools
  // is open. Each pause is resumed after a moment, the way a person clicking Resume would.
  const cdp = await context.newCDPSession(page);
  cdp.on("Debugger.paused", () => {
    setTimeout(() => void cdp.send("Debugger.resume").catch(() => undefined), 400);
  });
  await cdp.send("Debugger.enable");

  await expect(notice).toBeVisible({ timeout: 15_000 });
  await expect(notice).toContainText("Please close them to keep using Play Hub.");

  // Removing the notice from the page does not help: it is put back while DevTools stays open.
  await page.evaluate(() => document.getElementById("playhub-devtools-notice")?.remove());
  await expect(notice).toBeVisible({ timeout: 15_000 });

  await cdp.send("Debugger.disable");
  await expect(notice).toHaveCount(0, { timeout: 15_000 });
  await page.getByLabel("Email Address").fill("parent@playhub.local");
  await expect(page.getByLabel("Email Address")).toHaveValue("parent@playhub.local");
});
