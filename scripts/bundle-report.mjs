import { readdir,readFile } from 'node:fs/promises';
import { gzipSync,brotliCompressSync } from 'node:zlib';
const rows=[];
for(const file of await readdir('dist/assets'))if(/\.(js|css)$/.test(file)){const data=await readFile(`dist/assets/${file}`);rows.push({file,bytes:data.length,gzipBytes:gzipSync(data).length,brotliBytes:brotliCompressSync(data).length});}
console.log(JSON.stringify({note:'Compression sizes are offline estimates, not evidence the serving CDN sends compressed responses.',assets:rows},null,2));
