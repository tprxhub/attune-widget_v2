import { shareOrDownload, slug } from "@/features/progress/shareSupportMood";
import { DOMAINS, type PlayPulseDomain } from "./data";
import {
  DOMAIN_DOT_HEX,
  DOMAIN_STATUS,
  PULSE_COLORS as C,
  SCORE_HEX,
  TIER_PILL_HEX,
  resultCopy,
} from "./resultCopy";
import { TIER_COPY, type DomainTier, type ScoreTier } from "./scoring";

export type PlayPulseShare = {
  childName: string;
  goalName: string;
  ageBand: string;
  supportScore: number;
  tier: ScoreTier;
  domainTiers: Record<PlayPulseDomain, DomainTier>;
  focus: PlayPulseDomain | null;
};

const W = 1080;
const PAD = 60; // page around the card
const INNER = 84; // card edge to text
const TEXT_W = W - 2 * (PAD + INNER);

/** Wraps `value` onto lines no wider than `width`, using the context's current font. */
function wrap(ctx: CanvasRenderingContext2D, value: string, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of value.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Draws the Play Pulse result as it looks on the page: the Support Score and its pill, the
 * summary, the four areas, and the "keep building" footer. 1080 px wide; the height follows the
 * text, so a long goal name or summary never gets cut off.
 */
export async function renderPlayPulseImage(input: PlayPulseShare): Promise<Blob> {
  await document.fonts?.ready;
  const font = getComputedStyle(document.body).fontFamily || "sans-serif";
  const copy = resultCopy(input.tier, input.childName, input.goalName, input.ageBand);

  // Measure the wrapped text first, so the canvas can be made exactly tall enough.
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = `400 34px ${font}`;
  const summary = wrap(measure, copy.summary, TEXT_W);
  measure.font = `400 31px ${font}`;
  const body = wrap(measure, copy.body, TEXT_W);

  const top = PAD + 80;
  const summaryTop = top + 380;
  const rowsTop = summaryTop + summary.length * 58 + 30;
  const rowH = 104;
  const footerTop = rowsTop + 20 + DOMAINS.length * rowH + 20;
  const footerH = 64 + 52 + body.length * 52 + 40 + 104 + 64;
  const H = footerTop + footerH + 120;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const spaced = (px: number) => {
    // Letter spacing where the browser supports it (Chrome, Safari 17+).
    if ("letterSpacing" in ctx) (ctx as { letterSpacing: string }).letterSpacing = `${px}px`;
  };
  const text = (
    value: string,
    x: number,
    y: number,
    size: number,
    weight: number,
    color: string,
    tracking = 0,
  ) => {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillStyle = color;
    spaced(tracking);
    ctx.fillText(value, x, y);
    spaced(0);
  };
  const pill = (
    label: string,
    cx: number,
    cy: number,
    size: number,
    colors: { bg: string; text: string },
    align: "center" | "right",
  ) => {
    ctx.font = `800 ${size}px ${font}`;
    spaced(size * 0.16);
    const width = ctx.measureText(label).width + size * 2.2;
    spaced(0);
    const h = size * 2.4;
    const x = align === "center" ? cx - width / 2 : cx - width;
    ctx.fillStyle = colors.bg;
    ctx.beginPath();
    ctx.roundRect(x, cy - h / 2, width, h, h / 2);
    ctx.fill();
    ctx.textAlign = "center";
    text(label, x + width / 2, cy + size * 0.36, size, 800, colors.text, size * 0.16);
  };

  // Page and card.
  ctx.fillStyle = "#f5f3ef";
  ctx.fillRect(0, 0, W, H);
  const cardX = PAD;
  const cardW = W - 2 * PAD;
  const cardBottom = footerTop + footerH;
  ctx.save();
  ctx.shadowColor = "rgba(19,41,91,0.12)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(cardX, PAD, cardW, cardBottom - PAD, 44);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cardX, PAD, cardW, cardBottom - PAD, 44);
  ctx.clip();

  // Support Score, the percentage and the result pill.
  ctx.textAlign = "center";
  text("SUPPORT SCORE", W / 2, top + 6, 26, 700, C.label, 6);
  ctx.font = `800 190px ${font}`;
  const number = String(input.supportScore);
  const numberW = ctx.measureText(number).width;
  ctx.font = `800 88px ${font}`;
  const percentW = ctx.measureText("%").width;
  const start = W / 2 - (numberW + percentW) / 2;
  ctx.textAlign = "left";
  text(number, start, top + 200, 190, 800, SCORE_HEX[input.tier]);
  text("%", start + numberW, top + 112, 88, 800, SCORE_HEX[input.tier]);
  pill(
    TIER_COPY[input.tier].label.toUpperCase(),
    W / 2,
    top + 268,
    26,
    TIER_PILL_HEX[input.tier],
    "center",
  );

  // Summary.
  ctx.textAlign = "left";
  const left = cardX + INNER;
  summary.forEach((line, i) => text(line, left, summaryTop + i * 58, 34, 400, C.muted));

  // The four areas.
  ctx.fillStyle = C.border;
  ctx.fillRect(cardX, rowsTop, cardW, 2);
  DOMAINS.forEach((domain, i) => {
    const mid = rowsTop + 20 + i * rowH + rowH / 2;
    if (i > 0) {
      ctx.fillStyle = C.rule;
      ctx.fillRect(left, mid - rowH / 2, TEXT_W, 2);
    }
    ctx.fillStyle = DOMAIN_DOT_HEX[domain];
    ctx.beginPath();
    ctx.arc(left + 10, mid - 2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = "left";
    text(domain.toUpperCase(), left + 44, mid + 12, 34, 700, C.navy, 4);
    const status = DOMAIN_STATUS[input.domainTiers[domain]];
    pill(status.label.toUpperCase(), left + TEXT_W, mid, 23, status, "right");
  });

  // Footer: next step and the consult bar.
  ctx.fillStyle = C.footer;
  ctx.fillRect(cardX, footerTop, cardW, footerH);
  ctx.textAlign = "left";
  text(copy.heading, left, footerTop + 64 + 36, 44, 700, C.navy);
  body.forEach((line, i) => text(line, left, footerTop + 64 + 52 + 40 + i * 52, 31, 400, C.muted));
  const barTop = footerTop + 64 + 52 + body.length * 52 + 40;
  ctx.fillStyle = C.consultEdge;
  ctx.beginPath();
  ctx.roundRect(left, barTop + 8, TEXT_W, 96, 24);
  ctx.fill();
  ctx.fillStyle = C.consult;
  ctx.beginPath();
  ctx.roundRect(left, barTop, TEXT_W, 92, 24);
  ctx.fill();
  ctx.textAlign = "center";
  text("BOOK A PLAY CONSULT", W / 2, barTop + 58, 30, 800, "#ffffff", 5);
  ctx.restore();

  ctx.textAlign = "center";
  text(
    "Check yours with Play Pulse on Play Hub · The Toy Pharmacy",
    W / 2,
    H - 52,
    26,
    600,
    C.muted,
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No image"))), "image/png"),
  );
}

/** Shares the Play Pulse result as an image. */
export async function sharePlayPulseResult(input: PlayPulseShare) {
  const blob = await renderPlayPulseImage(input);
  await shareOrDownload(
    blob,
    `play-hub-${slug(input.childName)}-play-pulse.png`,
    `${input.childName}’s Play Pulse`,
    `${input.childName}’s Play Pulse Support Score for “${input.goalName}” on Play Hub.`,
  );
}
