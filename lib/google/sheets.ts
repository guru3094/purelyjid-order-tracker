import { google } from "googleapis";
import { getGoogleAuth } from "./auth";

export async function readOrdersSheet() {
  const auth = getGoogleAuth();

  const sheets = google.sheets({
    version: "v4",
    auth,
  });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: "Orders!A:N",
  });

  return response.data.values ?? [];
}
