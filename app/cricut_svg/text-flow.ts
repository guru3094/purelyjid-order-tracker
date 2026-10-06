export type TextOutline = {
  path: string;
  bounds: { x1: number; y1: number; x2: number; y2: number };
  fillRule: "nonzero" | "evenodd";
};

export type WrappedLine = { content: string; outline: TextOutline; scale: number; width: number; height: number };

const graphemes = (value: string) => Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value), part => part.segment);

function breakLine(value: string, target: number): [string, string] {
  const parts = graphemes(value);
  const limit = Math.max(1, Math.min(parts.length - 1, target));
  let split = limit;
  // Keep a whole word together whenever a space exists before the line edge.
  // A single word longer than the edge must still break by grapheme.
  for (let i = limit; i >= 1; i--) {
    if (/^\s$/u.test(parts[i - 1])) { split = i; break; }
  }
  return [parts.slice(0, split).join("").trimEnd(), parts.slice(split).join("").trimStart()];
}

// Requested width is the nominal width of the original unbroken text. When
// wrapping is needed, keep the same glyph scale on every line instead of
// shrinking a customer's letters to make a single line fit across the mat.
export async function wrapText(
  content: string,
  requestedWidth: number,
  maxLineWidth: number,
  outlineFor: (line: string) => Promise<TextOutline>,
  originalOutline?: TextOutline,
): Promise<WrappedLine[]> {
  const fullOutline = originalOutline || await outlineFor(content);
  const fullWidth = fullOutline.bounds.x2 - fullOutline.bounds.x1;
  if (!Number.isFinite(fullWidth) || fullWidth <= 0) throw new Error("Canva returned invalid text bounds.");
  const scale = requestedWidth / fullWidth;
  if (requestedWidth <= maxLineWidth) {
    return [{ content, outline: fullOutline, scale, width: requestedWidth,
      height: (fullOutline.bounds.y2 - fullOutline.bounds.y1) * scale }];
  }
  const count = graphemes(content).length;
  const initialLimit = Math.max(1, Math.floor(count * maxLineWidth / requestedWidth * 0.95));
  const lines: string[] = [];
  let remaining = content;
  while (graphemes(remaining).length > initialLimit) {
    const [line, rest] = breakLine(remaining, initialLimit);
    if (!line || !rest) break;
    lines.push(line);
    remaining = rest;
  }
  lines.push(remaining);

  for (let attempt = 0; attempt <= count; attempt++) {
    const outlines: TextOutline[] = [];
    for (const line of lines) outlines.push(await outlineFor(line));
    const widths = outlines.map(outline => outline.bounds.x2 - outline.bounds.x1);
    if (widths.some(width => !Number.isFinite(width) || width <= 0)) throw new Error("Canva returned invalid line widths.");
    const overflow = widths.findIndex(width => width * scale > maxLineWidth + 0.01);
    if (overflow < 0) return lines.map((line, i) => ({
      content: line, outline: outlines[i], scale, width: widths[i] * scale,
      height: (outlines[i].bounds.y2 - outlines[i].bounds.y1) * scale,
    }));
    const length = graphemes(lines[overflow]).length;
    if (length < 2) throw new Error("One character exceeds the mat's cuttable width at the requested size.");
    const target = Math.max(1, Math.floor(length * maxLineWidth / (widths[overflow] * scale) * 0.94));
    const [first, second] = breakLine(lines[overflow], target);
    if (!first || !second) throw new Error("This content cannot be wrapped at its requested size.");
    lines.splice(overflow, 1, first, second);
  }
  throw new Error("Could not fit this content into horizontal cut lines.");
}
