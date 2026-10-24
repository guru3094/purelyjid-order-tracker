import { NextResponse } from "next/server";
import { catalogueDb, metadataColumns, publicMetadata } from "@/lib/vinyl/catalogue";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { data, error } = await catalogueDb().from("vinyl_designs").select(metadataColumns).eq("published", true).order("code").limit(1000);
    if (error) throw error;
    return NextResponse.json({ designs: (data || []).map(publicMetadata) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Catalogue list:", error);
    return NextResponse.json({ error: "The design catalogue is temporarily unavailable. Please try again or contact PurelyJid." }, { status: 503 });
  }
}
