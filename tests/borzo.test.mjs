import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../lib/courier/borzo.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const input={matter:'Fragile craft item',total_weight_kg:2,points:[{address:'Pickup street Pune 411027',contact_person:{name:'Studio',phone:'9518770073'},is_order_payment_here:false},{address:'Delivery street Pune 411001',contact_person:{name:'Customer',phone:'9999999999'},is_order_payment_here:true}]};
test('Borzo payload validates addresses, Indian phones, payer, weight and strips untrusted payment overrides',()=>{
 const p=api.validateBooking({...input,payment_method:'balance',bank_card_id:99});
 assert.equal(p.payment_method,'cash');assert.equal(p.points[0].contact_person.phone,'919518770073');assert.ok(!('bank_card_id' in p));
 for(const patch of [{total_weight_kg:0},{total_weight_kg:21},{total_weight_kg:1.5},{points:[]},{matter:''}])assert.throws(()=>api.validateBooking({...input,...patch}));
 assert.throws(()=>api.validateBooking({...input,points:input.points.map(p=>({...p,is_order_payment_here:false}))}));
});
test('quotes are signed, bound to shipment/input/amount, reject tampering and expire',()=>{
 process.env.COURIER_SIGNING_SECRET='s'.repeat(40);
 const payload={shipment:'test',input,amount:'100.00',exp:Date.now()+10000};const token=api.quoteToken(payload);
 assert.deepEqual(api.readQuote(token),payload);assert.throws(()=>api.readQuote(token.slice(0,-1)+'x'));
 assert.throws(()=>api.readQuote(api.quoteToken({...payload,exp:Date.now()-1})),/expired/);
 const raw='{"order":{"order_id":1}}';const sig=api.signed(raw,'secret');assert.equal(api.validSignature(raw,sig,'secret'),true);assert.equal(api.validSignature(raw+' ',sig,'secret'),false);
});
test('Borzo defaults to sandbox, sends secret only in server headers and uses order_id query',async()=>{
 const original=global.fetch;process.env.BORZO_AUTH_TOKEN='test-secret';delete process.env.BORZO_ENV;
 try{global.fetch=async(url,init)=>{assert.ok(String(url).startsWith('https://robotapitest-in.borzodelivery.com/'));assert.equal(init.headers['X-DV-Auth-Token'],'test-secret');if(init.method==='GET')assert.equal(url.searchParams.get('order_id'),'123');return Response.json({is_successful:true,order:{order_id:123}});};await api.borzo('create-order',api.validateBooking(input));await api.borzo('orders',{order_id:123});
 process.env.BORZO_ENV='production';delete process.env.BORZO_LIVE_ENABLED;await assert.rejects(api.borzo('create-order',input),/not enabled/);
 delete process.env.BORZO_ENV;global.fetch=async()=>Response.json({is_successful:false},{status:400});await assert.rejects(api.borzo('calculate-order',input),/could not process/);
 }finally{global.fetch=original;delete process.env.BORZO_ENV;delete process.env.BORZO_AUTH_TOKEN;}
});
