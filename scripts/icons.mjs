import {deflateSync} from 'node:zlib';
import {mkdir,writeFile} from 'node:fs/promises';
// Small original icon, generated with standard Node modules; no image/build dependency.
const crc=bytes=>{let n=0xffffffff;for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1}return (n^0xffffffff)>>>0};
function chunk(type,data){const name=Buffer.from(type),length=Buffer.alloc(4),sum=Buffer.alloc(4);length.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([length,name,data,sum])}
const distance=(x,y,a,b,c,d)=>{const t=Math.max(0,Math.min(1,((x-a)*(c-a)+(y-b)*(d-b))/((c-a)**2+(d-b)**2)));return Math.hypot(x-a-t*(c-a),y-b-t*(d-b))};
export async function buildIcons(directory){
 await mkdir(directory,{recursive:true});
 for(const size of [16,32,48,128]){
  const pixels=Buffer.alloc((size*4+1)*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const px=(x+.5)*24/size,py=(y+.5)*24/size;
   const round=Math.hypot(Math.max(Math.abs(px-12)-7,0),Math.max(Math.abs(py-12)-7,0))<4;
   const bubble=px>=5&&px<=19&&py>=5&&py<=16&&(px<6.3||px>17.7||py<6.3||py>14.7);
   const tail=distance(px,py,5.7,15,5.7,19)<.65||distance(px,py,5.7,19,10.5,15.5)<.65;
   const tick=distance(px,py,8.5,10.7,11,13)<.75||distance(px,py,11,13,15.5,8.4)<.75;
   const pos=y*(size*4+1)+1+x*4;const color=bubble||tail||tick?[245,252,248]:[40,126,107];
   pixels.set([...color,round?255:0],pos);
  }
  const head=Buffer.alloc(13);head.writeUInt32BE(size);head.writeUInt32BE(size,4);head[8]=8;head[9]=6;
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
  await writeFile(`${directory}/icon-${size}.png`,png);
 }
}
