// Count visible characters, including spaces and symbols. A composed emoji or
// accented letter is one character rather than several UTF-16 code units.
export function vinylCharacterCount(content: string): number {
  return [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(content)].length;
}
export function vinylMaximumWidth(content: string): number {
  const count = vinylCharacterCount(content);
  return count <= 5 ? 2.5 : count <= 8 ? 3 : 29;
}
export function vinylMinimumWidth(content: string): number {
  return vinylCharacterCount(content) > 8 ? 5 : 2.5;
}
export function vinylTextSizeError(content: string, width: unknown): string | null {
  if (!content.trim()) return "Please enter the content for every custom vinyl.";
  const value = typeof width === "string" || typeof width === "number" ? Number(width) : NaN;
  const maximum = vinylMaximumWidth(content);
  const minimum = vinylMinimumWidth(content);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    return `${vinylCharacterCount(content)} characters (including spaces and symbols): width must be ${maximum === 2.5 ? "2.5" : `${minimum}–${maximum}`} cm.`;
  }
  return null;
}
