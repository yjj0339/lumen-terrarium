import * as T from './vendor/three.module.js';
import { RoundedBoxGeometry } from './vendor/jsm/geometries/RoundedBoxGeometry.js';

const PI=Math.PI, clamp=T.MathUtils.clamp, lerp=T.MathUtils.lerp;
let seed=180926; function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;} const range=(a,b)=>a+(b-a)*rand();
const noise=(x,z)=>Math.sin(x*1.7+Math.cos(z*1.3))*Math.sin(z*1.9-x*.33)*.48+Math.sin(x*4.7+z*3.1)*.18+Math.sin(x*9.3-z*7.7)*.06;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const V=(x,y,z)=>new T.Vector3(x,y,z);
const sphere=new T.IcosahedronGeometry(1,2), pebble=new T.IcosahedronGeometry(1,1), cylinder=new T.CylinderGeometry(1,1,1,9), cone=new T.ConeGeometry(1,1,9);
function material(c,opts={}){return new T.MeshStandardMaterial({color:c,roughness:.82,metalness:0,...opts});}
function mesh(geo,mat,pos,scale,parent){const m=new T.Mesh(geo,mat);if(pos)m.position.set(...pos);if(scale)m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function link(a,b,r,mat,parent){const d=new T.Vector3().subVectors(b,a),m=mesh(cylinder,mat,a.clone().add(b).multiplyScalar(.5).toArray(),[r,d.length(),r],parent);m.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return m;}
function cloudTexture(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(235,250,255,.65)');g.addColorStop(.24,'rgba(226,244,250,.35)');g.addColorStop(.6,'rgba(211,236,248,.1)');g.addColorStop(1,'rgba(220,240,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new T.CanvasTexture(c);}

export function createWorld(scene){
  const root=new T.Group();scene.add(root);
  const land=new T.Group();root.add(land);
  const time={value:0};
  const lowerCurve=new T.CatmullRomCurve3([V(.2,-1.35,-1.04),V(-.13,-1.35,-.25),V(-.72,-1.35,.55),V(.18,-1.35,1.4),V(1.65,-1.35,2.0),V(1.95,-1.35,3.1),V(1.43,-1.35,4.3),V(.55,-1.35,5.58)]);
  const upperCurve=new T.CatmullRomCurve3([V(.65,.34,-5.56),V(.9,.34,-4.5),V(.4,.34,-3.45),V(-.3,.34,-2.5),V(.2,.34,-1.06)]);
  const lower=lowerCurve.getPoints(130),upper=upperCurve.getPoints(85);
  function nearest(x,z,pts){let min=100;for(const p of pts){const d=(p.x-x)**2+(p.z-z)**2;if(d<min)min=d;}return Math.sqrt(min);}
  function waterDistance(x,z){return Math.min(nearest(x,z,lower)-.46,Math.hypot((x-1.95)/1.65,(z-3.04)/1.28)-1);}
  function height(x,z){
    const n=noise(x,z);let h=-1.43+n*.15;
    const shelf=1-smooth(-1.42,-.92,z);h+=shelf*1.72;
    const peaks=[[-2.35,-3.55,4.9,1.85,1.8],[-4.05,-3.5,2.45,1.45,1.4],[3.15,-4.25,3.0,1.7,1.45],[-1.13,-4.7,2.0,1.1,1.1]];
    for(const [px,pz,ph,rx,rz] of peaks){let d=Math.sqrt(((x-px)/rx)**2+((z-pz)/rz)**2),a=Math.atan2(z-pz,x-px);h+=ph*Math.pow(Math.max(0,1-d*.62),2.0)*(1+n*.20+Math.sin(a*5+d*4)*.13);}
    h+=.55*Math.exp(-((x+4)**2/2+(z-1.0)**2/5))+.45*Math.exp(-((x-4.5)**2/2+(z-.5)**2/3));
    const dl=nearest(x,z,lower),du=nearest(x,z,upper),lake=Math.hypot((x-1.95)/1.65,(z-3.04)/1.28);
    if(z> -1.06)h=lerp(-1.80,h,smooth(.35,.76,dl));
    h=lerp(-1.85,h,smooth(.87,1.16,lake));
    if(z< -1.04)h=lerp(.08,h,smooth(.25,.57,du));
    return h;
  }
  const resolution=160, size=11.12, positions=[],colors=[],indices=[];
  const green=new T.Color('#4c7a46'),lime=new T.Color('#91a25e'),rock=new T.Color('#727e7d'),snow=new T.Color('#f3f5e9'),darkSnow=new T.Color('#abc6cd');
  for(let iz=0;iz<=resolution;iz++)for(let ix=0;ix<=resolution;ix++){
    const x=ix/resolution*size-size/2,z=iz/resolution*size-size/2,y=height(x,z);positions.push(x,y,z);
    const slope=Math.hypot(height(x+.055,z)-height(x-.055,z),height(x,z+.055)-height(x,z-.055))/.11;
    const n=noise(x*1.4,z*1.4);let c=green.clone().lerp(lime,clamp(.44+n*.4,0,1));
    c.lerp(rock,smooth(.9,2.6,slope)*smooth(.4,1.4,y)*.95);
    if(y>1.1)c.lerp(rock,smooth(1.1,2.8,y)*.75);
    let snowline=2.45+noise(x*2,z*2)*.30+Math.sin(z*6+x*2)*.1;
    c.lerp(darkSnow.clone().lerp(snow,.76+n*.15),smooth(snowline,snowline+.24,y)*(1-smooth(2.4,4.2,slope)*.65*(.7+n*.3)));
    if(y< -1.5)c.lerp(new T.Color('#afbc8b'),.5);
    c.multiplyScalar(1+noise(x*9,z*9)*.045);colors.push(c.r,c.g,c.b);
    if(ix<resolution&&iz<resolution){const a=iz*(resolution+1)+ix,b=a+resolution+1;indices.push(a,b,a+1,b,b+1,a+1);}
  }
  const tg=new T.BufferGeometry();tg.setAttribute('position',new T.Float32BufferAttribute(positions,3));tg.setAttribute('color',new T.Float32BufferAttribute(colors,3));tg.setIndex(indices);tg.computeVertexNormals();
  mesh(tg,new T.MeshStandardMaterial({vertexColors:true,roughness:.91,flatShading:true}),null,null,land);
  // The cut earth has individually coloured strata, continuing up to the living surface.
  const wallPos=[],wallCols=[],wallIdx=[],strata=[new T.Color('#293c3c'),new T.Color('#46534b'),new T.Color('#766e59'),new T.Color('#6b7557')];
  for(let side=0;side<4;side++)for(let j=0;j<100;j++){
    let t=j/100*size-size/2,t2=(j+1)/100*size-size/2;
    const p=side===0?[t,-size/2]:side===1?[size/2,t]:side===2?[-t,size/2]:[-size/2,-t];
    const q=side===0?[t2,-size/2]:side===1?[size/2,t2]:side===2?[-t2,size/2]:[-size/2,-t2];
    for(let k=0;k<5;k++){
      const low=-3.35, hp=height(...p),hq=height(...q),ya=lerp(low,hp,k/5),yb=lerp(low,hq,k/5),yc=lerp(low,hp,(k+1)/5),yd=lerp(low,hq,(k+1)/5),a=wallPos.length/3;
      wallPos.push(p[0],ya,p[1],q[0],yb,q[1],p[0],yc,p[1],q[0],yd,q[1]);wallIdx.push(a,a+1,a+2,a+1,a+3,a+2);
      const c=strata[Math.min(3,k)].clone().multiplyScalar(.96+noise(p[0]*.5+k,p[1]*.5)*.08);for(let m=0;m<4;m++)wallCols.push(c.r,c.g,c.b);
    }
  }
  const wg=new T.BufferGeometry();wg.setAttribute('position',new T.Float32BufferAttribute(wallPos,3));wg.setAttribute('color',new T.Float32BufferAttribute(wallCols,3));wg.setIndex(wallIdx);wg.computeVertexNormals();mesh(wg,new T.MeshStandardMaterial({vertexColors:true,roughness:.94,side:T.DoubleSide}),null,null,root);
  mesh(new RoundedBoxGeometry(11.17,.26,11.17,3,.12),material('#263a3d',{roughness:.5}),[0,-3.42,0],null,root);
  const batchMap=new Map(),dummy=new T.Object3D();
  function addBatch(key,geo,mat,pos,scale,rot=[0,0,0],color=null){if(!batchMap.has(key))batchMap.set(key,{geo,mat,items:[]});batchMap.get(key).items.push({pos,scale,rot,color});}
  const trunkMat=material('#75654c'),pineMat=material('#496c54',{roughness:.95}),leafMat=material('#89a76b'),stoneMat=material('#9a9d87');
  const pineGeo=new T.LatheGeometry([new T.Vector2(.05,0),new T.Vector2(.78,.09),new T.Vector2(.73,.22),new T.Vector2(.51,.51),new T.Vector2(.39,.77),new T.Vector2(.23,1.06),new T.Vector2(.015,1.50)],12);
  const pinePos=pineGeo.attributes.position;for(let i=0;i<pinePos.count;i++){let x=pinePos.getX(i),y=pinePos.getY(i),z=pinePos.getZ(i),a=Math.atan2(z,x),f=1+.055*Math.sin(a*5+y*7);pinePos.setXYZ(i,x*f,y,z*f);}pineGeo.computeVertexNormals();
  let treeCount=0;
  for(let i=0;i<270;i++){
    const x=range(-5.22,5.22),z=range(-4.8,5.1),y=height(x,z),d=waterDistance(x,z),du=nearest(x,z,upper);
    if(y>2.0||d<.27||du<.72||Math.abs(z+1.1)<.31||((x+2.4)**2+(z-3.6)**2<1.8)||(z>2.2&&Math.hypot((x-1.95)/1.65,(z-3.04)/1.28)<1.48)||rand()<.10)continue;
    const h=range(.65,1.5)*(z<0?1:.9),w=range(.68,1.0),yaw=rand()*PI*2;
    addBatch('trunks',cylinder,trunkMat,[x,y+h*.30,z],[.045*h,h*.65,.045*h]);
    if(rand()<.7){
      const c=new T.Color().setHSL(range(.36,.43),range(.23,.36),range(.21,.36));
      for(let k=0;k<3;k++){const s=1-k*.22;addBatch('pines',pineGeo,pineMat,[x,y+h*(.16+k*.23),z],[h*w*.55*s,h*.57*s,h*w*.55*s],[0,yaw+k,0],c);}
    }else{
      const c=new T.Color().setHSL(range(.19,.30),range(.32,.48),range(.36,.51));
      for(let k=0;k<4;k++){const a=k*2.399;addBatch('leaves',sphere,leafMat,[x+Math.cos(a)*h*.19,y+h*(k===0?.9:.7),z+Math.sin(a)*h*.19],[h*w*.35,h*.41,h*w*.34],[.1,yaw,.1],c);}
    }treeCount++;
  }
  // River boulders, scree on the snowline, and pebble beaches.
  for(let i=0;i<470;i++){
    let x,z,s;if(i<210){const p=lower[Math.floor(rand()*lower.length)],sg=rand()<.5?-1:1;x=p.x+sg*range(.47,.69);z=p.z+range(-.16,.16);s=range(.045,.18);}else{x=range(-5.4,5.4);z=range(-5.2,5.2);s=range(.055,.23);}
    const y=height(x,z);if(y< -1.5)continue;
    addBatch('rocks',pebble,stoneMat,[x,y+s*.22,z],[s*range(1,1.5),s*range(.5,1),s],[rand(),rand()*PI,rand()],new T.Color().setHSL(.13+rand()*.04,.08+rand()*.09,.46+rand()*.20));
  }
  // Gently layered, rounded rock faces along the waterfall shelf.
  for(let i=0;i<35;i++){const x=-5.1+i*.30;if(Math.abs(x-.2)<.43)continue;const z=-1.12+range(-.14,.10),y=height(x,z);addBatch('cliff',pebble,material('#7e8c7a'),[x,-.71,z],[range(.22,.39),Math.max(.3,(y+1.6)*.48),range(.24,.37)],[0,rand(),.08],new T.Color('#849281').multiplyScalar(range(.75,1.15)));}
  const grassGeo=new T.BufferGeometry();grassGeo.setAttribute('position',new T.Float32BufferAttribute([-.035,0,0,.035,0,0,.02,.25,0,0,0,-.035,0,0,.035,-.03,.20,.01],3));grassGeo.computeVertexNormals();
  const grassMat=material('#b3c17a',{side:T.DoubleSide});grassMat.onBeforeCompile=s=>{s.uniforms.uTime=time;s.vertexShader='uniform float uTime;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.x += sin(uTime*1.2 + instanceMatrix[3].x*3.0 + instanceMatrix[3].z)*position.y*0.12;');};
  for(let i=0;i<2400;i++){const x=range(-5.42,5.42),z=range(-.65,5.42),y=height(x,z);if(y< -1.43||waterDistance(x,z)<.18)continue;const s=range(.45,1.1);addBatch('grass',grassGeo,grassMat,[x,y+.015,z],[s,s,s],[0,rand()*6.28,0],new T.Color().setHSL(range(.20,.28),.3,range(.39,.65)));}
  const flowerMat=material('#eee1b8'),stemMat=material('#708957');
  for(let i=0;i<280;i++){const x=range(-5.15,5.1),z=range(-.1,5.2),y=height(x,z);if(y< -1.40||waterDistance(x,z)<.25)continue;const h=range(.08,.19),c=new T.Color(['#dcc6e8','#e3c68d','#f2e7d1','#b6c7ef'][Math.floor(rand()*4)]);addBatch('flowerstem',cylinder,stemMat,[x,y+h*.5,z],[.009,h,.009]);addBatch('flowers',sphere,flowerMat,[x,y+h,z],[.037,.022,.037],[0,0,0],c);}
  for(const {geo,mat,items} of batchMap.values()){
    const batch=new T.InstancedMesh(geo,mat,items.length);items.forEach((a,i)=>{dummy.position.set(...a.pos);dummy.scale.set(...a.scale);dummy.rotation.set(...a.rot);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);if(a.color)batch.setColorAt(i,a.color);});batch.castShadow=geo!==grassGeo;batch.receiveShadow=true;land.add(batch);
  }

  // All surface water shares a moving, refractive-looking procedural normal field.
  const waterMat=new T.MeshPhysicalMaterial({color:'#36aaa0',metalness:.22,roughness:.16,transparent:true,opacity:.91,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:1.15,side:T.DoubleSide});
  waterMat.onBeforeCompile=s=>{s.uniforms.uTime=time;s.vertexShader='varying vec3 vWater;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vWater = position;');s.fragmentShader='uniform float uTime;varying vec3 vWater;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n normal = normalize(normal + vec3(sin(vWater.x*16.0+vWater.z*9.0-uTime*2.8)*0.055,cos(vWater.z*18.0-uTime*2.0)*0.05,0.0));');s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n float c = sin(vWater.x*10.0+sin(vWater.z*9.0-uTime)*1.5+uTime)*sin(vWater.z*13.0-uTime*1.8); diffuseColor.rgb += smoothstep(0.68,1.0,c)*vec3(0.15,0.22,0.18);');};
  function ribbon(curve,width,mat){const ps=[],uv=[],ids=[],count=160;for(let i=0;i<=count;i++){const t=i/count,p=curve.getPoint(t),d=curve.getTangent(t),n=V(-d.z,0,d.x).normalize(),w=width*(.92+.08*Math.sin(t*18));for(const side of [-1,1]){ps.push(p.x+n.x*w*side,p.y,p.z+n.z*w*side);uv.push((side+1)/2,t);}if(i<count){const a=i*2;ids.push(a,a+1,a+2,a+1,a+3,a+2);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(ps,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ids);g.computeVertexNormals();return mesh(g,mat,null,null,root);}
  ribbon(lowerCurve,.46,waterMat);ribbon(upperCurve,.29,waterMat);
  const lakeShape=new T.Shape();for(let i=0;i<=80;i++){const a=i/80*PI*2,r=1+Math.sin(a*3)*.055+Math.cos(a*7)*.022,x=1.95+Math.cos(a)*1.65*r,z=3.04+Math.sin(a)*1.28*r;if(i===0)lakeShape.moveTo(x,-z);else lakeShape.lineTo(x,-z);}const lg=new T.ShapeGeometry(lakeShape,80);lg.rotateX(-PI/2);mesh(lg,waterMat,[0,-1.345,0],null,root);
  const foamMat=new T.MeshBasicMaterial({color:'#e3fff0',transparent:true,opacity:.36,depthWrite:false});
  const flows=[];for(let i=0;i<34;i++){const m=mesh(new T.PlaneGeometry(range(.02,.04),range(.12,.32)),foamMat,[0,0,0],null,root);m.rotation.x=-PI/2;m.castShadow=false;flows.push({m,t:rand(),upper:i<9});}
  const fallMat=new T.ShaderMaterial({uniforms:{uTime:time},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`uniform float uTime;varying vec2 vUv;void main(){float a=sin(vUv.x*92.0+sin(vUv.y*19.0-uTime*6.0)*.8)*.5+.5;float b=sin(vUv.y*65.0-uTime*15.0+vUv.x*9.0)*.5+.5;float edge=smoothstep(0.0,.1,vUv.x)*smoothstep(1.0,.9,vUv.x);vec3 c=mix(vec3(.24,.64,.63),vec3(.82,.97,.91),a*.7+b*.15);gl_FragColor=vec4(c,edge*(.63+a*.3));}`,transparent:true,side:T.DoubleSide,depthWrite:false});
  const fallGeo=new T.PlaneGeometry(.62,1.82,20,30),fp=fallGeo.attributes.position;for(let i=0;i<fp.count;i++){const y=fp.getY(i),t=(.91-y)/1.82;fp.setZ(i,Math.sin(t*PI*.7)*.20);fp.setX(i,fp.getX(i)*(1+t*.20));}fallGeo.computeVertexNormals();const waterfall=mesh(fallGeo,fallMat,[.2,-.51,-1.03],null,root);waterfall.castShadow=false;
  const splashMat=material('#dcf7eb',{transparent:true,opacity:.7}),splashes=[];for(let i=0;i<32;i++){const m=mesh(pebble,splashMat,[.2,-1.3,-.8],[.018,.035,.018],root);m.castShadow=false;splashes.push({m,phase:rand(),angle:rand()*PI*2,speed:range(.15,.4)});}
  const rings=[];for(let i=0;i<4;i++){const m=mesh(new T.RingGeometry(.16,.177,48),foamMat,[.2,-1.324,-.73],null,root);m.rotation.x=-PI/2;m.castShadow=false;rings.push(m);}
  // A tiny arched footbridge and its weathered wooden rails.
  const bridge=new T.Group();bridge.position.set(-.50,-1.08,.59);bridge.rotation.y=-.44;root.add(bridge);const wood=material('#c0a079'),rail=material('#ad916e');
  for(let i=0;i<15;i++){const x=(i/14-.5)*1.65,y=Math.sin(i/14*PI)*.20;const m=mesh(new T.BoxGeometry(.116,.06,.43),wood,[x,y,0],null,bridge);m.rotation.z=Math.cos(i/14*PI)*.2;}
  for(const z of [-.25,.25]){for(const x of [-.78,-.39,0,.39,.78]){const y=Math.cos(x/1.65*PI)*.2;mesh(cylinder,rail,[x,y+.20,z],[.025,.40,.025],bridge);}const c=new T.CatmullRomCurve3([V(-.82,.34,z),V(0,.57,z),V(.82,.34,z)]);mesh(new T.TubeGeometry(c,16,.019,5,false),rail,null,null,bridge);}
  // Lily pads and tiny flowers are suspended just above the lake surface.
  const lily=material('#739e6a',{side:T.DoubleSide});for(let i=0;i<15;i++){const a=rand()*PI*2,r=range(.5,.93),x=1.95+Math.cos(a)*1.28*r,z=3.04+Math.sin(a)*.97*r,m=mesh(new T.CircleGeometry(range(.045,.10),16,0,PI*1.85),lily,[x,-1.329,z],null,root);m.rotation.x=-PI/2;m.rotation.z=a;m.castShadow=false;if(i%3===0)mesh(sphere,material('#e0c0c8'),[x,-1.30,z],[.025,.025,.025],root);}

  const animals=[];const deerMat=material('#bf9670'),ivory=material('#eee1c7'),dark=material('#303b38'),antlerMat=material('#89775a');
  function deer(x,z,s,angle,child=false){
    const g=new T.Group();g.position.set(x,height(x,z)+.015,z);g.scale.setScalar(s);g.rotation.y=angle;root.add(g);
    mesh(sphere,deerMat,[0,.43,0],[.31,.16,.13],g);mesh(sphere,ivory,[-.24,.45,0],[.085,.095,.12],g);mesh(sphere,deerMat,[-.32,.51,0],[.075,.035,.05],g);
    const legs=[];for(const x of [-.20,.2])for(const z of [-.085,.085]){const l=new T.Group();l.position.set(x,.39,z);g.add(l);mesh(cylinder,deerMat,[0,-.16,0],[.025,.32,.024],l);mesh(sphere,dark,[.01,-.32,0],[.034,.026,.03],l);legs.push(l);}
    const head=new T.Group();head.position.set(.22,.47,0);g.add(head);const neck=mesh(sphere,deerMat,[.035,.13,0],[.08,.19,.086],head);neck.rotation.z=-.3;
    mesh(sphere,deerMat,[.105,.29,0],[.13,.08,.075],head);mesh(sphere,dark,[.22,.27,0],[.025,.025,.045],head);for(const z of [-.057,.057]){mesh(sphere,dark,[.125,.32,z],[.012,.014,.01],head);const ear=mesh(sphere,deerMat,[.03,.39,z*1.55],[.035,.09,.025],head);ear.rotation.z=.38;ear.rotation.x=z*5;}
    if(!child)for(const sg of [-1,1]){link(V(.03,.35,sg*.04),V(-.04,.63,sg*.12),.013,antlerMat,head);link(V(-.01,.46,sg*.075),V(.08,.57,sg*.11),.009,antlerMat,head);link(V(-.025,.53,sg*.10),V(-.12,.64,sg*.14),.008,antlerMat,head);}
    animals.push({g,head,legs,kind:'deer',phase:rand()*6.28});return g;
  }
  deer(-2.25,3.65,1.15,.5);deer(-3.0,3.35,.85,-.7);deer(-2.8,4.15,.57,.3,true);
  function rabbit(x,z){const g=new T.Group();g.position.set(x,height(x,z),z);g.rotation.y=rand()*6;root.add(g);mesh(sphere,ivory,[0,.11,0],[.12,.11,.085],g);mesh(sphere,ivory,[.09,.19,0],[.075,.07,.065],g);for(const a of [-1,1]){const e=mesh(sphere,ivory,[.07,.29,a*.03],[.022,.095,.018],g);e.rotation.z=-.22;mesh(sphere,dark,[.135,.21,a*.045],[.009,.01,.008],g);mesh(sphere,ivory,[.03,.025,a*.07],[.08,.03,.04],g);}mesh(sphere,ivory,[-.13,.14,0],[.045,.045,.045],g);animals.push({g,kind:'rabbit',phase:rand()*6.28,base:g.position.clone()});}
  rabbit(-3.9,2.45);rabbit(-3.62,2.65);
  const fox=new T.Group();fox.position.set(3.95,height(3.95,1.5),1.5);fox.rotation.y=-.5;root.add(fox);const orange=material('#c98048');mesh(sphere,orange,[0,.20,0],[.23,.11,.1],fox);mesh(sphere,orange,[.22,.28,0],[.11,.095,.085],fox);const snout=mesh(cone,ivory,[.33,.25,0],[.06,.15,.06],fox);snout.rotation.z=-PI/2;mesh(sphere,dark,[.40,.25,0],[.02,.02,.022],fox);for(const z of [-.06,.06]){mesh(cone,orange,[.20,.40,z],[.043,.13,.03],fox);mesh(sphere,dark,[.26,.30,z],[.012,.012,.012],fox);for(const x of [-.15,.16])mesh(cylinder,dark,[x,.10,z],[.022,.19,.022],fox);}const tail=mesh(sphere,orange,[-.31,.22,.04],[.22,.09,.095],fox);tail.rotation.z=-.28;mesh(sphere,ivory,[-.48,.28,.04],[.08,.065,.07],fox);
  const ducks=[];for(let i=0;i<3;i++){const g=new T.Group();root.add(g);const dm=i===0?ivory:material('#cab897');mesh(sphere,dm,[0,.045,0],[.12,.065,.075],g);mesh(sphere,i===0?material('#527e68'):dm,[.095,.12,0],[.053,.057,.05],g);mesh(sphere,material('#d5a255'),[.15,.11,0],[.04,.016,.023],g);for(const z of [-.04,.04])mesh(sphere,dark,[.12,.13,z],[.006,.007,.006],g);g.scale.setScalar(i===0?1:.7);ducks.push({g,offset:i*.45});}
  const birds=[];const birdMat=material('#e7e9d8');for(let i=0;i<6;i++){const g=new T.Group();root.add(g);mesh(sphere,birdMat,[0,0,0],[.075,.033,.035],g);const wings=[];for(const s of [-1,1]){const wing=mesh(new T.SphereGeometry(1,8,5),birdMat,[0,.01,s*.10],[.065,.014,.16],g);wings.push(wing);}birds.push({g,wings,offset:i*1.05});}

  // Soft clay clouds, with transparent mist drifting between the trees.
  const cloudMat=new T.MeshPhysicalMaterial({color:'#edf3e9',roughness:1,metalness:0,transparent:true,opacity:.88,depthWrite:false});
  const clouds=[];for(const [x,y,z,s] of [[-3.8,5.4,-.4,.75],[2.9,5.95,-2.4,.86],[3.7,3.6,1.0,.53],[-.1,6.5,-4.5,.48]]){const g=new T.Group();g.position.set(x,y,z);g.scale.setScalar(s);root.add(g);for(let i=0;i<7;i++){const c=mesh(sphere,cloudMat,[(i-3)*.31,Math.sin(i*1.7)*.12,Math.cos(i*2)*.20],[range(.38,.63),range(.20,.38),range(.29,.42)],g);c.castShadow=false;c.renderOrder=4;}clouds.push({g,x,z,phase:rand()*PI*2});}
  const soft=cloudTexture(),mist=[];
  for(let i=0;i<17;i++){const sm=new T.SpriteMaterial({map:soft,color:'#bedce1',transparent:true,opacity:i<5?.30:.13,depthWrite:false});const m=new T.Sprite(sm);const x=i<5?.2+range(-.35,.35):range(-4.8,4.8),y=i<5?range(-1.3,-.8):range(-.7,1.0),z=i<5?-.65:range(-.3,4.2);m.position.set(x,y,z);m.scale.set(i<5?1.1:range(2,3.5),i<5?.7:range(.55,.95),1);root.add(m);mist.push({m,x,y,z,phase:rand()*PI*2});}
  const firePos=[],fireSeed=[];for(let i=0;i<95;i++){firePos.push(range(-5,5),range(-1.2,1.8),range(-.5,5.1));fireSeed.push(rand()*10);}const fg=new T.BufferGeometry();fg.setAttribute('position',new T.Float32BufferAttribute(firePos,3));const fireMat=new T.PointsMaterial({color:'#d7f4ac',map:soft,size:.19,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});const fireflies=new T.Points(fg,fireMat);root.add(fireflies);
  const beams=new T.Group();root.add(beams);const beamMat=new T.ShaderMaterial({uniforms:{uOpacity:{value:.11}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 vUv;uniform float uOpacity;void main(){float a=pow(sin(vUv.x*3.14159),2.0)*sin(vUv.y*3.14159);gl_FragColor=vec4(.83,.91,.72,a*uOpacity);}',side:T.DoubleSide,transparent:true,depthWrite:false,blending:T.AdditiveBlending});
  for(let i=0;i<4;i++){const geo=new T.PlaneGeometry(.25+i*.15,8.3);const b=new T.Mesh(geo,beamMat);b.position.set(-1.6+i*1.18,2.6,-1.6+i*.55);b.rotation.z=-.36;b.rotation.y=-.4;beams.add(b);}

  // A real transmissive shell plus finely rounded spectral edges.
  const glass=new T.Group();root.add(glass);const glassMat=new T.MeshPhysicalMaterial({color:'#d5efeb',metalness:0,roughness:.055,transmission:1,thickness:.12,ior:1.46,transparent:true,opacity:.20,clearcoat:1,clearcoatRoughness:.06,envMapIntensity:.55,depthWrite:false,side:T.FrontSide});
  const shell=mesh(new RoundedBoxGeometry(11.7,11.7,11.7,3,.095),glassMat,[0,2.17,0],null,glass);shell.castShadow=false;shell.receiveShadow=false;shell.renderOrder=10;
  const edgeMat=new T.MeshPhysicalMaterial({color:'#b5d2d0',metalness:.35,roughness:.15,transparent:true,opacity:.55,emissive:'#507e86',emissiveIntensity:.12,clearcoat:1});
  const edgeBright=new T.MeshBasicMaterial({color:'#cde9d6',transparent:true,opacity:.55});const l=5.85,bottom=-3.68,top=8.02;
  for(const x of [-l,l])for(const z of [-l,l]){const m=link(V(x,bottom,z),V(x,top,z),.021,edgeMat,glass);m.castShadow=false;}
  for(const y of [bottom,top])for(const sg of [-1,1]){link(V(-l,y,sg*l),V(l,y,sg*l),.022,edgeMat,glass).castShadow=false;link(V(sg*l,y,-l),V(sg*l,y,l),.022,edgeMat,glass).castShadow=false;}
  for(const [a,b] of [[V(-l,top,-l),V(-l,top,1.8)],[V(-l,top,-l),V(1.7,top,-l)],[V(l,-2,l),V(l,3.1,l)],[V(-l,bottom,l),V(1,bottom,l)]])link(a,b,.009,edgeBright,glass).castShadow=false;
  // Narrow highlights suggest studio reflections without hiding the ecosystem.
  const reflectionMat=new T.MeshBasicMaterial({color:'#c9e3e5',transparent:true,opacity:.035,side:T.DoubleSide,depthWrite:false});for(const [x,z,rot] of [[-5.845,1.3,PI/2],[2.1,5.845,0]]){const r=mesh(new T.PlaneGeometry(.25,8.5),reflectionMat,[x,2.5,z],null,glass);r.rotation.y=rot;r.rotation.z=-.12;r.castShadow=false;r.renderOrder=11;}
  const underglow=new T.Sprite(new T.SpriteMaterial({map:soft,color:'#69aebe',transparent:true,opacity:.14,blending:T.AdditiveBlending,depthWrite:false}));underglow.position.set(0,-3.6,0);underglow.scale.set(13,2,1);root.add(underglow);

  const sun=new T.DirectionalLight('#ffe6b4',3.8);sun.position.set(-8,13,7);sun.castShadow=true;const shadowSize=matchMedia('(pointer:coarse)').matches?1024:2048;sun.shadow.mapSize.set(shadowSize,shadowSize);Object.assign(sun.shadow.camera,{left:-10,right:10,top:12,bottom:-10,near:.5,far:40});sun.shadow.bias=-.0002;sun.shadow.normalBias=.035;sun.shadow.radius=3;sun.target.position.set(0,0,0);scene.add(sun,sun.target);
  const hemi=new T.HemisphereLight('#d4e8ef','#596e58',2.0);scene.add(hemi);
  const rim=new T.DirectionalLight('#b4e1f2',2.5);rim.position.set(5,7,-8);scene.add(rim);
  const fill=new T.DirectionalLight('#d5ebdd',.65);fill.position.set(3,1,9);scene.add(fill);
  const moon=new T.PointLight('#9cbfdc',0,20,1.2);moon.position.set(-2,6,1);root.add(moon);
  const colorDay=new T.Color('#ffe7c3'),colorDusk=new T.Color('#ffc087'),colorNight=new T.Color('#94b9e3'),hemiDay=new T.Color('#c5e1e4'),hemiNight=new T.Color('#708ab7'),rimDay=new T.Color('#b2d5dd'),rimNight=new T.Color('#90b9e7'),cloudDay=new T.Color('#edf3e9'),cloudNight=new T.Color('#8fabc8');
  function setDay(hour){const altitude=Math.sin((hour-6)/24*PI*2),day=smooth(-.23,.35,altitude),gold=1-smooth(.08,.52,Math.abs(altitude));sun.intensity=lerp(.16,2.8,day);sun.color.copy(colorNight).lerp(colorDay,day).lerp(colorDusk,gold*day*.7);hemi.intensity=lerp(.23,.85,day);hemi.color.copy(hemiNight).lerp(hemiDay,day);rim.intensity=lerp(.75,1.6,day);rim.color.copy(rimNight).lerp(rimDay,day);fill.intensity=lerp(.06,.38,day);moon.intensity=(1-day)*1.5;scene.environmentIntensity=lerp(.10,.45,day);fireMat.opacity=(1-day);beamMat.uniforms.uOpacity.value=lerp(.018,.065,day)*(1+gold*.6);edgeMat.emissiveIntensity=lerp(.42,.11,day);cloudMat.color.copy(cloudNight).lerp(cloudDay,day);waterMat.emissive.set('#286c73');waterMat.emissiveIntensity=lerp(.24,.035,day);return day;}
  function update(t,dt){
    time.value=t;root.position.y=Math.sin(t*.35)*.045;
    for(const f of flows){const p=(f.t+t*(f.upper?.025:.019))%1,c=f.upper?upperCurve:lowerCurve,v=c.getPoint(p),d=c.getTangent(p);f.m.position.copy(v);f.m.position.y+=.016;f.m.rotation.z=-Math.atan2(d.x,d.z);}
    for(const s of splashes){const f=(s.phase+t*.55)%1,r=s.speed*f,sz=1-f*.8;s.m.position.set(.2+Math.cos(s.angle)*r,-1.29+Math.sin(f*PI)*.23,-.72+Math.sin(s.angle)*r);s.m.scale.set(.018*sz,.035*sz,.018*sz);}
    for(let i=0;i<rings.length;i++){const s=(t*.3+i*.25)%1;rings[i].scale.setScalar(.35+s*2.6);}
    for(const a of animals){if(a.kind==='deer'){a.head.rotation.z=-.12+Math.sin(t*.65+a.phase)*.18;for(let i=0;i<a.legs.length;i++)a.legs[i].rotation.z=Math.sin(t*.7+a.phase+i)*.025;}else{a.g.position.y=a.base.y+Math.max(0,Math.sin(t*.7+a.phase)-.92)*.8;}}
    tail.rotation.z=-.28+Math.sin(t*1.8)*.09;
    for(const d of ducks){const a=t*.11+d.offset;d.g.position.set(1.95+Math.sin(a)*.65,-1.335+Math.sin(t*2+a)*.006,3.05+Math.cos(a)*.48);d.g.rotation.y=Math.atan2(Math.sin(a)*.48,Math.cos(a)*.65);}
    for(const b of birds){const a=t*.14+b.offset;b.g.position.set(Math.sin(a)*3.4,4.45+Math.sin(a*1.7+b.offset)*.45,Math.cos(a)*2.0);b.g.rotation.y=-a;for(let i=0;i<2;i++)b.wings[i].rotation.x=Math.sin(t*5+b.offset)*(i===0?1:-1)*.45;}
    for(const c of clouds){c.g.position.x=c.x+Math.sin(t*.055+c.phase)*.18;c.g.position.z=c.z+Math.cos(t*.06+c.phase)*.13;}
    for(const f of mist){f.m.position.x=f.x+Math.sin(t*.13+f.phase)*.22;f.m.position.y=f.y+Math.sin(t*.20+f.phase)*.035;}
    const fp=fg.attributes.position;for(let i=0;i<fireSeed.length;i++){fp.setXYZ(i,firePos[i*3]+Math.sin(t*.31+fireSeed[i])*.16,firePos[i*3+1]+Math.sin(t*.5+fireSeed[i]*2)*.18,firePos[i*3+2]+Math.cos(t*.38+fireSeed[i])*.16);}fp.needsUpdate=true;
  }
  return {root,glass,shell,update,setDay,height,stats:{trees:treeCount,animals:15,terrainTriangles:resolution*resolution*2},hotspots:[{pos:V(-2.15,3.9,-3.1),name:'雪线之上',view:'peaks',kicker:'高山 · 水的起点',title:'把一座雪山，藏进云里',copy:'积雪覆盖层叠山脊，融水穿过高山峡谷。绕到山的另一面，能看见雪线与岩层交织的纹理。'},{pos:V(.45,-.20,-.6),name:'溪谷回响',view:'river',kicker:'溪流 · 生生不息',title:'一条河流的慢旅行',copy:'山涧越过石壁，散成细小水雾，再汇入森林与湖泊。木桥横跨溪水，水鸟在睡莲旁缓缓游过。'},{pos:V(-2.5,-.65,3.65),name:'林间来客',view:'forest',kicker:'森林 · 安静的邻居',title:'每一片林荫，都有居民',copy:'鹿群在草地上低头，兔子躲在野花之间，狐狸停在林缘。将时间拨到夜晚，萤火会照亮它们的家。'}]};
}

export function createSpace(scene){
  const g=new T.SphereGeometry(90,32,24),m=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{},vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`varying vec3 vP;void main(){vec3 p=normalize(vP);float a=exp(-pow((p.x+.22)*1.7,2.0)-pow((p.y-.16)*3.0,2.0));float b=exp(-pow((p.x-.6)*2.0,2.0)-pow((p.y+.1)*4.0,2.0));vec3 c=vec3(.016,.029,.055)+a*vec3(.016,.036,.043)+b*vec3(.022,.015,.034);gl_FragColor=vec4(c,1.0);}`});scene.add(new T.Mesh(g,m));
  const p=[],col=[];for(let i=0;i<430;i++){const v=V(range(-1,1),range(-.5,1),range(-1,1)).normalize().multiplyScalar(range(42,70));p.push(...v.toArray());const c=new T.Color(rand()>.3?'#b2ced7':'#d9c9b3').multiplyScalar(range(.3,.85));col.push(c.r,c.g,c.b);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('color',new T.Float32BufferAttribute(col,3));const stars=new T.Points(geo,new T.PointsMaterial({size:.055,vertexColors:true,transparent:true,opacity:.6,depthWrite:false}));scene.add(stars);
  const soft=cloudTexture();for(let i=0;i<23;i++){const s=new T.Sprite(new T.SpriteMaterial({map:soft,color:i%2?'#a9c8d3':'#bcb09e',transparent:true,opacity:range(.04,.16),depthWrite:false}));s.position.set(range(-35,35),range(-15,22),range(-28,-13));s.scale.setScalar(range(.12,.40));scene.add(s);}return stars;
}
