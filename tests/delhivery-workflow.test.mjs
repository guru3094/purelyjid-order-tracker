import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
const url = (s) =>
  "data:text/javascript;base64," + Buffer.from(s).toString("base64");
const compile = (p) =>
  ts.transpileModule(readFileSync(new URL(p, import.meta.url), "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
const stateUrl = url(
  "export const state={db:null,staff:false,calls:[],rate:99,timeout:false,pickupTimeout:false};",
);
const { state } = await import(stateUrl);
const dbUrl = url(
  `import {state} from '${stateUrl}';class Query {constructor(table){this.table=table;this.filters=[];this.operation='select';}select(columns='*',opts={}){this.columns=columns;this.opts=opts;return this}update(patch){this.operation='update';this.patch=patch;return this}insert(patch){this.operation='insert';this.patch=patch;return this}eq(k,v){this.filters.push([k,'=',v]);return this}neq(k,v){this.filters.push([k,'<>',v]);return this}is(k,v){this.filters.push([k,'is',v]);return this}order(k,o){this.sort=[k,o];return this}limit(n){this.max=n;return this}maybeSingle(){this.one=true;return this}single(){this.one=true;return this}then(ok,bad){return this.run().then(ok,bad)}async run(){try{let args=[];const bind=v=>{args.push(typeof v==='object'&&v!==null?JSON.stringify(v):v);return '$'+args.length;};const name=k=>{if(!/^[a-z_]+$/.test(k))throw Error('identifier');return '"'+k+'"';};let sql='';if(this.operation==='select')sql='select '+(this.opts?.count?'count(*) as count':'*')+' from '+name(this.table);else if(this.operation==='update')sql='update '+name(this.table)+' set '+Object.entries(this.patch).map(([k,v])=>name(k)+'='+bind(v)).join(',');else sql='insert into '+name(this.table)+'('+Object.keys(this.patch).map(name).join(',')+') values('+Object.values(this.patch).map(bind).join(',')+')';if(this.filters.length)sql+=' where '+this.filters.map(([k,op,v])=>name(k)+(op==='is'?' is null':op+bind(v))).join(' and ');if(this.operation==='select'&&this.sort)sql+=' order by '+name(this.sort[0])+(this.sort[1]?.ascending===false?' desc':' asc');if(this.operation==='select'&&this.max)sql+=' limit '+Number(this.max);if(this.operation!=='select')sql+=' returning *';const result=await state.db.query(sql,args);const rows=result.rows.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v instanceof Date?(k==='pickup_date'?v.toISOString().slice(0,10):v.toISOString()):v])));if(this.opts?.count)return {data:null,count:Number(rows[0].count),error:null};return {data:this.one?(rows[0]||null):rows,error:null};}catch(error){return {data:null,error};}}}export const supabase={from:table=>new Query(table)};`,
);
const borzoUrl = url(compile("../lib/courier/borzo.ts"));
function module(p, map) {
  return url(
    compile(p).replace(
      /from ["']([^"']+)["']/g,
      (_, dep) => `from '${map[dep] || dep}'`,
    ),
  );
}
const dlUrl = module("../lib/courier/delhivery.ts", { "./borzo": borzoUrl });
const dl = await import(dlUrl);
const repoUrl = module("../lib/courier/repository.ts", {
  "./borzo": borzoUrl,
  "@/lib/supabase/client": dbUrl,
});
const repo = await import(repoUrl);
const workflowUrl = module("../lib/courier/delhiveryWorkflow.ts", {
  "./borzo": borzoUrl,
  "./delhivery": dlUrl,
  "./repository": repoUrl,
  "@/lib/supabase/client": dbUrl,
});
const workflow = await import(workflowUrl);
const common = {
  "next/server": url(
    "export const NextResponse={json:(v,o)=>Response.json(v,o)}",
  ),
  "@/lib/auth/staffAuth": url(
    `import {state} from '${stateUrl}';export const isStaffAuthenticated=async()=>state.staff;`,
  ),
  "@/lib/supabase/client": dbUrl,
  "@/lib/courier/repository": repoUrl,
  "@/lib/courier/borzo": borzoUrl,
  "@/lib/courier/delhivery": dlUrl,
  "@/lib/courier/delhiveryWorkflow": workflowUrl,
  "@/lib/google/sheets": url(
    'export const readOrdersSheet=async()=>[["Order"],["PJM12345"]];',
  ),
};
const route = await import(module("../app/api/courier/route.ts", common)),
  staffRoute = await import(
    module("../app/api/staff/couriers/route.ts", common)
  );
const input = {
  matter: "Resin crafts",
  weight_grams: 750,
  length_cm: 20,
  width_cm: 15,
  height_cm: 10,
  declared_value: 500,
  invoice: "INV123",
  pincode: "411045",
  city: "Pune",
  region: "Maharashtra",
  shipping_mode: "Surface",
  fragile: true,
  points: [
    { address: "Untrusted pickup Mumbai" },
    {
      address: "Customer test address Pune",
      contact_person: { name: "Test Customer", phone: "9999999999" },
    },
  ],
};
const request = (body, origin = "https://www.purelyjid.in") =>
  new Request(origin + "/api/courier", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
async function setup() {
  state.db = new PGlite();
  await state.db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;",
  );
  for (const p of readdirSync(
    new URL("../supabase/migrations/", import.meta.url),
  ).filter(
    (p) => p.includes("borzo_shipments") || p.includes("delhivery_payment"),
  ))
    await state.db.exec(
      readFileSync(
        new URL("../supabase/migrations/" + p, import.meta.url),
        "utf8",
      ),
    );
  await state.db.exec("set role service_role");
  state.staff = true;
  state.calls = [];
  state.rate = 99;
  state.timeout = false;
  state.pickupTimeout = false;
  process.env.DELHIVERY_ENV = "staging";
  process.env.DELHIVERY_TEST_API_TOKEN = "test-token";
  process.env.DELHIVERY_LIVE_ENABLED = "false";
  global.fetch = async (u, o = {}) => {
    const path = new URL(u).pathname;
    state.calls.push({
      path,
      method: o.method || "GET",
      body: o.body,
      headers: o.headers,
    });
    if (path.includes("pin-codes"))
      return Response.json({
        delivery_codes: [
          { postal_code: { pin: 411045, pre_paid: "Y", remarks: "" } },
        ],
      });
    if (path.includes("charges"))
      return Response.json([{ total_amount: state.rate }]);
    if (path.includes("cmu/create")) {
      if (state.timeout) throw Error("Timeout after provider accepted");
      return Response.json({
        success: true,
        packages: [{ status: "Success", waybill: "1234567890123" }],
      });
    }
    if (path.includes("request/new")) {
      if (state.pickupTimeout) throw Error("Timeout");
      return Response.json({ pickup_id: 123456 });
    }
    if (path.includes("packages/json"))
      return Response.json({
        ShipmentData: [
          {
            Shipment: {
              AWB: "1234567890123",
              Status: {
                Status: "In Transit",
                StatusDateTime: "2026-10-30T10:00:00+05:30",
                StatusType: "UD",
              },
            },
          },
        ],
      });
    if (path.includes("p/edit")) return Response.json({ status: true });
    throw Error("Unexpected provider call " + path);
  };
}
async function create() {
  state.staff = true;
  const r = await staffRoute.POST(
    request({ input, customerEnabled: true, orderRef: "PJM12345" }),
  );
  assert.equal(r.status, 200, JSON.stringify(await r.clone().json()));
  const d = await r.json();
  return { ...d, access: d.link.split(".").at(-1) };
}
async function get(id) {
  return (
    await state.db.query("select * from courier_shipments where id=$1", [id])
  ).rows[0];
}
async function act(s, action, extra = {}) {
  return route.POST(
    request({
      id: s.id,
      access: s.access,
      action,
      revision: (await get(s.id)).revision,
      ...extra,
    }),
  );
}
async function acceptedPaid(s) {
  state.staff = false;
  assert.equal((await act(s, "accept", { confirm: true })).status, 200);
  state.staff = true;
  assert.equal(
    (
      await act(s, "confirm_payment", {
        confirm: true,
        paymentReference: "UPI TEST123",
        paidAmount: "99",
      })
    ).status,
    200,
  );
}
const originalFetch = global.fetch;
for (const [name, fn] of Object.entries({
  "customer acceptance never dispatches and payment requires staff":
    async () => {
      const s = await create();
      let row = await get(s.id);
      assert.equal(row.input.points[0].address, dl.PUNE_PICKUP.address);
      assert.equal(row.provider, "delhivery");
      state.staff = false;
      assert.equal((await act(s, "accept", { confirm: true })).status, 200);
      assert.equal((await act(s, "book", { confirm: true })).status, 403);
      assert.equal(
        (
          await act(s, "confirm_payment", {
            confirm: true,
            paymentReference: "fake",
            paidAmount: 99,
          })
        ).status,
        403,
      );
      assert.equal(state.calls.filter((c) => c.method === "POST").length, 0);
      state.staff = true;
      assert.equal(
        (
          await act(s, "confirm_payment", {
            confirm: true,
            paymentReference: "UPI123",
            paidAmount: 98,
          })
        ).status,
        400,
      );
      assert.equal((await act(s, "book", { confirm: true })).status, 409);
    },
  "offline payment gates a single prepaid shipment, separate pickup and public tracking":
    async () => {
      const s = await create();
      await acceptedPaid(s);
      const responses = await Promise.all([
        act(s, "book", { confirm: true }),
        act(s, "book", { confirm: true }),
      ]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
      assert.equal(
        state.calls.filter((c) => c.path.includes("cmu/create")).length,
        1,
      );
      const booking = state.calls.find((c) => c.path.includes("cmu/create"));
      assert.equal(
        booking.headers["Content-Type"],
        "application/x-www-form-urlencoded",
      );
      const body = JSON.parse(new URLSearchParams(booking.body).get("data"));
      assert.equal(body.shipments[0].payment_mode, "Prepaid");
      assert.equal(body.shipments[0].cod_amount, "0");
      assert.equal(body.pickup_location.name, "PurelyJid");
      assert.equal((await get(s.id)).state, "manifested");
      assert.equal(
        state.calls.filter((c) => c.path.includes("request/new")).length,
        0,
      );
      let day = new Date(Date.now() + 3 * 86400000);
      while ([0, 1].includes(day.getUTCDay()))
        day = new Date(day.getTime() + 86400000);
      const date = day.toISOString().slice(0, 10);
      assert.equal(
        (await act(s, "schedule_pickup", { confirm: true, pickupDate: date }))
          .status,
        200,
      );
      assert.equal((await get(s.id)).state, "booked");
      assert.equal(
        (await act(s, "schedule_pickup", { confirm: true, pickupDate: date }))
          .status,
        200,
      );
      assert.equal(
        state.calls.filter((c) => c.path.includes("request/new")).length,
        1,
      );
      state.staff = false;
      const view = await act(s, "view"),
        v = await view.json();
      assert.equal(v.provider_status, "In Transit");
      assert.equal(v.awb, "1234567890123");
      assert.equal(v.access_hash, undefined);
      assert.equal(v.payment_reference, undefined);
    },
  "live activation guard prevents any provider write": async () => {
    const s = await create();
    await acceptedPaid(s);
    delete process.env.DELHIVERY_ENV;
    process.env.DELHIVERY_API_TOKEN = "live-test";
    const response = await act(s, "book", { confirm: true });
    assert.equal(response.status, 503);
    assert.equal((await get(s.id)).state, "payment_confirmed");
    assert.equal(state.calls.filter((c) => c.method === "POST").length, 0);
  },
  "changed estimate clears consent/payment and requires fresh customer approval":
    async () => {
      const s = await create();
      await acceptedPaid(s);
      state.rate = 101;
      assert.equal((await act(s, "book", { confirm: true })).status, 409);
      const row = await get(s.id);
      assert.equal(row.state, "requested");
      assert.equal(Number(row.amount), 101);
      assert.equal(row.revision, 2);
      assert.equal(row.payment_confirmed_at, null);
      assert.equal(row.accepted_at, null);
      const audit = await state.db.query(
        "select previous from courier_request_events where shipment_id=$1 order by id desc limit 1",
        [s.id],
      );
      assert.equal(audit.rows[0].previous.payment_reference, "UPI TEST123");
      assert.equal(state.calls.filter((c) => c.method === "POST").length, 0);
      state.staff = false;
      assert.equal(
        (
          await route.POST(
            request({
              id: s.id,
              access: s.access,
              action: "accept",
              revision: 1,
              confirm: true,
            }),
          )
        ).status,
        409,
      );
    },
  "decline and stale private links cannot book; edit revokes old links":
    async () => {
      const s = await create();
      state.staff = false;
      assert.equal((await act(s, "decline", { confirm: true })).status, 200);
      assert.equal((await act(s, "accept", { confirm: true })).status, 409);
      state.staff = true;
      assert.equal((await act(s, "book", { confirm: true })).status, 409);
      const edited = await staffRoute.POST(
        request({ id: s.id, revision:1, input, customerEnabled: true }),
      );
      assert.equal(edited.status, 200);
      assert.equal((await staffRoute.POST(request({id:s.id,revision:1,input,customerEnabled:true}))).status,409);
      state.staff = false;
      assert.equal((await act(s, "view")).status, 404);
    },
  "uncertain manifestation locks further dispatch and never retries creation":
    async () => {
      const s = await create();
      await acceptedPaid(s);
      state.timeout = true;
      assert.equal((await act(s, "book", { confirm: true })).status, 502);
      assert.equal((await get(s.id)).state, "needs_review");
      assert.equal((await act(s, "book", { confirm: true })).status, 409);
      assert.equal(
        state.calls.filter((c) => c.path.includes("cmu/create")).length,
        1,
      );
    },
  "uncertain pickup retains AWB and blocks another pickup or shipment":
    async () => {
      const s = await create();
      await acceptedPaid(s);
      assert.equal((await act(s, "book", { confirm: true })).status, 200);
      let day = new Date(Date.now() + 3 * 86400000);
      while ([0, 1].includes(day.getUTCDay()))
        day = new Date(day.getTime() + 86400000);
      state.pickupTimeout = true;
      const b = { confirm: true, pickupDate: day.toISOString().slice(0, 10) };
      assert.equal((await act(s, "schedule_pickup", b)).status, 502);
      assert.equal((await get(s.id)).state, "manifested");
      assert.equal((await act(s, "schedule_pickup", b)).status, 409);
      assert.equal(
        state.calls.filter((c) => c.path.includes("request/new")).length,
        1,
      );
      assert.equal(
        state.calls.filter((c) => c.path.includes("cmu/create")).length,
        1,
      );
    },
  "concurrent cancellation is sent once and remains separate from pickup cancellation":
    async () => {
      const s = await create();
      await acceptedPaid(s);
      assert.equal((await act(s, "book", { confirm: true })).status, 200);
      const replies = await Promise.all([
        act(s, "cancel", { confirm: true }),
        act(s, "cancel", { confirm: true }),
      ]);
      assert.deepEqual(replies.map((x) => x.status).sort(), [200, 409]);
      assert.equal(
        state.calls.filter((x) => x.path.includes("p/edit")).length,
        1,
      );
      assert.equal((await get(s.id)).state, "cancelled");
      assert.equal((await act(s, "cancel", { confirm: true })).status, 200);
      assert.equal(
        state.calls.filter((x) => x.path.includes("p/edit")).length,
        1,
      );
    },
  "legacy Borzo requests cannot dispatch": async () => {
    const s = await create();
    await state.db.query(
      "update courier_shipments set provider='borzo',state='draft' where id=$1",
      [s.id],
    );
    state.staff = false;
    assert.equal((await act(s, "book", { confirm: true })).status, 409);
    assert.equal(state.calls.filter((c) => c.method === "POST").length, 0);
    state.staff = true;
    assert.equal((await act(s, "cancel", { confirm: true })).status, 200);
  },
  "private storage and origin checks deny unauthorized writes": async () => {
    const s = await create();
    assert.equal(
      (await route.POST(request({ id: s.id, action: "view", access: "wrong" })))
        .status,
      200,
    );
    state.staff = false;
    assert.equal(
      (await route.POST(request({ id: s.id, action: "view", access: "wrong" })))
        .status,
      404,
    );
    assert.equal(
      (
        await route.POST(
          request(
            {
              id: s.id,
              access: s.access,
              action: "accept",
              revision: 1,
              confirm: true,
            },
            "https://evil.test",
          ),
        )
      ).status,
      403,
    );
    await state.db.exec("reset role;set role anon;");
    await assert.rejects(
      state.db.query("select * from delhivery_pickups"),
      /permission denied/,
    );
    await assert.rejects(
      state.db.query("update courier_shipments set state='payment_confirmed'"),
      /permission denied/,
    );
  },
})) {
  test(name, async () => {
    await setup();
    try {
      await fn();
    } finally {
      global.fetch = originalFetch;
      await state.db.close();
    }
  });
}
test("validation rejects invalid parcel values and closed pickup days, serviceability checks fail closed", () => {
  assert.throws(() => dl.validateDelhivery({ ...input, weight_grams: -1 }));
  assert.throws(() =>
    dl.validateDelhivery({ ...input, declared_value: 50000 }),
  );
  assert.throws(() => dl.validateDelhivery({ ...input, pincode: "000000" }));
  assert.throws(() => dl.validPickupDate("2026-11-02", new Date("2026-10-30")));
  assert.throws(() => dl.validPickupDate("2026-11-01", new Date("2026-10-30")));
  assert.throws(() => dl.validPickupDate("2026-02-30", new Date("2026-02-01")));
  assert.equal(dl.prepaidServiceable({ delivery_codes: [] }, "411027"), false);
  assert.equal(
    dl.prepaidServiceable(
      {
        delivery_codes: [
          { postal_code: { pin: 411027, pre_paid: "Y", remarks: "Embargo" } },
        ],
      },
      "411027",
    ),
    false,
  );
});
