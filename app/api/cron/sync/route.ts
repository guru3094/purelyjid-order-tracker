import { NextResponse } from "next/server";
import { syncGoogleSheet } from "@/lib/sync/syncGoogleSheet";

export async function GET() {
  try {
    const result = await syncGoogleSheet();

    return NextResponse.json({
      success: true,
      message: "Scheduled sync completed.",
      result,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Scheduled sync failed.",
      },
      {
        status: 500,
      }
    );
  }
}
