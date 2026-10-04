// Client-side cut contour preparation. The output is path geometry, never an
// <image> element. Keep tracing separate from nesting so it can be replaced by
// a more sophisticated vectorizer without changing the mat optimizer.
import { svgPathBbox } from "svg-path-bbox";

export type ArtworkOutline = {
  path: string;
  bounds: { x1: number; y1: number; x2: number; y2: number };
  fillRule: "evenodd";
  pathCount: number;
};
type Point = { x: number; y: number };
type Edge = { start: Point; end: Point; direction: number };
const key = ({ x, y }: Point) => `${x},${y}`;

export async function traceArtwork(file: Blob, threshold: number, invert: boolean, minArea: number): Promise<ArtworkOutline> {
  const bitmap = await createImageBitmap(file);
  try {
    const size = Math.min(1, 650 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * size));
    const height = Math.max(1, Math.round(bitmap.height * size));
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("This browser cannot prepare image contours.");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const rgba = ctx.getImageData(0, 0, width, height).data;
    let hasTransparency = false;
    for (let i = 0; i < width * height; i++) if (rgba[i * 4 + 3] < 250) { hasTransparency = true; break; }
    const occupied = new Uint8Array(width * height);
    for (let i = 0; i < occupied.length; i++) {
      const offset = i * 4;
      const luminance = .2126 * rgba[offset] + .7152 * rgba[offset + 1] + .0722 * rgba[offset + 2];
      const present = hasTransparency ? rgba[offset + 3] >= threshold : luminance < threshold;
      occupied[i] = Number(invert ? !present : present);
    }
    const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && occupied[y * width + x] === 1;
    const edges: Edge[] = [];
    const byStart = new Map<string, number[]>();
    const add = (start: Point, end: Point, direction: number) => {
      const index = edges.push({ start, end, direction }) - 1;
      const from = key(start);
      const list = byStart.get(from) ?? [];
      list.push(index);
      byStart.set(from, list);
    };
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (filled(x, y)) {
      if (!filled(x, y - 1)) add({ x, y }, { x: x + 1, y }, 0);
      if (!filled(x + 1, y)) add({ x: x + 1, y }, { x: x + 1, y: y + 1 }, 1);
      if (!filled(x, y + 1)) add({ x: x + 1, y: y + 1 }, { x, y: y + 1 }, 2);
      if (!filled(x - 1, y)) add({ x, y: y + 1 }, { x, y }, 3);
    }
    const remaining = new Set(edges.map((_, i) => i));
    const loops: { corners: Point[]; signedArea: number }[] = [];
    const limit = edges.length + 1;
    while (remaining.size) {
      let current = remaining.values().next().value as number;
      const origin = edges[current].start;
      const polygon: Point[] = [origin];
      for (let steps = 0; steps < limit; steps++) {
        remaining.delete(current);
        const edge = edges[current];
        polygon.push(edge.end);
        if (edge.end.x === origin.x && edge.end.y === origin.y) break;
        const candidates = (byStart.get(key(edge.end)) ?? []).filter(i => remaining.has(i));
        if (!candidates.length) throw new Error("The image contour has an open edge. Try another threshold.");
        // At diagonal pixel contacts, follow the outline of each island.
        candidates.sort((a, b) => ((edges[a].direction - edge.direction + 4) % 4) - ((edges[b].direction - edge.direction + 4) % 4));
        current = candidates[0];
      }
      if (polygon.length < 4 || key(polygon.at(-1)!) !== key(origin)) throw new Error("Could not close the image contour.");
      const signedArea = polygon.slice(0, -1).reduce((sum, p, i) => {
        const q = polygon[i + 1]; return sum + p.x * q.y - q.x * p.y;
      }, 0) / 2;
      const corners = polygon.slice(0, -1).filter((p, i, list) => {
        const previous = list[(i - 1 + list.length) % list.length];
        const next = list[(i + 1) % list.length];
        return (p.x - previous.x) * (next.y - p.y) !== (p.y - previous.y) * (next.x - p.x);
      });
      if (corners.length >= 3) loops.push({ corners, signedArea });
    }
    // Positive loops bound foreground islands; negative loops bound their holes.
    // Removing a tiny island must remove its holes as well.
    const retainedIslands = loops.filter(loop => loop.signedArea > 0 && loop.signedArea >= minArea);
    const inside = (point: Point, polygon: Point[]) => {
      let enclosed = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i], b = polygon[j];
        if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) enclosed = !enclosed;
      }
      return enclosed;
    };
    const paths = loops.filter(loop => loop.signedArea > 0
      ? loop.signedArea >= minArea
      : retainedIslands.some(island => inside(loop.corners[0], island.corners)))
      .map(loop => `M${loop.corners.map(p => `${p.x} ${p.y}`).join("L")}Z`);
    if (!paths.length) throw new Error("No cut shape was found. Try a different threshold or request a clearer image.");
    const path = paths.join("");
    const [x1, y1, x2, y2] = svgPathBbox(path);
    if (x2 <= x1 || y2 <= y1) throw new Error("The image has no usable cut contour.");
    return { path, bounds: { x1, y1, x2, y2 }, fillRule: "evenodd", pathCount: paths.length };
  } finally { bitmap.close(); }
}
