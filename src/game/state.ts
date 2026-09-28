export type Vec2 = { x: number; z: number };
export type Obstacle = { minX: number; maxX: number; minZ: number; maxZ: number; enabled?: () => boolean };
export const PLAYER_RADIUS = 0.32;
export const SPAWN: Vec2 = { x: 0, z: 29 };
export const WORLD_LIMIT = 92;

export function isBlocked(x: number, z: number, obstacles: Obstacle[], radius = PLAYER_RADIUS): boolean {
  if (Math.abs(x) > WORLD_LIMIT || Math.abs(z) > WORLD_LIMIT) return true;
  return obstacles.some(o => {
    if (o.enabled && !o.enabled()) return false;
    const nearX = Math.max(o.minX, Math.min(x, o.maxX));
    const nearZ = Math.max(o.minZ, Math.min(z, o.maxZ));
    return (x - nearX) ** 2 + (z - nearZ) ** 2 < radius ** 2;
  });
}

// Small steps prevent tunnelling; independent axes let the player slide along walls.
export function movePlayer(position: Vec2, dx: number, dz: number, obstacles: Obstacle[]): Vec2 {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.15));
  let { x, z } = position;
  for (let i = 0; i < steps; i++) {
    if (!isBlocked(x + dx / steps, z, obstacles)) x += dx / steps;
    if (!isBlocked(x, z + dz / steps, obstacles)) z += dz / steps;
  }
  return { x, z };
}

export type Place = { id: string; name: string; subtitle: string; x: number; z: number; radius: number };
export const PLACES: Place[] = [
  { id: 'classroom-west', name: 'Classroom 101', subtitle: 'West wing · Academic block', x: -15, z: -24, radius: 10 },
  { id: 'classroom-east', name: 'Classroom 102', subtitle: 'East wing · Academic block', x: 15, z: -24, radius: 10 },
  { id: 'hall', name: 'Academic block', subtitle: 'Ground floor · Main hall', x: 0, z: -24, radius: 14 },
  { id: 'cafe', name: 'The Campus Café', subtitle: 'A little pause between classes', x: 42, z: 7, radius: 12 },
  { id: 'garden', name: 'Palm garden', subtitle: 'Find your quiet corner', x: -35, z: 10, radius: 20 },
  { id: 'court', name: 'Main courtyard', subtitle: 'Academic block · South entrance', x: 0, z: 10, radius: 28 },
];
export function getPlace(p: Vec2): Place {
  return PLACES.find(place => Math.hypot(p.x - place.x, p.z - place.z) < place.radius)
    ?? { id: 'grounds', name: 'Campus grounds', subtitle: 'A place to wander', x: 0, z: 0, radius: 0 };
}
export type SaveData = { version: 1; x: number; z: number; yaw: number; visited: string[] };
export function parseSave(raw: string | null, obstacles: Obstacle[]): SaveData | null {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || value.version !== 1 || !Number.isFinite(value.x) || !Number.isFinite(value.z) || !Number.isFinite(value.yaw)) return null;
    if (isBlocked(value.x, value.z, obstacles)) return null;
    return { version: 1, x: value.x, z: value.z, yaw: value.yaw, visited: Array.isArray(value.visited) ? value.visited.filter((s: unknown) => typeof s === 'string') : [] };
  } catch { return null; }
}
