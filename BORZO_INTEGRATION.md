# Borzo courier booking and pjresin.in order sync

## What is implemented

- Staff: `/sales/couriers`, using the existing staff session. Create linked or ad hoc requests, edit unsubmitted drafts, enable customer booking when packed, get a quote, confirm, refresh from Borzo and cancel with confirmation.
- Customers: private, revocable link at `/track-order#delivery=<id>.<secret>`. Review staff-confirmed pickup/delivery details, get a live quote and explicitly confirm booking. Normal order-reference/mobile lookup on `/track-order` also displays received courier status, including ad hoc PJC references.
- Parcel preparation and courier progress remain separate. Courier callbacks do not complete a sales order or deduct inventory.
- Cash courier fees: staff selects payment at pickup or delivery. Merchandise payments/COD collection and business wallet/card debit are not enabled. Motorbike, 1–20 kg only. Staff must verify safe packaging and Borzo's goods restrictions for the particular parcel.
- Drafts are persistent. Only one open courier request per order reference is allowed. Old customer links stop working after link regeneration or draft editing.
- Quotes expire after five minutes, are signed against the shipment/details/price, and are recalculated before creating a booking. A changed price requires a fresh customer confirmation.
- An atomic state transition prevents double-click/concurrent bookings. An uncertain create timeout is not retried automatically. Staff must reconcile in Borzo; signed callbacks can recover a booking using its client reference.
- Signed order and delivery callbacks maintain independent timestamps and ignore older/repeated updates. Customer screens display only the latest received state. Staff can manually refresh the provider snapshot if callbacks are delayed. This does not implement a moving courier map.

## Setup — main website

Apply `supabase/migrations/20261029124429_borzo_shipments_and_store_sync.sql` to the **main tracker** Supabase project. Tables have RLS and explicit service-role-only grants; no browser table access is required. Existing Google credentials and `GOOGLE_SHEET_ID` remain in use.

Set server-side Vercel environment variables:

| Variable | Value |
| --- | --- |
| `APP_ORIGIN` | `https://www.purelyjid.in` |
| `BORZO_ENV` | `test` initially; use `production` only after successful sandbox verification |
| `BORZO_AUTH_TOKEN` | Borzo API token for that environment |
| `BORZO_CALLBACK_SECRET` | Callback secret from the same Borzo account |
| `COURIER_SIGNING_SECRET` | Independent random secret, at least 32 characters |
| `STORE_SYNC_SECRET` | Independent random secret, at least 32 characters; identical on both website projects |
| `BORZO_LIVE_ENABLED` | Leave unset in test; set `true` only when production API access is approved and live booking is intended |

Configure Borzo's order **and delivery** callback URL as `https://www.purelyjid.in/api/borzo/webhook` and enable delivery callbacks. Sandbox and production use separate tokens/accounts/configuration. Borzo requires sandbox integration and production API activation; installing code does not provision those accounts.

Staff creates a ready request, checks both addresses/phone numbers and payer, then shares its private link with the customer. A request with customer booking disabled is staff-only until edited to enable it. Creating/editing a draft is not a paid booking. Cancellation may be refused or chargeable under Borzo's rules.

For a `submitting`/`needs_review` result: inspect Borzo before any further dispatch. Match the 32-character `client_order_id` to the shipment UUID with hyphens removed. A signed callback can attach the provider ID; otherwise reconcile it through a trusted administrative database operation after checking the actual booking. Never blindly reset a draft and book again.

## pjresin.in → existing Google Sheet

The companion `PurelyJid-Raw-Materials` repository contains the outbox migration and sender. Deploy/configure the main receiver first, then the store changes. The original PJM order number is used in `Orders!A:S` of the existing `GOOGLE_SHEET_ID`; no second spreadsheet is created. New rows contain customer name/mobile/email, requested fulfilment, `ORDER_RECEIVED`, line-item names/quantities/prices, actual stored subtotal, zero advance, full outstanding balance and `Raw Materials` category. Address/notes are retained in Remarks.

The store commits the order and an immutable sync payload in the same database transaction, then attempts immediate delivery. Failure never erases the customer's order. The admin retry button and scheduled store retry process pending records. Existing historical orders are not backfilled by this migration.

The main receiver authenticates timestamped HMAC requests, records the payload hash and checks the Sheet before appending the same PJM reference. Concurrent requests acquire a single append claim. If a Google append has an uncertain outcome, automatic re-appending is blocked; retries first check for the existing row. If it is found, the receipt completes. If not, staff must inspect the Sheet and receipt before resetting `writing` to `pending`. This avoids silently duplicating orders after a timeout. Google Sheets does not provide a transactional unique constraint.

Staff order lists refresh immediately on new imports. Customer tracking has a Sheet fallback for PJM references while the existing Sheet-to-main-Supabase cron catches up. Initially received PJM delivery requests are allowed to sync without inventing a courier assignment. Later sales statuses retain existing validation.

## Verification and activation

Local tests cover provider contract, cash payer rules, invalid inputs, HMAC/tamper/expiry, changed quote, two simultaneous booking submissions, ambiguous timeout, private storage permissions, stale/duplicate callbacks, outbox transaction/replay, nineteen-column Sheet mapping and retry acknowledgement. Existing tracking/status/SVG tests are retained.

No credentials have been configured and no real Google Sheet append, live Borzo quote, dispatch, cancellation or database migration has been executed by this code preparation. Complete a sandbox order → callback → customer tracking check before enabling production. Check real account service coverage, package restrictions and fee/payment availability before go-live.

Official API reference: https://borzodelivery.com/in/business-api/doc
