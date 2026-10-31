import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const php=process.env.PHP_BINARY||'php';
const flags=process.env.PHP_EXTENSION_DIR?['-n','-d',`extension_dir=${process.env.PHP_EXTENSION_DIR}`,'-d','extension=pdo_sqlite']:[];
const password=randomBytes(20).toString('hex');
const hash=execFileSync(php,['-n','-r','echo password_hash(getenv("TEST_PASSWORD"), PASSWORD_DEFAULT);'],{env:{...process.env,TEST_PASSWORD:password},encoding:'utf8'});
const data=mkdtempSync(join(tmpdir(),'storytracks-http-'));
const server=spawn(php,[...flags,'-S','127.0.0.1:8317','-t',resolve('dist/php/public')],{env:{...process.env,STORYTRACKS_DATA_DIR:data,STORYTRACKS_PASSWORD_HASH:hash},stdio:['ignore','pipe','pipe'],windowsHide:true});
let errors='';server.stderr.on('data',b=>errors+=b.toString());
let cookie='',csrf='';
async function request(action,body,token=csrf){const r=await fetch(`http://127.0.0.1:8317/api.php?action=${action}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','Cookie':cookie,'X-CSRF-Token':token},...(body?{body:JSON.stringify(body)}:{})});const c=r.headers.get('set-cookie');if(c)cookie=c.split(';')[0];const text=await r.text();let data;try{data=JSON.parse(text);}catch{throw new Error(`Non-JSON API response: ${text}`);}if(data.csrf)csrf=data.csrf;return {status:r.status,data};}
try{
  let ready=false;for(let i=0;i<30;i++){try{await fetch('http://127.0.0.1:8317/api.php');ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(ready,errors);
  assert.equal((await request('session')).data.authenticated,false);
  assert.equal((await request('list')).status,401);
  assert.equal((await request('login',{password},'invalid')).status,403);
  assert.equal((await request('login',{password})).data.authenticated,true);
  const fixture=JSON.parse(readFileSync('contracts/fixtures.json','utf8'));
  const result=await request('save',{project:fixture.project,expectedRevision:0});assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.project.revision,1);
  assert.equal(Array.isArray(result.data.project.chapters[1].metadata),false,'Empty metadata must serialize as an object.');
  assert.equal((await request('save',{project:fixture.project,expectedRevision:0})).status,409);
  const reopened=await request('list');assert.equal(reopened.data.projects.length,1);
  const out=await request('publish',{id:fixture.project.id,revision:1,includeSuspended:false});assert.equal(out.status,200,JSON.stringify(out.data));assert.equal(out.data.publication.markdown,fixture.publication.markdown.replace('project_revision: 0','project_revision: 1'));assert.equal(out.data.publication.history,fixture.publication.history);
  assert.equal((await request('publish',{id:fixture.project.id,revision:0,includeSuspended:false})).status,409);
  console.log('PHP HTTP checks passed: authentication, CSRF, object serialization, durable save/reopen, stale writes, revision-safe publication.');
}finally{server.kill();}
