const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(process.argv[2]||process.cwd());
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'changes.json'),'utf8'));
const hash=s=>crypto.createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
const pending=[];
for(const item of data.manifest){const p=path.join(root,item.file),text=fs.readFileSync(p,'utf8');if(hash(text)===item.after)continue;if(hash(text)!==item.before)throw Error('File differs from reviewed version; refusing to overwrite: '+item.file);pending.push({p,text,next:fs.readFileSync(path.join(__dirname,'files',item.file),'utf8')});}
const p=path.join(root,'supabase/functions/emma-chat/index.ts');let text=fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n'),next=text;
for(const change of data.patches){if(next.includes(change.after))continue;const count=next.split(change.before).length-1;if(count!==1)throw Error('Emma backend differs from reviewed character code; refusing to overwrite');next=next.replace(change.before,change.after);}
if(next!==text)pending.push({p,text,next});
const assetPath=path.join(root,data.asset),asset=fs.readFileSync(path.join(__dirname,'files',data.asset));
if(fs.existsSync(assetPath)&&!fs.readFileSync(assetPath).equals(asset))throw Error('New asset filename already exists with different content');
const backup=path.join(root,'emma-backup-'+Date.now());
for(const item of pending){const relative=path.relative(root,item.p);const b=path.join(backup,relative);fs.mkdirSync(path.dirname(b),{recursive:true});fs.writeFileSync(b,item.text);}
for(const item of pending)fs.writeFileSync(item.p,item.next);
fs.mkdirSync(path.dirname(assetPath),{recursive:true});fs.writeFileSync(assetPath,asset);
console.log('Emma changes applied to '+root+'. Original files backed up to '+backup+'. Run typecheck/build and deploy emma-chat separately.');
