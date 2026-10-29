import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
const dataUrl=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const compile=p=>ts.transpileModule(readFileSync(new URL(p,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const borzoUrl=dataUrl(compile('../lib/courier/borzo.ts'));const borzo=await import(borzoUrl);
const stateUrl=dataUrl(`export const state={row:null,calls:0};`);const {state}=await import(stateUrl);
const dbUrl=dataUrl(`import {state} from '${stateUrl}';export const supabase={from(){return {update(patch){this.patch=patch;return this},eq(k,v){if(k==='state')this.expected=v;return this},async select(){if(state.row.state!==this.expected)return {data:[]};Object.assign(state.row,this.patch);return {data:[{id:state.row.id}]};}}}};`);
const repoUrl=dataUrl(`import {state} from '${stateUrl}';export const accessHash=x=>x;export async function shipment(id,access,staff){if(!staff&&access!=='private')throw Error('Denied');return structuredClone(state.row)}export const publicShipment=x=>x;export async function saveShipment(id,patch){Object.assign(state.row,patch)}`);
const stubs={'next/server':dataUrl('export const NextResponse={json:(v,o)=>Response.json(v,o)}'),'@/lib/auth/staffAuth':dataUrl('export const isStaffAuthenticated=async()=>false;'),'@/lib/supabase/client':dbUrl,'@/lib/courier/borzo':borzoUrl,'@/lib/courier/repository':repoUrl};
let code=compile('../app/api/courier/route.ts').replace(/from ['"]([^'"]+)['"]/g,(_,dep)=>`from '${stubs[dep]||dep}'`);const route=await import(dataUrl(code));
const input={type:'standard',matter:'Crafts',total_weight_kg:1,vehicle_type_id:8,payment_method:'cash',points:[{address:'Pickup Pune address',contact_person:{name:'Studio',phone:'919518770073'},is_order_payment_here:false},{address:'Drop Pune address',contact_person:{name:'Customer',phone:'919999999999'},is_order_payment_here:true}]};
const id='11111111-1111-4111-8111-111111111111';
function reset(){state.row={id,input,state:'draft',customer_enabled:true};state.calls=0;process.env.BORZO_AUTH_TOKEN='test';process.env.COURIER_SIGNING_SECRET='s'.repeat(40);delete process.env.BORZO_ENV;}
const request=b=>new Request('https://www.purelyjid.in/api/courier',{method:'POST',headers:{origin:'https://www.purelyjid.in','Content-Type':'application/json'},body:JSON.stringify({id,access:'private',...b})});
const quote=()=>borzo.quoteToken({shipment:id,input,amount:'99.00',exp:Date.now()+60000});
test('concurrent customer confirmation creates exactly one provider booking',async()=>{
 reset();const original=global.fetch;
 try{global.fetch=async(url)=>{if(String(url).endsWith('create-order')){state.calls++;return Response.json({is_successful:true,order:{order_id:123,status:'new',payment_amount:'99.00'}});}return Response.json({is_successful:true,order:{payment_amount:'99.00'}});};
 const responses=await Promise.all([route.POST(request({action:'book',confirm:true,quote:quote()})),route.POST(request({action:'book',confirm:true,quote:quote()}))]);assert.equal(state.calls,1);assert.equal(state.row.borzo_id,123);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
 }finally{global.fetch=original;}
});
test('timeout after dispatch locks the booking for reconciliation and never auto-retries create',async()=>{
 reset();const original=global.fetch;
 try{global.fetch=async(url)=>{if(String(url).endsWith('create-order')){state.calls++;throw Error('timeout');}return Response.json({is_successful:true,order:{payment_amount:'99.00'}});};
 assert.equal((await route.POST(request({action:'book',confirm:true,quote:quote()}))).status,502);assert.equal(state.row.state,'needs_review');
 assert.equal((await route.POST(request({action:'book',confirm:true,quote:quote()}))).status,409);assert.equal(state.calls,1);
 }finally{global.fetch=original;}
});
test('customer cannot book before staff enablement, without confirmation, or with changed quote price',async()=>{
 reset();state.row.customer_enabled=false;assert.equal((await route.POST(request({action:'quote'}))).status,403);
 reset();assert.equal((await route.POST(request({action:'book',quote:quote()}))).status,403);
 const original=global.fetch;try{global.fetch=async()=>Response.json({is_successful:true,order:{payment_amount:'101.00'}});assert.equal((await route.POST(request({action:'book',confirm:true,quote:quote()}))).status,409);assert.equal(state.row.state,'draft');}finally{global.fetch=original;}
});
