import './style.css';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Color4, Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { Ray } from '@babylonjs/core/Culling/ray';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/core/Shaders/shadowMap.vertex';
import '@babylonjs/core/Shaders/shadowMap.fragment';
import '@babylonjs/core/Shaders/kernelBlur.vertex';
import '@babylonjs/core/Shaders/kernelBlur.fragment';
import { buildWorld, type Interaction } from './game/world';
import { createPlayer } from './game/player';
import { SPAWN, movePlayer, getPlace, parseSave } from './game/state';
import { createUI, type Settings } from './ui';
import { Ambience } from './game/audio';
import { CampusConnection } from './game/network';
import { RemotePlayers } from './game/remotes';
import { predict } from '../shared/simulation';
import { STEP_MS } from '../shared/protocol';

const ui = createUI();
async function boot() {
  if (!Engine.isSupported()) { ui.fail('This browser needs WebGL graphics support. Try an up-to-date browser with hardware acceleration enabled.'); return; }
  const engine = new Engine(ui.canvas, true, { stencil: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }, false);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(.73,.82,.82,1);
  scene.fogMode=Scene.FOGMODE_EXP2;scene.fogDensity=.0053;scene.fogColor=new Color3(.73,.81,.78);
  scene.ambientColor=new Color3(.22,.24,.19);
  scene.imageProcessingConfiguration.contrast=1.06;scene.imageProcessingConfiguration.exposure=1.0;
  const hemi=new HemisphericLight('Soft sky',new Vector3(0,1,0),scene);hemi.intensity=.85;hemi.diffuse=new Color3(.87,.93,1);hemi.groundColor=new Color3(.38,.4,.26);
  const sun=new DirectionalLight('Afternoon sun',new Vector3(-.55,-1,-.4),scene);sun.position.set(50,85,40);sun.intensity=1.25;sun.diffuse=new Color3(1,.88,.7);sun.shadowMinZ=1;sun.shadowMaxZ=220;
  sun.autoCalcShadowZBounds=true;sun.shadowFrustumSize=100;
  const shadows=new ShadowGenerator(1024,sun);shadows.useBlurExponentialShadowMap=true;shadows.useKernelBlur=true;shadows.blurKernel=20;shadows.filteringQuality=ShadowGenerator.QUALITY_LOW;shadows.bias=.0008;shadows.normalBias=.05;shadows.darkness=.25;
  const camera=new UniversalCamera('Third-person camera',new Vector3(0,5,38),scene);camera.minZ=.08;camera.maxZ=260;camera.fov=.92;camera.inputs.clear();
  scene.activeCamera=camera;
  // Let the loading state paint before constructing the campus.
  await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  const world=buildWorld(scene,shadows);
  const treeStats=await world.trees;
  const smoke = import.meta.env.DEV && new URLSearchParams(location.search).has('smoke');
  const saveKey = smoke ? 'campus-test-position' : 'campus-position';
  const player=await createPlayer(scene,shadows);
  let rawSave: string|null=null;try{rawSave=smoke ? null : localStorage.getItem(saveKey);}catch{/* Local saves are optional. */}
  const saved=parseSave(rawSave,world.obstacles);
  player.root.position.set(saved?.x??SPAWN.x,.05,saved?.z??SPAWN.z);
  let yaw=saved?.yaw??0, pitch=.18, paused=true, started=false, frame=0, run=false;
  let nearest: Interaction|undefined, seated: Interaction|undefined;
  let standingPosition={x:SPAWN.x,z:SPAWN.z};
  const keys=new Set<string>(),visited=new Set<string>(saved?.visited??[]);
  const audio=new Ambience();
  let joystick={x:0,y:0}, lastSaved=0;
  let currentSettings=ui.settings;
  let online=false,networkPosition={x:SPAWN.x,z:SPAWN.z,rotation:Math.PI,speed:0},inputTime=0,wasMoving=false,lastWave=0;
  let population=0,reserved=0,connectionState='offline';
  const remotes=new RemotePlayers(scene,shadows,error=>{console.error('Remote avatar',error);ui.toast('A student avatar could not load. Refresh to retry.');});
  const network=new CampusConnection({
    status(status){connectionState=status;ui.connection(status,population,reserved);if(status==='online'){started=true;paused=!!document.querySelector('dialog[open]');ui.begin();applySettings(currentSettings);}else if(status!=='offline'){clearInput();wasMoving=false;}},
    error(message){ui.toast(message);},
    state(state,welcome){
      world.setDoors(state.doors);population=state.count;reserved=state.reserved;
      const own=network.players.get(network.id);
      if(own){
        const seatChanged=(seated?.id??null)!==own.seatId;
        seated=own.seatId?world.interactions.find(i=>i.id===own.seatId):undefined;
        networkPosition={x:own.x,z:own.z,rotation:own.rotation,speed:own.speed};
        for(const input of network.pending)networkPosition=predict(networkPosition,input,world.obstacles);
        if(welcome||seatChanged||Math.hypot(player.root.position.x-networkPosition.x,player.root.position.z-networkPosition.z)>2){player.root.position.set(networkPosition.x,.05,networkPosition.z);player.root.rotation.y=networkPosition.rotation;}
        if(!welcome&&own.wave!==lastWave)player.wave(true);lastWave=own.wave;
      }
      remotes.sync(network.players,network.id);ui.connection('online',population,reserved);
    },
  });
  const wave=()=>{if(online){if(network.ready)network.action('wave');}else player.wave();};
  const playerMeshes=player.root.getChildMeshes();
  const applySettings=(settings:Settings)=>{
    currentSettings=settings;
    const limit=settings.quality==='low'?1:settings.quality==='high'?1.75:1.25;
    engine.setHardwareScalingLevel(1/Math.min(devicePixelRatio,limit));
    shadows.mapSize=settings.quality==='high'?2048:settings.quality==='low'?512:1024;
    scene.shadowsEnabled=true;
    shadows.filteringQuality=settings.quality==='high'?ShadowGenerator.QUALITY_MEDIUM:ShadowGenerator.QUALITY_LOW;
    audio.setEnabled(started && !paused && settings.sound);
    engine.resize();
  };
  const clearInput=()=>{keys.clear();joystick={x:0,y:0};const knob=document.getElementById('joystick-knob')!;knob.style.transform='';};
  const save=()=>{
    if(online)return;
    const p=seated?standingPosition:player.root.position;
    try{localStorage.setItem(saveKey,JSON.stringify({version:1,x:p.x,z:p.z,yaw,visited:[...visited]}));}catch{/* Private browsing may not permit persistence. */}
  };
  const stand=()=>{if(!seated)return;player.root.position.set(standingPosition.x,.05,standingPosition.z);seated=undefined;};
  const interact=()=>{
    if(paused)return;
    if(online){
      if(!network.ready)return;
      if(seated)network.action('stand');
      else if(nearest?.kind==='sign')ui.showSign();
      else if(nearest)network.action(nearest.kind==='door'?'door':'sit',nearest.id);
      return;
    }
    if(seated){stand();return;}
    if(!nearest)return;
    if(nearest.kind==='seat'&&nearest.seat){standingPosition={x:player.root.position.x,z:player.root.position.z};seated=nearest;player.root.position.set(nearest.seat.x,.05,nearest.seat.z);player.root.rotation.y=nearest.seat.rotation;}
    else if(nearest.kind==='sign')ui.showSign();
    else { const message=nearest.action(player.root.position); if(message)ui.toast(message); }
  };
  ui.bind({
    start(mode,name){
      if(mode==='online'){
        if(network.ready||['connecting','reconnecting'].includes(connectionState))return;
        save();online=true;paused=true;clearInput();network.connect(name);return;
      }
      const wasOnline=online;online=false;network.disconnect();remotes.clear();world.setDoors({});
      if(wasOnline){seated=undefined;let restore=null;try{restore=parseSave(localStorage.getItem(saveKey),world.obstacles);}catch{}player.root.position.set(restore?.x??SPAWN.x,.05,restore?.z??SPAWN.z);yaw=restore?.yaw??0;}
      started=true;paused=false;ui.begin();applySettings(currentSettings);ui.toast(matchMedia('(pointer:coarse)').matches?'Use the joystick to walk. Swipe to look around.':'WASD to walk · Drag to look · E to interact');
    },
    pause(value){paused=value;clearInput();if(online)network.stop();audio.setEnabled(started&&!paused&&currentSettings.sound);},
    interact,
    reset(){if(online){network.action('reset');return;}stand();player.root.position.set(SPAWN.x,.05,SPAWN.z);yaw=0;pitch=.18;player.root.rotation.y=Math.PI;save();ui.toast('Back at the campus entrance.');},
    settings:applySettings,
  });
  applySettings(currentSettings);
  const movementCodes=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'];
  window.addEventListener('keydown',e=>{
    if(paused||e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
    if(movementCodes.includes(e.code)){e.preventDefault();keys.add(e.code);}
    if(e.code==='KeyQ'&&!e.repeat){e.preventDefault();wave();}
    if(e.code==='KeyE'&&!e.repeat){e.preventDefault();interact();}
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',()=>{clearInput();if(online)network.stop();save();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(online)network.stop();save();audio.setEnabled(false);}else audio.setEnabled(started&&!paused&&currentSettings.sound);});
  window.addEventListener('pagehide',()=>{save();if(online)network.disconnect(true);});
  window.addEventListener('pageshow',e=>{if(e.persisted&&online)network.connect((document.getElementById('display-name') as HTMLInputElement).value||'Guest');});
  let dragId:number|undefined,lastX=0,lastY=0;
  ui.canvas.addEventListener('pointerdown',e=>{if(paused)return;dragId=e.pointerId;lastX=e.clientX;lastY=e.clientY;ui.canvas.setPointerCapture(e.pointerId);});
  ui.canvas.addEventListener('pointermove',e=>{if(paused||dragId!==e.pointerId)return;yaw+=(e.clientX-lastX)*.005*currentSettings.sensitivity;pitch=Math.max(-.12,Math.min(.9,pitch+(e.clientY-lastY)*.004*currentSettings.sensitivity));lastX=e.clientX;lastY=e.clientY;});
  const releaseLook=()=>{dragId=undefined;};ui.canvas.addEventListener('pointerup',releaseLook);ui.canvas.addEventListener('pointercancel',releaseLook);ui.canvas.addEventListener('lostpointercapture',releaseLook);
  ui.canvas.addEventListener('contextmenu',e=>e.preventDefault());
  let distance=8;
  ui.canvas.addEventListener('wheel',e=>{if(paused)return;e.preventDefault();distance=Math.max(3.5,Math.min(12,distance+e.deltaY*.008));},{passive:false});
  const stick=document.getElementById('joystick')!,knob=document.getElementById('joystick-knob')!;
  let stickId:number|undefined;
  const updateStick=(e:PointerEvent)=>{const r=stick.getBoundingClientRect(),max=r.width*.32;let x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;const len=Math.hypot(x,y);if(len>max){x=x/len*max;y=y/len*max;}joystick={x:x/max,y:y/max};knob.style.transform=`translate(${x}px,${y}px)`;};
  stick.addEventListener('pointerdown',e=>{if(paused)return;e.preventDefault();stickId=e.pointerId;stick.setPointerCapture(e.pointerId);updateStick(e);});
  stick.addEventListener('pointermove',e=>{if(stickId===e.pointerId&&!paused)updateStick(e);});
  const releaseStick=()=>{stickId=undefined;joystick={x:0,y:0};knob.style.transform='';};
  stick.addEventListener('pointerup',releaseStick);stick.addEventListener('pointercancel',releaseStick);stick.addEventListener('lostpointercapture',releaseStick);
  document.getElementById('wave-button')!.onclick=()=>{if(!paused)wave();};
  document.getElementById('run-button')!.onclick=()=>{run=!run;document.getElementById('run-button')!.classList.toggle('active',run);};
  window.addEventListener('resize',()=>engine.resize());
  window.addEventListener('orientationchange',()=>setTimeout(()=>engine.resize(),150));
  const target=new Vector3(),desired=new Vector3();
  function updateCamera(dt:number,immediate=false){
    const p=player.root.position;
    const indoors=(p.z < -14 && p.z > -34 && Math.abs(p.x)<27)||(p.x>36&&p.x<52&&p.z>0&&p.z<14);
    const follow=indoors?Math.min(distance,4.5):distance;
    const angle=indoors?Math.min(pitch,.20):pitch;
    target.set(p.x,p.y+(seated?1.02:1.38),p.z);
    desired.set(p.x+Math.sin(yaw)*Math.cos(angle)*follow,target.y+Math.sin(angle)*follow,p.z+Math.cos(yaw)*Math.cos(angle)*follow);
    const direction=desired.subtract(target),length=direction.length();
    const hit=scene.pickWithRay(new Ray(target,direction.normalize(),length),m=>m.metadata?.cameraBlocker===true);
    if(hit?.hit&&hit.distance<length)desired.copyFrom(target.add(direction.scale(Math.max(.5,hit.distance-.25))));
    const blend=immediate?1:1-Math.exp(-12*dt);
    Vector3.LerpToRef(camera.position,desired,blend,camera.position);camera.setTarget(target);
    const visibility=Vector3.Distance(camera.position,target)<1.1?.2:1;
    playerMeshes.forEach(m=>m.visibility=visibility);
  }
  player.root.rotation.y=Math.PI;
  updateCamera(.016,true);
  // Dev-only inspection lets browser tests verify real movement and interaction state.
  if(import.meta.env.DEV)Object.assign(window,{__campus:{
    snapshot:()=>({x:player.root.position.x,z:player.root.position.z,yaw,paused,seated:!!seated,place:getPlace(player.root.position).name,interaction:nearest?.id,meshes:scene.meshes.length,fps:engine.getFps(),player:player.snapshot(),trees:treeStats,online,connected:network.ready,remotePlayers:remotes.count,population}),
  }});
  scene.executeWhenReady(()=>{
    ui.ready();
    if(smoke) void import('./game/smoke').then(({runSmoke})=>runSmoke({
      snapshot:()=>({x:player.root.position.x,z:player.root.position.z,paused,seated:!!seated,place:getPlace(player.root.position).name,interaction:nearest?.id,fps:engine.getFps(),player:player.snapshot(),trees:treeStats,online,connected:network.ready,remotePlayers:remotes.count,population}),
    }));
  });
  engine.runRenderLoop(()=>{
    if(document.hidden)return;
    const dt=Math.min(engine.getDeltaTime()/1000,.05);frame++;
    let speed=0;
    if(!paused){
      let forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-joystick.y;
      let right=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+joystick.x;
      const len=Math.hypot(forward,right);
      if(len>.08&&!online){
        if(seated)stand();
        if(len>1){forward/=len;right/=len;}
        const pace=run||keys.has('ShiftLeft')||keys.has('ShiftRight')?5.8:3.1;
        const dx=(-Math.sin(yaw)*forward-Math.cos(yaw)*right)*pace*dt;
        const dz=(-Math.cos(yaw)*forward+Math.sin(yaw)*right)*pace*dt;
        const p=movePlayer(player.root.position,dx,dz,world.obstacles);
        const actualX=p.x-player.root.position.x,actualZ=p.z-player.root.position.z;
        speed=Math.hypot(actualX,actualZ)/dt;player.root.position.x=p.x;player.root.position.z=p.z;
        if(speed>.1){const desiredAngle=Math.atan2(actualX,actualZ);const diff=Math.atan2(Math.sin(desiredAngle-player.root.rotation.y),Math.cos(desiredAngle-player.root.rotation.y));player.root.rotation.y+=diff*Math.min(1,dt*12);}
      }
      if(online&&network.ready){
        inputTime+=dt;
        while(inputTime>=STEP_MS/1000){
          inputTime-=STEP_MS/1000;
          if(len>.08){
            const norm=Math.max(1,len);
            const x=(-Math.sin(yaw)*forward-Math.cos(yaw)*right)/norm,z=(-Math.cos(yaw)*forward+Math.sin(yaw)*right)/norm;
            const input=network.input(x,z,run||keys.has('ShiftLeft')||keys.has('ShiftRight'));
            if(input){networkPosition=predict(networkPosition,input,world.obstacles);wasMoving=true;}
          }else if(wasMoving){network.stop();wasMoving=false;networkPosition.speed=0;}
        }
      }else inputTime=0;
      const p=player.root.position;
      let best=2.5;nearest=undefined;
      for(const obj of world.interactions){const d=Math.hypot(p.x-obj.x,p.z-obj.z);if(d<best){best=d;nearest=obj;}}
      ui.prompt(seated?'Stand up':nearest?.label()??null);
      const place=getPlace(p);
      if(place.id!=='grounds'&&place.id!=='hall')visited.add(place.id);
      ui.location(place,Math.min(5,visited.size));
      if(performance.now()-lastSaved>5000){save();lastSaved=performance.now();}

    }else ui.prompt(null);
    if(online&&network.ready){
      const blend=1-Math.exp(-22*dt);
      player.root.position.x+=(networkPosition.x-player.root.position.x)*blend;
      player.root.position.z+=(networkPosition.z-player.root.position.z)*blend;
      const angle=Math.atan2(Math.sin(networkPosition.rotation-player.root.rotation.y),Math.cos(networkPosition.rotation-player.root.rotation.y));player.root.rotation.y+=angle*blend;
      speed=networkPosition.speed;
    }
    if(!paused||online)world.update(dt);
    remotes.update(dt,player.root.position,currentSettings.quality==='low');
    player.animate(dt,speed,!!seated,paused);
    updateCamera(dt);
    if(frame%6===0)ui.updateMap(player.root.position,yaw);
    scene.render();
  });
}
boot().catch(error=>{console.error(error);ui.fail('Something interrupted loading. Refresh to try again, or use another browser with WebGL enabled.');});
