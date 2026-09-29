import type { ComponentType } from "react";
import { apiAssetUrl } from "@/api/client";
import type { AvatarSticker } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  BearMark,
  BunnyMark,
  CatMark,
  DuckMark,
  ElephantMark,
  FoxMark,
  OwlMark,
  TurtleMark,
} from "./animals";

type StickerMark = ComponentType<{ className?: string; title?: string }>;

export const PROFILE_STICKERS: Array<{
  id: AvatarSticker;
  name: string;
  Mark: StickerMark;
  colour: string;
  background: string;
}> = [
  {
    id: "bunny",
    name: "Brave Bunny",
    Mark: BunnyMark,
    colour: "text-coral",
    background: "bg-coral/12",
  },
  {
    id: "bear",
    name: "Happy Bear",
    Mark: BearMark,
    colour: "text-amber",
    background: "bg-amber/25",
  },
  { id: "fox", name: "Clever Fox", Mark: FoxMark, colour: "text-coral", background: "bg-coral/12" },
  { id: "owl", name: "Wise Owl", Mark: OwlMark, colour: "text-blue", background: "bg-blue/12" },
  {
    id: "elephant",
    name: "Kind Elephant",
    Mark: ElephantMark,
    colour: "text-blue",
    background: "bg-blue/12",
  },
  {
    id: "cat",
    name: "Curious Cat",
    Mark: CatMark,
    colour: "text-coral",
    background: "bg-coral/12",
  },
  {
    id: "turtle",
    name: "Steady Turtle",
    Mark: TurtleMark,
    colour: "text-blue",
    background: "bg-blue/12",
  },
  {
    id: "duck",
    name: "Cheerful Duck",
    Mark: DuckMark,
    colour: "text-amber",
    background: "bg-amber/25",
  },
];

export function ProfileAvatar({
  name,
  photoUrl,
  sticker,
  className,
}: {
  name: string;
  photoUrl?: string | null | undefined;
  sticker?: AvatarSticker | null | undefined;
  className?: string;
}) {
  const stickerData = PROFILE_STICKERS.find((item) => item.id === sticker);
  const imageUrl = apiAssetUrl(photoUrl);
  const label = stickerData ? `${stickerData.name} profile sticker` : `${name}'s profile picture`;

  return (
    <span
      className={cn(
        "grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-cream text-lg font-bold text-navy",
        stickerData?.background,
        className,
      )}
      role={!imageUrl ? "img" : undefined}
      aria-label={!imageUrl ? label : undefined}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={label} className="h-full w-full object-cover" />
      ) : stickerData ? (
        <stickerData.Mark className={cn("h-[68%] w-[68%]", stickerData.colour)} />
      ) : (
        <span aria-hidden>{name.trim().slice(0, 1).toUpperCase() || "P"}</span>
      )}
    </span>
  );
}
