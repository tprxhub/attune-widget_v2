import thumbGrip from "@/assets/Thumbnails/Thumb1.jpeg";
import thumbReading from "@/assets/Thumbnails/Thumb2.jpeg";
import thumbScissors from "@/assets/Thumbnails/Thum3.jpeg";
import thumbWriting from "@/assets/Thumbnails/Thumb4.jpeg";

export const DEFAULT_PLAN_THUMBNAIL = thumbGrip;

/** One visual per built-in Play Plan, shared by its Rookie, Starter and Pro versions. */
export const PLAN_THUMBNAILS: Record<string, string> = {
  pinch: thumbGrip,
  bilateral: thumbGrip,
  visual: thumbReading,
  tool: thumbScissors,
  prewrite: thumbWriting,
  scanning: thumbReading,
  letters: thumbWriting,
};

/** Built-in pictures to cycle through for a plan that has no picture of its own. */
export const FALLBACK_THUMBNAILS = [thumbGrip, thumbReading, thumbScissors, thumbWriting];
