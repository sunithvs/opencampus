export type Crop={zoom:number;x:number;y:number};
const clamp=(n:number,low:number,high:number)=>Math.min(high,Math.max(low,n));
export function cropRect(width:number,height:number,crop:Crop){
  const size=Math.min(width,height)/clamp(crop.zoom,1,4);
  return {x:(width-size)*clamp(crop.x,0,1),y:(height-size)*clamp(crop.y,0,1),size};
}
export function panCrop(width:number,height:number,crop:Crop,dx:number,dy:number,displaySize:number):Crop{
  const rect=cropRect(width,height,crop),scale=rect.size/displaySize;
  return {...crop,x:width===rect.size?.5:clamp((rect.x-dx*scale)/(width-rect.size),0,1),y:height===rect.size?.5:clamp((rect.y-dy*scale)/(height-rect.size),0,1)};
}
