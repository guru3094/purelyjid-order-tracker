export const DESIGN_CATEGORIES = ["Ganesha", "Religious Symbols", "Wedding Motifs", "Decorative Designs"] as const;
export type CutOutline = { path: string; bounds: { x1: number; y1: number; x2: number; y2: number }; fillRule: "evenodd" | "nonzero" };
export type CatalogueDesign = { id: string; code: string; name: string; category: string; width: number; height: number; published: boolean; revision: string };
export type CatalogueSelection = { id: string; design: CatalogueDesign; sizeBy: "width" | "height"; size: string; quantity: string; color: string };
export const designPreview = (design: CatalogueDesign) => `/api/vinyl-designs/${design.id}/preview?v=${encodeURIComponent(design.revision)}`;
export function catalogueDimensions(item: CatalogueSelection) {
  const size = Number(item.size);
  const scale = size / (item.sizeBy === "width" ? item.design.width : item.design.height);
  return { width: item.design.width * scale, height: item.design.height * scale };
}
export function validateSelection(item: CatalogueSelection) {
  const size = Number(item.size), quantity = Number(item.quantity);
  if (!Number.isFinite(size) || size < .1 || size > 29) throw new Error(`${item.design.code}: size must be 0.1–29 cm.`);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new Error(`${item.design.code}: quantity must be 1–100.`);
  return catalogueDimensions(item);
}
