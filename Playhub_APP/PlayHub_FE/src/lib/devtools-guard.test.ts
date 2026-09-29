import { describe, expect, test } from "bun:test";
import { devtoolsGuardEnabled, isDevtoolsShortcut } from "./devtools-guard";

const keys = (
  code: string,
  mods: Partial<Record<"ctrl" | "meta" | "shift" | "alt", boolean>> = {},
) =>
  isDevtoolsShortcut({
    code,
    ctrlKey: mods.ctrl ?? false,
    metaKey: mods.meta ?? false,
    shiftKey: mods.shift ?? false,
    altKey: mods.alt ?? false,
  });

describe("isDevtoolsShortcut", () => {
  test("blocks F12 however it is pressed", () => {
    expect(keys("F12")).toBe(true);
    expect(keys("F12", { shift: true })).toBe(true);
  });

  test("blocks Inspect, Console, the element picker and the Firefox console on Windows and Linux", () => {
    for (const code of ["KeyI", "KeyJ", "KeyC", "KeyK"]) {
      expect(keys(code, { ctrl: true, shift: true })).toBe(true);
    }
  });

  test("blocks the Mac shortcuts, including Cmd+Shift+C", () => {
    for (const code of ["KeyI", "KeyJ", "KeyC", "KeyK"]) {
      expect(keys(code, { meta: true, alt: true })).toBe(true);
    }
    expect(keys("KeyC", { meta: true, shift: true })).toBe(true);
  });

  test("blocks View Source", () => {
    expect(keys("KeyU", { ctrl: true })).toBe(true);
    expect(keys("KeyU", { meta: true, alt: true })).toBe(true);
  });

  test("leaves everyday shortcuts alone", () => {
    expect(keys("KeyC", { ctrl: true })).toBe(false); // copy
    expect(keys("KeyC", { meta: true })).toBe(false); // copy on a Mac
    expect(keys("KeyV", { ctrl: true, shift: true })).toBe(false); // paste as plain text
    expect(keys("KeyI")).toBe(false);
    expect(keys("KeyU")).toBe(false);
    expect(keys("KeyT", { ctrl: true, shift: true })).toBe(false); // reopen closed tab
    expect(keys("F5")).toBe(false);
    expect(keys("KeyP", { ctrl: true })).toBe(false);
  });

  test("does not break AltGr (Ctrl+Alt), which types letters on many keyboard layouts", () => {
    for (const code of ["KeyI", "KeyJ", "KeyC", "KeyK", "KeyU"]) {
      expect(keys(code, { ctrl: true, alt: true })).toBe(false);
      expect(keys(code, { ctrl: true, alt: true, shift: true })).toBe(false);
    }
  });
});

describe("devtoolsGuardEnabled", () => {
  test("does nothing outside a browser", () => {
    expect(devtoolsGuardEnabled()).toBe(false);
  });
});
