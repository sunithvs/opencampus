export const FACE_SIZE=256;
export const MAX_FACE_BYTES=48*1024;
export const facePath=(id:string,version:string)=>`/api/campus/faces/${encodeURIComponent(id)}/${encodeURIComponent(version)}`;

// Canvas exports baseline JPEG. Walk every segment and the entropy stream rather
// than trusting the MIME type or accepting an arbitrary URL/SVG from a client.
export function validFaceJpeg(bytes:Uint8Array):boolean {
  if(bytes.length<20||bytes.length>MAX_FACE_BYTES||bytes[0]!==255||bytes[1]!==216)return false;
  let at=2,frame=false,scan=false;
  while(at<bytes.length){
    if(bytes[at++]!==255)return false;
    while(bytes[at]===255)at++;
    const marker=bytes[at++];
    if(marker===217)return frame&&scan&&at===bytes.length;
    if(marker===216||marker===0||marker===undefined)return false;
    const length=(bytes[at]<<8)|bytes[at+1];
    if(length<2||at+length>bytes.length)return false;
    if(marker>=192&&marker<=207&&![196,200,204].includes(marker)){
      if(marker!==192||frame||length<17||bytes[at+2]!==8)return false;
      if(((bytes[at+3]<<8)|bytes[at+4])!==FACE_SIZE||((bytes[at+5]<<8)|bytes[at+6])!==FACE_SIZE||bytes[at+7]!==3)return false;
      frame=true;
    }
    at+=length;
    if(marker===218){
      if(!frame||scan)return false;scan=true;
      while(at<bytes.length){
        if(bytes[at]!==255){at++;continue;}
        if(bytes[at+1]===0||(bytes[at+1]>=208&&bytes[at+1]<=215)){at+=2;continue;}
        break;
      }
    }
  }
  return false;
}
