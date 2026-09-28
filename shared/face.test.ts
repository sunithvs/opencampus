import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAX_FACE_BYTES, validFaceJpeg } from './face';
const jpeg=readFileSync(new URL('../scripts/fixtures/face-square.jpg',import.meta.url));
test('only bounded square baseline JPEG faces are accepted',()=>{
  assert.ok(validFaceJpeg(jpeg));
  assert.equal(validFaceJpeg(readFileSync(new URL('../scripts/fixtures/face-wide.jpg',import.meta.url))),false);
  assert.equal(validFaceJpeg(jpeg.subarray(0,jpeg.length-2)),false);
  assert.equal(validFaceJpeg(Buffer.from('<svg onload="alert(1)"></svg>')),false);
  assert.equal(validFaceJpeg(new Uint8Array(MAX_FACE_BYTES+1)),false);
  assert.equal(validFaceJpeg(Buffer.concat([jpeg,Buffer.from('trailing bytes')])),false);
});
