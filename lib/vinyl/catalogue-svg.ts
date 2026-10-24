import { DOMParser, type Element } from "@xmldom/xmldom";
import svgpath from "svgpath";
import paper from "paper";
import { svgPathBbox } from "svg-path-bbox";
import type { CutOutline } from "./catalogue-types";

// Strict path-only import. Rebuild geometry; never serve uploaded SVG markup.
// Export text as outlines and expand strokes before uploading.
export function normalizeCatalogueSvg(svg: string): CutOutline {
  if (Buffer.byteLength(svg) > 500_000 || /<!DOCTYPE|<!ENTITY/i.test(svg)) throw new Error("SVG must be under 500 KB and cannot contain document entities.");
  const errors: string[] = [];
  const doc = new DOMParser({ onError: (level, message) => { if (level !== "warning") errors.push(message); } }).parseFromString(svg, "image/svg+xml");
  if (errors.length || doc.documentElement?.localName !== "svg") throw new Error("Upload a valid SVG.");
  const paths: string[] = [];
  let rule: CutOutline["fillRule"] | undefined;
  function visit(node: Element, transforms: string[], fill: string, inheritedRule: string) {
    const tag = node.localName || node.tagName;
    if (["title", "desc", "metadata"].includes(tag)) return;
    if (tag === "defs" && node.getElementsByTagName("*").length === 0) return;
    if (!["svg", "g", "path"].includes(tag)) throw new Error(`Unsupported ${tag}. Export a flattened SVG with filled paths only; expand shapes, text and strokes first.`);
    for (let i = 0; i < node.attributes.length; i++) {
      const a = node.attributes.item(i)!;
      if (/^on/i.test((a.name || "")) || ["href", "xlink:href", "clip-path", "mask", "filter", "opacity", "class", "display", "visibility"].includes((a.name || ""))) throw new Error("Remove scripts, references, styles and effects from the SVG before uploading.");
    }
    const style = Object.fromEntries((node.getAttribute("style") || "").split(";").filter(Boolean).map(part => part.split(":").map(s => s.trim())));
    if (Object.keys(style).some(k => !["fill", "fill-rule", "stroke", "stroke-width"].includes(k))) throw new Error("Remove SVG styles except fill and fill-rule; flatten effects first.");
    const stroke = style.stroke || node.getAttribute("stroke");
    if (stroke && stroke !== "none") throw new Error("Expand strokes to filled paths before uploading.");
    const nextFill = style.fill || node.getAttribute("fill") || fill;
    if (/url\(/i.test(nextFill)) throw new Error("Gradient or referenced fills must be flattened first.");
    const nextRule = style["fill-rule"] || node.getAttribute("fill-rule") || inheritedRule;
    if (!["nonzero", "evenodd"].includes(nextRule)) throw new Error("Unsupported fill rule.");
    const nextTransforms = node.hasAttribute("transform") ? [node.getAttribute("transform")!, ...transforms] : transforms;
    if (nextTransforms.some(t => !/^(?:\s*(?:matrix|translate|scale|rotate|skewX|skewY)\s*\([\d.eE+,\s-]+\)\s*)+$/.test(t))) throw new Error("Invalid SVG transform.");
    if (tag === "path" && nextFill !== "none") {
      const data = node.getAttribute("d") || "";
      let path = svgpath(data).abs();
      if ((path as unknown as { err?: string }).err || !data) throw new Error("SVG contains an invalid path.");
      let open = false, valid = true;
      path.iterate(segment => { if (segment[0] === "M") { if (open) valid = false; open = true; } else if (segment[0] === "Z") open = false; });
      if (open || !valid) throw new Error("Every cut contour must be closed. Close open paths before uploading.");
      if (rule && rule !== nextRule) throw new Error("Use one consistent fill rule across the flattened SVG.");
      rule = nextRule as CutOutline["fillRule"];
      for (const transform of nextTransforms) path = path.transform(transform);
      paths.push(path.abs().round(5).toString());
    }
    for (let child = node.firstChild; child; child = child.nextSibling) if (child.nodeType === 1) visit(child as Element, nextTransforms, nextFill, nextRule);
  }
  visit(doc.documentElement!, [], "black", "nonzero");
  // Independent filled elements paint a union, even when their fill rule is
  // evenodd. Concatenating them directly could punch holes at overlaps.
  let path = paths.join(" ");
  if (paths.length > 1) {
    const scope = new paper.PaperScope();
    scope.setup(new scope.Size(1, 1));
    try {
      let united: paper.PathItem = new scope.CompoundPath(paths[0]);
      united.fillRule = rule || "nonzero";
      for (const nextPath of paths.slice(1)) {
        const next = new scope.CompoundPath(nextPath);
        next.fillRule = rule || "nonzero";
        const combined = united.unite(next, { insert: false });
        united.remove(); next.remove(); united = combined;
      }
      path = united.pathData;
      rule = "nonzero";
    } finally { scope.project.remove(); }
  }
  if (!path || path.length > 200_000) throw new Error("SVG needs filled cut paths and must have less than 200,000 path characters.");
  const [x1, y1, x2, y2] = svgPathBbox(path);
  if (![x1, y1, x2, y2].every(n => Number.isFinite(n) && Math.abs(n) < 1e7) || x2 <= x1 || y2 <= y1) throw new Error("Invalid or empty SVG bounds.");
  return { path, bounds: { x1, y1, x2, y2 }, fillRule: rule || "nonzero" };
}
export function outlineSvg(outline: CutOutline) {
  const { x1, y1, x2, y2 } = outline.bounds;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x1} ${y1} ${x2-x1} ${y2-y1}"><path fill="#26343a" fill-rule="${outline.fillRule}" d="${outline.path}"/></svg>`;
}
