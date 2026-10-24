import { NextResponse } from "next/server";
import { isStaffAuthenticated } from "@/lib/auth/staffAuth";
import { catalogueDb, metadataColumns, publicMetadata } from "@/lib/vinyl/catalogue";
import { DESIGN_CATEGORIES } from "@/lib/vinyl/catalogue-types";
import { normalizeCatalogueSvg } from "@/lib/vinyl/catalogue-svg";
import { artworkType } from "@/lib/vinyl/artwork";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const response = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function authorized(request?: Request) {
  if (request) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
    if (!origin || new URL(origin).host !== host) return false;
  }
  return isStaffAuthenticated();
}
export async function GET() {
  if (!(await authorized())) return response({ error: "Unauthorized" }, 401);
  try {
    const { data, error } = await catalogueDb().from("vinyl_designs").select(metadataColumns).order("code").limit(1000);
    if (error) throw error;
    return response({ designs: (data || []).map(publicMetadata) });
  } catch { return response({ error: "Cannot load catalogue. Apply the vinyl_design_catalogue migration and check server settings." }, 503); }
}
export async function POST(request: Request) {
  if (!(await authorized(request))) return response({ error: "Unauthorized or invalid origin" }, 403);
  try {
    if (Number(request.headers.get("content-length")) > 900_000) return response({ error: "Upload is too large." }, 413);
    const form = await request.formData();
    const name = String(form.get("name") || "").trim(), code = String(form.get("code") || "").trim().toUpperCase(), category = String(form.get("category") || "");
    const published = form.get("published") === "true";
    if (!name || name.length > 100 || !/^[A-Z0-9][A-Z0-9-]{1,29}$/.test(code) || !DESIGN_CATEGORIES.includes(category as typeof DESIGN_CATEGORIES[number])) return response({ error: "Enter a name, unique code (2–30 letters/digits/hyphens), and category." }, 400);
    if (form.get("action") !== "preview" && form.get("approved") !== "true") return response({ error: "Review and approve the cut artwork before saving." }, 400);
    const file = form.get("svg");
    if (!(file instanceof File) || !file.size || file.size > 500_000) return response({ error: "Upload a cut-ready SVG under 500 KB." }, 400);
    const outline = normalizeCatalogueSvg(await file.text());
    if (form.get("action") === "preview") return response({ outline });
    let thumbnail: string | null = null;
    const image = form.get("thumbnail");
    if (image instanceof File && image.size) {
      if (image.size > 250_000) return response({ error: "Thumbnail must be a PNG/JPG under 250 KB." }, 400);
      const bytes = new Uint8Array(await image.arrayBuffer()), type = artworkType(bytes);
      if (!type) return response({ error: "Thumbnail must contain PNG or JPG data." }, 400);
      thumbnail = `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
    }
    const { error } = await catalogueDb().from("vinyl_designs").insert({ name, code, category, published, outline, thumbnail, width: outline.bounds.x2-outline.bounds.x1, height: outline.bounds.y2-outline.bounds.y1 });
    if (error) return response({ error: error.code === "23505" ? "That design code is already in use." : "Could not save design. Check the catalogue migration and database settings." }, 400);
    return response({ success: true }, 201);
  } catch (error) { return response({ error: error instanceof Error ? error.message : "Could not import SVG." }, 400); }
}
export async function PATCH(request: Request) {
  if (!(await authorized(request))) return response({ error: "Unauthorized or invalid origin" }, 403);
  try {
    const body = await request.json();
    if (!/^[0-9a-f-]{36}$/i.test(body.id) || typeof body.published !== "boolean" || (body.published && body.approved !== true)) return response({ error: "Choose a design and confirm approval before publishing." }, 400);
    const { data, error } = await catalogueDb().from("vinyl_designs").update({ published: body.published, updated_at: new Date().toISOString() }).eq("id", body.id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return response({ error: "Design not found." }, 404);
    return response({ success: true });
  } catch { return response({ error: "Could not update design." }, 400); }
}
