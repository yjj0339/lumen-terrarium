import * as T from './vendor/three.module.js';
import { OrbitControls } from './vendor/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from './vendor/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from './vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from './vendor/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from './vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/jsm/postprocessing/OutputPass.js';
import { createWorld,createSpace } from './world.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let ready=false,paused=reduceMotion,orbit=false,cycle=!reduceMotion,hour=16.33,elapsed=0,frameCount=0,zen=false;
let renderer,scene,camera,controls,composer,world,transition,shiftPass,fxaa;
let last=performance.now(),lastClock=-1,toastTimeout;
let controlsCollapsed=innerWidth<700&&innerHeight<700,controlsUserChoice=false,layoutFrame=0,projectionZoom=-1;
let framing={size:25,xShift:0,yShift:0,width:innerWidth,height:innerHeight};
const touchDevice=()=>matchMedia('(pointer:coarse)').matches||(navigator.maxTouchPoints>0&&innerWidth<=700);
const mobileLayout=()=>innerWidth<=700||(touchDevice()&&innerWidth<=1100)||(innerHeight<=600&&innerWidth<=1100);
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('#toast').classList.remove('visible'),3200);}
function fail(message){$('#loader').classList.remove('done');$('#loader h2').textContent='这个世界暂时无法展开';$('#load-status').textContent=message;$('.loading-line').style.display='none';window.__LUMEN_ERROR__=message;}
window.addEventListener('error',e=>{console.error('Lumen:',e.message);if(!ready)fail('请在开启硬件加速的现代浏览器中重试。'+e.message);});

const views={
  overview:{position:[16.5,12.8,18.5],target:[0,1.9,0],zoom:1},
  river:{position:[10,7.8,15.8],target:[.0,.1,.1],zoom:1.58},
  forest:{position:[9.0,5.3,14.0],target:[-2.4,-.3,2.9],zoom:2.35},
  peaks:{position:[12,10.5,16.5],target:[-1.6,2.4,-2.5],zoom:1.9}
};
let currentView='overview';
function setView(name,immediate=false){
  if(!ready)return;const v=views[name];currentView=name;orbit=false;$('#orbit').setAttribute('aria-pressed','false');controls.autoRotate=false;
  $$('.view-button').forEach(b=>{const on=b.dataset.view===name;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
  const startPosition=camera.position.clone(),startTarget=controls.target.clone();const target=new T.Vector3(...v.target),endPosition=target.clone().add(new T.Vector3(...v.position));
  transition={start:performance.now(),duration:immediate||reduceMotion?1:1450,startPosition,startTarget,target,endPosition,startZoom:camera.zoom,endZoom:v.zoom};
  $('#detail').hidden=true;
}
function applyCameraFrame(){const {size,xShift,yShift,width:w,height:h}=framing,halfW=size*w/h/2,x=xShift/camera.zoom,y=yShift/camera.zoom;camera.left=-halfW+x;camera.right=halfW+x;camera.top=size/2+y;camera.bottom=-size/2+y;camera.updateProjectionMatrix();projectionZoom=camera.zoom;}
function scheduleResize(){cancelAnimationFrame(layoutFrame);layoutFrame=requestAnimationFrame(resize);}
function resize(){
  if(!renderer||!composer)return;
  const rect=$('#app').getBoundingClientRect(),w=Math.round(rect.width),h=Math.round(rect.height),aspect=w/h;
  if(!controlsUserChoice){controlsCollapsed=mobileLayout()&&w<h&&h<700;document.body.classList.toggle('controls-collapsed',controlsCollapsed);$('#settings-toggle').setAttribute('aria-expanded',String(!controlsCollapsed));}
  const dock=$('.control-dock').getBoundingClientRect();document.documentElement.style.setProperty('--dock-height',`${Math.ceil(dock.height)}px`);
  let size=25,xShift=-25*aspect*.075,yShift=-.8;
  if(mobileLayout()){
    const landscape=aspect>=1.2&&h<=600;
    const viewsRect=$('.views').getBoundingClientRect(),bar=$('.topbar').getBoundingClientRect(),intro=$('.intro').getBoundingClientRect(),cam=$('.camera-tools').getBoundingClientRect();
    const left=landscape?66:12,right=landscape?dock.left-12:w-12;
    const top=zen?28:(landscape?bar.bottom+8:Math.max(bar.bottom,intro.bottom,cam.bottom)+10);
    const bottom=zen?h-64:viewsRect.top-10;
    const availableW=Math.max(180,right-left),availableH=Math.max(60,bottom-top);
    size=Math.max(19*h/availableH,18.6*h/availableW);
    const centerX=zen?w/2:(left+right)/2,centerY=(top+bottom)/2;
    xShift=(.5-centerX/w)*size*aspect;yShift=(centerY/h-.5)*size+.25;
  }
  framing={size,xShift,yShift,width:w,height:h};applyCameraFrame();
  const ratio=Math.min(devicePixelRatio,mobileLayout()?1.35:1.7);if(renderer.getPixelRatio()!==ratio){renderer.setPixelRatio(ratio);composer.setPixelRatio(ratio);}
  renderer.setSize(w,h);composer.setSize(w,h);shiftPass.uniforms.resolution.value.set(w,h);fxaa.uniforms.resolution.value.set(1/(w*ratio),1/(h*ratio));
}
function zoomBy(factor){if(!ready)return;transition=null;camera.zoom=T.MathUtils.clamp(camera.zoom*factor,controls.minZoom,controls.maxZoom);applyCameraFrame();controls.update();}
function toggleControls(){controlsUserChoice=true;controlsCollapsed=!controlsCollapsed;updateControlPanel();}
function updateControlPanel(){document.body.classList.toggle('controls-collapsed',controlsCollapsed);$('#settings-toggle').setAttribute('aria-expanded',String(!controlsCollapsed));scheduleResize();}
function updateClock(){let minute=Math.floor(hour*60+1e-7)%1440;if(minute===lastClock)return;lastClock=minute;$('#clock').textContent=`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;$('#daytime').value=hour;$('#phase').textContent=hour<5?'万籁星夜':hour<8?'林间晨曦':hour<15?'晴昼山色':hour<17?'午后微光':hour<19?'落日余温':hour<21?'蓝调时刻':'万籁星夜';}
function setHour(value){hour=((Number(value)%24)+24)%24;cycle=false;$('#cycle').setAttribute('aria-pressed','false');lastClock=-1;updateClock();world?.setDay(hour);}

async function init(){
  try{
    renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
  }catch(e){fail('浏览器未能启用 WebGL 2，请开启硬件加速后重新打开。');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobileLayout()?1.35:1.7));renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;renderer.outputColorSpace=T.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  $('#scene').appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','三维生态场景，拖动旋转，滚轮缩放');renderer.domElement.tabIndex=0;
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;toast('图形上下文暂时中断，请刷新页面恢复世界。');});
  scene=new T.Scene();camera=new T.OrthographicCamera(-10,10,10,-10,.1,180);camera.position.set(16.5,14.7,18.5);
  controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.9,0);controls.enableDamping=true;controls.dampingFactor=.065;controls.enablePan=false;controls.minZoom=.68;controls.maxZoom=3.5;controls.minPolarAngle=.25;controls.maxPolarAngle=1.45;controls.autoRotateSpeed=.25;controls.rotateSpeed=.5;controls.zoomSpeed=.7;controls.update();
  controls.touches.ONE=T.TOUCH.ROTATE;controls.touches.TWO=T.TOUCH.DOLLY_ROTATE;controls.addEventListener('start',()=>{transition=null;});
  const pmrem=new T.PMREMGenerator(renderer),environment=new RoomEnvironment();const env=pmrem.fromScene(environment,.025);scene.environment=env.texture;scene.environmentIntensity=.45;environment.dispose();pmrem.dispose();
  createSpace(scene);world=createWorld(scene);
  composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),.12,.55,2.0);composer.addPass(bloom);
  shiftPass=new ShaderPass({uniforms:{tDiffuse:{value:null},resolution:{value:new T.Vector2(innerWidth,innerHeight)},uTime:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`uniform sampler2D tDiffuse;uniform vec2 resolution;uniform float uTime;varying vec2 vUv;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){float d=max(abs(vUv.y-.50)-.19,0.0);vec2 r=vec2(0.,d*d*30.0/resolution.y);vec4 c=texture2D(tDiffuse,vUv)*.28;c+=texture2D(tDiffuse,vUv+r)*.22;c+=texture2D(tDiffuse,vUv-r)*.22;c+=texture2D(tDiffuse,vUv+r*2.)*.11;c+=texture2D(tDiffuse,vUv-r*2.)*.11;c+=texture2D(tDiffuse,vUv+r*3.)*.03;c+=texture2D(tDiffuse,vUv-r*3.)*.03;c.rgb+=(hash(vUv*resolution)-.5)*.002;gl_FragColor=c;}`});composer.addPass(shiftPass);composer.addPass(new OutputPass());
  fxaa=new ShaderPass({uniforms:{tDiffuse:{value:null},resolution:{value:new T.Vector2(1/innerWidth,1/innerHeight)}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`uniform sampler2D tDiffuse;uniform vec2 resolution;varying vec2 vUv;void main(){vec3 nw=texture2D(tDiffuse,vUv+vec2(-1.,-1.)*resolution).rgb,ne=texture2D(tDiffuse,vUv+vec2(1.,-1.)*resolution).rgb,sw=texture2D(tDiffuse,vUv+vec2(-1.,1.)*resolution).rgb,se=texture2D(tDiffuse,vUv+vec2(1.,1.)*resolution).rgb,m=texture2D(tDiffuse,vUv).rgb;vec3 l=vec3(.299,.587,.114);float a=dot(nw,l),b=dot(ne,l),c=dot(sw,l),d=dot(se,l),e=dot(m,l),mn=min(e,min(min(a,b),min(c,d))),mx=max(e,max(max(a,b),max(c,d)));vec2 dir=vec2(-((a+b)-(c+d)),(a+c)-(b+d));float red=max((a+b+c+d)*.03125,.0078125);float inv=1./(min(abs(dir.x),abs(dir.y))+red);dir=clamp(dir*inv,vec2(-8.),vec2(8.))*resolution;vec3 r1=.5*(texture2D(tDiffuse,vUv+dir*(-.166667)).rgb+texture2D(tDiffuse,vUv+dir*.166667).rgb);vec3 r2=r1*.5+.25*(texture2D(tDiffuse,vUv+dir*(-.5)).rgb+texture2D(tDiffuse,vUv+dir*.5).rgb);float lm=dot(r2,l);gl_FragColor=vec4(lm<mn||lm>mx?r1:r2,1.);}`});composer.addPass(fxaa);
  ready=true;window.__LUMEN__={ready:true,renderer,scene,camera,controls,world,setView,setHour,get state(){return{hour,paused,orbit,cycle,currentView,elapsed,frames:frameCount,controlsCollapsed,zoom:camera.zoom,framing,stats:world.stats};},render:()=>composer.render()};
  resize();bindUI();makeHotspots();world.setDay(hour);world.update(0,0);composer.render();$('#loader').classList.add('done');setTimeout(()=>$('#loader').style.display='none',900);requestAnimationFrame(animate);
}

const hotspotElements=[];
function makeHotspots(){world.hotspots.forEach((a,i)=>{const b=document.createElement('button');b.className='hotspot';b.innerHTML=`<i></i><span>${a.name}</span>`;b.setAttribute('aria-label',`探索${a.name}`);b.onclick=()=>{$('#detail-kicker').textContent=a.kicker;$('#detail-title').textContent=a.title;$('#detail-copy').textContent=a.copy;$('#detail').hidden=false;$('#detail-view').onclick=()=>setView(a.view);};$('#hotspots').appendChild(b);hotspotElements.push({b,a});});}
const projected=new T.Vector3();
function updateHotspots(){for(let i=0;i<hotspotElements.length;i++){const {b,a}=hotspotElements[i];projected.copy(a.pos);world.root.localToWorld(projected);projected.project(camera);const w=framing.width,h=framing.height,x=(projected.x*.5+.5)*w,y=(-projected.y*.5+.5)*h;const visible=currentView==='overview'&&camera.zoom<1.35&&projected.z<1&&x>w*.15&&x<w*.82&&y>(mobileLayout()?110:140)&&y<(mobileLayout()?$('.views').getBoundingClientRect().top-45:h-230)&&(!mobileLayout()||i===1);b.hidden=!visible;if(visible)b.style.transform=`translate(${x+7}px,${y-20}px)`;}}
function animate(now){requestAnimationFrame(animate);const dt=Math.min(.045,(now-last)/1000);last=now;if(document.hidden)return;frameCount++;
  if(!paused){elapsed+=dt;world.update(elapsed,dt);if(cycle)hour=(hour+dt*.035)%24;}
  if(transition){const t=Math.min(1,(now-transition.start)/transition.duration),k=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;camera.position.lerpVectors(transition.startPosition,transition.endPosition,k);controls.target.lerpVectors(transition.startTarget,transition.target,k);camera.zoom=T.MathUtils.lerp(transition.startZoom,transition.endZoom,k);camera.updateProjectionMatrix();if(t>=1)transition=null;}
  controls.autoRotate=orbit&&!paused;controls.update(dt);if(camera.zoom!==projectionZoom)applyCameraFrame();$('#zoom-in').disabled=camera.zoom>=controls.maxZoom-.001;$('#zoom-out').disabled=camera.zoom<=controls.minZoom+.001;const daylight=world.setDay(hour);renderer.toneMappingExposure=.86+.14*daylight;updateClock();updateHotspots();shiftPass.uniforms.uTime.value=elapsed;
  // Static terrain shadow maps are reused. The miniature's slow breathing does not need a full shadow pass each frame.
  if(frameCount%100===0&&!paused)renderer.shadowMap.needsUpdate=true;
  composer.render();
}
function togglePause(){paused=!paused;$('#pause').setAttribute('aria-pressed',String(paused));$('#pause').setAttribute('aria-label',paused?'继续世界':'暂停世界');$('#pause span').textContent=paused?'继续':'暂停';$('#pause-icon').innerHTML=paused?'<path d="m8 5 11 7-11 7Z"/>':'<path d="M9 5v14M15 5v14"/>';$('.live').innerHTML=paused?'<i></i>时光停驻此刻':'<i></i>世界正在呼吸';}
function toggleZen(){zen=!zen;document.body.classList.toggle('zen',zen);$('#detail').hidden=true;scheduleResize();}
let photoUrl,photoFile;
async function capture(){
  $('#capture').disabled=true;
  try{composer.render();const filename=`一方静谧-${new Date().toISOString().replace(/[:.]/g,'-')}.png`;let saved=false;
    if(!touchDevice()&&['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&location.protocol==='http:'){try{const r=await fetch('/api/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:renderer.domElement.toDataURL('image/png')})});if(r.ok){const j=await r.json();saved=true;toast('已保存至 exports / '+j.name);}}catch{}}
    if(!saved){const blob=await new Promise((resolve,reject)=>renderer.domElement.toBlob(b=>b?resolve(b):reject(new Error('PNG encoding failed')),'image/png'));if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=URL.createObjectURL(blob);photoFile=new File([blob],filename,{type:'image/png'});
      if(touchDevice()){$('#photo-image').src=photoUrl;$('#download-photo').href=photoUrl;$('#download-photo').download=filename;$('#share-photo').hidden=!(navigator.canShare&&navigator.canShare({files:[photoFile]}));$('#photo-dialog').showModal();}
      else{const a=document.createElement('a');a.href=photoUrl;a.download=filename;a.click();toast('画面已导出为 PNG');}
    }
  }catch(e){console.error(e);toast('画面保存失败，请重试。');}finally{$('#capture').disabled=false;}
}
let soundscape;
async function toggleSound(){
  if(!soundscape){const AC=window.AudioContext||window.webkitAudioContext;if(!AC){toast('当前浏览器不支持环境音');return;}const ctx=new AC(),master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
    const buffer=ctx.createBuffer(1,ctx.sampleRate*4,ctx.sampleRate),data=buffer.getChannelData(0);let previous=0;for(let i=0;i<data.length;i++){previous=(previous+Math.random()*.08-.04)/1.025;data[i]=previous*3.5;}
    const water=ctx.createBufferSource();water.buffer=buffer;water.loop=true;const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1600;water.connect(filter);filter.connect(master);water.start();
    const wind=ctx.createOscillator(),windGain=ctx.createGain();wind.type='sine';wind.frequency.value=97;windGain.gain.value=.014;wind.connect(windGain);windGain.connect(master);wind.start();
    soundscape={ctx,master,on:false,timer:setInterval(()=>{if(!soundscape?.on||paused)return;const now=ctx.currentTime;for(let i=0;i<2;i++){const bird=ctx.createOscillator(),g=ctx.createGain();bird.type='sine';bird.frequency.setValueAtTime(1800+Math.random()*700,now+i*.14);bird.frequency.exponentialRampToValueAtTime(2900+Math.random()*500,now+i*.14+.10);g.gain.setValueAtTime(0,now+i*.14);g.gain.linearRampToValueAtTime(.025,now+i*.14+.025);g.gain.exponentialRampToValueAtTime(.0001,now+i*.14+.19);bird.connect(g);g.connect(master);bird.start(now+i*.14);bird.stop(now+i*.14+.2);}},6700)};
  }
  await soundscape.ctx.resume();soundscape.on=!soundscape.on;soundscape.master.gain.setTargetAtTime(soundscape.on?.25:0,soundscape.ctx.currentTime,.8);$('#sound').setAttribute('aria-pressed',String(soundscape.on));toast(soundscape.on?'自然声已开启 · 水流、微风与鸟鸣':'自然声已关闭');
}
function bindUI(){
  window.addEventListener('resize',scheduleResize);window.visualViewport?.addEventListener('resize',scheduleResize);const layoutObserver=new ResizeObserver(scheduleResize);layoutObserver.observe($('#app'));layoutObserver.observe($('.control-dock'));updateControlPanel();$('#daytime').oninput=e=>setHour(e.target.value);$$('[data-time]').forEach(b=>b.onclick=()=>setHour(b.dataset.time));
  $('#cycle').onclick=()=>{cycle=!cycle;$('#cycle').setAttribute('aria-pressed',String(cycle));toast(cycle?'昼夜开始缓缓流转':'已停留在当前光照');};$('#cycle').setAttribute('aria-pressed',String(cycle));
  $('#pause').onclick=togglePause;if(paused){paused=false;togglePause();}$('#orbit').onclick=()=>{orbit=!orbit;transition=null;$('#orbit').setAttribute('aria-pressed',String(orbit));};$('#sound').onclick=toggleSound;$('#capture').onclick=capture;
  $$('.view-button').forEach(b=>b.onclick=()=>setView(b.dataset.view));$('#explore').onclick=()=>setView('river');$('.brand').onclick=e=>{e.preventDefault();setView('overview');};$('#zen').onclick=toggleZen;$('#exit-zen').onclick=toggleZen;
  $('#zoom-in').onclick=()=>zoomBy(1.2);$('#zoom-out').onclick=()=>zoomBy(1/1.2);$('#reset-view').onclick=()=>setView('overview');$('#settings-toggle').onclick=toggleControls;
  $('#close-photo').onclick=()=>$('#photo-dialog').close();$('#share-photo').onclick=async()=>{try{await navigator.share({files:[photoFile],title:'一方静谧'});}catch(e){if(e.name!=='AbortError')toast('可长按照片保存，或使用保存图片按钮。');}};
  $('#help').onclick=()=>$('#guide').showModal();$('#close-help').onclick=()=>$('#guide').close();$('#guide').onclick=e=>{if(e.target===$('#guide')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};$('#close-detail').onclick=()=>$('#detail').hidden=true;
  $('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.fullscreenEnabled&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else{toggleZen();toast(zen?'已进入沉浸观景，点“返回操作”恢复界面':'已返回操作界面');}}catch{if(!zen)toggleZen();toast('已进入沉浸观景，点“返回操作”恢复界面');}};document.addEventListener('fullscreenchange',()=>{$('#fullscreen').setAttribute('aria-label',document.fullscreenElement?'退出全屏':'全屏');scheduleResize();});
  document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea')||$('#guide').open||$('#photo-dialog').open)return;if(e.code==='Space'&&!e.target.matches('button')){e.preventDefault();togglePause();}if(e.key.toLowerCase()==='h')toggleZen();if(e.key.toLowerCase()==='r')setView('overview');if(e.key.toLowerCase()==='p')capture();if(e.key==='Escape'){$('#detail').hidden=true;if(zen)toggleZen();}});
  document.addEventListener('visibilitychange',()=>{last=performance.now();if(soundscape){soundscape.master.gain.setTargetAtTime(!document.hidden&&soundscape.on?.25:0,soundscape.ctx.currentTime,.3);}});
}
setTimeout(()=>init().catch(e=>{console.error(e);fail(e.message);}),60);
