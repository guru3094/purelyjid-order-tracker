# Approved vinyl design catalogue

Based on GitHub main `d977a23`. This update does not push or deploy itself.

## What changes

- `/vinylfonts`: quick navigation to Text & Fonts, Browse Designs, Upload Your Design. Browse Designs has category filters, name/code search, thumbnails, repeated selections, proportional width/height, colour, quantity and its own WhatsApp enquiry.
- Existing `app/vinylfonts/VinylFontSelector.tsx`, its PF01–PF08 options, previews and text WhatsApp flow are unchanged. Customer image uploading is also unchanged. Text, catalogue and uploaded-image enquiries retain separate send buttons.
- `/cricut_svg`: shared published catalogue; combine catalogue vector paths with text and uploaded images in one optimized batch, preserve size and quantity, include design codes in cutting-cost messages. Existing mat sizes, prices and nesting algorithm are unchanged. Vinyl colours are reference notes, not automatic colour-separated mats.
- `/sales/vinyl-designs`: existing staff login; upload SVG, optional thumbnail, name, unique code and category; preview actual cut paths, approve, save hidden or published; publish/hide saved designs. Staff navigation includes this page.
- Public routes return only published designs. Unpublished IDs also stop working for new mat generation. Existing downloaded SVGs cannot be recalled. No image tracing is applied to catalogue vectors.

## Database

The migration in `supabase/migrations/*_vinyl_design_catalogue.sql` has already been applied to the connected **purelyjid-order-tracker** Supabase project. Do not run it again on that same project. It is included for new environments.

It creates only `public.vinyl_designs`, enables RLS, revokes direct browser-role access, and explicitly grants backend `service_role` CRUD. No other tables are changed. This uses the existing `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `STAFF_SESSION_SECRET`; no new environment variables are required. The service key is never sent to the browser.

Public metadata and vector/preview reads go through Next.js routes with `published=true` filtering. Staff mutations require a valid existing staff cookie and a matching Origin. Catalogue responses are not cached so hide/publish changes take effect on the next fetch. The intentional backend-only RLS table has no browser policies; Supabase may show an informational “RLS Enabled No Policy” advisory for it.

## Add your first approved design

1. Deploy this code using the existing deployment process.
2. Sign in as staff and open `/sales/vinyl-designs`.
3. Enter a unique code such as VD001, a name and category.
4. Upload a **path-only, cut-ready SVG** under 500 KB. All contours must be closed and filled. Expand text, primitive shapes and strokes into paths and flatten effects first. Raster images, scripts, external references, masks, clipping and mixed fill rules are rejected. SVGs with independent overlapping paths are united to avoid unwanted internal cut lines.
5. Optionally upload a PNG/JPG thumbnail under 250 KB. Otherwise the cut geometry is the thumbnail. Thumbnails are stored with catalogue metadata; SVG markup is never served verbatim.
6. Click Preview cut paths. Check the silhouette and intentional holes, approve it, and tick Publish if it is ready for customers.
7. Check `/vinylfonts` and `/cricut_svg`. Search by the same VD code. Saved cards also provide a separate “View actual cut paths” link, even when a thumbnail was uploaded.

The catalogue intentionally starts empty. No Canva stock artwork or religious designs have been imported, licensed or approved on your behalf. Staff supplies approved assets. The full Canva library is not accessible through this catalogue.

## Checks

- `npx tsc --noEmit`
- `node --test tests/*.test.mjs` — 17 tests passed
- Targeted ESLint for catalogue modules and changed components.
- `npm run build` (build verification used placeholder Supabase credentials; no live API keys stored).
- `node scripts/smoke-vinyl-catalogue.mjs` after a production build: customer page, authentication, Origin protection, normalized vector preview and rejection of unapproved saves; no live database writes.
- Live database grants/RLS verified. A transactional insert/publish/hide check was rolled back and left no test designs behind.

## Limits

No browser screenshot check was available in this environment. Catalogue API currently lists up to 1,000 designs. SVG input is deliberately restricted to prepared paths; a general-purpose Canva SVG may need flattening first. The existing text and uploaded-image flows stay available if the catalogue cannot load.
