import { google } from "googleapis";
import { getGoogleAuth } from "./auth";
import { config } from "@/lib/config";

export async function readOrdersSheet() {
  const auth = getGoogleAuth();

  const sheets = google.sheets({
    version: "v4",
    auth,
  });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.google.sheetId,
    range: "Orders!A:S",
  });

  return response.data.values ?? [];
}
