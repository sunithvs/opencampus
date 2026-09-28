import { PLACES, type Vec2, type Place } from './game/state';
const icons = {
  wave: '<path d="M8 13V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v6c0 4-2 7-6 7h-1c-2 0-4-1-5-3l-4-5a1.5 1.5 0 0 1 2-2l2 2Z"/>',
  campus: '<path d="m3 9 9-6 9 6H3Zm3 4v6m6-6v6m6-6v6M3 21h18"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
  volume: '<path d="m11 5-6 4H2v6h3l6 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  location: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  leaf: '<path d="M20 4c0 12-8 15-13 10C2 9 8 3 20 4ZM5 20l10-11"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 2m0 3h.01"/>',
};
export const icon = (name: keyof typeof icons) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
export type Settings = { quality: 'low' | 'balanced' | 'high'; sensitivity: number; sound: boolean; };
export function createUI() {
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <canvas id="world" aria-label="3D campus. Use WASD or arrow keys to walk; drag to look around." tabindex="0"></canvas>
    <div id="loading"><div class="loading-mark">${icon('campus')}</div><span class="eyebrow">CAMPUS</span><h1>A world just around the corner.</h1><div class="load-track"><i></i></div><p>Preparing the grounds…</p></div>
    <header class="hud topbar">
      <a class="brand" href="#" aria-label="Campus home"><span class="brand-mark">${icon('campus')}</span><span>campus<span class="brand-caption">A PLACE TO WANDER</span></span></a>
      <div class="session"><span class="session-dot"></span><span id="session-label">Choose your walk</span><span class="session-divider"></span><span id="population">Public campus</span></div>
      <nav aria-label="Game controls"><button id="wave-button" class="icon-button" aria-label="Wave" title="Wave while standing (Q)" hidden>${icon('wave')}</button><button id="map-button" class="icon-button" aria-label="Open campus map" title="Campus map (M)">${icon('map')}</button><button id="settings-button" class="icon-button" aria-label="Open settings" title="Settings">${icon('settings')}</button></nav>
    </header>
    <div class="hud north"><span>N</span><i></i></div>
    <section id="welcome" class="hud welcome"><div class="eyebrow"><span class="small-line"></span> YOUR WALK STARTS HERE</div><h1>Welcome to <br><em>campus.</em></h1><p>Familiar paths. A quiet café. A seat in the shade.<br>Take a look around, at your own pace.</p><label class="join-name" for="display-name">Your display name</label><input id="display-name" class="name-input" maxlength="24" autocomplete="nickname" placeholder="Campus explorer" value="Guest" /><button id="join-button" class="primary">Join public campus ${icon('arrow')}</button><p id="join-status" class="join-status" role="status"></p><button id="start-button" class="offline-button">Explore offline</button><div class="welcome-note">${icon('leaf')} No rush. No destination required.</div></section>
    <section id="location-card" class="hud location-card" hidden><div class="eyebrow">${icon('location')} <span id="location-category">THE GROUNDS</span></div><h1 id="location-title">Main courtyard</h1><p id="location-subtitle">Academic block · South entrance</p><div class="visited"><span id="visited-count">0</span> / 5 places discovered <span class="visited-track"><i id="visited-fill"></i></span></div></section>
    <div id="interaction" class="hud interaction" hidden><button id="interact-button"><kbd>E</kbd><span id="interaction-label">Open door</span>${icon('arrow')}</button></div>
    <div class="hud bottom-controls" id="desktop-controls"><span><kbd>W</kbd><span class="wasd-bottom"><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></span><span>Walk</span><i></i><span class="mouse-icon"></span><span>Drag to look</span><i></i><kbd>⇧</kbd><span>Run</span></div>
    <button id="help-button" class="hud help-button" aria-label="Show controls">${icon('help')}</button>
    <button id="minimap-button" class="hud minimap" aria-label="Open campus map"><div class="map-heading"><span>YOUR LITTLE WORLD</span>${icon('expand')}</div><canvas id="minimap" width="360" height="280"></canvas><div class="map-footer"><span id="map-location">Main courtyard</span><span>N ↑</span></div></button>
    <div class="hud touch-controls" id="touch-controls"><div id="joystick" aria-label="Movement joystick"><div id="joystick-knob"></div></div><button id="run-button" aria-label="Toggle running">RUN</button><span class="touch-look-hint">Drag the right side to look</span></div>
    <div id="toast" role="status" hidden></div><div id="connection-banner" class="hud connection-banner" hidden><span id="connection-message" role="status"></span><button id="retry-button">Retry</button><button id="offline-button">Play offline</button></div>
    <dialog id="map-dialog" aria-labelledby="map-title"><div class="dialog-head"><div><span class="eyebrow">FIND YOUR WAY</span><h2 id="map-title">The campus</h2></div><button class="icon-button close-dialog" aria-label="Close map">${icon('close')}</button></div><canvas id="large-map" width="1100" height="850" aria-label="Campus map showing your position, academic block, café, and palm garden"></canvas><div class="map-key"><span><i class="you-dot"></i>You are here</span><span><i class="building-dot"></i>Buildings</span><span><i class="garden-dot"></i>Green spaces</span></div><p class="dialog-note">Classrooms are inside the academic block. The café entrance faces south.</p></dialog>
    <dialog id="settings-dialog" aria-labelledby="settings-title"><div class="dialog-head"><div><span class="eyebrow">MAKE YOURSELF COMFORTABLE</span><h2 id="settings-title">Settings</h2></div><button class="icon-button close-dialog" aria-label="Close settings">${icon('close')}</button></div><label class="setting-row"><span>Graphics quality<small>Lower settings help on slower devices.</small></span><select id="quality"><option value="low">Low</option><option value="balanced" selected>Balanced</option><option value="high">High</option></select></label><label class="setting-row"><span>Camera sensitivity</span><input id="sensitivity" type="range" min="0.4" max="2" step="0.1" value="1" /></label><label class="setting-row"><span>Ambient sound<small>Soft wind and distant birds.</small></span><input id="sound" type="checkbox" /></label><button id="fullscreen-button" class="secondary">${icon('expand')} Toggle fullscreen</button><button id="leave-button" class="secondary" hidden>Leave public campus · play offline</button><button id="reset-button" class="secondary">Return to campus entrance</button><p class="dialog-note">Offline position and settings are saved on this device. Online sessions reconnect for up to 30 seconds.</p></dialog>
    <dialog id="help-dialog" aria-labelledby="help-title"><div class="dialog-head"><div><span class="eyebrow">SETTLE IN</span><h2 id="help-title">A few simple controls</h2></div><button class="icon-button close-dialog" aria-label="Close controls">${icon('close')}</button></div><div class="help-grid"><span>Walk</span><span><kbd>W A S D</kbd> or arrow keys</span><span>Look around</span><span>Click and drag / swipe</span><span>Run</span><span>Hold <kbd>Shift</kbd> / tap RUN</span><span>Use doors & seats</span><span><kbd>E</kbd> / tap the prompt</span><span>Wave while standing</span><span><kbd>Q</kbd> / hand button</span><span>Campus map</span><span><kbd>M</kbd> / map button</span><span>Pause</span><span><kbd>Esc</kbd></span></div><p class="dialog-note">On a phone, use the left joystick to move and drag the right side of the screen to look. Move closer to a door or bench to interact.</p></dialog>
    <dialog id="sign-dialog" aria-labelledby="sign-title"><div class="dialog-head"><div><span class="eyebrow">A QUIETER CORNER</span><h2 id="sign-title">Palm garden</h2></div><button class="icon-button close-dialog" aria-label="Close garden sign">${icon('close')}</button></div><p class="sign-copy">A little green space between classes. Follow the circular path, find a bench, and enjoy a moment under the palms.</p></dialog>
  `;
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const canvas = $<HTMLCanvasElement>('world');
  let onStart = (_mode:'online'|'offline',_name:string) => {}, onPause = (_paused: boolean) => {}, onInteract = () => {}, onReset = () => {}, onSettings = (_settings: Settings) => {};
  let started = false, toastTimer = 0, lastFocus: HTMLElement | null = null;
  const settings: Settings = { quality: matchMedia('(pointer: coarse)').matches ? 'low' : 'balanced', sensitivity: 1, sound: false };
  const settingsKey = import.meta.env.DEV && new URLSearchParams(location.search).has('smoke') ? 'campus-test-settings' : 'campus-settings';
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) || 'null');
    if (saved && ['low','balanced','high'].includes(saved.quality)) settings.quality = saved.quality;
    if (saved && typeof saved.sound === 'boolean') settings.sound = saved.sound;
    if (saved && typeof saved.sensitivity === 'number' && saved.sensitivity >= .4 && saved.sensitivity <= 2) settings.sensitivity = saved.sensitivity;
  } catch { /* Storage may be unavailable in private browsers. */ }
  $<HTMLSelectElement>('quality').value = settings.quality;
  $<HTMLInputElement>('sensitivity').value = String(settings.sensitivity);
  $<HTMLInputElement>('sound').checked = settings.sound;
  const showDialog = (id: string) => { lastFocus = document.activeElement as HTMLElement; $<HTMLDialogElement>(id).showModal(); onPause(true); };
  document.querySelectorAll<HTMLDialogElement>('dialog').forEach(d => {
    d.querySelector('button.close-dialog')!.addEventListener('click', () => d.close());
    d.addEventListener('click', e => { if (e.target === d) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); } });
    d.addEventListener('close', () => { onPause(!started); lastFocus?.focus(); });
  });
  const name=()=>($<HTMLInputElement>('display-name').value.trim()||'Guest').slice(0,24);
  const begin=()=>{started=true;$('wave-button').hidden=false;$('welcome').hidden=true;$('location-card').hidden=false;document.body.classList.add('playing');canvas.focus();};
  const offline=()=>{for(const dialog of document.querySelectorAll<HTMLDialogElement>('dialog[open]'))dialog.close();begin();onStart('offline',name());};
  $('start-button').onclick=$('offline-button').onclick=$('leave-button').onclick=offline;
  $('join-button').onclick=$('retry-button').onclick=()=>onStart('online',name());
  $<HTMLInputElement>('display-name').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();onStart('online',name());}});
  $('map-button').onclick = $('minimap-button').onclick = () => showDialog('map-dialog');
  $('settings-button').onclick = () => showDialog('settings-dialog');
  $('help-button').onclick = () => showDialog('help-dialog');
  $('interact-button').onclick = () => onInteract();
  document.querySelector('.brand')!.addEventListener('click', e => { e.preventDefault(); showDialog('help-dialog'); });
  $('reset-button').onclick = () => { onReset(); $<HTMLDialogElement>('settings-dialog').close(); };
  if (!document.fullscreenEnabled) $('fullscreen-button').hidden = true;
  $('fullscreen-button').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { toast('Fullscreen isn’t available in this browser.'); } };
  for (const id of ['quality','sensitivity','sound']) $(id).addEventListener('change', () => {
    settings.quality = $<HTMLSelectElement>('quality').value as Settings['quality']; settings.sensitivity = Number($<HTMLInputElement>('sensitivity').value); settings.sound = $<HTMLInputElement>('sound').checked;
    try { localStorage.setItem(settingsKey, JSON.stringify(settings)); } catch { /* Keep settings for this session. */ }
    onSettings(settings);
  });
  document.addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]') || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (e.code === 'KeyM') { e.preventDefault(); showDialog('map-dialog'); }
    if (e.code === 'Escape' && started) showDialog('settings-dialog');
  });
  function toast(message: string) { const el=$('toast'); el.textContent=message; el.hidden=false; clearTimeout(toastTimer); toastTimer=window.setTimeout(()=>el.hidden=true,4200); }
  let lastPlace = '';
  return { canvas, settings, toast, begin,
    connection(status:string,count=0,reserved=0){
      const busy=status==='connecting'||status==='reconnecting';
      $<HTMLButtonElement>('join-button').disabled=busy;
      $('session-label').textContent=status==='online'?'Public campus':status==='offline'?'Offline':status==='full'?'Campus full':busy?'Connecting…':'Disconnected';
      $('population').textContent=status==='online'?`${count} / 50 online${reserved?` · ${reserved} reconnecting`:''}`:'Free roam';
      $('leave-button').hidden=status==='offline';
      const message=status==='full'?'Campus full — 50/50. Try again shortly.':status==='failed'?'Connection unavailable. Retry or explore offline.':busy?'Connecting to the public campus…':'';
      $('join-status').textContent=message;
      $('connection-banner').hidden=!started||!message;
      $('connection-message').textContent=message;
      $<HTMLButtonElement>('retry-button').disabled=busy;
    },
    showSign: () => showDialog('sign-dialog'),
    bind(handlers: { start: (mode:'online'|'offline',name:string) => void; pause: (p: boolean) => void; interact: () => void; reset: () => void; settings: (s: Settings) => void }) { onStart=handlers.start; onPause=handlers.pause; onInteract=handlers.interact; onReset=handlers.reset; onSettings=handlers.settings; },
    ready() { $('loading').classList.add('loaded'); window.setTimeout(()=>$('loading').remove(),650); },
    fail(message: string) { $('loading').innerHTML = `<div class="loading-mark">${icon('campus')}</div><h1>We couldn’t open the campus.</h1><p>${message}</p><button class="primary" onclick="location.reload()">Try again</button>`; },
    location(place: Place, visited: number) {
      if (place.id!==lastPlace) { $('location-title').textContent=place.name; $('location-subtitle').textContent=place.subtitle; $('map-location').textContent=place.name; $('location-category').textContent = place.id.startsWith('classroom') || place.id === 'hall' ? 'THE ACADEMIC BLOCK' : 'THE GROUNDS'; lastPlace=place.id; }
      $('visited-count').textContent=String(visited); $('visited-fill').style.width=`${visited/5*100}%`;
    },
    prompt(text: string | null) { $('interaction').hidden = !text || !started; if (text) $('interaction-label').textContent=text; },
    updateMap(p: Vec2, yaw: number) { drawMap($<HTMLCanvasElement>('minimap'),p,yaw,false); if ($<HTMLDialogElement>('map-dialog').open) drawMap($<HTMLCanvasElement>('large-map'),p,yaw,true); },
  };
}
function drawMap(canvas: HTMLCanvasElement, p: Vec2, yaw: number, large: boolean) {
  const c=canvas.getContext('2d')!, w=canvas.width, h=canvas.height;
  const scale=w/130, ox=w*.5, oz=h*.57;
  const pos=(x:number,z:number)=>[ox-x*scale,oz+z*scale];
  c.fillStyle='#dfe4d2'; c.fillRect(0,0,w,h);
  function rect(x:number,z:number,ww:number,dd:number,color:string) { const [xx,yy]=pos(x+ww/2,z-dd/2); c.fillStyle=color; c.fillRect(xx,yy,ww*scale,dd*scale); }
  rect(0,36,10,79,'#f7f4e8'); rect(0,-6,62,14,'#f7f4e8'); rect(1,12,92,4,'#f7f4e8'); rect(-37,-24,6,79,'#eeeede'); rect(34,-29,6,67,'#eeeede');
  for (const [x,z,ww,dd] of [[0,-24,54,20],[44,7,16,14],[-53,-29,19,16], [48,-32,20,17], [-18,-57,29,15],[21,-62,20,14]]) { rect(x,z,ww,dd,'#b7856d'); rect(x,z-.4,ww-1.5,dd-1.5,'#c89e87'); }
  for (const side of [-1,1]) for(let z=4;z<73;z+=12) { const [x,y]=pos(side*8,z); c.beginPath();c.arc(x,y,1.6*scale,0,Math.PI*2);c.fillStyle='#849b6e';c.fill(); }
  const [gx,gy]=pos(-34,9); c.beginPath();c.arc(gx,gy,9.5*scale,0,Math.PI*2);c.strokeStyle='#f6f1df';c.lineWidth=2.5*scale;c.stroke();c.beginPath();c.arc(gx,gy,2.5*scale,0,Math.PI*2);c.fillStyle='#819f99';c.fill();
  if(large) { c.textAlign='center';c.fillStyle='#31493a';c.font=`500 ${Math.round(w*.021)}px system-ui`; for(const [text,x,z] of [['ACADEMIC BLOCK',0,-39],['CAFÉ',44,22],['PALM GARDEN',-34,25]] as [string,number,number][]) { const [xx,yy]=pos(x,z);c.fillText(text,xx,yy); } }
  const [px,py]=pos(p.x,p.z); c.save();c.translate(px,py);c.rotate(yaw);c.beginPath();c.moveTo(0,-16);c.lineTo(-10,-1);c.lineTo(10,-1);c.closePath();c.fillStyle='rgba(24,70,55,.16)';c.fill();c.restore();
  c.beginPath();c.arc(px,py,large?10:6,0,Math.PI*2);c.fillStyle='#214f3f';c.fill();c.strokeStyle='#fffdf3';c.lineWidth=large?4:3;c.stroke();
}
