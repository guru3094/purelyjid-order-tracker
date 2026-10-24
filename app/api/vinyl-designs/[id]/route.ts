import { NextResponse } from "next/server";
import { catalogueRecord } from "@/lib/vinyl/catalogue";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const record = await catalogueRecord((await params).id);
    if (!record) return NextResponse.json({ error: "This design is no longer available." }, { status: 404 });
    return NextResponse.json({ outline: record.outline, revision: record.updated_at }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Could not load this design." }, { status: 503 }); }
}
