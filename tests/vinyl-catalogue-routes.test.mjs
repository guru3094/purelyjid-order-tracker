import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const responseStub=url('export const NextResponse = {json(value,init){return Response.json(value,init)}};');
const authStub=url('export async function isStaffAuthenticated(){return false;}');
const dbStub=url(`
 const rows=[{id:'00000000-0000-0000-0000-000000000001',code:'VD001',published:true,width:100,height:50},{id:'00000000-0000-0000-0000-000000000002',code:'VD002',published:false,width:100,height:50}];
 export function catalogueDb(){return {from(){let list=rows;return {select(){return this},eq(k,v){list=list.filter(r=>r[k]===v);return this},order(){return this},limit(){return Promise.resolve({data:list,error:null})}}}}}
 export function publicMetadata(r){return r;}
 export const metadataColumns='id,code,published';
 export async function catalogueRecord(id,staff=false){const r=rows.find(r=>r.id===id&&(staff||r.published));return r?{...r,outline:{path:'M0 0H100V50H0Z',bounds:{x1:0,y1:0,x2:100,y2:50},fillRule:'nonzero'}}:null;}
`);
async function route(file){
 let source=stripTypeScriptTypes(readFileSync(new URL(file,import.meta.url),'utf8'));
 const stubs={'next/server':responseStub,'@/lib/vinyl/catalogue':dbStub,'@/lib/auth/staffAuth':authStub};
 source=source.replace(/from "([^"]+)"/g,(_,dep)=>`from ${JSON.stringify(stubs[dep]||dep)}`);
 return import(url(source));
}
const list=await route('../app/api/vinyl-designs/route.ts');
const detail=await route('../app/api/vinyl-designs/[id]/route.ts');
test('public catalogue queries only published records',async()=>{
 const r=await list.GET(); assert.equal(r.status,200);
 assert.deepEqual((await r.json()).designs.map(d=>d.code),['VD001']);
 assert.equal(r.headers.get('cache-control'),'no-store');
});
test('unpublished and nonexistent design IDs cannot load vector outlines',async()=>{
 for(const id of ['00000000-0000-0000-0000-000000000002','missing']) assert.equal((await detail.GET(new Request('http://test'),{params:Promise.resolve({id})})).status,404);
 const r=await detail.GET(new Request('http://test'),{params:Promise.resolve({id:'00000000-0000-0000-0000-000000000001'})});
 assert.equal(r.status,200);assert.equal((await r.json()).outline.path,'M0 0H100V50H0Z');
});
