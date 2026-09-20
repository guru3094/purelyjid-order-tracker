import { NextResponse } from "next/server";
import { isStaffAuthenticated } from "@/lib/auth/staffAuth";
import { readOrdersSheet } from "@/lib/google/sheets";
import { mapGoogleSheetRow } from "@/lib/google/mapper";

export async function GET() {
  if (!(await isStaffAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await readOrdersSheet();
  const orders = rows.slice(1)
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .map((row) => mapGoogleSheetRow(row))
    .reverse();
  return NextResponse.json({ orders, totalRecords: orders.length });
}
