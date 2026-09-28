import { FACE_SIZE, MAX_FACE_BYTES } from '../shared/face';
import { cropRect, panCrop, type Crop } from './game/face-crop';

export const faceEditorMarkup=`
<dialog id="face-dialog" aria-labelledby="face-title">
  <div class="dialog-head"><div><span class="eyebrow">MAKE IT YOURS</span><h2 id="face-title">Your face</h2></div><button class="icon-button close-dialog" aria-label="Close face editor">✕</button></div>
  <p class="face-intro">Choose a photo, then frame your face in the square.</p>
  <label class="secondary face-file-label" for="face-file">Choose an image<input id="face-file" type="file" accept="image/jpeg,image/png,image/webp" /></label>
  <p class="face-file-help">JPG, PNG or WebP · up to 8 MB</p>
  <div class="face-crop-wrap"><canvas id="face-crop" width="256" height="256" aria-label="Square face crop preview. Drag to reposition or use the sliders below."></canvas><span id="face-empty">Your photo goes here</span></div>
  <div id="face-adjustments" hidden>
    <p class="face-hint">Drag the photo to reposition</p>
    <label class="face-slider">Zoom<input id="face-zoom" type="range" min="1" max="4" step="0.01" value="1" /></label>
    <label class="face-slider">Horizontal position<input id="face-x" type="range" min="0" max="1" step="0.01" value="0.5" /></label>
    <label class="face-slider">Vertical position<input id="face-y" type="range" min="0" max="1" step="0.01" value="0.5" /></label>
  </div>
  <p class="dialog-note">Saved on this device. Your cropped face is visible to everyone when you join the public campus. The original photo stays on your device.</p>
  <p id="face-status" role="status" aria-live="polite"></p>
  <div class="face-actions"><button id="face-apply" class="primary" disabled>Use this face</button><button id="face-remove" class="secondary" hidden>Use default face</button></div>
</dialog>`;

export function createFaceEditor(options:{getSaved:()=>string|null;apply:(data:string|null)=>Promise<void>;open:()=>void}){
  const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
  const dialog=$<HTMLDialogElement>('face-dialog'),canvas=$<HTMLCanvasElement>('face-crop'),ctx=canvas.getContext('2d')!;
  const file=$<HTMLInputElement>('face-file'),apply=$<HTMLButtonElement>('face-apply'),remove=$<HTMLButtonElement>('face-remove');
  let image:HTMLImageElement|undefined,crop:Crop={zoom:1,x:.5,y:.5},generation=0,busy=false;
  let pointer:{id:number;x:number;y:number}|undefined;
  const status=(text:string)=>$('face-status').textContent=text;
  function draw(){
    ctx.fillStyle='#edf0e4';ctx.fillRect(0,0,FACE_SIZE,FACE_SIZE);
    if(image){const r=cropRect(image.naturalWidth,image.naturalHeight,crop);ctx.drawImage(image,r.x,r.y,r.size,r.size,0,0,FACE_SIZE,FACE_SIZE);}
    $('face-empty').hidden=!!image;$('face-adjustments').hidden=!image;apply.disabled=busy||!image;
    for(const [key,value] of Object.entries(crop))$<HTMLInputElement>(`face-${key}`).value=String(value);
  }
  function refresh(){
    const saved=options.getSaved();remove.hidden=!saved;
    for(const thumb of document.querySelectorAll<HTMLImageElement>('.face-thumbnail')){thumb.hidden=!saved;if(saved)thumb.src=saved;else thumb.removeAttribute('src');}
  }
  async function load(source:string){
    const current=++generation;image=undefined;draw();status('Loading image…');
    const candidate=new Image();candidate.src=source;
    try{
      await candidate.decode();
      if(current!==generation||!dialog.open)return;
      if(!candidate.naturalWidth||!candidate.naturalHeight||candidate.naturalWidth*candidate.naturalHeight>40_000_000)throw Error('Choose an image smaller than 40 megapixels.');
      image=candidate;crop={zoom:1,x:.5,y:.5};draw();status('');
    }catch(error){if(current===generation)status(error instanceof Error&&error.message.includes('megapixels')?error.message:'This image could not be opened. Try a JPG, PNG or WebP.');}
  }
  function open(){options.open();file.value='';image=undefined;crop={zoom:1,x:.5,y:.5};draw();refresh();status('');const saved=options.getSaved();if(saved)void load(saved);}
  $('face-welcome').onclick=$('face-settings').onclick=open;
  file.onchange=async()=>{
    const selected=file.files?.[0];if(!selected)return;
    generation++;image=undefined;draw();
    if(!['image/jpeg','image/png','image/webp'].includes(selected.type)){status('Choose a JPG, PNG or WebP image.');return;}
    if(selected.size>8*1024*1024){status('Choose an image smaller than 8 MB.');return;}
    const url=URL.createObjectURL(selected);try{await load(url);}finally{URL.revokeObjectURL(url);}
  };
  for(const key of ['zoom','x','y'] as const)$<HTMLInputElement>(`face-${key}`).oninput=e=>{crop[key]=Number((e.target as HTMLInputElement).value);draw();};
  canvas.onpointerdown=e=>{if(!image||busy)return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);};
  canvas.onpointermove=e=>{if(!image||!pointer||pointer.id!==e.pointerId)return;crop=panCrop(image.naturalWidth,image.naturalHeight,crop,e.clientX-pointer.x,e.clientY-pointer.y,canvas.getBoundingClientRect().width);pointer.x=e.clientX;pointer.y=e.clientY;draw();};
  canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=()=>{pointer=undefined;};
  async function save(data:string|null){
    busy=true;apply.disabled=true;remove.disabled=true;file.disabled=true;dialog.querySelector<HTMLButtonElement>('.close-dialog')!.disabled=true;status('Saving your face…');
    try{await options.apply(data);refresh();dialog.close();}
    catch(error){status(error instanceof Error?error.message:'Your face could not be saved. Please try again.');}
    finally{busy=false;remove.disabled=false;file.disabled=false;dialog.querySelector<HTMLButtonElement>('.close-dialog')!.disabled=false;draw();}
  }
  apply.onclick=()=>{
    if(!image||busy)return;
    let data=canvas.toDataURL('image/jpeg',.86);
    for(const quality of [.7,.55,.4]){if(atob(data.split(',')[1]).length<=MAX_FACE_BYTES)break;data=canvas.toDataURL('image/jpeg',quality);}
    if(atob(data.split(',')[1]).length>MAX_FACE_BYTES){status('This crop is too detailed. Zoom in slightly and try again.');return;}
    void save(data);
  };
  remove.onclick=()=>{if(!busy)void save(null);};
  dialog.addEventListener('click',e=>{if(busy&&e.target===dialog)e.stopImmediatePropagation();},true);
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  dialog.addEventListener('close',()=>{generation++;image=undefined;pointer=undefined;file.value='';});
  refresh();draw();
  return {refresh};
}
