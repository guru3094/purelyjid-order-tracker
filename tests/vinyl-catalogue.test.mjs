import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const load = async (relative) => {
  let source = stripTypeScriptTypes(readFileSync(new URL(relative, import.meta.url), 'utf8'));
  source = source.replace(/from "(@xmldom\/xmldom|svgpath|svg-path-bbox|paper)"/g,(_,p)=>`from ${JSON.stringify(import.meta.resolve(p))}`);
  return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
};
const { normalizeCatalogueSvg, outlineSvg } = await load('../lib/vinyl/catalogue-svg.ts');
const { validateSelection, catalogueDimensions } = await load('../lib/vinyl/catalogue-types.ts');
const { nest, matSvg } = await load('../app/cricut_svg/nesting.ts');
const rectangle = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0H100V50H0Z"/></svg>';
test('approved paths retain exact vector bounds; inherited transforms compose correctly',()=>{
 const result=normalizeCatalogueSvg('<svg><g transform="translate(10 20)"><path transform="scale(2)" d="M0 0H100V50H0Z"/></g></svg>');
 assert.deepEqual(result.bounds,{x1:10,y1:20,x2:210,y2:120});
 assert.doesNotMatch(outlineSvg(result), /image|script|transform/);
});
test('hole contours and inherited evenodd fill are preserved without font welding',()=>{
 const result=normalizeCatalogueSvg('<svg fill-rule="evenodd"><g><path d="M0 0H100V100H0Z M25 25H75V75H25Z"/></g></svg>');
 assert.equal(result.fillRule,'evenodd'); assert.equal((result.path.match(/M/g)||[]).length,2);
});
test('separate overlapping evenodd elements are united instead of creating accidental holes',()=>{
 const result=normalizeCatalogueSvg('<svg fill-rule="evenodd"><path d="M0 0H100V50H0Z"/><path d="M50 0H150V50H50Z"/></svg>');
 assert.equal(result.fillRule,'nonzero'); assert.deepEqual(result.bounds,{x1:0,y1:0,x2:150,y2:50});
 assert.equal((result.path.match(/[Mm]/g)||[]).length,1);
});
test('reject unsafe, raster, open, mixed-rule and unsupported SVGs',()=>{
 for(const source of ['<svg><script/></svg>','<svg><image href="https://example.com/a.png"/></svg>','<svg><path d="M0 0L10 10"/></svg>','<svg><path onclick="x()" d="M0 0H10V10Z"/></svg>','<svg><path fill="url(#x)" d="M0 0H10V10Z"/></svg>','<svg><path stroke="red" d="M0 0H10V10Z"/></svg>','<svg><path d="M0 0H10V10Z"/><path fill-rule="evenodd" d="M20 0H30V10Z"/></svg>','<!DOCTYPE svg [<!ENTITY x "x">]><svg/>']) assert.throws(()=>normalizeCatalogueSvg(source),source);
});
const item={id:'test',design:{width:100,height:50,code:'VD001'},sizeBy:'width',size:'7',quantity:'2'};
test('whole-artwork dimensions follow width or height; invalid size/quantity rejected',()=>{
 const size=validateSelection(item); assert.ok(Math.abs(size.width-7)<1e-10); assert.ok(Math.abs(size.height-3.5)<1e-10);
 assert.deepEqual(catalogueDimensions({...item,sizeBy:'height',size:'5'}),{width:10,height:5});
 for(const patch of [{size:'NaN'},{size:'0'},{quantity:'1.5'},{quantity:'101'}]) assert.throws(()=>validateSelection({...item,...patch}));
});
test('catalogue paths nest with other designs and export actual vectors at the requested size',()=>{
 const o=normalizeCatalogueSvg(rectangle);
 const design={id:'catalogue',sequence:0,content:'VD001',fontCode:'CATALOGUE',path:o.path,fillRule:o.fillRule,bounds:{x1:0,y1:0},scale:.5,width:50,height:25};
 const mats=nest([design,{...design,id:'text',sequence:1,fontCode:'PF01'}],2,true,1);
 assert.equal(mats.length,1); assert.equal(mats[0].placements.length,2);
 assert.ok(mats[0].placements.every(p=>p.design.width===50));
 const svg=matSvg(mats[0]); assert.match(svg,/<path/); assert.doesNotMatch(svg,/<image|<text/);
 assert.throws(()=>nest([{...design,width:500,height:300}],2,true,1));
});
test('customer font selector remains unchanged from the baseline snapshot',()=>{
 const source=readFileSync(new URL('../app/vinylfonts/VinylFontSelector.tsx',import.meta.url),'utf8');
 assert.equal((source.match(/code: "PF0[1-8]"/g)||[]).length,8);
});
