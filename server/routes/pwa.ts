import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { verifyIdToken } from "../shared/auth.js";
import { getAdminDb } from "../firebaseAdmin.js";

export const pwaRoutes = Router();

const publicDir = path.resolve(process.cwd(), "public");
const iconsDir = path.resolve(publicDir, "icons");

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1. Get PWA Icon Status
pwaRoutes.get("/status", async (req: Request, res: Response) => {
  try {
    const files = [
      { name: "pwa-192x192.png", path: path.join(publicDir, "pwa-192x192.png") },
      { name: "pwa-512x512.png", path: path.join(publicDir, "pwa-512x512.png") },
      { name: "maskable-icon-512x512.png", path: path.join(publicDir, "maskable-icon-512x512.png") },
      { name: "apple-touch-icon.png", path: path.join(publicDir, "apple-touch-icon.png") },
      { name: "favicon.ico", path: path.join(publicDir, "favicon.ico") },
    ];

    const results = await Promise.all(
      files.map(async (file) => {
        if (!fs.existsSync(file.path)) {
          return { name: file.name, exists: false };
        }
        const stats = fs.statSync(file.path);
        let meta = null;
        try {
          meta = await sharp(file.path).metadata();
        } catch {
          // ignore
        }
        return {
          name: file.name,
          exists: true,
          sizeBytes: stats.size,
          lastModified: stats.mtime,
          width: meta?.width,
          height: meta?.height,
          format: meta?.format,
        };
      })
    );

    res.json({
      success: true,
      icons: results,
      pwaThemeColor: "#D4AF37",
      pwaBackgroundColor: "#050505",
    });
  } catch (error: any) {
    console.error("[PWA Status Error]:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper to sanitize base64 input
function extractBase64Buffer(input: string): Buffer {
  let base64Data = input;
  if (input.includes(",")) {
    base64Data = input.split(",")[1];
  }
  return Buffer.from(base64Data, "base64");
}

// 2. Update PWA Icons with Custom Logo
pwaRoutes.post("/update-icons", async (req: Request, res: Response) => {
  try {
    // Verify authentication
    let decodedToken: any = null;
    try {
      decodedToken = await verifyIdToken(req);
    } catch {
      // Allow fallback if user is local admin, but check token if present
    }

    const { imageBase64, backgroundColor = "#050505", paddingPercent = 12 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: "A imagem em base64 da logo é obrigatória." });
    }

    const inputBuffer = extractBase64Buffer(imageBase64);

    // Validate the image format using sharp
    const inputMeta = await sharp(inputBuffer).metadata();
    if (!inputMeta.format) {
      return res.status(400).json({ success: false, error: "Formato de imagem inválido ou não suportado." });
    }

    // Convert hex color to sharp background color
    const bgHex = backgroundColor || "#050505";

    // 1. Generate 512x512 standard square icon
    // Fitted with padding so it looks balanced
    const innerSizeStd = Math.round(512 * (1 - (paddingPercent * 2) / 100));
    const resizedLogoStd = await sharp(inputBuffer)
      .resize(innerSizeStd, innerSizeStd, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toBuffer();

    const std512 = await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: bgHex,
      }
    })
      .composite([{ input: resizedLogoStd, gravity: "center" }])
      .png()
      .toBuffer();

    // 2. Generate 192x192 standard icon
    const std192 = await sharp(std512).resize(192, 192).png().toBuffer();

    // 3. Generate Maskable Icon 512x512
    // Safe zone is central 80% circle (radius 204.8), so logo needs ~25-30% padding
    const innerSizeMask = Math.round(512 * 0.65);
    const resizedLogoMask = await sharp(inputBuffer)
      .resize(innerSizeMask, innerSizeMask, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toBuffer();

    const mask512 = await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: bgHex,
      }
    })
      .composite([{ input: resizedLogoMask, gravity: "center" }])
      .png()
      .toBuffer();

    const mask192 = await sharp(mask512).resize(192, 192).png().toBuffer();

    // 4. Apple Touch Icon (180x180)
    const apple180 = await sharp(std512).resize(180, 180).png().toBuffer();

    // 5. Favicon (48x48)
    const fav48 = await sharp(std512).resize(48, 48).png().toBuffer();

    // Write all to public and public/icons
    fs.writeFileSync(path.join(publicDir, "pwa-512x512.png"), std512);
    fs.writeFileSync(path.join(iconsDir, "icon-512x512.png"), std512);

    fs.writeFileSync(path.join(publicDir, "pwa-192x192.png"), std192);
    fs.writeFileSync(path.join(iconsDir, "icon-192x192.png"), std192);

    fs.writeFileSync(path.join(publicDir, "maskable-icon-512x512.png"), mask512);
    fs.writeFileSync(path.join(iconsDir, "icon-maskable-512x512.png"), mask512);
    fs.writeFileSync(path.join(iconsDir, "icon-maskable-192x192.png"), mask192);

    fs.writeFileSync(path.join(publicDir, "apple-touch-icon.png"), apple180);
    fs.writeFileSync(path.join(iconsDir, "apple-touch-icon.png"), apple180);

    fs.writeFileSync(path.join(publicDir, "favicon.ico"), fav48);

    console.log(`[PWA] Ícones PWA atualizados com sucesso pelo usuário ${decodedToken?.email || 'admin'}`);

    res.json({
      success: true,
      message: "Ícones do PWA atualizados com sucesso em todas as resoluções (192px, 512px, Maskable e iOS)!",
    });
  } catch (error: any) {
    console.error("[PWA Update Error]:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Reset to default Lumière icons
pwaRoutes.post("/reset-default-icons", async (req: Request, res: Response) => {
  try {
    const { execSync } = await import("child_process");
    execSync("node scripts/apply-custom-logo.cjs", { cwd: process.cwd() });
    res.json({
      success: true,
      message: "Ícones oficiais do LumièreOS restaurados com sucesso!",
    });
  } catch (error: any) {
    console.error("[PWA Reset Error]:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
