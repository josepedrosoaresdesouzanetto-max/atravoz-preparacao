import { readdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files=(await readdir('dist/assets')).map(f=>'/assets/'+f);
const html=await readFile('dist/index.html','utf8');
const version=createHash('sha256').update(html+files.join()).digest('hex').slice(0,12);
const assets=['/','/index.html','/manifest.webmanifest','/icon.svg',...files];
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
