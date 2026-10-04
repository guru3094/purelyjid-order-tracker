import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/google/auth";

export type ArtistSheetOrder = {
  order_id: string;
  order_date: string;
  customer_name: string;
  product_name: string;
  requirements?: string | null;
  artist_cost?: number | null;
  artist_advance?: number | null;
  artist_balance?: number | null;
  estimated_delivery_date?: string | null;
  comments?: string | null;
};

export function getMonthFromOrderDate(orderDate: string) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  let month = 0;
  const mdY = orderDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const yMd = orderDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (mdY) month = Number(mdY[1]);
  else if (yMd) month = Number(yMd[2]);
  return month >= 1 && month <= 12 ? months[month - 1] : "";
}

function formatDeliveryDate(value?: string | null) {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export async function appendArtistOrder(order: ArtistSheetOrder) {
  const spreadsheetId = process.env.RESIN_ARTIST_GOOGLE_SHEET_ID;
  const sheetName = process.env.RESIN_ARTIST_GOOGLE_SHEET_TAB || "Artist";
  if (!spreadsheetId) throw new Error("RESIN_ARTIST_GOOGLE_SHEET_ID is not configured.");

  const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() });
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:K`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[
      getMonthFromOrderDate(order.order_date),
      order.order_date,
      order.customer_name,
      order.product_name,
      order.requirements ?? "",
      order.artist_cost ?? 0,
      order.artist_advance ?? 0,
      order.artist_balance ?? 0,
      formatDeliveryDate(order.estimated_delivery_date),
      "Pending",
      order.comments ?? "",
    ]] },
  });
}
