import { DOMParser, type Element as XmlElement } from "@xmldom/xmldom";
import svgpath from "svgpath";
import { svgPathBbox } from "svg-path-bbox";
import paper from "paper";
import { getValidCanvaAccessToken } from "@/lib/canva/oauth";

const API = "https://api.canva.com/rest/v1";
const PAGE: Record<string, number> = { PF01: 1, PF02: 2, PF03: 3, PF04: 4, PF05: 5, PF06: 6, PF07: 7, PF08: 8 };
type Job = { job?: { id?: string; status?: string; result?: { design?: { id?: string } }; urls?: string[]; error?: { message?: string } } };
type Outline = { path: string; bounds: { x1: number; y1: number; x2: number; y2: number }; fillRule: "nonzero" | "evenodd" };

// Script letters can overlap in Canva. Weld the filled glyphs but determine
// counters by contour containment, not by the winding of the largest symbol.
// A solid heart can wind opposite to the letters without filling their holes.
function weldGlyphs(pathData: string[]): string {
  const scope = new paper.PaperScope();
  scope.setup(new scope.Size(1, 1));
  try {
    const glyphs: paper.CompoundPath[] = [];
    const contours = pathData.flatMap(data => [...new scope.CompoundPath(data).children] as paper.Path[]);
    const parents = contours.map((contour, index) => {
      const area = Math.abs(contour.area);
      if (area < 1e-8) throw new Error("Canva returned a zero-area glyph contour.");
      let parent = -1;
      let parentArea = Infinity;
      for (let other = 0; other < contours.length; other++) {
        if (other === index || Math.abs(contours[other].area) <= area ||
            !contours[other].bounds.contains(contour.bounds)) continue;
        const point = contour.getPointAt(contour.length * 0.25);
        if (point && contours[other].contains(point) && Math.abs(contours[other].area) < parentArea) {
          parent = other;
          parentArea = Math.abs(contours[other].area);
        }
      }
      return parent;
    });
    const depth = (index: number): number => parents[index] < 0 ? 0 : 1 + depth(parents[index]);
    for (let i = 0; i < contours.length; i++) {
      if (depth(i) % 2) continue;
      const glyph = new scope.CompoundPath("");
      const outer = contours[i].clone();
      if (outer.area < 0) outer.reverse();
      glyph.addChild(outer);
      for (let j = 0; j < contours.length; j++) {
        if (parents[j] !== i || depth(j) % 2 !== 1) continue;
        const hole = contours[j].clone();
        if (hole.area > 0) hole.reverse();
        glyph.addChild(hole);
      }
      glyphs.push(glyph);
    }
    if (!glyphs.length) throw new Error("Canva returned no closed glyph contours.");
    let welded: paper.PathItem = glyphs[0];
    for (const next of glyphs.slice(1)) {
      const joined = welded.unite(next, { insert: false });
      welded.remove();
      next.remove();
      welded = joined;
    }
    if (!welded.pathData) throw new Error("Could not weld the font outlines for cutting.");
    return welded.pathData;
  } finally {
    scope.project.remove();
  }
}

async function canva<T>(token: string, endpoint: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API}${endpoint}`, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(`Canva request failed (${response.status}). Check the Canva connection and template access.`);
  return response.json() as Promise<T>;
}

async function waitForJob(token: string, endpoint: string): Promise<Job["job"]> {
  for (let i = 0; i < 30; i++) {
    const data = await canva<Job>(token, endpoint);
    if (data.job?.status === "success") return data.job;
    if (data.job?.status === "failed") throw new Error(data.job.error?.message || "Canva job failed.");
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error("Canva timed out while preparing the cut outline.");
}

// Only accept SVG path geometry. If Canva flattened a text effect into an image,
// or the PDF converter did not produce valid outlines, fail closed.
export function extractOutline(svg: string): Outline {
  const errors: string[] = [];
  const doc = new DOMParser({ onError: (level, message) => { if (level === "error" || level === "fatalError") errors.push(message); } }).parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;
  if (errors.length || !root || root.localName !== "svg") throw new Error("Canva PDF conversion produced invalid SVG.");
  const viewBox = (root.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
  if (viewBox.length !== 4 || viewBox.some(v => !Number.isFinite(v)) || viewBox[2] <= 0 || viewBox[3] <= 0) {
    throw new Error("Canva returned a vector page without valid dimensions.");
  }
  const clipDefinitions = new Map<string, string[]>();
  // The PDF converter stores clipping outlines in <defs>. They are vectors,
  // but are not themselves cut shapes; resolve only internal clipPath paths.
  function readClip(node: XmlElement, transforms: string[]): string[] {
    const tag = node.localName || node.tagName;
    if (tag !== "clipPath" && tag !== "g" && tag !== "path") {
      throw new Error(`Canva export contains an unsupported ${tag} clipping definition.`);
    }
    const own = node.hasAttribute("transform") ? [node.getAttribute("transform")!, ...transforms] : transforms;
    if (tag === "path") {
      const data = node.getAttribute("d") || "";
      if (!data || !/[zZ]/.test(data)) throw new Error("Canva returned an open clipping path.");
      let transformed = svgpath(data);
      for (const transform of own) transformed = transformed.transform(transform);
      return [transformed.abs().round(5).toString()];
    }
    const result: string[] = [];
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 1) result.push(...readClip(child as XmlElement, own));
    }
    return result;
  }
  for (let child = root.firstChild; child; child = child.nextSibling) {
    if (child.nodeType !== 1 || (child as XmlElement).localName !== "defs") continue;
    for (let entry = child.firstChild; entry; entry = entry.nextSibling) {
      if (entry.nodeType !== 1) continue;
      const definition = entry as XmlElement;
      if (definition.localName !== "clipPath" ||
          (definition.hasAttribute("clipPathUnits") && definition.getAttribute("clipPathUnits") !== "userSpaceOnUse")) {
        throw new Error("Canva export contains a definition that cannot be turned into a cut outline.");
      }
      const id = definition.getAttribute("id") || "";
      if (!/^[A-Za-z_][\w.-]*$/.test(id) || clipDefinitions.has(id)) throw new Error("Canva returned an invalid clipping definition.");
      const parts = readClip(definition, []);
      if (!parts.length) throw new Error("Canva returned an empty clipping definition.");
      clipDefinitions.set(id, parts);
    }
  }
  const paths: { data: string; clips: string[] }[] = [];
  let rule: "nonzero" | "evenodd" | null = null;
  function visit(node: XmlElement, parentTransforms: string[], parentClips: string[]) {
    const tag = node.localName || node.tagName;
    if (["title", "desc", "metadata", "defs"].includes(tag)) return;
    if (tag !== "svg" && tag !== "g" && tag !== "path") {
      throw new Error(`Canva export contains ${tag} rather than text outlines. Remove effects/backgrounds from the font template.`);
    }
    if (node.hasAttribute("mask") || node.hasAttribute("filter") || node.hasAttribute("opacity")) {
      throw new Error("Canva export contains effects that cannot be safely used as cut paths.");
    }
    const transforms = node.hasAttribute("transform") ? [node.getAttribute("transform")!, ...parentTransforms] : parentTransforms;
    let clips = parentClips;
    if (node.hasAttribute("clip-path")) {
      const match = /^url\(#([A-Za-z_][\w.-]*)\)$/.exec((node.getAttribute("clip-path") || "").trim());
      const definition = match && clipDefinitions.get(match[1]);
      if (!definition) throw new Error("Canva export contains an unsupported clipping reference.");
      const transformed = definition.map(data => {
        let path = svgpath(data);
        for (const transform of transforms) path = path.transform(transform);
        return path.abs().round(5).toString();
      });
      clips = [...parentClips, weldGlyphs(transformed)];
    }
    if (tag === "path") {
      const data = node.getAttribute("d") || "";
      if (!data || !/[zZ]/.test(data)) throw new Error("Canva returned an open or empty path.");
      const fill = node.getAttribute("fill");
      if (fill === "none") throw new Error("Canva returned a stroke-only shape instead of filled glyphs.");
      let transformed = svgpath(data);
      for (const transform of transforms) transformed = transformed.transform(transform);
      transformed = transformed.abs().round(5);
      const segments: string[] = [];
      transformed.iterate(segment => { segments.push(segment[0]); });
      const [px1, py1, px2, py2] = svgPathBbox(transformed.toString());
      const white = /^#(?:fff|ffffff)$/i.test((fill || "").trim());
      const fullPage = Math.abs(px1 - viewBox[0]) < 0.02 && Math.abs(py1 - viewBox[1]) < 0.02 &&
        Math.abs(px2 - viewBox[0] - viewBox[2]) < 0.02 && Math.abs(py2 - viewBox[1] - viewBox[3]) < 0.02;
      const rectangle = segments.length === 5 && ["M", "L", "L", "L", "Z"].every((command, index) => segments[index] === command);
      if (white && fullPage && rectangle) return; // Canva PDF page backgrounds are not cut designs.
      if (white) throw new Error("Canva export contains a white shape other than the page background.");
      const pathRule = node.getAttribute("fill-rule") === "evenodd" ? "evenodd" : "nonzero";
      if (rule && rule !== pathRule) throw new Error("Canva returned mixed fill rules that cannot be merged into one cut design.");
      rule = pathRule;
      paths.push({ data: transformed.toString(), clips });
      return;
    }
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 1) visit(child as XmlElement, transforms, clips);
    }
  }
  visit(root, [], []);
  if (!paths.length) throw new Error("Canva returned no cut paths for this text.");
  const groups = new Map<string, { parts: string[]; clips: string[] }>();
  for (const item of paths) {
    const key = JSON.stringify(item.clips);
    if (!groups.has(key)) groups.set(key, { parts: [], clips: item.clips });
    groups.get(key)!.parts.push(item.data);
  }
  const visible: string[] = [];
  for (const group of groups.values()) {
    let path = weldGlyphs(group.parts);
    for (const clip of group.clips) {
      const scope = new paper.PaperScope();
      scope.setup(new scope.Size(1, 1));
      try {
        const clipped = new scope.CompoundPath(path).intersect(new scope.CompoundPath(clip), { insert: false });
        path = clipped.pathData || "";
      } finally {
        scope.project.remove();
      }
      if (!path) break;
    }
    if (path) visible.push(path);
  }
  if (!visible.length) throw new Error("Canva clipped all of the text outside the visible page.");
  const path = visible.length === 1 ? visible[0] : weldGlyphs(visible);
  const [x1, y1, x2, y2] = svgPathBbox(path);
  if (![x1, y1, x2, y2].every(Number.isFinite) || x2 <= x1 || y2 <= y1) throw new Error("Canva returned invalid outline bounds.");
  return { path, bounds: { x1, y1, x2, y2 }, fillRule: "nonzero" };
}

export async function generateCanvaOutline(content: string, fontCode: string): Promise<Outline> {
  const page = PAGE[fontCode];
  const designId = process.env.CANVA_VINYL_DESIGN_ID;
  if (!page || !designId) throw new Error("The Canva vinyl font template is not configured for this font.");
  const token = await getValidCanvaAccessToken();
  // The existing template has VINYL_TEXT on all eight pages, one text object on each.
  const job = await canva<Job>(token, "/autofills", {
    type: "create_from_design", design_id: designId,
    data: { VINYL_TEXT: { type: "text", text: content } },
    title: `PurelyJid Cut - ${content.slice(0, 50)}`,
  });
  if (!job.job?.id) throw new Error("Canva did not create an autofill job.");
  const filled = await waitForJob(token, `/autofills/${encodeURIComponent(job.job.id)}`);
  const filledId = filled?.result?.design?.id;
  if (!filledId) throw new Error("Canva did not return the filled design.");
  const exportJob = await canva<Job>(token, "/exports", {
    design_id: filledId, format: { type: "pdf", export_quality: "pro", pages: [page] },
  });
  if (!exportJob.job?.id) throw new Error("Canva did not create a PDF export job.");
  const exported = await waitForJob(token, `/exports/${encodeURIComponent(exportJob.job.id)}`);
  const url = exported?.urls?.[0];
  if (!url || new URL(url).protocol !== "https:") throw new Error("Canva returned no secure PDF download URL.");
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not download the Canva PDF (${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 20 * 1024 * 1024 || bytes.byteLength < 5 || String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-") {
    throw new Error("Canva did not return a valid PDF under 20 MB.");
  }
  const [{ transcodePdf }, { createNodePdfRuntime }] = await Promise.all([
    import("@/lib/cricut/pdf-transcoder.mjs"), import("@svgsketch/pdf/node"),
  ]);
  const vector = await transcodePdf(bytes, {
    // Supply a statically resolvable module import. The converter's default
    // file:// import can escape Next's server bundle on Windows deployments.
    runtime: createNodePdfRuntime({
      loadModule: () => import("pdfjs-dist/legacy/build/pdf.mjs"),
    }),
    textMode: "outline", layers: "flatten", pages: [1],
  });
  // Canva emits the Monarda font as Type3 glyph procedures. Its PDF marks an
  // unpainted space as "glyph-outline-missing" even though the visible vector
  // output is complete. Tolerate that diagnostic only up to the number of
  // whitespace characters in the requested text.
  const missing = vector.diagnostics.filter(d => d.code === "glyph-outline-missing")
    .reduce((sum, d) => sum + (d.count || 1), 0);
  const spaces = (content.match(/\s/g) || []).length;
  if (vector.stats.images > 0 || vector.stats.textsOutlined < vector.stats.texts ||
      vector.fonts.some(font => font.unmappableGlyphs > 0) || missing > spaces ||
      vector.fonts.some(font => font.glyphsShown > 0 && !font.outlined && !font.isType3)) {
    throw new Error("Canva PDF did not provide complete vector font outlines. Remove effects or use a different font page.");
  }
  return extractOutline(vector.svg);
}
