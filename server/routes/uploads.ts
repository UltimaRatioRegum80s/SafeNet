import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 2,
    fileSize: 8 * 1024 * 1024, // 8MB input cap (pre-compress)
  },
});

const ALLOWED_MIME = new Set([
  "image/jpeg","image/png","image/webp","image/avif","image/heic","image/heif",
]);

router.post("/", upload.array("files", 2), async (req, res, next) => {
  try {
    const files = (req.files as any[]) || [];
    if (!files.length) return res.status(400).json({ ok: false, error: "No files" });

    const outDir = path.join(process.cwd(), "public/uploads");
    await fs.mkdir(outDir, { recursive: true });

    const results = [];
    for (const f of files) {
      // Validate by magic bytes (never trust Content-Type)
      const ft = await fileTypeFromBuffer(f.buffer);
      const mime = ft?.mime || f.mimetype;
      if (!mime || !ALLOWED_MIME.has(mime)) {
        return res.status(415).json({ ok: false, error: `Unsupported file type: ${mime || "unknown"}` });
      }

      // Process: strip metadata, honor EXIF orientation, resize, convert to webp (fallback jpeg)
      const base = sharp(f.buffer, { failOnError: false }).rotate(); // auto-orient, strips EXIF by default if we don't .withMetadata()

      const pipeline = base.resize({
        width: 1600, height: 1600, fit: "inside", withoutEnlargement: true,
      });

      // Try WebP first
      const webpId = randomUUID();
      const webpPath = path.join(outDir, `${webpId}.webp`);
      let data: Buffer | null = null;
      try {
        data = await pipeline.clone().webp({ quality: 78 }).toBuffer();
        
        // Output size ceiling - shrink if too large
        const MAX_OUT = 800 * 1024; // 800 KB
        if (data.length > MAX_OUT) {
          const smaller = await sharp(data).webp({ quality: 70 }).toBuffer();
          if (smaller.length < data.length) data = smaller;
          if (data.length > MAX_OUT) {
            return res.status(413).json({
              ok: false,
              error: "Image too large after compression. Try a smaller photo.",
            });
          }
        }
        
        await fs.writeFile(webpPath, data);
        const { width, height } = await sharp(data).metadata();
        results.push({
          url: `/uploads/${webpId}.webp`,
          width, height, size: data.length, format: "webp",
        });
        continue;
      } catch {
        // fall through to jpeg
      }

      // JPEG fallback
      const jpgId = randomUUID();
      const jpgPath = path.join(outDir, `${jpgId}.jpg`);
      let jpgData = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      
      // Output size ceiling for JPEG too
      const MAX_OUT = 800 * 1024; // 800 KB
      if (jpgData.length > MAX_OUT) {
        const smaller = await sharp(jpgData).jpeg({ quality: 70, mozjpeg: true }).toBuffer();
        if (smaller.length < jpgData.length) jpgData = smaller;
        if (jpgData.length > MAX_OUT) {
          return res.status(413).json({
            ok: false,
            error: "Image too large after compression. Try a smaller photo.",
          });
        }
      }
      
      await fs.writeFile(jpgPath, jpgData);
      const { width, height } = await sharp(jpgData).metadata();
      results.push({
        url: `/uploads/${jpgId}.jpg`,
        width, height, size: jpgData.length, format: "jpeg",
      });
    }

    return res.status(201).json({ ok: true, files: results });
  } catch (e) {
    next(e);
  }
});

export default router;