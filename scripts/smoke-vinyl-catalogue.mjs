// Runs against a local production build. No live credentials or database writes.
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
const secret='catalogue-smoke-test-secret-at-least-32-characters';
const port=3139, origin=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'https://build-placeholder.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'placeholder',STAFF_SESSION_SECRET:secret},stdio:['ignore','pipe','pipe']});
let output=''; child.stdout.on('data',d=>output+=d); child.stderr.on('data',d=>output+=d);
try {
 let ready=false;
 for(let i=0;i<60;i++){try{const r=await fetch(origin+'/vinylfonts');if(r.ok){const html=await r.text(); assert.match(html,/Browse Designs/);assert.match(html,/Upload Your Design/);ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
 assert.ok(ready,output);
 assert.equal((await fetch(origin+'/api/staff/vinyl-designs')).status,401);
 assert.equal((await fetch(origin+'/api/staff/vinyl-designs',{method:'POST',headers:{origin}})).status,403);
 const payload=Buffer.from(JSON.stringify({username:'test',expiresAt:Date.now()+60000})).toString('base64url');
 const cookie=`pj_staff_session=${payload}.${createHmac('sha256',secret).update(payload).digest('hex')}`;
 const headers={origin,cookie};
 const bad=await fetch(origin+'/api/staff/vinyl-designs',{method:'POST',headers:{...headers,origin:'https://untrusted.example'}});assert.equal(bad.status,403);
 const form=new FormData();for(const [k,v] of Object.entries({name:'Test geometry',code:'TEST001',category:'Decorative Designs',action:'preview'})) form.set(k,v);
 form.set('svg',new File(['<svg><path d="M0 0H100V50H0Z"/></svg>'],'test.svg',{type:'image/svg+xml'}));
 const preview=await fetch(origin+'/api/staff/vinyl-designs',{method:'POST',headers,body:form});
 assert.equal(preview.status,200,await preview.clone().text());
 assert.deepEqual((await preview.json()).outline.bounds,{x1:0,y1:0,x2:100,y2:50});
 form.set('action','save');
 assert.equal((await fetch(origin+'/api/staff/vinyl-designs',{method:'POST',headers,body:form})).status,400);
 console.log('PASS: customer page, unauthenticated requests, cross-origin rejection, authenticated vector preview and unapproved-save rejection. No database writes.');
} finally { child.kill('SIGTERM'); }
