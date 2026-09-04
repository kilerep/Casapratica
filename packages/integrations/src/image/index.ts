import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import type { BrandKit, CreativeOutput } from "@casapratica/domain";

export interface ImageCompositionProvider {
  compose(input: { sourcePath: string; outputKey: string; output: CreativeOutput; brandKit: BrandKit }): Promise<{ storageKey: string; width: number; height: number; mimeType: "image/png" }>;
}
export interface ImageGenerationProvider { generateBackground(prompt: string): Promise<{ storageKey: string; mimeType: string }> }

const xml = (value: string) => value.replace(/[<>&'\"]/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[char]!);

export class SharpImageCompositionProvider implements ImageCompositionProvider {
  constructor(private readonly outputRoot: string) {}

  async compose(input: { sourcePath: string; outputKey: string; output: CreativeOutput; brandKit: BrandKit }) {
    const { width, height } = input.output.size;
    const destination = resolve(this.outputRoot, input.outputKey);
    await mkdir(dirname(destination), { recursive: true });
    const content = input.output.overlays.filter(item => item.kind !== "BRAND");
    const overlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="${Math.round(height * .72)}" width="${width}" height="${Math.round(height * .28)}" fill="${input.brandKit.colors.background}" fill-opacity="0.94"/>${content.map((item, index) => `<text x="${Math.round(width * item.x)}" y="${Math.round(height * item.y)}" font-family="Arial, sans-serif" font-size="${index === 0 ? Math.round(width * .044) : Math.round(width * .029)}" font-weight="${index === 0 ? 700 : 400}" fill="${input.brandKit.colors.text}">${xml(item.text)}</text>`).join("")}<text x="${Math.round(width * .94)}" y="${Math.round(height * .965)}" text-anchor="end" font-family="Arial, sans-serif" font-size="${Math.round(width * .02)}" fill="${input.brandKit.colors.primary}">CasaPrática</text></svg>`);
    await sharp(input.sourcePath).resize(width, height, { fit: "contain", background: input.brandKit.colors.background }).composite([{ input: overlay, top: 0, left: 0 }]).png().toFile(destination);
    const metadata = await sharp(destination).metadata();
    if (metadata.width !== width || metadata.height !== height) throw new Error("creative_dimensions_mismatch");
    return { storageKey: destination, width, height, mimeType: "image/png" as const };
  }
}
