import { moodMeta } from "@/components/icons";
import {
  averageMood,
  celebrate,
  independence,
  moodColor,
  moodRange,
  type MoodDay,
} from "./supportMood";

const NAVY = "#11295B";
const CREAM = "#F5F2EE";
const TRACK = "#FFFFFF";
const EMPTY_FACE = "#ECEEF2";
const SUPPORT = "#2459A0";
const MUTED = "rgba(17,41,91,0.6)";

/** A filled mood face, matching the one on the page: frown (1) through to a big open smile (5). */
function drawFace(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, mood: number) {
  ctx.fillStyle = moodColor(mood);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = NAVY;
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = r * 0.1;
  ctx.lineCap = "round";
  const eyeY = y - r * 0.18;
  const eyeX = r * 0.32;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + side * eyeX, eyeY, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    if (mood === 1) {
      ctx.beginPath();
      ctx.moveTo(x + side * (eyeX + r * 0.14), eyeY - r * 0.26);
      ctx.lineTo(x + side * (eyeX - r * 0.1), eyeY - r * 0.16);
      ctx.stroke();
    }
  }
  const mouthY = y + r * 0.3;
  const half = r * 0.38;
  ctx.beginPath();
  if (mood === 5) {
    ctx.moveTo(x - half, mouthY - r * 0.06);
    ctx.quadraticCurveTo(x, mouthY + r * 0.5, x + half, mouthY - r * 0.06);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.moveTo(x - half, mouthY);
    ctx.quadraticCurveTo(x, mouthY + (mood - 3) * r * 0.2, x + half, mouthY);
    ctx.stroke();
  }
}

function ring(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  width: number,
  value: number,
  color: string,
) {
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.strokeStyle = TRACK;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  const filled = Math.max(0, Math.min(1, value));
  if (filled > 0) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * filled);
    ctx.stroke();
  }
}

/** Draws the Support & Mood card as a 1080×1350 PNG. */
export async function renderSupportMoodImage({
  childName,
  supportScore,
  moods,
}: {
  childName: string;
  supportScore: number | null;
  moods: MoodDay[];
}): Promise<Blob> {
  await document.fonts?.ready;
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const font = getComputedStyle(document.body).fontFamily || "sans-serif";
  const text = (value: string, x: number, y: number, size: number, weight = 700, color = NAVY) => {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
  };

  // Warm celebration background with a scatter of confetti.
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);
  const confetti: [number, number, number, string, "dot" | "bar"][] = [
    [90, 70, 20, "#F2B544", "bar"],
    [210, 40, 0, "#DF3B2D", "dot"],
    [330, 120, -35, "#2459A0", "bar"],
    [760, 50, 40, "#6FA05A", "bar"],
    [880, 130, 0, "#F2B544", "dot"],
    [990, 60, -20, "#DF3B2D", "bar"],
    [60, 420, 0, "#6FA05A", "dot"],
    [1030, 380, 30, "#2459A0", "bar"],
    [80, 760, -25, "#DF3B2D", "bar"],
    [1010, 720, 0, "#F2B544", "dot"],
    [150, 300, 0, "#2459A0", "dot"],
    [950, 280, 60, "#6FA05A", "bar"],
  ];
  for (const [x, y, rotate, color, shape] of confetti) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    if (shape === "dot") ctx.arc(0, 0, 11, 0, Math.PI * 2);
    else ctx.roundRect(-26, -8, 52, 16, 8);
    ctx.fill();
    ctx.restore();
  }

  const cheer = celebrate(childName, supportScore, moods);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  // "Celebrate the win" tag.
  ctx.font = `800 26px ${font}`;
  const tag = "CELEBRATE THE WIN";
  const tagWidth = ctx.measureText(tag).width + 56;
  ctx.fillStyle = "#F2B544";
  ctx.beginPath();
  ctx.roundRect(W / 2 - tagWidth / 2, 62, tagWidth, 52, 26);
  ctx.fill();
  text(tag, W / 2, 98, 26, 800);
  // Headline, shrunk to fit the width when the name is long.
  let size = 70;
  ctx.font = `800 ${size}px ${font}`;
  while (ctx.measureText(cheer.headline).width > W - 140 && size > 40) {
    size -= 2;
    ctx.font = `800 ${size}px ${font}`;
  }
  text(cheer.headline, W / 2, 200, size, 800);
  text(cheer.message, W / 2, 252, 32, 600, MUTED);

  // Rings: Support Score outside, mood inside, the latest mood's face in the middle.
  const cx = W / 2;
  const cy = 545;
  const average = averageMood(moods);
  const latest = moods.at(-1)?.mood ?? null;
  ring(ctx, cx, cy, 228, 60, independence(supportScore), SUPPORT);
  ring(
    ctx,
    cx,
    cy,
    164,
    60,
    average === null ? 0 : average / 5,
    average === null ? TRACK : moodColor(Math.round(average)),
  );
  if (latest !== null) drawFace(ctx, cx, cy, 92, latest);
  else {
    ctx.fillStyle = EMPTY_FACE;
    ctx.beginPath();
    ctx.arc(cx, cy, 92, 0, Math.PI * 2);
    ctx.fill();
  }

  // Two figures under the rings.
  const figures = [
    {
      x: W * 0.3,
      label: "Support Score",
      value: supportScore === null ? "—" : `${supportScore}%`,
      color: SUPPORT,
    },
    {
      x: W * 0.7,
      label: "Mood",
      value: average === null ? "—" : moodMeta(Math.round(average)).label,
      color: average === null ? EMPTY_FACE : moodColor(Math.round(average)),
    },
  ];
  for (const f of figures) {
    // The dot sits just before the label, with the pair centred over the value.
    ctx.font = `700 28px ${font}`;
    const labelWidth = ctx.measureText(f.label).width;
    const start = f.x - (labelWidth + 34) / 2;
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(start + 11, 852, 11, 0, Math.PI * 2);
    ctx.fill();
    text(f.label, start + 34 + labelWidth / 2, 862, 28, 700, MUTED);
    text(f.value, f.x, 930, f.value.length > 8 ? 50 : 60);
  }

  // Win chips.
  if (cheer.wins.length) {
    ctx.font = `700 26px ${font}`;
    const chips = cheer.wins.map((win) => ({
      win,
      width: ctx.measureText(`★  ${win}`).width + 44,
    }));
    const total = chips.reduce((sum, c) => sum + c.width, 0) + 16 * (chips.length - 1);
    let x = W / 2 - total / 2;
    for (const chip of chips) {
      ctx.fillStyle = "#F4F5F8";
      ctx.beginPath();
      ctx.roundRect(x, 972, chip.width, 50, 25);
      ctx.fill();
      ctx.textAlign = "left";
      text("★", x + 22, 1006, 26, 700, "#E3A21A");
      text(chip.win, x + 22 + 34, 1006, 26, 700);
      ctx.textAlign = "center";
      x += chip.width + 16;
    }
  }

  // Mood history strip.
  ctx.strokeStyle = "rgba(17,41,91,0.1)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(70, 1050, W - 140, 200, 36);
  ctx.stroke();
  ctx.textAlign = "left";
  text("Mood history", 110, 1100, 30);
  ctx.textAlign = "right";
  text(moodRange(moods), W - 110, 1100, 24, 600, MUTED);
  ctx.textAlign = "center";
  const slot = (W - 220) / 7;
  moods.forEach((m, i) => {
    const x = 110 + slot * i + slot / 2;
    drawFace(ctx, x, 1160, 34, m.mood);
    text(m.weekday, x, 1228, 22, 600, MUTED);
  });
  if (!moods.length) text("Moods appear as Sessions are logged", W / 2, 1175, 26, 600, MUTED);

  text("Shared from Play Hub · The Toy Pharmacy", W / 2, 1304, 24, 600, MUTED);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No image"))), "image/png"),
  );
}

/**
 * Shares the card as an image through the device share sheet, or downloads it where sharing
 * files isn't supported (most desktop browsers).
 */
export async function shareSupportMoodCard(input: {
  childName: string;
  supportScore: number | null;
  moods: MoodDay[];
}) {
  const blob = await renderSupportMoodImage(input);
  const name = `play-hub-${input.childName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-support-mood.png`;
  const file = new File([blob], name, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `${input.childName}’s Play Hub week`,
        text: `${input.childName}’s Support Score and mood this week on Play Hub.`,
      });
      return;
    } catch (error) {
      // Closing the share sheet isn't an error worth reporting.
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
