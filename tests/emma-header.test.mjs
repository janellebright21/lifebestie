import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSync} from 'esbuild';
// Compile the actual loader and manifest together; no CommonJS mock wrapping.
const compiled = buildSync({entryPoints:['src/lib/emmaModelAsset.ts'],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env.DEV':'false'}}).outputFiles[0].text;
const real = fs.readFileSync('public/characters/emma/Emma-Master.glb');
assert.equal(real.length,23517212,'Installed master must retain the verified full size');
const head = real.subarray(0,20), type={'content-type':'model/gltf-binary'};
const version=Buffer.from(head);version.writeUInt32LE(1,4);
const size=Buffer.from(head);size.writeUInt32LE(100,8);
const chunk=Buffer.from(head);chunk.write('BIN\0',16);
const cases=[
 ['actual 20-byte 206',head,206,{...type,'content-range':`bytes 0-19/${real.length}`},'ready'],
 ['206 without optional range',head,206,type,'ready'],
 ['actual full 200',real,200,type,'ready'],
 ['truncated header',head.subarray(0,12),206,type,'unavailable'],
 ['unsupported GLB version',version,206,type,'unavailable'],
 ['wrong model size',size,206,type,'unavailable'],
 ['wrong JSON chunk marker',chunk,206,type,'unavailable'],
 ['wrong range start',head,206,{...type,'content-range':`bytes 4-23/${real.length}`},'unavailable'],
 ['incomplete full response',head,200,type,'unavailable'],
 ['SPA HTML fallback','<html>app</html>',200,{'content-type':'text/html'},'unavailable'],
];
for(const [name,data,status,headers,expected] of cases) test(`Emma header: ${name}`,{concurrency:false},async()=>{
 const prior=globalThis.fetch;
 try {
  globalThis.fetch=async(url,options)=>{assert.equal(options.headers.Range,'bytes=0-19');return new Response(data,{status,headers});};
  // Every test needs a fresh module: ready probes are deliberately memoized.
  const url='data:text/javascript;base64,'+Buffer.from(compiled+'\n// '+name).toString('base64');
  const module=await import(url);const result=await module.loadEmmaModel();assert.equal(result.state,expected,JSON.stringify(result));
 } finally {globalThis.fetch=prior;}
});
