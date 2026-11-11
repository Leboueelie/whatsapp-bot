import { execFile } from "child_process";
import fs from "fs";
import sharp from "sharp";
import { tmpPath, cleanEnv } from "./utils";

const SIZE = 512;

export async function imageToSticker(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90 })
    .toBuffer();
}

export async function videoToSticker(buffer: Buffer): Promise<Buffer> {
  const inFile = tmpPath(".mp4");
  const outFile = tmpPath(".webp");
  fs.writeFileSync(inFile, buffer);
  await new Promise<void>((resolve, reject) => {
    execFile(
      "ffmpeg",
      [
        "-i",
        inFile,
        "-t",
        "10",
        "-vf",
        `scale='min(${SIZE},iw)':-2:force_original_aspect_ratio=decrease,pad=${SIZE}:${SIZE}:-1:-1:color=black@0.0,fps=15`,
        "-loop",
        "0",
        "-preset",
        "default",
        "-an",
        "-vsync",
        "0",
        "-c:v",
        "libwebp",
        "-lossless",
        "0",
        "-q:v",
        "70",
        "-y",
        outFile,
      ],
      { timeout: 60_000, env: cleanEnv() },
      (err) => (err ? reject(err) : resolve())
    );
  });
  const out = fs.readFileSync(outFile);
  fs.rmSync(inFile, { force: true });
  fs.rmSync(outFile, { force: true });
  return out;
}

export async function textToSticker(text: string, author = ""): Promise<Buffer> {
  const lines = text.split("\n").slice(0, 20).map((l) => l || " ");
  const wrapped = lines.map((l) =>
    l.length > 28 ? l.slice(0, 28) : l
  );
  const body = wrapped.join("\n");
  const authorLine = author ? `\n\n~ ${author}` : "";
  const svg = `<svg width="${SIZE}" height="${SIZE}">
    <rect width="100%" height="100%" fill="#1f2937"/>
    <text x="50%" y="45%" fill="#ffffff" font-size="40" font-family="sans-serif"
      text-anchor="middle" dominant-baseline="middle">${escapeXml(body)}${escapeXml(authorLine)}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 90 }).toBuffer();
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function stickerToImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer).png().toBuffer();
}
