import { drawFace, ring, shareOrDownload, slug } from "@/features/progress/shareSupportMood";
import { independence } from "@/features/progress/supportMood";
import { ON_TRACK_COLOR, PULSE_FACE, pulseCheer } from "./pulseCheer";
import type { PlayPulseDomain } from "./data";
import { TIER_COPY, type DomainTier, type ScoreTier } from "./scoring";

const NAVY = "#11295B";
const MUTED = "rgba(17,41,91,0.6)";
const SUPPORT = "#2459A0";

/** Canvas colours matching the result page's tier styles. */
const TIER_COLORS: Record<DomainTier, { soft: string; text: string; border: string }> = {
  ontrack: { soft: "#D6F0E1", text: "#146334", border: "#A9D9BD" },
  practice: { soft: "#FFE0B0", text: "#9B6208", border: "#EFC478" },
  help: { soft: "#FDE7E4", text: "#A8291D", border: "#EFB7B1" },
  unknown: { soft: "#EEF0F4", text: "rgba(17,41,91,0.5)", border: "rgba(17,41,91,0.1)" },
};

const DOMAIN_COLORS: Record<PlayPulseDomain, string> = {
  Sensory: "#11295B",
  Motor: "#DF3B2D",
  Cognition: "#A76709",
  Engagement: "#2459A0",
};

export type PlayPulseShare = {
  childName: string;
  goalName: string;
  ageBand: string;
  supportScore: number;
  tier: ScoreTier;
  domainTiers: Record<PlayPulseDomain, DomainTier>;
  focus: PlayPulseDomain | null;
};

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

/** Draws the Play Pulse result as a 1080×1350 PNG. */
export async function renderPlayPulseImage(input: PlayPulseShare): Promise<Blob> {
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
  const tier = TIER_COLORS[input.tier];

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);
  const confetti: [number, number, number, string, "dot" | "bar"][] = [
    [90, 70, 20, "#F2B544", "bar"],
    [210, 40, 0, "#DF3B2D", "dot"],
    [880, 130, 0, "#F2B544", "dot"],
    [990, 60, -20, "#DF3B2D", "bar"],
    [760, 50, 40, "#6FA05A", "bar"],
    [330, 120, -35, "#2459A0", "bar"],
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

  const cheer = pulseCheer(
    input.childName,
    input.goalName,
    input.tier,
    input.domainTiers,
    input.focus,
  );
  ctx.textAlign = "center";
  // "Play Pulse result" tag.
  ctx.font = `800 26px ${font}`;
  const tag = "PLAY PULSE RESULT";
  const tagWidth = ctx.measureText(tag).width + 56;
  ctx.fillStyle = "#F2B544";
  ctx.beginPath();
  ctx.roundRect(W / 2 - tagWidth / 2, 62, tagWidth, 52, 26);
  ctx.fill();
  text(tag, W / 2, 98, 26, 800);

  let size = 66;
  ctx.font = `800 ${size}px ${font}`;
  while (ctx.measureText(cheer.headline).width > W - 140 && size > 40) {
    size -= 2;
    ctx.font = `800 ${size}px ${font}`;
  }
  text(cheer.headline, W / 2, 196, size, 800);
  ctx.font = `600 30px ${font}`;
  wrap(ctx, cheer.message, W - 180).forEach((line, i) =>
    text(line, W / 2, 246 + i * 38, 30, 600, MUTED),
  );

  // Rings: Support Score outside, areas on track inside, a smiling face in the middle.
  const cx = W / 2;
  const cy = 500;
  ring(ctx, cx, cy, 190, 52, independence(input.supportScore), SUPPORT);
  ring(ctx, cx, cy, 134, 52, cheer.assessed ? cheer.onTrack / cheer.assessed : 0, ON_TRACK_COLOR);
  drawFace(ctx, cx, cy, 78, PULSE_FACE[input.tier]);

  // Two figures under the rings.
  const figures = [
    { x: W * 0.3, label: "Support Score", value: `${input.supportScore}%`, color: SUPPORT },
    {
      x: W * 0.7,
      label: "Areas on track",
      value: `${cheer.onTrack} of ${cheer.assessed || 4}`,
      color: ON_TRACK_COLOR,
    },
  ];
  for (const f of figures) {
    ctx.font = `700 28px ${font}`;
    const labelWidth = ctx.measureText(f.label).width;
    const start = f.x - (labelWidth + 34) / 2;
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(start + 11, 742, 11, 0, Math.PI * 2);
    ctx.fill();
    text(f.label, start + 34 + labelWidth / 2, 752, 28, 700, MUTED);
    text(f.value, f.x, 815, 58);
  }
  text(TIER_COPY[input.tier].label, W * 0.3, 852, 26, 700, tier.text);

  // Four domains, two by two.
  const cardW = (W - 140 - 24) / 2;
  const cardH = 124;
  (Object.keys(input.domainTiers) as PlayPulseDomain[]).forEach((domain, i) => {
    const x = 70 + (i % 2) * (cardW + 24);
    const y = 880 + Math.floor(i / 2) * (cardH + 16);
    const status = TIER_COLORS[input.domainTiers[domain]];
    ctx.strokeStyle = "rgba(17,41,91,0.1)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 28);
    ctx.stroke();
    ctx.fillStyle = DOMAIN_COLORS[domain];
    ctx.beginPath();
    ctx.arc(x + 46, y + 44, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = "left";
    text(domain, x + 76, y + 56, 32, 800);
    const badge =
      input.domainTiers[domain] === "unknown"
        ? "NOT YET"
        : TIER_COPY[input.domainTiers[domain]].badge;
    ctx.font = `800 20px ${font}`;
    const badgeW = ctx.measureText(badge).width + 32;
    const bx = x + 76;
    const by = y + 70;
    ctx.fillStyle = status.soft;
    ctx.beginPath();
    ctx.roundRect(bx, by, badgeW, 44, 22);
    ctx.fill();
    ctx.textAlign = "center";
    text(badge, bx + badgeW / 2, by + 30, 20, 800, status.text);
  });

  text("Not a pass/fail score — it shows where to focus next.", W / 2, 1222, 24, 600, MUTED);
  text("Check yours with Play Pulse on Play Hub · The Toy Pharmacy", W / 2, 1290, 24, 600, MUTED);

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
