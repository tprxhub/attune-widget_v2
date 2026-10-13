import defaultLogo from "@/assets/playhub-logo.svg";
import { moodMeta } from "@/components/icons";
import { averageMood, celebrate, independence, moodColor, type MoodDay } from "./supportMood";

const NAVY = "#11295B";
const TRACK = "#FFFFFF";
const SUPPORT = "#2459A0";
const MUTED = "rgba(17,41,91,0.6)";

/** A filled mood face, matching the one on the page: frown (1) through to a big open smile (5). */
export function drawFace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  mood: number,
) {
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

export function ring(
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
  logoUrl = defaultLogo,
  winNote,
}: {
  childName: string;
  supportScore: number | null;
  moods: MoodDay[];
  logoUrl?: string;
  winNote?: string | undefined;
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
  const tag = `CELEBRATING ${childName.toUpperCase()}!`;
  const tagWidth = Math.min(W - 140, ctx.measureText(tag).width + 56);
  ctx.fillStyle = "#F2B544";
  ctx.beginPath();
  ctx.roundRect(W / 2 - tagWidth / 2, 62, tagWidth, 52, 26);
  ctx.fill();
  ctx.fillStyle = NAVY;
  ctx.fillText(tag, W / 2, 98, W - 200);
  text(cheer.message, W / 2, 252, 32, 600, MUTED);

  // Rings: Support Score outside, mood inside, the latest mood's face in the middle.
  const cx = W / 2;
  const cy = 600;
  const average = averageMood(moods);
  ring(ctx, cx, cy, 228, 60, independence(supportScore), SUPPORT);
  ring(
    ctx,
    cx,
    cy,
    168,
    60,
    average === null ? 0 : average / 5,
    average === null ? TRACK : moodColor(Math.round(average)),
  );
  text("Let’s", cx, cy - 58, 30);
  const logo = await loadShareLogo(logoUrl);
  if (logo) {
    const width = 160;
    const height = (width * logo.naturalHeight) / logo.naturalWidth;
    ctx.drawImage(logo, cx - width / 2, cy - height / 2, width, height);
  }

  text("again soon!", cx, cy + 88, 25);

  // Compact colour legend centred beneath the graph; no text is drawn on the rings.
  const legend = [
    {
      x: W * 0.3,
      label: `Independence Score: ${supportScore === null ? "Not recorded" : `${Math.round(100 - supportScore)}%`}`,
      color: SUPPORT,
    },
    {
      x: W * 0.7,
      label: `Mood: ${average === null ? "Not recorded" : moodMeta(Math.round(average)).label}`,
      color: average === null ? "#ECEEF2" : moodColor(Math.round(average)),
    },
  ];
  for (const item of legend) {
    ctx.font = `600 26px ${font}`;
    const start = item.x - (ctx.measureText(item.label).width + 30) / 2;
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(start + 8, 920, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = "left";
    text(item.label, start + 30, 930, 26, 600, MUTED);
    ctx.textAlign = "center";
  }

  // The latest recorded win, or a truthful encouragement when none has been written.
  ctx.fillStyle = "#F4F5F8";
  ctx.beginPath();
  ctx.roundRect(70, 1050, W - 140, 180, 36);
  ctx.fill();
  drawWinNote(ctx, winNote ? `“${winNote}”` : cheer.message, font);

  text("Shared from Play Hub · The Toy Pharmacy", W / 2, 1304, 24, 600, MUTED);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No image"))), "image/png"),
  );
}

/**
 * Shares an image through the device share sheet, or downloads it where sharing files isn't
 * supported (most desktop browsers).
 */
export async function shareOrDownload(blob: Blob, fileName: string, title: string, text: string) {
  const file = new File([blob], fileName, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return;
    } catch (error) {
      // Closing the share sheet isn't an error worth reporting.
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Shares the Support & Mood card as an image. */
export async function shareSupportMoodCard(input: {
  childName: string;
  supportScore: number | null;
  moods: MoodDay[];
  logoUrl?: string;
  winNote?: string | undefined;
}) {
  const blob = await renderSupportMoodImage(input);
  await shareOrDownload(
    blob,
    `play-hub-${slug(input.childName)}-support-mood.png`,
    `${input.childName}’s Play Hub week`,
    `${input.childName}’s Support Score and mood this week on Play Hub.`,
  );
}

async function loadShareLogo(url: string): Promise<HTMLImageElement | null> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = url;
  try {
    await image.decode();
    return image;
  } catch {
    if (url !== defaultLogo) return loadShareLogo(defaultLogo);
    return null;
  }
}

function drawWinNote(ctx: CanvasRenderingContext2D, note: string, font: string) {
  const x = 540;
  const y = 1105;
  const width = 860;
  ctx.font = `600 32px ${font}`;
  ctx.fillStyle = NAVY;
  ctx.textAlign = "center";
  const lines: string[] = [];
  let line = "";
  for (const word of note.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  lines.push(line);
  lines
    .slice(0, 3)
    .forEach((value, index) =>
      ctx.fillText(value + (index === 2 && lines.length > 3 ? "…" : ""), x, y + index * 42, width),
    );
}
