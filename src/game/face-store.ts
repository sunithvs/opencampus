import { MAX_FACE_BYTES, validFaceJpeg } from '../../shared/face';
export function faceBlob(data:string):Blob{
  if(!data.startsWith('data:image/jpeg;base64,')||data.length>MAX_FACE_BYTES*4/3+32)throw Error('Invalid saved face image.');
  const bytes=Uint8Array.from(atob(data.slice(23)),c=>c.charCodeAt(0));
  if(!validFaceJpeg(bytes))throw Error('Invalid saved face image.');
  return new Blob([bytes],{type:'image/jpeg'});
}
export function loadFace(key:string):string|null{
  try{const data=localStorage.getItem(key);if(data){faceBlob(data);return data;}}catch{/* A damaged or unavailable local save falls back to the default face. */}
  return null;
}
