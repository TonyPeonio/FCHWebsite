// Quick photo resizing in the browser, used before uploads (portal and the website's inquiry form).

/**
 * Scales a photo down so its longest side is at most `maxSide` and saves it as a JPEG, in one pass.
 * Much quicker than browser-image-compression's repeated attempts (a fraction of a second for a
 * phone photo, where that could take many seconds), so callers try this first and fall back to the
 * library when it gives null: an old browser, or a photo too large for the device to decode.
 * The photo's rotation is applied; its other details (location, camera) aren't copied across.
 */
export async function fastJpeg(file: Blob, maxSide: number, quality: number): Promise<Blob | null> {
  if (typeof createImageBitmap !== "function") return null;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    let source: ImageBitmap | HTMLCanvasElement = bitmap;
    let width = bitmap.width;
    let height = bitmap.height;
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale));
    // Halve repeatedly on the way down: one big jump (e.g. to a thumbnail) looks jagged.
    for (;;) {
      const last = width / 2 <= targetWidth || height / 2 <= targetHeight;
      width = last ? targetWidth : Math.round(width / 2);
      height = last ? targetHeight : Math.round(height / 2);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      // White behind see-through areas, which JPEG would otherwise turn black.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source, 0, 0, width, height);
      source = canvas;
      if (last) break;
    }
    const out = source as HTMLCanvasElement;
    return await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/jpeg", quality));
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}
