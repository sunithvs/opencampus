import { test } from 'node:test';
import assert from 'node:assert/strict';
import { movePlayer, isBlocked, parseSave } from './state';
const wall = { minX: 2, maxX: 2.3, minZ: -4, maxZ: 4 };
test('a long frame cannot tunnel through a thin wall', () => {
  const p = movePlayer({ x: 0, z: 0 }, 8, 0, [wall]);
  assert.ok(p.x < 1.7);
  assert.ok(!isBlocked(p.x, p.z, [wall]));
});
test('movement slides along walls', () => {
  const p = movePlayer({ x: 1.6, z: 0 }, 1, 2, [wall]);
  assert.ok(p.x < 1.7);
  assert.ok(Math.abs(p.z - 2) < 0.001);
});
test('closed doors block movement and open doors allow passage', () => {
  let closed = true;
  const door = { ...wall, enabled: () => closed };
  assert.ok(movePlayer({ x: 0, z: 0 }, 4, 0, [door]).x < 2);
  closed = false;
  assert.ok(movePlayer({ x: 0, z: 0 }, 4, 0, [door]).x > 3.9);
});
test('saved positions must be finite, in bounds, and outside walls', () => {
  assert.equal(parseSave('{bad', []), null);
  assert.equal(parseSave(JSON.stringify({ version: 1, x: 200, z: 0, yaw: 0 }), []), null);
  assert.equal(parseSave(JSON.stringify({ version: 1, x: 2, z: 0, yaw: 0 }), [wall]), null);
  assert.equal(parseSave(JSON.stringify({ version: 1, x: 0, z: 0, yaw: 0, visited: ['court'] }), [])?.x, 0);
});
