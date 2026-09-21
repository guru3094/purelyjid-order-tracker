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
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  let month = 0;

  const mdY = orderDate.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );

  const yMd = orderDate.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/
  );

  if (mdY) {
    month = Number(mdY[1]);
  } else if (yMd) {
    month = Number(yMd[2]);
  }

  return month >= 1 && month <= 12
    ? months[month - 1]
    : "";
}

function formatDeliveryDate(
  value?: string | null
) {
  if (!value) {
    return "";
  }

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  return match
    ? `${match[3]}/${match[2]}/${match[1]}`
    : value;
}

export async function appendArtistOrder(
  order: ArtistSheetOrder
) {
  const spreadsheetId =
    process.env.RESIN_ARTIST_GOOGLE_SHEET_ID;

  const sheetName =
    process.env.RESIN_ARTIST_GOOGLE_SHEET_TAB ||
    "Artist";

  if (!spreadsheetId) {
    throw new Error(
      "RESIN_ARTIST_GOOGLE_SHEET_ID is not configured."
    );
  }

  const sheets = google.sheets({
    version: "v4",
    auth: getGoogleAuth(),
  });

  /*
   * Read column A only.
   *
   * Row 1 contains the header.
   * Existing order rows begin at row 2.
   */
  const existingRows =
    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:A`,
    });

  const values =
    existingRows.data.values ?? [];

  /*
   * If:
   *
   * A1 = Month
   * A2 = Nov
   * A3 = Nov
   *
   * values.length = 3
   *
   * therefore the next row is 4.
   */
  const nextRow =
    Math.max(values.length + 1, 2);

  /*
   * IMPORTANT:
   *
   * Write ONLY A:K for this exact row.
   *
   * We deliberately do not use
   * spreadsheets.values.append().
   *
   * This prevents Google Sheets from
   * determining/expanding the logical
   * table range into other columns.
   */
  const targetRange =
    `${sheetName}!A${nextRow}:K${nextRow}`;

  const row = [
    // A - Month
    getMonthFromOrderDate(
      order.order_date
    ),

    // B - Order Date
    order.order_date,

    // C - Customer Name
    order.customer_name,

    // D - Product
    order.product_name,

    // E - Requirements
    order.requirements ?? "",

    // F - Cost
    order.artist_cost ?? 0,

    // G - Advance
    order.artist_advance ?? 0,

    // H - Balance
    order.artist_balance ?? 0,

    // I - Estimated Delivery Date
    formatDeliveryDate(
      order.estimated_delivery_date
    ),

    // J - Status
    "Pending",

    // K - Comments
    order.comments ?? "",
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,

    range: targetRange,

    valueInputOption: "USER_ENTERED",

    requestBody: {
      values: [row],
    },
  });

  return {
    success: true,
    row: nextRow,
    range: targetRange,
  };
}