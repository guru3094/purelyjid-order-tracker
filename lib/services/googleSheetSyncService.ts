import { readOrdersSheet } from "@/lib/google/sheets";
import { mapGoogleSheetRow } from "@/lib/google/mapper";

import { enqueue } from "@/lib/queue/writeQueue";
import { processQueue } from "@/lib/queue/queueProcessor";

import { Order } from "@/lib/types/order";

import {
  toIsoTimestamp,
  toNullableIsoTimestamp,
} from "@/lib/utils/date";

export async function syncGoogleSheet() {
  // Read all rows from Google Sheets
  const rows = await readOrdersSheet();

  // No data or only header row
  if (rows.length <= 1) {
    return {
      success: true,
      processed: 0,
      message: "No orders found in Google Sheet.",
    };
  }

  // Skip header row
  const dataRows = rows.slice(1);

  for (const row of dataRows) {
    const googleRow = mapGoogleSheetRow(row);

    const order: Order = {
      orderId: googleRow.orderId,
      customerName: googleRow.customerName,
      mobileNumber: googleRow.mobileNumber,

      email:
        googleRow.email && googleRow.email.trim() !== ""
          ? googleRow.email
          : undefined,

      orderDate: toIsoTimestamp(googleRow.orderDate),

      fulfillmentMethod: googleRow.fulfillmentMethod,

      status: googleRow.status,

      courierPartner:
        googleRow.courierPartner &&
        googleRow.courierPartner.trim() !== ""
          ? googleRow.courierPartner
          : undefined,

      trackingNumber:
        googleRow.trackingNumber &&
        googleRow.trackingNumber.trim() !== ""
          ? googleRow.trackingNumber
          : undefined,

      expectedDeliveryDate:
        toNullableIsoTimestamp(
          googleRow.expectedDeliveryDate
        ) ?? undefined,

      remarks:
        googleRow.remarks &&
        googleRow.remarks.trim() !== ""
          ? googleRow.remarks
          : undefined,

      lastUpdated: toIsoTimestamp(
        googleRow.orderDate,
        googleRow.lastUpdated
      ),
    };

    enqueue({
      order,
      retryCount: 0,
      createdAt: new Date(),
    });
  }

  // Process queued orders
  await processQueue();

  return {
    success: true,
    processed: dataRows.length,
  };
}
