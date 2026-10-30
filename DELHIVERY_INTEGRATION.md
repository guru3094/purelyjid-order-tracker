# Delhivery dispatch with customer approval and offline payment

## Scope and staff flow

The only pickup origin is PurelyJid, Pimple Gurav, Pune 411027. Both Pune and other Indian destinations use Delhivery's **B2C parcel** service, subject to prepaid PIN-code serviceability. This does not claim instant delivery or implement Delhivery's separate Intracity product.

1. Staff opens `/sales/couriers`, optionally links an existing Orders Sheet reference, and enters consignee details, parcel description, weight in grams, dimensions in cm, invoice reference/value and Surface/Express.
2. Server fixes the Pune origin, validates one box up to 20 kg and invoice value below ₹50,000, checks prepaid serviceability and obtains an estimated shipping charge. No shipment is created. An unlinked request receives a PJC reference.
3. Staff shares the private `/track-order#delivery=<id>.<token>` link. Customer accepts or declines that specific revision and charge. No carrier write or wallet debit occurs.
4. After receiving offline payment, staff records the delivery amount and payment/cash receipt reference and confirms receipt. Product payment is separate in the sales order. Customer cannot confirm payment through the API.
5. Staff explicitly authorizes **Create Delhivery shipment**. Server rechecks the estimate. Any amount change resets customer acceptance/payment confirmation and requires review; earlier payment evidence remains in the private audit table for manual reconciliation. An atomic state/revision claim prevents duplicate manifestations. Shipments are **Prepaid**, COD zero, using the business account's billing terms.
6. The response AWB is persisted. Staff prints and attaches its label in Delhivery One. Staff then separately selects a Tuesday–Saturday pickup date, 6–9 PM, at least one hour before slot start and within 30 days, confirms packaging/labeling and schedules pickup. There is no automatic booking on checkout, customer acceptance, or payment confirmation.
7. Pickup requests are warehouse/date based. A confirmed existing request for the same location/date is reused; staff checks the package count in Delhivery One before handover. An uncertain pickup response is locked for reconciliation. Changing/canceling warehouse pickups is managed in Delhivery One, since other parcels can share them.
8. Private links and normal order-reference + delivery-mobile tracking remain on `/track-order`. On authorized page loads/refresh, server refreshes the Delhivery snapshot with a two-minute database claim. This is on-demand polling, not a webhook or moving courier map. Staff can refresh; old/duplicate status timestamps do not overwrite newer saved events.

Staff may edit an unbooked proposal; doing so changes its revision, revokes old private links and clears acceptance/payment confirmation. A declined proposal may be edited or replaced. Consent/payment/state changes are recorded in `courier_request_events` without private access tokens. All new tables are RLS enabled with explicit service-role-only access. Customer responses require same-origin requests, the private token and the matching proposal revision.

Parcel delivery never automatically completes a product sales order or deducts stock. Existing store-to-Google-Sheet and completion-only inventory behavior is retained. Checkout displays the agreed additional-delivery-charges note only when Delivery is selected; no carrier is booked at checkout.

## Activation requirements

1. Apply `supabase/migrations/20261030073134_delhivery_payment_gated_dispatch.sql` to the main order-tracker database before deploying the changed API/UI. The migration was tested locally and applied to the main production database before publishing this release.
2. Vercel main project has existing `DELHIVERY_API_TOKEN` and exact `DELHIVERY_PICKUP_LOCATION=PurelyJid`. Keep `DELHIVERY_LIVE_ENABLED=false`. `APP_ORIGIN` remains the canonical website origin.
3. Obtain a **separate staging token** from Delhivery. Set `DELHIVERY_ENV=staging` and `DELHIVERY_TEST_API_TOKEN` only in an isolated staging deployment/database. Staging uses `https://staging-express.delhivery.com`; production uses `https://track.delhivery.com`. The production token is never used as a staging fallback.
4. Verify staging: serviceable/unserviceable destination, estimate, customer accept/decline, offline payment confirmation, shipment creation, real staging response parsing, label printout, pickup acknowledgment, tracking and cancellation. Local mock-provider tests cannot certify account permissions or carrier behavior.
5. After a successful staging end-to-end run, get approval for release/activation. Set production live dispatch true only when explicitly authorized. All carrier POSTs check the server activation guard. Any unrelated auto-pickup/account service must be reviewed in Delhivery One before live activation.

## Recovery and limitations

- Creation timeout, partial/malformed response, or failure saving an AWB becomes `needs_review`. Never retry creation, reset the row, or create a replacement until checking Delhivery using provider order reference `PJD` + shipment UUID without hyphens. It may have charged/created a shipment even when the response failed. Reconcile the confirmed AWB through a trusted administrative operation after verification.
- Pickup timeout keeps the existing AWB and `manifested` state; its warehouse/date job stays `needs_review`. Inspect Delhivery before resetting anything. No automatic pickup retry exists.
- Cancellation is atomically claimed once. An uncertain cancellation locks the shipment for review. Provider cancellation may fail, incur fees, or initiate RTO. A cancellation response is not a refund confirmation and does not cancel a warehouse pickup shared with other parcels. Reconcile customer payments manually.
- Labels are printed in Delhivery One; this implementation does not download labels into the website. Multi-box shipments, values requiring e-waybills, heavy cargo, COD, insurance purchases and restricted goods need a separate supported process. Rate estimates may differ after carrier weight/dimension assessment.
- Old Borzo requests remain visible. The active courier API cannot create Borzo bookings. Staff can close old unbooked drafts; existing provider bookings must be managed directly in their original provider account.
- Pre-release validation did not create a live or staging provider shipment, charge a wallet or change carrier account permissions. The release applies the database migration and publishes source while live dispatch remains disabled.

## Verification

Tests use the actual route handlers and workflow with an isolated PostgreSQL-compatible PGlite database and mock Delhivery HTTP responses. They cover permissions, private links, origin, immutable Pune origin, customer response/revision, staff payment gate, activation guard, duplicate concurrent submission, changed estimates, prepaid payload encoding, separate pickup, uncertain submission/pickup, cancellation, privacy, audit preservation and legacy-provider dispatch denial. Existing stock, Sheet sync, SEO, status and SVG tests also pass. A clean dependency installation and production build are included. Browser preview could not be completed because the browser policy rejected the internal QA page; visual behavior remains unverified.

Official contracts inspected: Delhivery One developer portal, B2C Pincode Serviceability, Calculate Shipping Cost, Shipment Creation, Pickup Request Creation, Shipment Tracking and Shipment Cancellation. https://one.delhivery.com/developer-portal/documents/b2c/
