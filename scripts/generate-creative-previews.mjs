import { resolve } from "node:path";
import { DEFAULT_BRAND_KIT, creativeOutputSchema } from "../packages/domain/dist/index.js";
import { SharpImageCompositionProvider } from "../packages/integrations/dist/index.js";

const sourcePath = resolve("packages/integrations/src/image/fixtures/product.svg");
const outputRoot = resolve("var/creative-assets");
const provider = new SharpImageCompositionProvider(outputRoot);
const formats = [
  ["pinterest-1000x1500.png", "pinterest", 1000, 1500],
  ["facebook-portrait-1080x1350.png", "facebook", 1080, 1350],
  ["facebook-square-1080x1080.png", "facebook", 1080, 1080],
];

for (const [fileName, platform, width, height] of formats) {
  const output = creativeOutputSchema.parse({
    platform,
    size: { width, height },
    primaryImage: { imageUrl: sourcePath, score: 90, strengths: ["Produto visível"], risks: [], selectionReason: "Imagem fonte preservada" },
    layout: { template: "PHOTO_FIRST", width, height, safeCrop: { strategy: "contain", preserveProduct: true, criticalAreaCovered: false }, contrastRatio: 7, overlayBackground: true },
    overlays: [
      { kind: "PRODUCT_NAME", text: "Carrinho Organizador", confirmed: true, x: .06, y: .78, maxWidth: .88 },
      { kind: "FACT", text: "4 andares", confirmed: true, x: .06, y: .83, maxWidth: .88 },
      { kind: "FACT", text: "Com rodinhas", confirmed: true, x: .06, y: .88, maxWidth: .88 },
      { kind: "BRAND", text: "CasaPrática", confirmed: true, x: .75, y: .96, maxWidth: .2 },
    ],
    brandPlacement: "BOTTOM_RIGHT",
    price: null,
    validation: { valid: true, errors: [], warnings: [] },
    status: "READY",
    previewReference: null,
    metadata: { sourceImage: sourcePath, generatedWithAi: false, productFacts: 2 },
  });
  const rendered = await provider.compose({ sourcePath, outputKey: `previews/${fileName}`, output, brandKit: DEFAULT_BRAND_KIT });
  process.stdout.write(`${rendered.storageKey} ${rendered.width}x${rendered.height} png\n`);
}
