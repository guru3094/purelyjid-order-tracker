import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
test('courier storage denies public writes, prevents duplicate open bookings and ignores stale/repeated callbacks',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');await db.exec(readFileSync(new URL('../supabase/migrations/20261029124429_borzo_shipments_and_store_sync.sql',import.meta.url),'utf8'));
 await db.exec("set role service_role;insert into courier_shipments(id,order_ref,access_hash,input,state) values('11111111-1111-4111-8111-111111111111','PJ100001','hash','{}','needs_review');");
 await assert.rejects(db.exec("insert into courier_shipments(order_ref,access_hash,input)values('PJ100001','other','{}')"),/duplicate/);
 const event=(at,status)=>db.query('select apply_borzo_event($1,$2,$3,null,$4) ok',[123,at,status,'11111111111141118111111111111111']);
 assert.equal((await event('2026-10-29T12:00:00Z','active')).rows[0].ok,true);
 await event('2026-10-29T11:00:00Z','new');await event('2026-10-29T12:00:00Z','new');
 let row=(await db.query('select * from courier_shipments')).rows[0];assert.equal(row.provider_status,'active');assert.equal(row.state,'booked');assert.equal(Number(row.borzo_id),123);
 await db.query("select apply_borzo_delivery_event(123,'2026-10-29T12:00:00Z','courier_picked_up','')");
 await event('2026-10-29T12:01:00Z','active');row=(await db.query('select * from courier_shipments')).rows[0];assert.equal(row.delivery_status,'courier_picked_up');
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from courier_shipments'),/permission denied/);await assert.rejects(event('2026-10-29T13:00:00Z','completed'),/permission denied/);
 }finally{await db.close();}
});
