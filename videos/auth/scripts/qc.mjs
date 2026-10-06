import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {createRequire} from 'node:module';
const base=dirname(dirname(fileURLToPath(import.meta.url)));
// Optional inspection helper: SHARP_MODULE points to an already installed sharp.
const sharp=(await import(createRequire(import.meta.url).resolve(process.env.SHARP_MODULE||'sharp'))).default;
const specs=[['registro','01-registro.mp4',[.8,3.5,7.8,10,13.8,16.5,20.8,23.5,27.8,31,35.8,38.5,41.9]],['recuperar','02-recuperar-clave.mp4',[.8,3,6.8,9.5,13.8,16.5,20.8,24,28.8,30.5,33.8,36,38.9]]];
const records=[];
for(const [name,file,times] of specs){
 const input=join(base,'deliverables',file), dest=join(base,'qc',name);
 await mkdir(dest,{recursive:true});
 const ff=(args)=>{const r=spawnSync('ffmpeg',args,{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);return r.stderr;};
 const p=spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',input],{encoding:'utf8'});
 if(p.status!==0)throw Error(p.stderr);
 const probe=JSON.parse(p.stdout);
 await writeFile(join(dest,'probe.json'),p.stdout);
 ff(['-v','error','-i',input,'-f','null','-']);
 const audio=ff(['-hide_banner','-nostats','-i',input,'-filter_complex','ebur128=peak=true,silencedetect=noise=-60dB:d=0.4','-f','null','-']);
 await writeFile(join(dest,'audio.txt'),audio);
 const videoLog=ff(['-hide_banner','-nostats','-i',input,'-vf','blackdetect=d=0.1:pix_th=0.10','-an','-f','null','-']);
 await writeFile(join(dest,'black-detection.txt'),videoLog);
 const tiles=[];
 for(const [i,t] of times.entries()){
   const image=join(dest,`frame-${String(i).padStart(2,'0')}-${t}s.png`);
   ff(['-v','error','-ss',String(t),'-i',input,'-frames:v','1','-update','1','-y',image]);
   const label=Buffer.from(`<svg width="360" height="35"><rect width="360" height="35" fill="#252b26"/><text x="16" y="25" font-family="sans-serif" fill="#faf9f5" font-size="20">${t.toFixed(1)} s</text></svg>`);
   const small=await sharp(image).resize(360,640).png().toBuffer();
   tiles.push({input:label,top:Math.floor(i/4)*675,left:(i%4)*360},{input:small,top:Math.floor(i/4)*675+35,left:(i%4)*360});
 }
 await sharp({create:{width:1440,height:Math.ceil(times.length/4)*675,channels:3,background:'#252b26'}}).composite(tiles).jpeg({quality:90}).toFile(join(dest,'contact-sheet.jpg'));
 const chunks=[];const bytes=await readFile(input);let offset=0;
 while(offset+8<=bytes.length){let size=bytes.readUInt32BE(offset);const type=bytes.toString('ascii',offset+4,offset+8);if(size===1)size=Number(bytes.readBigUInt64BE(offset+8));if(size===0)size=bytes.length-offset;if(size<8)break;chunks.push({type,offset});offset+=size;}
 const loudness=audio.match(/Integrated loudness:\s+I:\s+([-\d.]+) LUFS/);
 const peaks=[...audio.matchAll(/Peak:\s+([-\d.]+) dBFS/g)];
 records.push({name,file,bytes:bytes.length,sha256:spawnSync('shasum',['-a','256',input],{encoding:'utf8'}).stdout.split(' ')[0],duration:probe.format.duration,streams:probe.streams.map(s=>({codec:s.codec_name,type:s.codec_type,width:s.width,height:s.height,pixelFormat:s.pix_fmt,fps:s.r_frame_rate,sampleRate:s.sample_rate,channels:s.channels,duration:s.duration})),integratedLufs:loudness?Number(loudness[1]):null,truePeakDbfs:peaks.length?Number(peaks.at(-1)[1]):null,fullDecode:'passed',blackIntervals:videoLog.includes('black_start:')?'detected':'none',silenceIntervals:audio.includes('silence_start:')?'detected':'none',fastStart:chunks.findIndex(x=>x.type==='moov')<chunks.findIndex(x=>x.type==='mdat'),frameTimes:times});
}
await writeFile(join(base,'qc','report.json'),JSON.stringify(records,null,2));
console.log(JSON.stringify(records,null,2));
