import { NextResponse } from "next/server";
import { getActiveCouriers } from "@/lib/supabase/courierRepository";

export async function GET() {
  try {
    const couriers = await getActiveCouriers();

    return NextResponse.json({
      success: true,
      count: couriers?.length ?? 0,
      data: couriers,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}
