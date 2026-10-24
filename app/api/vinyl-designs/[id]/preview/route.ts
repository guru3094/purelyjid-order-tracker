import { isStaffAuthenticated } from "@/lib/auth/staffAuth";
import { catalogueRecord } from "@/lib/vinyl/catalogue";
import { outlineSvg } from "@/lib/vinyl/catalogue-svg";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const record = await catalogueRecord((await params).id, await isStaffAuthenticated());
    if (!record) return new Response("Design unavailable", { status: 404 });
    const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" };
    if (record.thumbnail && new URL(request.url).searchParams.get("cut") !== "1") {
      const [, type, data] = record.thumbnail.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/) || [];
      if (type && data) return new Response(Buffer.from(data, "base64"), { headers: { ...headers, "Content-Type": type } });
    }
    return new Response(outlineSvg(record.outline), { headers: { ...headers, "Content-Type": "image/svg+xml" } });
  } catch { return new Response("Preview unavailable", { status: 503 }); }
}
