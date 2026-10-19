import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ImagePlus, Minus, Plus, RotateCcw } from "lucide-react";
import { useState, type DragEvent, type KeyboardEvent, type PointerEvent } from "react";
import { Logo } from "@/components/brand";
import { SERVICE_ICON_IMAGES } from "@/components/serviceIcons";
import { roleLabel } from "@/lib/roles";
import type { Session } from "@/lib/types";
import type { HubCardSetting, LaunchItem } from "./hubTiles";
import { hubLaunchItemId } from "./hubTiles";
import { shrinkImage } from "./shrinkImage";
import { useHubCardDrag } from "./useHubCardDrag";
import portrait from "@/assets/kids-hands-beads.jpg";

export function HubSimpleView({
  session,
  home,
  items,
  shortcuts,
  shortcutSlots,
  profilePhoto,
  onProfilePhoto,
  customizing,
  onRemoveTile,
  onRemoveShortcut,
  onReorderTile,
  onReorderShortcut,
  onAddShortcut,
}: {
  session: Session;
  home: LaunchItem | undefined;
  items: LaunchItem[];
  shortcuts: HubCardSetting[];
  /** How many shortcut places to offer. */
  shortcutSlots: number;
  profilePhoto: string | null;
  onProfilePhoto: (photo: string | null) => void;
  customizing: boolean;
  onRemoveTile: (item: LaunchItem) => void;
  onRemoveShortcut: (id: string) => void;
  onReorderTile: (sourceId: string, targetId: string) => void;
  onReorderShortcut: (sourceId: string, targetId: string) => void;
  onAddShortcut: () => void;
}) {
  const { draggingCardId, dragOverCardId, dragOffset, dragOrigin, startCardDrag } =
    useHubCardDrag();
  const tiles = items.filter((item) => item.label !== "Dashboard" && item.label !== "Overview");
  const availableShortcuts = shortcuts.filter((card) => card.to);
  const tileIds = tiles.map(hubLaunchItemId);
  const shortcutIds = availableShortcuts.map((card) => card.id);
  const extraTileCount = Math.max(0, tiles.length - 6);
  const extraRemainder = extraTileCount % 4;
  const draggingTileIndex = tileIds.indexOf(draggingCardId ?? "");
  const emptySlots = Math.max(0, shortcutSlots - availableShortcuts.length);
  const firstName = session.name.split(" ")[0];
  const homeLabel = home?.label ?? "Dashboard";
  const [photoError, setPhotoError] = useState("");
  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      onProfilePhoto(await shrinkImage(file, 900, 1400));
      setPhotoError("");
    } catch (problem) {
      setPhotoError((problem as Error).message);
    }
  };
  const profileContent = (
    <>
      <img className="hub-simple-profile-image" src={profilePhoto ?? portrait} alt="" />
      <span className="hub-simple-profile-brand">
        <Logo wordmark={false} />
      </span>
      <span className="hub-simple-profile-caption">
        <span className="hub-simple-profile-name">{firstName}’s</span>
        <strong>{homeLabel === "Overview" ? "overview" : "dashboard"}</strong>
        <span className="hub-simple-profile-role">
          {roleLabel(session.role, session.accountType)}
        </span>
      </span>
    </>
  );
  const dragProps = (
    id: string,
    index: number,
    ids: string[],
    onReorder: (sourceId: string, targetId: string) => void,
  ) => ({
    "data-hub-card-id": id,
    "data-dragging": draggingCardId === id,
    "data-drag-over": dragOverCardId === id,
    "aria-roledescription": customizing ? "draggable card" : undefined,
    tabIndex: customizing ? 0 : undefined,
    onDragStart: (event: DragEvent<HTMLElement>) => event.preventDefault(),
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (!customizing) return;
      startCardDrag(id, event, {
        onPreview: () => {},
        onDrop: onReorder,
        onCancel: () => {},
      });
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (!customizing || !event.altKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const targetId = ids[index + (event.key === "ArrowLeft" ? -1 : 1)];
      if (targetId) onReorder(id, targetId);
    },
    style: {
      order: index + 1,
      ...(customizing
        ? { cursor: draggingCardId === id ? "grabbing" : "grab", touchAction: "none" as const }
        : {}),
      ...(draggingCardId === id && dragOrigin
        ? {
            position: "absolute" as const,
            left: dragOrigin.left,
            top: dragOrigin.top,
            width: dragOrigin.width,
            height: dragOrigin.height,
            transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) scale(1.03)`,
            zIndex: 80,
            pointerEvents: "none" as const,
          }
        : {}),
    },
  });

  return (
    <section
      className="hub-simple-grid relative z-10 mx-auto"
      aria-label="Quick launch"
      data-has-extra={extraTileCount > 0}
      data-customizing={customizing}
    >
      <h1 className="sr-only">{firstName}’s Play Hub</h1>
      <div className="hub-simple-cards" data-extra-remainder={extraRemainder}>
        {draggingCardId && tileIds.includes(draggingCardId) && dragOrigin && (
          <div
            aria-hidden
            className="hub-drag-placeholder hub-simple-drag-placeholder"
            data-extra-slot={
              extraRemainder === 1 && draggingTileIndex === tiles.length - 1
                ? "single"
                : extraRemainder > 1 && draggingTileIndex === tiles.length - extraRemainder
                  ? "start"
                  : undefined
            }
            style={{ order: tileIds.indexOf(draggingCardId) + 1, height: dragOrigin.height }}
          />
        )}
        {customizing ? (
          <div className="hub-simple-profile" data-simple-profile>
            {profileContent}
            <div className="hub-simple-photo-controls">
              <label className="hub-simple-photo-button">
                <ImagePlus aria-hidden />
                Change photo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    void uploadPhoto(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
              {profilePhoto && (
                <button
                  type="button"
                  className="hub-simple-photo-button"
                  onClick={() => onProfilePhoto(null)}
                >
                  <RotateCcw aria-hidden />
                  Reset photo
                </button>
              )}
              {photoError && (
                <p role="alert" className="hub-simple-photo-error">
                  {photoError}
                </p>
              )}
            </div>
          </div>
        ) : (
          <Link
            to={(home?.to ?? "/dashboard") as never}
            className="hub-simple-profile"
            aria-label={`Open ${homeLabel}`}
            data-simple-profile
          >
            {profileContent}
          </Link>
        )}

        {tiles.map((item, index) => {
          const Icon = item.icon;
          const serviceImage = SERVICE_ICON_IMAGES.get(Icon);
          const id = hubLaunchItemId(item);
          return (
            <div
              className="hub-simple-tile-wrap"
              key={id}
              {...dragProps(id, index, tileIds, onReorderTile)}
            >
              <Link
                to={item.to as never}
                className="hub-simple-tile"
                data-tone={index % 3 === 0 ? "cream" : index % 3 === 1 ? "navy" : "blue"}
                data-simple-destination={item.to}
                onClick={(event) => {
                  if (customizing) event.preventDefault();
                }}
              >
                <span className="hub-simple-icon" data-icon={item.label} aria-hidden>
                  {serviceImage && item.label === "Ask Attune" ? (
                    <img className="hub-simple-attune-image" src={serviceImage} alt="" />
                  ) : serviceImage ? (
                    <span
                      className="hub-simple-icon-image"
                      style={{ maskImage: `url("${serviceImage}")` }}
                    />
                  ) : (
                    <Icon strokeWidth={1.75} />
                  )}
                </span>
                <span>{item.label}</span>
              </Link>
              {customizing && (
                <button
                  type="button"
                  className="hub-simple-remove"
                  aria-label={`Remove ${item.label} tile`}
                  onClick={() => onRemoveTile(item)}
                >
                  <Minus aria-hidden />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="hub-simple-shortcuts">
        {draggingCardId && shortcutIds.includes(draggingCardId) && dragOrigin && (
          <div
            aria-hidden
            className="hub-drag-placeholder hub-simple-drag-placeholder"
            style={{ order: shortcutIds.indexOf(draggingCardId) + 1, height: dragOrigin.height }}
          />
        )}
        {availableShortcuts.map((card, index) => (
          <div
            key={card.id}
            className="hub-simple-shortcut-wrap"
            {...dragProps(card.id, index, shortcutIds, onReorderShortcut)}
          >
            <Link
              to={card.to as never}
              className="hub-simple-shortcut"
              onClick={(event) => {
                if (customizing) event.preventDefault();
              }}
            >
              <span>{card.title}</span>
              <ArrowUpRight aria-hidden />
            </Link>
            {customizing && (
              <button
                type="button"
                className="hub-simple-remove"
                aria-label={`Remove ${card.title}`}
                onClick={() => onRemoveShortcut(card.id)}
              >
                <Minus aria-hidden />
              </button>
            )}
          </div>
        ))}

        {Array.from({ length: emptySlots }, (_, index) => (
          <button
            key={index}
            type="button"
            className="hub-simple-shortcut"
            style={{ order: availableShortcuts.length + index + 1 }}
            onClick={onAddShortcut}
            aria-label={`Add shortcut ${availableShortcuts.length + index + 1}`}
          >
            <span>Shortcut {availableShortcuts.length + index + 1}</span>
            <Plus aria-hidden />
          </button>
        ))}
      </div>
    </section>
  );
}
