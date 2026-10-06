import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join, dirname} from 'node:path';
import {stories} from '../stories.mjs';

const base=dirname(dirname(fileURLToPath(import.meta.url)));
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const brand=`<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="10" fill="#385443"/><path d="m8 15 8-7 8 7M10 14v10h12V14M14 24v-7h4v7" fill="none" stroke="#faf9f5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const arrow=`<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 24h28M27 13l11 11-11 11" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const envelope=`<svg viewBox="0 0 160 120" aria-hidden="true"><rect x="10" y="12" width="140" height="96" rx="14" fill="#edf1e9" stroke="#385443" stroke-width="5"/><path class="draw" d="m16 20 64 49 64-49" fill="none" stroke="#385443" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const key=`<svg viewBox="0 0 160 120" aria-hidden="true"><circle cx="48" cy="51" r="28" fill="#edf1e9" stroke="#385443" stroke-width="6"/><path class="draw" d="m72 68 50 37 17-22-15-11-9 11-13-10 9-12-17-13" fill="none" stroke="#385443" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const css=`
@font-face {font-family:'Instrument Sans';src:url('assets/InstrumentSans.woff2') format('woff2');font-weight:400 700;font-style:normal;font-display:block;}
*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#faf9f5;color:#252b26;font-family:'Instrument Sans',sans-serif}
#root{position:relative;width:100%;height:100%;overflow:hidden;background:#faf9f5}
.clip{position:absolute;inset:0;width:100%;height:100%}
.brand{position:absolute;left:96px;top:102px;display:flex;align-items:center;gap:22px;color:#252b26;z-index:10}
.brand svg{width:80px;height:80px;display:block}.brand-name{font-size:40px;line-height:1.08;font-weight:700;letter-spacing:-1px}.brand-sub{font-size:24px;letter-spacing:5px;font-weight:500;margin-top:8px}
.guide{position:absolute;right:96px;top:120px;color:#385443;font-size:32px;font-weight:600;z-index:10}
.scene-body{height:100%;padding:258px 96px 265px;display:flex;flex-direction:column;gap:27px}
.eyebrow{font-size:31px;line-height:1.25;letter-spacing:2.2px;font-weight:600;color:#385443;margin:0}
h1{font-size:94px;line-height:1.04;font-weight:700;letter-spacing:-4px;margin:0;max-width:888px;white-space:pre-line}
.deck{font-size:43px;line-height:1.27;color:#666b63;margin:0;max-width:868px}
.demo{flex:1;min-height:530px;display:flex;align-items:center;justify-content:center}
.panel{width:100%;border:3px solid #e3e5dc;border-radius:30px;padding:36px 42px;background:#ffffff;display:flex;flex-direction:column;gap:25px}
.panel .mini{font-size:29px;letter-spacing:.5px;font-weight:600;color:#666b63;line-height:1.2;margin:0}
.panel h2{margin:0;font-size:46px;line-height:1.14;letter-spacing:-1px;color:#252b26}
.panel p{margin:0;line-height:1.3}.panel .body{font-size:38px;color:#666b63}
.ui-brand{display:flex;align-items:center;gap:15px;border-bottom:2px solid #e3e5dc;padding-bottom:22px;font-size:32px;font-weight:600}.ui-brand svg{width:52px;height:52px}
.field{display:flex;flex-direction:column;gap:11px}.label{font-size:34px;font-weight:600;line-height:1.18}
.value{border:2px solid #8b9385;background:#faf9f5;border-radius:14px;padding:24px;font-size:39px;line-height:1.2;min-height:95px;color:#252b26;display:flex;align-items:center;justify-content:space-between;gap:16px}
.value.dim{color:#666b63}.helper{font-size:31px;color:#666b63;line-height:1.25}.value .show{color:#385443;font-size:28px;font-weight:600}
.button{position:relative;background:#385443;color:#ffffff;border-radius:15px;padding:26px 70px 26px 24px;text-align:center;font-size:37px;line-height:1.22;font-weight:600;min-height:102px;display:flex;align-items:center;justify-content:center}
.link-button{position:relative;font-size:36px;font-weight:600;text-decoration:underline;text-underline-offset:8px;color:#385443;border:3px solid #385443;border-radius:16px;padding:24px 70px 24px 24px;text-align:center;line-height:1.25}
.option{border:2px solid #8b9385;border-radius:14px;padding:21px;font-size:34px;line-height:1.2;display:flex;gap:18px;align-items:center}.option.active{background:#edf1e9;border:3px solid #385443}.radio{width:28px;height:28px;border:3px solid #385443;border-radius:50%;flex:0 0 28px}.active .radio{background:#385443;box-shadow:inset 0 0 0 5px #edf1e9}
.options{display:grid;grid-template-columns:1fr 1fr;gap:18px}.note{font-size:30px;color:#666b63;line-height:1.28;margin:0}.soft{background:#edf1e9;border-radius:16px;padding:25px;font-size:35px;line-height:1.3;color:#385443}
.mail-art{width:156px;height:120px;margin:0 auto 10px;display:block}.mail-art svg{width:100%;height:100%}
.mail-content{border:2px solid #e3e5dc;border-radius:18px;padding:25px;display:flex;flex-direction:column;gap:20px}.mail-link{display:flex;gap:20px;align-items:center;color:#385443;font-size:38px;line-height:1.2;font-weight:600;text-decoration:underline;text-underline-offset:8px}.mail-link svg{width:48px;height:48px;flex:0 0 48px}.mail-caption{font-size:29px;line-height:1.2;color:#666b63;text-align:center}
.step-row{display:grid;grid-template-columns:1fr 1fr;gap:18px;font-size:29px;line-height:1.2;font-weight:600}.step-row span{padding:15px 0;border-top:4px solid #385443;color:#385443}
.big-number{font-size:110px;font-weight:700;letter-spacing:-5px;line-height:1;color:#385443;display:flex;gap:20px;align-items:baseline}.big-number small{font-size:46px;letter-spacing:-1px}.review-rule{font-size:36px;color:#666b63;line-height:1.3}
.caption{display:flex;gap:22px;align-items:flex-start;min-height:155px;margin-top:4px}.caption-arrow{display:flex;flex:0 0 56px;width:56px;height:56px;border-radius:50%;align-items:center;justify-content:center;background:#edf1e9;color:#385443;margin-top:4px}.caption-arrow svg{width:36px;height:36px}.tip{font-size:44px;line-height:1.27;font-weight:600;color:#252b26;margin:0}.foot{font-size:32px;line-height:1.3;color:#666b63;margin-top:16px}
.footer{position:absolute;left:96px;right:96px;top:1714px;display:flex;gap:16px;align-items:center;z-index:10}.progress-rail{height:8px;flex:1;background:#e3e5dc;border-radius:4px;overflow:hidden}.progress{width:100%;height:8px;background:#385443;transform-origin:left center}.footer-text{font-size:26px;letter-spacing:1px;color:#666b63;font-weight:600;line-height:1.2}
.tap{position:absolute;right:24px;top:calc(50% - 22px);width:44px;height:44px;pointer-events:none;z-index:3;display:flex;align-items:center;justify-content:center}.tap-dot{width:20px;height:20px;border:3px solid currentColor;border-radius:50%;background:transparent}.tap-ring{position:absolute;inset:0;border:3px solid currentColor;border-radius:50%;opacity:0}
.corner{position:absolute;left:53px;top:258px;width:16px;height:1300px;border-left:3px solid #e3e5dc;border-top:3px solid #e3e5dc;border-bottom:3px solid #e3e5dc;pointer-events:none}
`;
const tap='<span class="tap" data-layout-ignore="true" aria-hidden="true"><span class="tap-ring"></span><span class="tap-dot"></span></span>';
const button=(label,kind='button')=>`<div class="${kind} action" data-click="true">${escape(label)}${tap}</div>`;
const field=(label,value,extra='')=>`<div class="field reveal"><div class="label">${escape(label)}</div><div class="value">${escape(value)}${extra}</div></div>`;
const options=`<div class="label">Tipo de cuenta</div><div class="options reveal"><div class="option active"><span class="radio"></span>Propietario</div><div class="option"><span class="radio"></span>Agencia</div></div>`;

function view(kind){
  const header=`<div class="ui-brand">${brand}<span>La Protectora del Alquiler</span></div>`;
  const home=`${header}<h2 class="reveal">Proteja su propiedad.<br>Alquile con confianza.</h2><p class="body reveal">Experiencias de otros propietarios para elegir mejor a su inquilino.</p>`;
  const mail=(reset)=>`<div class="mail-art">${envelope}</div><p class="mini">${reset?'RECUPERACIÓN DE CLAVE':'CONFIRMACIÓN DE CUENTA'}</p><div class="mail-content reveal"><p class="body">Mensaje para su correo</p><p class="mail-link">${reset?'Abra el enlace de recuperación':'Abra el enlace de confirmación'}${arrow}</p></div><p class="mail-caption">Ilustración del correo</p>`;
  switch(kind){
    case 'homeRegister': return home+button('Crear una cuenta')+'<p class="note">¿Ya tiene cuenta? Iniciar sesión · Recuperar mi clave</p>';
    case 'homeReset': return home+'<p class="body reveal">¿Ya tiene cuenta?</p>'+button('Recuperar mi clave','link-button');
    case 'identity': return '<p class="mini">CREAR UNA CUENTA · DATOS FICTICIOS</p>'+field('Número de cédula','•-••••-••••')+field('Nombre completo','Ana Ejemplo')+'<p class="helper reveal">Puede escribirla con o sin guiones.</p>';
    case 'contact': return '<p class="mini">CREAR UNA CUENTA · DATOS FICTICIOS</p>'+field('Correo electrónico','ana@example.com')+field('Perfil de Facebook','Ana Ejemplo')+'<p class="helper reveal">Su nombre, usuario o enlace de Facebook.</p>';
    case 'registerSubmit': return field('Clave','••••••••••','<span class="show">Mostrar</span>')+'<p class="helper">Mínimo 8 caracteres, con letras y números.</p>'+options+button('Crear cuenta');
    case 'mailRegister': return mail(false);
    case 'review': return '<div class="step-row reveal"><span>✓ Su cuenta</span><span>2 Su primera reseña</span></div><h2 class="reveal">Mi primera reseña</h2><p class="body reveal">Identifique al inquilino y cuente qué ocurrió.</p><div class="soft reveal"><div class="big-number">3 <small>meses de consultas</small></div><p class="review-rule">Desde la aprobación de su primera reseña.</p></div>';
    case 'requestReset': return '<h2 class="reveal">Recuperar mi clave</h2>'+field('Correo electrónico de su cuenta','ana@example.com')+button('Solicitar enlace de recuperación')+'<p class="note">Ejemplo ficticio · No se solicita ningún correo.</p>';
    case 'mailReset': return mail(true)+'<p class="soft reveal">Use el mensaje más reciente.</p>';
    case 'newPassword': return '<h2 class="reveal">Elija una clave nueva</h2>'+field('Clave nueva','••••••••••','<span class="show">Mostrar</span>')+field('Confirme la clave nueva','••••••••••','<span class="show">Mostrar</span>')+button('Guardar clave nueva');
    case 'continue': return '<div class="mail-art">'+key+'</div><h2 class="reveal">Después de guardar su clave</h2><p class="body reveal">Cuando vea la confirmación en la plataforma, continúe.</p>'+button('Continuar con mi cuenta');
    case 'expired': return '<h2 class="reveal">¿El enlace venció o ya se usó?</h2><p class="body reveal">Solicite uno nuevo para continuar.</p>'+button('Solicitar un enlace nuevo');
    default: throw Error('Unknown view: '+kind);
  }
}

for(const [name, story] of Object.entries(stories)){
  const dir=join(base,name);
  await mkdir(join(dir,'compositions'),{recursive:true});
  await mkdir(join(dir,'assets'),{recursive:true});
  for(const f of ['gsap.min.js','InstrumentSans.woff2','OFL-InstrumentSans.txt']) await copyFile(join(base,'shared',f),join(dir,'assets',f));
  let start=0; const mounts=[]; const storyboard=[]; const captions=[];
  for(const [i, scene] of story.scenes.entries()){
    const id=`${name}-${String(i+1).padStart(2,'0')}`;
    const body=`<div class="scene-body"><p class="eyebrow">${escape(scene.step)}</p><h1 class="title">${escape(scene.title)}</h1><p class="deck">${escape(scene.deck)}</p><div class="demo"><div class="panel">${view(scene.view)}</div></div><div class="caption"><span class="caption-arrow">${arrow}</span><div><p class="tip">${escape(scene.tip)}</p><p class="foot">${escape(scene.foot)}</p></div></div></div>`;
    const script=`const tl=gsap.timeline({paused:true});
tl.fromTo('.eyebrow',{opacity:0,x:-18},{opacity:1,x:0,duration:.3,ease:'power2.out'},.04);
tl.fromTo('.title',{opacity:0,y:24},{opacity:1,y:0,duration:.45,ease:'power3.out'},.08);
tl.fromTo('.deck',{opacity:0},{opacity:1,duration:.35},.22);
tl.fromTo('.panel',{opacity:0,y:32},{opacity:1,y:0,duration:.5,ease:'power3.out'},.30);
tl.fromTo('.reveal',{opacity:0,x:12},{opacity:1,x:0,duration:.32,stagger:.18,ease:'power2.out'},.65);
tl.fromTo('.caption',{opacity:0,x:-15},{opacity:1,x:0,duration:.4,ease:'power2.out'},.9);
if(document.querySelector('.tap')){
tl.fromTo('.tap',{opacity:0,x:18,y:20},{opacity:1,x:0,y:0,duration:.4,ease:'power2.out'},${Math.min(2,scene.duration-2)});
tl.to('.tap-dot',{scale:.72,duration:.10,yoyo:true,repeat:1,ease:'power2.inOut'},${Math.min(2.5,scene.duration-1.4)});
tl.fromTo('.tap-ring',{scale:.55,opacity:0},{scale:1.7,opacity:.75,duration:.25,ease:'power2.out'},${Math.min(2.5,scene.duration-1.4)});
tl.to('.tap-ring',{opacity:0,duration:.45,ease:'power2.out'},${Math.min(2.75,scene.duration-1.1)});
}
document.querySelectorAll('.draw').forEach(p=>{const length=p.getTotalLength();p.style.strokeDasharray=length;p.style.strokeDashoffset=length;tl.to(p,{strokeDashoffset:0,duration:.7,ease:'power2.out'},.7);});
tl.to({}, {duration:.01}, ${scene.duration-.01});
window.__timelines['${id}']=tl;`;
    await writeFile(join(dir,'compositions',id+'.html'),`<!doctype html><html lang="es-CR"><head><meta charset="UTF-8"></head><body><template><style>${css}</style><div id="root" data-composition-id="${id}" data-width="1080" data-height="1920" data-duration="${scene.duration}">${body}</div><script>${script}</script></template></body></html>`);
    mounts.push(`<div id="${id}" class="clip" data-composition-id="${id}" data-composition-src="compositions/${id}.html" data-start="${start}" data-duration="${scene.duration}" data-track-index="0" data-width="1080" data-height="1920"></div>`);
    storyboard.push(`## Frame ${i+1}\nstatus: authored\nsrc: compositions/${id}.html\nstart: ${start}\nduration: ${scene.duration}\nmotion: title-and-panel reveal; cursor-click-ripple where an action exists; svg-path-draw for mail/key symbols.\nbeat: ${scene.title.replaceAll('\n',' ')} ${scene.tip}\n`);
    captions.push({start,end:start+scene.duration,text:scene.title.replaceAll('\n',' ')+' '+scene.deck+' '+scene.tip+' '+scene.foot});
    start+=scene.duration;
  }
  if(start!==story.duration)throw Error(`${name}: timeline mismatch`);
  await writeFile(join(dir,'index.html'),`<!doctype html><html lang="es-CR" data-resolution="portrait"><head><meta charset="UTF-8"><meta name="viewport" content="width=1080,height=1920"><title>${escape(story.title)} · La Protectora del Alquiler</title><script src="assets/gsap.min.js"></script><style>${css}</style></head><body><div id="root" data-composition-id="${name}" data-start="0" data-duration="${story.duration}" data-width="1080" data-height="1920"><div class="corner" data-layout-ignore="true"></div>${mounts.join('\n')}<div class="brand">${brand}<div><div class="brand-name">La Protectora</div><div class="brand-sub">DEL ALQUILER</div></div></div><div class="guide">GUÍA ${story.number}</div><div class="footer"><div class="progress-rail"><div class="progress"></div></div><div class="footer-text">PASO A PASO</div></div><audio id="${name}-music" class="clip" src="assets/musica-original.wav" data-start="0" data-duration="${story.duration}" data-track-index="1" data-volume="1"></audio></div><script>const tl=gsap.timeline({paused:true});tl.fromTo('.progress',{scaleX:0},{scaleX:1,duration:${story.duration},ease:'none'},0);window.__timelines['${name}']=tl;</script></body></html>`);
  await writeFile(join(dir,'STORYBOARD.md'),`# ${story.title}\n\n${storyboard.join('\n')}`);
  await writeFile(join(dir,'BRIEF.md'),`---\nworkflow: general-video\nflow: automation\nstoryboard: no\nlanguage: es-CR\naspect: portrait\nlength: ${story.duration}\nmessage: "${story.title} con pasos claros y reales"\n---\n\nUser authorized two complete explanatory videos, editable repository source and MP4 rendering. Initial Spanish assumption accepted in delegation; vertical format, duration, no voice and original local music are production choices. Authored enlarged instructional replicas use fictional data and never submit forms. Source labels and behavior verified in app code and public UI. No authentication success is represented as a performed operation. Final render is part of the explicitly delegated request.\n`);
  await writeFile(join(dir,'captions.json'),JSON.stringify(captions,null,2));
  await writeFile(join(dir,'index.motion.json'),JSON.stringify({duration:story.duration,assertions:[{kind:'appearsBy',selector:'.brand',bySec:.5},{kind:'staysInFrame',selector:'.brand'},...story.scenes.map((_,i)=>({kind:'staysInFrame',selector:`#${name}-${String(i+1).padStart(2,'0')} .panel`})),{kind:'keepsMoving',withinSelector:'.progress',maxStaticSec:2}]},null,2));
  await writeFile(join(dir,'meta.json'),JSON.stringify({title:story.title,description:'Guía de ayuda en español · La Protectora del Alquiler',duration:story.duration,width:1080,height:1920,fps:30},null,2));
  await writeFile(join(dir,'package.json'),JSON.stringify({name:'protectora-video-'+name,private:true,type:'module',scripts:{dev:'npx --yes hyperframes@0.8.117 preview',check:'npx --yes hyperframes@0.8.117 check',render:`npx --yes hyperframes@0.8.117 render --fps 30 --quality delivery --output renders/${name}.mp4`}},null,2)+'\n');
  console.log(`${name}: ${story.scenes.length} scenes, ${start}s`);
}
