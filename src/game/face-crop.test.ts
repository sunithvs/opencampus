import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cropRect, panCrop } from './face-crop';
test('square crop covers portrait and landscape images without stretching',()=>{
  assert.deepEqual(cropRect(640,360,{zoom:1,x:.5,y:.5}),{x:140,y:0,size:360});
  assert.deepEqual(cropRect(360,640,{zoom:1,x:.5,y:.5}),{x:0,y:140,size:360});
  assert.deepEqual(cropRect(640,360,{zoom:2,x:1,y:0}),{x:460,y:0,size:180});
});
test('dragging and zoom stay inside the source image, including a square at minimum zoom',()=>{
  const crop=panCrop(640,360,{zoom:1,x:.5,y:.5},10000,-10000,256);
  assert.deepEqual(crop,{zoom:1,x:0,y:.5});
  assert.deepEqual(panCrop(256,256,{zoom:1,x:.5,y:.5},20,20,256),{zoom:1,x:.5,y:.5});
  assert.deepEqual(cropRect(256,256,{zoom:99,x:-10,y:100}),{x:0,y:192,size:64});
});
