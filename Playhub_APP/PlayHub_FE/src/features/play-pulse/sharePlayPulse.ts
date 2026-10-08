import { shareOrDownload, slug } from "@/features/progress/shareSupportMood";
import type { PlayPulseDomain } from "./data";
import { TIER_COPY, type DomainTier, type ScoreTier } from "./scoring";

const NAVY = "#11295B";
const MUTED = "rgba(17,41,91,0.6)";

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

  ctx.textAlign = "center";
  // "Play Pulse" tag.
  ctx.font = `800 26px ${font}`;
  const tag = "PLAY PULSE";
  const tagWidth = ctx.measureText(tag).width + 56;
  ctx.fillStyle = "#F2B544";
  ctx.beginPath();
  ctx.roundRect(W / 2 - tagWidth / 2, 62, tagWidth, 52, 26);
  ctx.fill();
  text(tag, W / 2, 98, 26, 800);

  let size = 64;
  const headline = `${input.childName}’s Play Pulse`;
  ctx.font = `800 ${size}px ${font}`;
  while (ctx.measureText(headline).width > W - 140 && size > 40) {
    size -= 2;
    ctx.font = `800 ${size}px ${font}`;
  }
  text(headline, W / 2, 200, size, 800);
  text(`“${input.goalName}” · ${input.ageBand}`, W / 2, 250, 30, 600, MUTED);

  // Score panel in the tier colour.
  ctx.fillStyle = tier.soft;
  ctx.beginPath();
  ctx.roundRect(70, 300, W - 140, 440, 44);
  ctx.fill();
  text("SUPPORT SCORE", W / 2, 375, 28, 700, MUTED);
  text(`${input.supportScore}%`, W / 2, 545, 180, 800, tier.text);
  text(TIER_COPY[input.tier].label, W / 2, 625, 54, 800, tier.text);
  if (input.focus) {
    ctx.font = `600 28px ${font}`;
    const lines = wrap(ctx, `Next focus: ${input.focus} skills`, W - 260);
    lines.forEach((line, i) => text(line, W / 2, 690 + i * 36, 28, 600, NAVY));
  }

  // Four domains, two by two.
  const cardW = (W - 140 - 24) / 2;
  const cardH = 150;
  (Object.keys(input.domainTiers) as PlayPulseDomain[]).forEach((domain, i) => {
    const x = 70 + (i % 2) * (cardW + 24);
    const y = 780 + Math.floor(i / 2) * (cardH + 24);
    const status = TIER_COLORS[input.domainTiers[domain]];
    ctx.strokeStyle = "rgba(17,41,91,0.1)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 28);
    ctx.stroke();
    ctx.fillStyle = DOMAIN_COLORS[domain];
    ctx.beginPath();
    ctx.arc(x + 46, y + 52, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = "left";
    text(domain, x + 76, y + 64, 34, 800);
    const badge =
      input.domainTiers[domain] === "unknown"
        ? "NOT YET"
        : TIER_COPY[input.domainTiers[domain]].badge;
    ctx.font = `800 20px ${font}`;
    const badgeW = ctx.measureText(badge).width + 32;
    const bx = x + 76;
    const by = y + 86;
    ctx.fillStyle = status.soft;
    ctx.beginPath();
    ctx.roundRect(bx, by, badgeW, 44, 22);
    ctx.fill();
    ctx.textAlign = "center";
    text(badge, bx + badgeW / 2, by + 30, 20, 800, status.text);
  });

  ctx.font = `600 26px ${font}`;
  wrap(ctx, "Not a pass/fail score — it shows where to focus next.", W - 200).forEach((line, i) =>
    text(line, W / 2, 1170 + i * 34, 26, 600, MUTED),
  );
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
