import { readdir, writeFile, readFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files=(await readdir('dist/assets')).map(f=>'/assets/'+f);
const html=await readFile('dist/index.html','utf8');
const version=createHash('sha256').update(html+files.join()).digest('hex').slice(0,12);
const assets=['/','/index.html','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png',...files];
await writeFile('dist/sw.js',`const CACHE='resilient-shell-${version}';
const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('resilient-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname==='/central.html')return;
 if(ASSETS.includes(url.pathname))event.respondWith(caches.open(CACHE).then(cache=>cache.match(url.pathname)).then(cached=>cached||fetch(event.request)));
});
`);
console.log('Service Worker generated:',version,'assets:',assets.length);

await mkdir('dist/central',{recursive:true});
await writeFile('dist/central/index.html',await readFile('dist/central.html','utf8'));
await writeFile('dist/central/manifest.webmanifest',JSON.stringify({id:'/central/',name:'ATRAVOZ Central Mobile',short_name:'ATRAVOZ Central',start_url:'/central/',scope:'/central/',display:'standalone',background_color:'#f4f5ef',theme_color:'#123e39',icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/icon-512.png',sizes:'512x512',type:'image/png'}]}));
const centralAssets=['/central/','/central/index.html','/central/manifest.webmanifest','/icon-192.png','/icon-512.png',...files];
await writeFile('dist/central/sw.js',`const CACHE='atravoz-central-${version}';const ASSETS=${JSON.stringify(centralAssets)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('atravoz-central-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/'))return;if(ASSETS.includes(u.pathname))e.respondWith(caches.open(CACHE).then(c=>c.match(u.pathname)).then(r=>r||fetch(e.request)));});`);
