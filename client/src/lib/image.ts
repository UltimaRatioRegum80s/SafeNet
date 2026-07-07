export async function compressImage(file: File, opts?: {
  maxEdge?: number; quality?: number; preferWebP?: boolean;
}): Promise<Blob> {
  const maxEdge = opts?.maxEdge ?? 1600;
  const quality = opts?.quality ?? 0.78;
  const preferWebP = opts?.preferWebP ?? true;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // cannot decode (e.g., HEIC in some browsers), let server handle

  const { width, height } = bitmap;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  // Prefer OffscreenCanvas when available (perf), fallback to Canvas
  const canvas: any = "OffscreenCanvas" in globalThis
    ? new (globalThis as any).OffscreenCanvas(outW, outH)
    : Object.assign(document.createElement("canvas"), { width: outW, height: outH });

  if (!("OffscreenCanvas" in globalThis)) {
    const c = canvas as HTMLCanvasElement;
    c.width = outW; c.height = outH;
  }

  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.drawImage(bitmap, 0, 0, outW, outH);

  const type = preferWebP && "image/webp" ? "image/webp" : "image/jpeg";
  const blob: Blob = await (canvas.convertToBlob
    ? canvas.convertToBlob({ type, quality })
    : new Promise((resolve) => (canvas as HTMLCanvasElement).toBlob(b => resolve(b!), type, quality))
  );

  try { (bitmap as any).close?.(); } catch {}
  return blob;
}

export function toFile(blob: Blob, original: File, ext = "webp") {
  return new File([blob], replaceExt(original.name, ext), { type: blob.type });
}

function replaceExt(name: string, ext: string) {
  const i = name.lastIndexOf(".");
  return (i > 0 ? name.slice(0, i) : name) + "." + ext.replace(/^\./, "");
}