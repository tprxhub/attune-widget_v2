/** Checks an uploaded picture and returns it as a JPEG data URL no larger than the given size. */
export async function shrinkImage(file: File, maxWidth: number, maxHeight: number) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 15_000_000) {
    throw new Error("Choose a PNG, JPEG, or WebP image under 15 MB.");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This image could not be opened. Try another file.");
  }
  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This image could not be opened. Try another file.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.78);
}
