import * as THREE from 'three';
import { MapBiome } from '../types/game';

export interface BiomeConfig {
  id: MapBiome;
  labelFa: string;
  labelEn: string;
  fogColor: number;
  fogDensity: number;
  skyZenith: number;
  skyMid: number;
  skyHorizon: number;
  keyColor: number;
  keyIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  rimColor: number;
  rimIntensity: number;
  searchlightColor: number;
}

export const BIOME_CONFIGS: Record<MapBiome, BiomeConfig> = {
  alpine: {
    id: 'alpine',
    labelFa: 'کوهستان',
    labelEn: 'Alpine Valley',
    fogColor: 0x152136,
    fogDensity: 0.0037,
    skyZenith: 0x060b18,
    skyMid: 0x132440,
    skyHorizon: 0x334766,
    keyColor: 0xc2ddff,
    keyIntensity: 1.62,
    hemiSky: 0x5276a6,
    hemiGround: 0x182620,
    hemiIntensity: 0.94,
    rimColor: 0xf59e0b,
    rimIntensity: 0.58,
    searchlightColor: 0xdbeafe,
  },
  coastal: {
    id: 'coastal',
    labelFa: 'ساحلی',
    labelEn: 'Coastal Base',
    fogColor: 0x0f1e33,
    fogDensity: 0.0035,
    skyZenith: 0x050a16,
    skyMid: 0x102742,
    skyHorizon: 0x264463,
    keyColor: 0xc7e4ff,
    keyIntensity: 1.65,
    hemiSky: 0x507da8,
    hemiGround: 0x122233,
    hemiIntensity: 0.96,
    rimColor: 0x38bdf8,
    rimIntensity: 0.56,
    searchlightColor: 0xe0f2fe,
  },
  desert: {
    id: 'desert',
    labelFa: 'کویر',
    labelEn: 'Desert Canyon',
    fogColor: 0x251a24,
    fogDensity: 0.0036,
    skyZenith: 0x0b0b1c,
    skyMid: 0x281e36,
    skyHorizon: 0x6b3d3c,
    keyColor: 0xffd5aa,
    keyIntensity: 1.62,
    hemiSky: 0x7b5d82,
    hemiGround: 0x38241a,
    hemiIntensity: 0.94,
    rimColor: 0xf97316,
    rimIntensity: 0.7,
    searchlightColor: 0xfef3c7,
  },
  arctic: {
    id: 'arctic',
    labelFa: 'دژ قطبی',
    labelEn: 'Arctic Fortress',
    fogColor: 0x0d1f30,
    fogDensity: 0.0036,
    skyZenith: 0x040b18,
    skyMid: 0x0b2538,
    skyHorizon: 0x1d4d63,
    keyColor: 0xd8f3ff,
    keyIntensity: 1.7,
    hemiSky: 0x67b5d1,
    hemiGround: 0x1b3445,
    hemiIntensity: 1.0,
    rimColor: 0x34d399,
    rimIntensity: 0.72,
    searchlightColor: 0xa5f3fc,
  },
};

export interface SearchlightTargetPoint {
  x: number;
  y: number;
  z: number;
}

export interface BiomeWorldHandle {
  group: THREE.Group;
  terrainMesh: THREE.Mesh;
  update: (timeSec: number, dt: number, nightFactor?: number, searchTargets?: SearchlightTargetPoint[]) => void;
  dispose: () => void;
}

// Reusable zero-GC scratch objects for active AA searchlight target tracking
const _slTargetVec = new THREE.Vector3();
const _slUpVec = new THREE.Vector3(0, 1, 0);
const _slGoalQuat = new THREE.Quaternion();
const _slSweepEuler = new THREE.Euler(0, 0, 0, 'YXZ');

// Deterministic pseudo-random and smooth 2D noise helpers
function hash2(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function valueNoise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);

  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm2D(x: number, z: number, octaves = 3): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1.0;
  for (let i = 0; i < octaves; i++) {
    value += amp * (valueNoise2D(x * freq, z * freq) * 2 - 1);
    freq *= 2.05;
    amp *= 0.48;
  }
  return value;
}

function riverCenterZ(x: number): number {
  return 18.5 + Math.sin(x * 0.065) * 4.5 + Math.cos(x * 0.03) * 2.0;
}

/**
 * Deterministic ground elevation at (x, z) for each biome.
 * Central military plateau stays cleanly flat at y = 0 for crisp tower placement.
 */
export function getGroundHeight(x: number, z: number, biome: MapBiome): number {
  const r = Math.hypot(x, z);

  if (biome === 'alpine') {
    const plateauBlend = smoothstep(13.5, 22.0, r);
    const n1 = fbm2D(x * 0.035 + 3.1, z * 0.035 - 1.7, 3);
    const n2 = fbm2D(x * 0.08 - 5.2, z * 0.08 + 4.4, 2);

    const mountainRing = smoothstep(23, 62, r) * (16.5 + n1 * 9.8 + Math.abs(n2) * 5.2);
    const rollingHills = plateauBlend * (n1 * 2.6 + n2 * 0.9);

    let h = rollingHills + mountainRing;

    const rz = riverCenterZ(x);
    const distRiver = Math.abs(z - rz);
    const riverMask = 1 - smoothstep(2.6, 7.2, distRiver);
    const bridgeClear = smoothstep(12.5, 16.5, r);
    h = h * (1 - riverMask * 0.85 * bridgeClear) - riverMask * 2.35 * bridgeClear;

    const roadDist = Math.abs(x + 2.0);
    if (z > 8 && z < 44 && roadDist < 4.5) {
      const roadFlatten = 1 - smoothstep(1.8, 4.5, roadDist);
      if (distRiver > 4.2) {
        h *= 1 - roadFlatten * 0.65;
      }
    }

    return h;
  }

  if (biome === 'coastal') {
    const coastCoord = x * 0.68 + z * 0.73 + fbm2D(x * 0.055, z * 0.055, 2) * 6.5;
    const plateauMask = 1 - smoothstep(12.0, 16.5, r);

    const seaBlend = smoothstep(13.5, 23.5, coastCoord);
    const n1 = fbm2D(x * 0.04 + 7.2, z * 0.04 + 2.8, 3);

    const inlandFactor = smoothstep(16.0, 52.0, r) * (1 - smoothstep(2.0, 16.0, coastCoord));
    let h = inlandFactor * (14.5 + n1 * 7.5);

    h = h * (1 - seaBlend) + (-4.2 + n1 * 0.8) * seaBlend;

    const isl1 = Math.hypot(x - 38, z - 28);
    const isl2 = Math.hypot(x - 24, z - 44);
    const isl3 = Math.hypot(x - 52, z - 6);
    const islandBoost =
      (1 - smoothstep(4, 13, isl1)) * (7.2 + n1 * 2.5) +
      (1 - smoothstep(3.5, 11, isl2)) * (5.9 + n1 * 2.0) +
      (1 - smoothstep(5, 15, isl3)) * (7.8 + n1 * 2.8);
    h += islandBoost;

    h = h * (1 - plateauMask);
    return h;
  }

  if (biome === 'arctic') {
    const plateauBlend = smoothstep(14.0, 21.5, r);
    const n1 = fbm2D(x * 0.036 + 5.7, z * 0.036 - 4.2, 3);
    const n2 = fbm2D(x * 0.085 - 2.3, z * 0.085 + 6.1, 2);

    // Jagged glacial peaks ringing the snow plateau
    const ridgeNoise = Math.abs(n1) * 10.5 + Math.abs(n2) * 5.8;
    const glacierRing = smoothstep(23.0, 58.0, r) * (14.5 + ridgeNoise);
    let h = plateauBlend * (n1 * 2.1 + n2 * 0.75) + glacierRing;

    // Frozen Arctic Fjord cutting along the East/South-East edge
    const fjordCoord = x * 0.74 + z * 0.67 + fbm2D(x * 0.05, z * 0.05, 2) * 5.2;
    const fjordBlend = smoothstep(17.5, 26.0, fjordCoord) * smoothstep(13.8, 18.0, r);
    h = h * (1 - fjordBlend) + (-3.4 + n2 * 0.35) * fjordBlend;

    // Snow-cleared northern ice runway strip
    if (Math.abs(z + 11.8) < 3.5 && Math.abs(x) < 20) {
      const stripMask = (1 - smoothstep(2.1, 3.5, Math.abs(z + 11.8))) * (1 - smoothstep(15, 20, Math.abs(x)));
      h *= 1 - stripMask;
    }

    return h;
  }

  // biome === 'desert'
  const plateauBlend = smoothstep(14.5, 22.5, r);
  const n1 = fbm2D(x * 0.032 - 4.1, z * 0.032 + 8.3, 3);
  const n2 = fbm2D(x * 0.075 + 1.5, z * 0.075 - 6.2, 2);

  const rawMesa = smoothstep(24, 58, r) * (15.8 + n1 * 8.8);
  const terraceStep = 3.4;
  const terraced =
    Math.floor(rawMesa / terraceStep) * terraceStep +
    smoothstep(0.35, 0.75, (rawMesa % terraceStep) / terraceStep) * terraceStep;

  let h = plateauBlend * (n1 * 1.4 + n2 * 0.6) + terraced;

  const canyonLine = x * 0.55 - z * 0.82 - 19 + Math.sin(x * 0.06) * 4.0;
  const canyonMask = (1 - smoothstep(2.8, 9.0, Math.abs(canyonLine))) * smoothstep(15.5, 21.0, r);
  h -= canyonMask * 4.4;

  if (Math.abs(z + 11.5) < 3.6 && Math.abs(x) < 22) {
    const stripMask = (1 - smoothstep(2.2, 3.6, Math.abs(z + 11.5))) * (1 - smoothstep(16, 22, Math.abs(x)));
    h *= 1 - stripMask;
  }

  return h;
}

/**
 * Checks whether (x, z) is valid flat buildable ground for a defense tower.
 */
export function isBuildableSpot(x: number, z: number, biome: MapBiome): boolean {
  const distToBase = Math.hypot(x, z);
  if (distToBase < 4.0 || distToBase > 33.5) return false;

  const h = getGroundHeight(x, z, biome);
  if ((biome === 'coastal' || biome === 'arctic') && h < -0.35) return false;
  if (biome === 'alpine' && h < -0.45) return false;
  if (Math.abs(h) > 1.65) return false;

  const hx = getGroundHeight(x + 1.0, z, biome);
  const hz = getGroundHeight(x, z + 1.0, biome);
  const slope = Math.max(Math.abs(hx - h), Math.abs(hz - h));
  if (slope > 0.45) return false;

  return true;
}

/**
 * Soft vertical-gradient volumetric cone texture for sweeping base searchlights.
 */
function createSearchlightBeamTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.54)');
  grad.addColorStop(0.25, 'rgba(225, 240, 255, 0.25)');
  grad.addColorStop(0.65, 'rgba(180, 215, 255, 0.08)');
  grad.addColorStop(1.0, 'rgba(160, 200, 255, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * High-Detail v2.0 Military Base Concrete Apron Texture (1024x1024):
 * Painted Helipad ("H"), weathered slab seams, tactical compass rings, and hazard chevrons.
 */
function createBasePadTexture(biome: MapBiome): THREE.CanvasTexture {
  const size = 1024;
  const cx = size / 2;
  const cy = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Base concrete surface
  ctx.fillStyle =
    biome === 'desert' ? '#403832' : biome === 'arctic' ? '#334659' : biome === 'coastal' ? '#25303e' : '#28323e';
  ctx.fillRect(0, 0, size, size);

  // Subtle weathered concrete noise speckles
  for (let i = 0; i < 1400; i++) {
    const nx = hash2(i, 1.9) * size;
    const ny = hash2(i, 7.3) * size;
    const r = 1 + hash2(i, 3.1) * 3.5;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.028)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(nx, ny, r, r);
  }

  // Crisp concrete expansion joints
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.32)';
  ctx.lineWidth = 3;
  for (let i = 96; i < size; i += 96) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  // Radial tactical apron ring + subtle darker asphalt wear band
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
  ctx.lineWidth = 42;
  ctx.beginPath();
  ctx.arc(cx, cy, 360, 0, Math.PI * 2);
  ctx.stroke();

  // Outer amber tactical warning ring (dashed)
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
  ctx.lineWidth = 8;
  ctx.setLineDash([28, 18]);
  ctx.beginPath();
  ctx.arc(cx, cy, 448, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Inner bunker safety boundary
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.36)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, 240, 0, Math.PI * 2);
  ctx.stroke();

  // Painted Helipad on the South-East quadrant of the apron
  const hx = cx + 195;
  const hy = cy + 195;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
  ctx.beginPath();
  ctx.arc(hx, hy, 88, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.72)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(hx, hy, 80, 0, Math.PI * 2);
  ctx.stroke();

  // Crisp "H" stencil inside helipad
  ctx.fillStyle = 'rgba(248, 250, 252, 0.72)';
  ctx.fillRect(hx - 34, hy - 38, 14, 76);
  ctx.fillRect(hx + 20, hy - 38, 14, 76);
  ctx.fillRect(hx - 34, hy - 7, 68, 14);

  // Cardinal compass ticks
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.78)';
  ctx.lineWidth = 7;
  const ticks = [
    [cx, 54, cx, 112],
    [cx, size - 112, cx, size - 54],
    [54, cy, 112, cy],
    [size - 112, cy, size - 54, cy],
  ];
  ticks.forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Builds Twilight Sky Dome, Glowing Moon Halo, Stars & Drifting Low-Poly Cloud Banks.
 */
function buildTwilightSky(cfg: BiomeConfig): {
  group: THREE.Group;
  cloudRing: THREE.Group;
  cloudMat: THREE.MeshStandardMaterial;
  cloudDayColor: THREE.Color;
  skyMat: THREE.MeshBasicMaterial;
  starMat: THREE.PointsMaterial;
  haloMat: THREE.MeshBasicMaterial;
  auroraRibbons: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; phase: number }[];
} {
  const skyGroup = new THREE.Group();

  const skyGeo = new THREE.SphereGeometry(235, 28, 18);
  const pos = skyGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const cZenith = new THREE.Color(cfg.skyZenith);
  const cMid = new THREE.Color(cfg.skyMid);
  const cHorizon = new THREE.Color(cfg.skyHorizon);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = Math.max(0, Math.min(1, (y + 18) / 210));
    if (t < 0.36) {
      tmpColor.copy(cHorizon).lerp(cMid, t / 0.36);
    } else {
      tmpColor.copy(cMid).lerp(cZenith, (t - 0.36) / 0.64);
    }
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const skyMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  skyGroup.add(new THREE.Mesh(skyGeo, skyMat));

  // Moon disc + subtle translucent twilight moon halo
  const moonColor = cfg.id === 'desert' ? 0xffe4c4 : 0xe2eeff;
  const moon = new THREE.Mesh(new THREE.CircleGeometry(6.8, 18), new THREE.MeshBasicMaterial({ color: moonColor, fog: false }));
  moon.position.set(-96, 86, -114);
  moon.lookAt(0, 0, 0);
  skyGroup.add(moon);

  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(16.5, 20),
    new THREE.MeshBasicMaterial({
      color: cfg.id === 'desert' ? 0xf59e0b : 0x60a5fa,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      fog: false,
      depthWrite: false,
    })
  );
  halo.position.set(-97, 86.5, -115);
  halo.lookAt(0, 0, 0);
  skyGroup.add(halo);

  // Upper-hemisphere twilight stars
  const starCount = 280;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = hash2(i, 1.3) * Math.PI * 2;
    const phi = 0.14 + hash2(i, 5.7) * 0.94;
    const rad = 212;
    starPositions[i * 3] = rad * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = rad * Math.cos(phi);
    starPositions[i * 3 + 2] = rad * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xdbeafe,
    size: 1.05,
    transparent: true,
    opacity: 0.74,
    fog: false,
    sizeAttenuation: true,
  });
  skyGroup.add(new THREE.Points(starGeo, starMat));

  // Drifting Faceted Low-Poly Twilight Cloud Ring (Single InstancedMesh = 1 draw call!)
  const cloudRing = new THREE.Group();
  const cloudPuffs: { x: number; y: number; z: number; sx: number; sy: number; sz: number; ry: number }[] = [];
  const cloudClusters = 16;
  for (let c = 0; c < cloudClusters; c++) {
    const baseAngle = (c / cloudClusters) * Math.PI * 2 + hash2(c, 4.1) * 0.35;
    const dist = 54 + hash2(c, 8.7) * 44;
    const cy = 28 + hash2(c, 12.3) * 14;
    const cx = Math.cos(baseAngle) * dist;
    const cz = Math.sin(baseAngle) * dist;
    const clusterScale = 2.8 + hash2(c, 19.4) * 3.0;

    // 3 overlapping low-poly puffs per cloud cluster
    for (let p = 0; p < 3; p++) {
      const offX = (p - 1) * clusterScale * 0.95;
      const offY = p === 1 ? clusterScale * 0.25 : -clusterScale * 0.08;
      const offZ = (hash2(c * 3 + p, 27.1) - 0.5) * clusterScale * 0.7;
      cloudPuffs.push({
        x: cx + offX,
        y: cy + offY,
        z: cz + offZ,
        sx: clusterScale * (p === 1 ? 1.25 : 0.85),
        sy: clusterScale * (p === 1 ? 0.45 : 0.34),
        sz: clusterScale * (0.7 + hash2(c * 3 + p, 31.4) * 0.3),
        ry: baseAngle,
      });
    }
  }

  const cloudGeo = new THREE.DodecahedronGeometry(1.0, 0);
  const cloudColor =
    cfg.id === 'desert' ? 0x6b4b54 : cfg.id === 'arctic' ? 0x3b6078 : cfg.id === 'coastal' ? 0x2f4b6e : 0x3a5275;
  const cloudMat = new THREE.MeshStandardMaterial({
    color: cloudColor,
    roughness: 0.95,
    metalness: 0.02,
    flatShading: true,
    transparent: true,
    opacity: 0.52,
  });
  const cloudInst = new THREE.InstancedMesh(cloudGeo, cloudMat, cloudPuffs.length);
  cloudInst.frustumCulled = false;
  const dummy = new THREE.Object3D();
  cloudPuffs.forEach((p, idx) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, p.ry, 0);
    dummy.scale.set(p.sx, p.sy, p.sz);
    dummy.updateMatrix();
    cloudInst.setMatrixAt(idx, dummy.matrix);
  });
  cloudInst.instanceMatrix.needsUpdate = true;
  cloudRing.add(cloudInst);
  skyGroup.add(cloudRing);

  // Polar Emerald-Cyan Aurora Borealis Ribbons for Arctic Ice Fortress
  const auroraRibbons: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; phase: number }[] = [];
  if (cfg.id === 'arctic') {
    const ribbonConfigs = [
      { rad: 158, height: 34, y: 62, color: 0x34d399, opacity: 0.22, rotY: 0.3, phase: 0 },
      { rad: 146, height: 26, y: 74, color: 0x22d3ee, opacity: 0.18, rotY: 2.1, phase: 1.8 },
    ];
    ribbonConfigs.forEach((rc) => {
      const geo = new THREE.CylinderGeometry(rc.rad, rc.rad * 1.04, rc.height, 28, 1, true, 0, Math.PI * 1.15);
      const posAttr = geo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const vz = posAttr.getZ(i);
        const wave = Math.sin(Math.atan2(vz, vx) * 4.0 + rc.phase) * 7.5;
        posAttr.setY(i, vy + wave);
      }
      const mat = new THREE.MeshBasicMaterial({
        color: rc.color,
        transparent: true,
        opacity: rc.opacity,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
        fog: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = rc.y;
      mesh.rotation.y = rc.rotY;
      skyGroup.add(mesh);
      auroraRibbons.push({ mesh, mat, phase: rc.phase });
    });
  }

  return {
    group: skyGroup,
    cloudRing,
    cloudMat,
    cloudDayColor: new THREE.Color(cloudColor),
    skyMat,
    starMat,
    haloMat: halo.material as THREE.MeshBasicMaterial,
    auroraRibbons,
  };
}

/**
 * Builds faceted Low-Poly Terrain Mesh with richer elevation/slope vertex colors.
 */
function buildLowPolyTerrain(biome: MapBiome): THREE.Mesh {
  const size = 260;
  const segs = 78;
  const baseGeo = new THREE.PlaneGeometry(size, size, segs, segs);
  baseGeo.rotateX(-Math.PI / 2);

  const pos = baseGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let z = pos.getZ(i);
    const r = Math.hypot(x, z);

    if (r > 13.5) {
      const jAmt = Math.min(0.85, (r - 13.5) * 0.045);
      x += (hash2(i * 0.37, 1.1) - 0.5) * jAmt;
      z += (hash2(i * 0.71, 2.9) - 0.5) * jAmt;
    }

    const y = getGroundHeight(x, z, biome);
    pos.setXYZ(i, x, y, z);
  }

  const geo = baseGeo.toNonIndexed();
  baseGeo.dispose();
  geo.computeVertexNormals();

  const fPos = geo.attributes.position;
  const fNorm = geo.attributes.normal;
  const colors = new Float32Array(fPos.count * 3);
  const c = new THREE.Color();

  for (let i = 0; i < fPos.count; i += 3) {
    const cx = (fPos.getX(i) + fPos.getX(i + 1) + fPos.getX(i + 2)) / 3;
    const cy = (fPos.getY(i) + fPos.getY(i + 1) + fPos.getY(i + 2)) / 3;
    const cz = (fPos.getZ(i) + fPos.getZ(i + 1) + fPos.getZ(i + 2)) / 3;
    const ny = (fNorm.getY(i) + fNorm.getY(i + 1) + fNorm.getY(i + 2)) / 3;
    const dist = Math.hypot(cx, cz);
    const faceJitter = (hash2(Math.floor(cx * 2), Math.floor(cz * 2)) - 0.5) * 0.06;

    if (biome === 'alpine') {
      if (dist < 13.8 && Math.abs(cy) < 0.25) {
        c.setHex(dist < 9.5 ? 0x2d383d : 0x2a3e36);
      } else if (cy < -0.95) {
        c.setHex(0x273540);
      } else if (cy < 0.25) {
        c.setHex(0x2a483a);
      } else if (cy > 10.6 && ny > 0.58) {
        c.setHex(0xb8cde0);
      } else if (ny < 0.72 || cy > 5.8) {
        c.setHex(0x3f4c5c);
      } else {
        c.setHex(0x243f35);
      }
    } else if (biome === 'coastal') {
      if (dist < 13.0 && Math.abs(cy) < 0.25) {
        c.setHex(0x303c4a);
      } else if (cy < -1.8) {
        c.setHex(0x1a2f40);
      } else if (cy < -0.3) {
        c.setHex(0x756c5c);
      } else if (ny < 0.74) {
        c.setHex(0x3d4754);
      } else if (cy > 6.5) {
        c.setHex(0x525e6e);
      } else {
        c.setHex(0x2d4a3f);
      }
    } else if (biome === 'arctic') {
      if (dist < 13.8 && Math.abs(cy) < 0.25) {
        c.setHex(dist < 9.5 ? 0x455a6e : 0x8ea9bd);
      } else if (cy < -1.1) {
        c.setHex(0x16394f);
      } else if (cy < -0.25) {
        c.setHex(0x4d8299);
      } else if (ny < 0.72) {
        c.setHex(cy > 6.5 ? 0x5c7d94 : 0x354b5e);
      } else if (cy > 8.5) {
        c.setHex(0xdcecf7);
      } else {
        c.setHex(0xb3cede);
      }
    } else {
      if (dist < 13.8 && Math.abs(cy) < 0.25) {
        c.setHex(0x614e3f);
      } else if (cy < -1.2) {
        c.setHex(0x4a3126);
      } else if (ny < 0.76) {
        const band = Math.floor(Math.abs(cy) * 0.7) % 3;
        c.setHex(band === 0 ? 0x874e36 : band === 1 ? 0x6b3e2c : 0x995f42);
      } else if (cy > 8.0) {
        c.setHex(0xa6734e);
      } else {
        c.setHex(0x885f3f);
      }
    }

    c.offsetHSL(0, 0, faceJitter);
    for (let k = 0; k < 3; k++) {
      colors[(i + k) * 3] = c.r;
      colors[(i + k) * 3 + 1] = c.g;
      colors[(i + k) * 3 + 2] = c.b;
    }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.04,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  (mesh as unknown as { isGround: boolean }).isGround = true;
  return mesh;
}

/**
 * Helper: Builds a crisp Low-Poly Military Supply Truck (for base compound & alpine bridge road).
 */
function buildMilitaryTruck(biome: MapBiome): THREE.Group {
  const truck = new THREE.Group();
  const bodyHex = biome === 'desert' ? 0x9a8262 : biome === 'arctic' ? 0x94a9bc : 0x3b4d3e;
  const cabMat = new THREE.MeshStandardMaterial({ color: bodyHex, roughness: 0.65, metalness: 0.2, flatShading: true });
  const tarpMat = new THREE.MeshStandardMaterial({
    color: biome === 'desert' ? 0x7c6950 : biome === 'arctic' ? 0xcbe0ee : 0x2c3b30,
    roughness: 0.85,
    flatShading: true,
  });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x181c22, roughness: 0.9 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.32, 2.7), wheelMat);
  chassis.position.y = 0.34;
  truck.add(chassis);

  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.72, 0.95), cabMat);
  cab.position.set(0, 0.76, 0.82);
  cab.castShadow = true;
  truck.add(cab);

  const cargo = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.92, 1.68), tarpMat);
  cargo.position.set(0, 0.92, -0.5);
  cargo.castShadow = true;
  truck.add(cargo);

  const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.22, 6);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const wx of [-0.56, 0.56]) {
    for (const wz of [-0.85, 0.0, 0.85]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(wx, 0.24, wz);
      truck.add(w);
    }
  }

  for (const lx of [-0.34, 0.34]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.06), headMat);
    lamp.position.set(lx, 0.56, 1.32);
    truck.add(lamp);
  }
  return truck;
}

/**
 * Builds 4 Perimeter Low-Poly Searchlight Towers with sweeping twilight volumetric cones.
 */
function buildSearchlightTowers(
  biome: MapBiome,
  beamColor: number
): {
  group: THREE.Group;
  beamMat: THREE.MeshBasicMaterial;
  heads: { pivot: THREE.Group; wx: number; wy: number; wz: number; baseYaw: number; speed: number; phase: number }[];
} {
  const group = new THREE.Group();
  const heads: { pivot: THREE.Group; wx: number; wy: number; wz: number; baseYaw: number; speed: number; phase: number }[] = [];

  const coords: [number, number, number][] =
    biome === 'coastal'
      ? [
          [-10.5, -9.5, 0.6],
          [9.5, -10.0, -0.6],
          [-10.5, 9.5, 2.3],
          [5.5, 9.5, -2.1],
        ]
      : [
          [-11.0, -11.0, 0.75],
          [11.0, -11.0, -0.75],
          [-11.0, 11.0, 2.35],
          [11.0, 11.0, -2.35],
        ];

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.55,
    metalness: 0.65,
    flatShading: true,
  });
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.85,
    metalness: 0.1,
    flatShading: true,
  });
  const lensMat = new THREE.MeshBasicMaterial({ color: beamColor });

  const beamTex = createSearchlightBeamTexture();
  const beamGeo = new THREE.ConeGeometry(4.0, 48, 12, 1, true);
  beamGeo.translate(0, -24, 0);
  beamGeo.rotateX(Math.PI);

  const beamMat = new THREE.MeshBasicMaterial({
    color: beamColor,
    map: beamTex,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  coords.forEach(([x, z, baseYaw], idx) => {
    const y = getGroundHeight(x, z, biome);
    const tower = new THREE.Group();
    tower.position.set(x, y, z);

    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.2, 0.5, 6), concreteMat);
    pad.position.y = 0.25;
    pad.castShadow = true;
    pad.receiveShadow = true;
    tower.add(pad);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.55, 2.6, 4), steelMat);
    mast.position.y = 1.75;
    mast.castShadow = true;
    tower.add(mast);

    const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.55, 0.22, 6), steelMat);
    deck.position.y = 3.1;
    tower.add(deck);

    const pivot = new THREE.Group();
    pivot.position.y = 3.45;
    tower.add(pivot);

    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.65, 8), steelMat);
    housing.rotation.x = 0.25;
    pivot.add(housing);

    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.36, 8), lensMat);
    lens.position.set(0, 0.33, 0.08);
    lens.rotation.x = -Math.PI / 2 + 0.25;
    pivot.add(lens);

    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, 0.3, 0.08);
    pivot.add(beam);

    const warn = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    );
    warn.position.set(0.48, 3.25, 0);
    tower.add(warn);

    heads.push({
      pivot,
      wx: x,
      wy: y + 3.45,
      wz: z,
      baseYaw,
      speed: 0.32 + idx * 0.07,
      phase: idx * 1.65,
    });
    group.add(tower);
  });

  return { group, beamMat, heads };
}

/**
 * Builds v2.0 High-Detail Central Military Compound:
 * 1024px Helipad Apron, Instanced T-Wall Perimeter Barriers, Hangar, Fuel Silos,
 * Tall Radio Comms Mast, Generator Array, and Parked Military Trucks.
 */
function buildBaseStructures(biome: MapBiome): { group: THREE.Group; blinkingBeacons: THREE.MeshBasicMaterial[] } {
  const baseGroup = new THREE.Group();
  const blinkingBeacons: THREE.MeshBasicMaterial[] = [];

  // 1. High-Res Central Octagonal Concrete Defense Apron with Painted Helipad
  const padTex = createBasePadTexture(biome);
  const padMat = new THREE.MeshStandardMaterial({
    map: padTex,
    roughness: 0.84,
    metalness: 0.12,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const padMesh = new THREE.Mesh(new THREE.CylinderGeometry(9.8, 10.35, 0.14, 8), padMat);
  padMesh.position.y = 0.07;
  padMesh.receiveShadow = true;
  baseGroup.add(padMesh);

  // 2. Instanced Perimeter Concrete Blast T-Walls around base compound (1 draw call!)
  const wallPositions: { x: number; y: number; z: number; rot: number }[] = [];
  for (let i = 0; i < 24; i++) {
    // Leave clean gaps at cardinal roads & coastal pier entry
    if (i % 6 === 0) continue;
    const a = (i / 24) * Math.PI * 2;
    const r = 10.2;
    const wx = Math.cos(a) * r;
    const wz = Math.sin(a) * r;
    const wy = getGroundHeight(wx, wz, biome);
    if (wy < -0.25) continue;
    wallPositions.push({ x: wx, y: wy, z: wz, rot: -a + Math.PI / 2 });
  }
  if (wallPositions.length > 0) {
    const wallGeo = new THREE.BoxGeometry(1.75, 0.82, 0.34);
    const wallMat = new THREE.MeshStandardMaterial({
      color: biome === 'desert' ? 0x7a6a58 : 0x475569,
      roughness: 0.88,
      metalness: 0.08,
      flatShading: true,
    });
    const wallInst = new THREE.InstancedMesh(wallGeo, wallMat, wallPositions.length);
    wallInst.receiveShadow = true;
    const dummy = new THREE.Object3D();
    wallPositions.forEach((p, idx) => {
      dummy.position.set(p.x, p.y + 0.41, p.z);
      dummy.rotation.set(0, p.rot, 0);
      dummy.updateMatrix();
      wallInst.setMatrixAt(idx, dummy.matrix);
    });
    wallInst.instanceMatrix.needsUpdate = true;
    wallInst.computeBoundingSphere();
    baseGroup.add(wallInst);
  }

  // 3. Perimeter Amber Beacon Posts (Instanced)
  const postGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.58, 5);
  const bulbGeo = new THREE.SphereGeometry(0.13, 6, 6);
  const beaconPostMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.5 });
  const amberGlowMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
  const postInst = new THREE.InstancedMesh(postGeo, beaconPostMat, 8);
  const bulbInst = new THREE.InstancedMesh(bulbGeo, amberGlowMat, 8);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const bx = Math.cos(a) * 9.35;
    const bz = Math.sin(a) * 9.35;
    dummy.position.set(bx, 0.32, bz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    postInst.setMatrixAt(i, dummy.matrix);
    dummy.position.set(bx, 0.65, bz);
    dummy.updateMatrix();
    bulbInst.setMatrixAt(i, dummy.matrix);
  }
  postInst.instanceMatrix.needsUpdate = true;
  bulbInst.instanceMatrix.needsUpdate = true;
  baseGroup.add(postInst, bulbInst);

  // 4. Armored Military Hangar (North-West flank) + Parked Command Truck
  const hangar = new THREE.Group();
  const hx = -11.8;
  const hz = -3.0;
  hangar.position.set(hx, getGroundHeight(hx, hz, biome), hz);
  hangar.rotation.y = Math.PI / 2;

  const hangarWallMat = new THREE.MeshStandardMaterial({
    color: biome === 'desert' ? 0x7c6a56 : 0x3b4858,
    roughness: 0.72,
    metalness: 0.28,
    flatShading: true,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: biome === 'desert' ? 0x5c4f41 : 0x263140,
    roughness: 0.58,
    metalness: 0.45,
    flatShading: true,
  });
  const warmWinMat = new THREE.MeshBasicMaterial({ color: 0xfde68a });

  const hBody = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.0, 3.4), hangarWallMat);
  hBody.position.y = 1.0;
  hBody.castShadow = true;
  hBody.receiveShadow = true;
  hangar.add(hBody);

  const hRoof = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 4.7, 6, 1, false, 0, Math.PI), roofMat);
  hRoof.rotation.z = Math.PI / 2;
  hRoof.position.y = 1.95;
  hRoof.castShadow = true;
  hangar.add(hRoof);

  const bayDoor = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.3), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
  bayDoor.position.set(0, 0.68, 1.72);
  hangar.add(bayDoor);

  for (let w = -1.3; w <= 1.3; w += 1.3) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.34), warmWinMat);
    win.position.set(w, 1.4, -1.72);
    win.rotation.y = Math.PI;
    hangar.add(win);
  }
  baseGroup.add(hangar);

  const parkedTruck = buildMilitaryTruck(biome);
  const tx = -9.6;
  const tz = 1.8;
  parkedTruck.position.set(tx, getGroundHeight(tx, tz, biome), tz);
  parkedTruck.rotation.y = 0.45;
  baseGroup.add(parkedTruck);

  // 5. Twin Fuel Silos + Solar/Generator Substation (North-East flank)
  const siloMat = new THREE.MeshStandardMaterial({
    color: biome === 'desert' ? 0x9c8971 : 0x64748b,
    roughness: 0.48,
    metalness: 0.5,
    flatShading: true,
  });
  const sx = 11.4;
  const sz = -2.6;
  const sy = getGroundHeight(sx, sz, biome);
  for (let k = 0; k < 2; k++) {
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 2.3, 8), siloMat);
    silo.position.set(sx, sy + 1.15, sz + k * 2.35);
    silo.castShadow = true;
    silo.receiveShadow = true;
    baseGroup.add(silo);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 0.35, 8), roofMat);
    cap.position.set(sx, sy + 2.45, sz + k * 2.35);
    baseGroup.add(cap);
  }

  // Tall Red/White Communications Radio Mast behind hangar
  const mastGroup = new THREE.Group();
  const mx = -10.8;
  const mz = -7.2;
  mastGroup.position.set(mx, getGroundHeight(mx, mz, biome), mz);
  const mastRedMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.55, metalness: 0.4, flatShading: true });
  const mastWhiteMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.55, metalness: 0.3, flatShading: true });
  for (let seg = 0; seg < 4; seg++) {
    const rTop = 0.28 - seg * 0.05;
    const rBot = 0.33 - seg * 0.05;
    const piece = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, 1.55, 4), seg % 2 === 0 ? mastRedMat : mastWhiteMat);
    piece.position.y = 0.78 + seg * 1.55;
    mastGroup.add(piece);
  }
  const radioStrobeMat = new THREE.MeshBasicMaterial({ color: 0xff2a55 });
  blinkingBeacons.push(radioStrobeMat);
  const radioStrobe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), radioStrobeMat);
  radioStrobe.position.y = 6.35;
  mastGroup.add(radioStrobe);
  baseGroup.add(mastGroup);

  return { group: baseGroup, blinkingBeacons };
}

/**
 * Populates Instanced Low-Poly Pine Trees (for Alpine and Coastal inland).
 */
function buildInstancedPines(biome: MapBiome, targetCount: number): THREE.Group {
  const treeGroup = new THREE.Group();
  const positions: { x: number; y: number; z: number; scale: number; rot: number; tint: number }[] = [];

  for (let attempt = 0; attempt < targetCount * 6 && positions.length < targetCount; attempt++) {
    const angle = hash2(attempt, 11.3) * Math.PI * 2;
    const rad = 16.8 + hash2(attempt, 23.7) * 58.0;
    const x = Math.cos(angle) * rad;
    const z = Math.sin(angle) * rad;
    const y = getGroundHeight(x, z, biome);

    if (biome === 'alpine') {
      const distRiver = Math.abs(z - riverCenterZ(x));
      if (distRiver < 5.5) continue;
      if (z > 8 && z < 44 && Math.abs(x + 2.0) < 4.8) continue;
      if (y < -0.2 || y > 10.2) continue;
    } else if (biome === 'coastal') {
      if (y < 0.35 || y > 8.5) continue;
    }

    positions.push({
      x,
      y,
      z,
      scale: 0.74 + hash2(attempt, 37.1) * 0.75,
      rot: hash2(attempt, 51.9) * Math.PI * 2,
      tint: hash2(attempt, 67.3),
    });
  }

  const count = positions.length;
  if (count === 0) return treeGroup;

  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 1.0, 5);
  trunkGeo.translate(0, 0.5, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3b2c22, roughness: 0.92, flatShading: true });

  const tier1Geo = new THREE.ConeGeometry(1.15, 1.9, 6);
  tier1Geo.translate(0, 1.75, 0);
  const tier2Geo = new THREE.ConeGeometry(0.88, 1.7, 6);
  tier2Geo.translate(0, 2.75, 0);
  const tier3Geo = new THREE.ConeGeometry(0.55, 1.35, 6);
  tier3Geo.translate(0, 3.6, 0);

  const leafMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0.04,
    flatShading: true,
  });

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const tier1 = new THREE.InstancedMesh(tier1Geo, leafMat, count);
  const tier2 = new THREE.InstancedMesh(tier2Geo, leafMat, count);
  const tier3 = new THREE.InstancedMesh(tier3Geo, leafMat, count);

  tier1.castShadow = true;
  tier1.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  positions.forEach((p, idx) => {
    dummy.position.set(p.x, p.y - 0.12, p.z);
    dummy.rotation.set(0, p.rot, 0);
    dummy.scale.set(p.scale, p.scale * (0.92 + p.tint * 0.22), p.scale);
    dummy.updateMatrix();

    trunks.setMatrixAt(idx, dummy.matrix);
    tier1.setMatrixAt(idx, dummy.matrix);
    tier2.setMatrixAt(idx, dummy.matrix);
    tier3.setMatrixAt(idx, dummy.matrix);

    color.setHex(p.tint > 0.65 ? 0x1d3f35 : p.tint > 0.3 ? 0x264c3f : 0x1a362f);
    tier1.setColorAt(idx, color);
    color.offsetHSL(0, 0.02, 0.03);
    tier2.setColorAt(idx, color);
    color.offsetHSL(0, 0.02, 0.05);
    tier3.setColorAt(idx, color);
  });

  [trunks, tier1, tier2, tier3].forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    treeGroup.add(mesh);
  });

  return treeGroup;
}

/**
 * Populates Instanced Faceted Low-Poly Boulders / Sandstone Spires.
 */
function buildInstancedRocks(biome: MapBiome, targetCount: number): THREE.InstancedMesh | null {
  const placements: { x: number; y: number; z: number; sx: number; sy: number; sz: number; ry: number; rx: number; shade: number }[] = [];

  for (let attempt = 0; attempt < targetCount * 5 && placements.length < targetCount; attempt++) {
    const angle = hash2(attempt, 91.2) * Math.PI * 2;
    const rad = 15.8 + hash2(attempt, 103.4) * 56.0;
    const x = Math.cos(angle) * rad;
    const z = Math.sin(angle) * rad;
    const y = getGroundHeight(x, z, biome);

    if (biome === 'coastal' && y < -1.2) continue;
    if (biome === 'desert' && Math.abs(z + 12.0) < 5.0 && Math.abs(x) < 23) continue;

    const base = 0.65 + hash2(attempt, 127.8) * 1.65;
    placements.push({
      x,
      y,
      z,
      sx: base * (0.8 + hash2(attempt, 131.1) * 0.6),
      sy: base * (biome === 'desert' ? 0.95 + hash2(attempt, 139.3) * 1.25 : 0.55 + hash2(attempt, 139.3) * 0.7),
      sz: base * (0.8 + hash2(attempt, 149.7) * 0.6),
      ry: hash2(attempt, 163.2) * Math.PI * 2,
      rx: (hash2(attempt, 173.9) - 0.5) * 0.45,
      shade: hash2(attempt, 191.5),
    });
  }

  if (placements.length === 0) return null;

  const geo = new THREE.DodecahedronGeometry(1.0, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.05,
    flatShading: true,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, placements.length);
  mesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const c = new THREE.Color();

  placements.forEach((p, i) => {
    dummy.position.set(p.x, p.y + p.sy * 0.25, p.z);
    dummy.rotation.set(p.rx, p.ry, 0);
    dummy.scale.set(p.sx, p.sy, p.sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    if (biome === 'desert') {
      c.setHex(p.shade > 0.5 ? 0x854f36 : 0x663d2c);
    } else if (biome === 'arctic') {
      c.setHex(p.shade > 0.65 ? 0xc8e7f5 : p.shade > 0.3 ? 0x6ba7c4 : 0x3c586e);
    } else if (biome === 'coastal') {
      c.setHex(p.shade > 0.5 ? 0x485260 : 0x36404d);
    } else {
      c.setHex(p.shade > 0.5 ? 0x4f5c6b : 0x3d4857);
    }
    c.offsetHSL(0, 0, (p.shade - 0.5) * 0.05);
    mesh.setColorAt(i, c);
  });

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/**
 * Biome-Specific Hero v2.0 Set-Pieces & Animated Landmarks!
 */
function buildBiomeLandmarks(biome: MapBiome): {
  group: THREE.Group;
  waterMesh?: THREE.Mesh;
  waterBaseY?: Float32Array;
  bobbingShips: { ship: THREE.Group; baseY: number; phase: number }[];
  spinners: { obj: THREE.Object3D; speed: number }[];
  lighthouseBeam?: THREE.Group;
  shoreFoamMat?: THREE.MeshBasicMaterial;
  blinkingMats: THREE.MeshBasicMaterial[];
} {
  const group = new THREE.Group();
  const bobbingShips: { ship: THREE.Group; baseY: number; phase: number }[] = [];
  const spinners: { obj: THREE.Object3D; speed: number }[] = [];
  const blinkingMats: THREE.MeshBasicMaterial[] = [];

  if (biome === 'alpine') {
    // 1. Winding Alpine River water surface + foaming rapids highlights
    const riverGeo = new THREE.PlaneGeometry(224, 24, 52, 6);
    riverGeo.rotateX(-Math.PI / 2);
    const rPos = riverGeo.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      const rx = rPos.getX(i);
      const rz = rPos.getZ(i);
      rPos.setZ(i, rz + riverCenterZ(rx));
    }
    const nonIdxRiver = riverGeo.toNonIndexed();
    riverGeo.dispose();
    nonIdxRiver.computeVertexNormals();

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1b4c6b,
      roughness: 0.2,
      metalness: 0.48,
      flatShading: true,
      transparent: true,
      opacity: 0.92,
    });
    const waterMesh = new THREE.Mesh(nonIdxRiver, waterMat);
    waterMesh.position.y = -1.15;
    waterMesh.receiveShadow = true;
    group.add(waterMesh);

    // Instanced river rapids white foam dashes
    const foamGeo = new THREE.PlaneGeometry(2.6, 0.35);
    foamGeo.rotateX(-Math.PI / 2);
    const foamMat = new THREE.MeshBasicMaterial({ color: 0xcbe9ff, transparent: true, opacity: 0.38, depthWrite: false });
    const foamInst = new THREE.InstancedMesh(foamGeo, foamMat, 22);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 22; i++) {
      const fx = -52 + i * 5.0;
      const fz = riverCenterZ(fx) + (hash2(i, 4.4) - 0.5) * 3.0;
      dummy.position.set(fx, -1.08, fz);
      dummy.rotation.set(0, Math.cos(fx * 0.065) * 0.28, 0);
      dummy.scale.setScalar(0.8 + hash2(i, 9.2) * 0.6);
      dummy.updateMatrix();
      foamInst.setMatrixAt(i, dummy.matrix);
    }
    foamInst.instanceMatrix.needsUpdate = true;
    group.add(foamInst);

    // 2. Upgraded Steel Truss Arch Military Bridge + Supply Road + Convoy Truck
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x262e38,
      roughness: 0.88,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const roadSegment1 = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 9.0), roadMat);
    roadSegment1.position.set(-2.0, 0.04, 11.4);
    roadSegment1.receiveShadow = true;
    group.add(roadSegment1);

    const bridgeZ = riverCenterZ(-2.0);
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8, flatShading: true });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.62, roughness: 0.4, flatShading: true });

    const bridgeDeck = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.38, 12.2), concreteMat);
    bridgeDeck.position.set(-2.0, 0.28, bridgeZ);
    bridgeDeck.castShadow = true;
    bridgeDeck.receiveShadow = true;
    group.add(bridgeDeck);

    // Twin overhead steel truss arches along bridge flanks
    const lampGlow = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    for (const side of [-1.75, 1.75]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 11.8), steelMat);
      rail.position.set(-2.0 + side, 0.72, bridgeZ);
      group.add(rail);

      // Steel truss arch frame
      const topChord = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 6.2), steelMat);
      topChord.position.set(-2.0 + side, 2.55, bridgeZ);
      group.add(topChord);

      for (const sgn of [-1, 1]) {
        const diag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 3.3), steelMat);
        diag.position.set(-2.0 + side, 1.65, bridgeZ + sgn * 4.2);
        diag.rotation.x = sgn * 0.65;
        group.add(diag);
      }

      for (const lz of [-4.2, 4.2]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.3, 5), steelMat);
        pole.position.set(-2.0 + side, 1.45, bridgeZ + lz);
        group.add(pole);

        const lightBulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), lampGlow);
        lightBulb.position.set(-2.0 + side, 2.65, bridgeZ + lz);
        group.add(lightBulb);
      }
    }
    // Overhead cross-beams connecting the two arches
    for (const cz of [-2.4, 0, 2.4]) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 0.16), steelMat);
      brace.position.set(-2.0, 2.55, bridgeZ + cz);
      group.add(brace);
    }

    // Parked convoy supply truck crossing the bridge
    const bridgeTruck = buildMilitaryTruck('alpine');
    bridgeTruck.position.set(-2.0, 0.48, bridgeZ - 1.2);
    bridgeTruck.rotation.y = Math.PI;
    group.add(bridgeTruck);

    // 3. Highland North Ridge Mountain Radar Outpost Cabin
    const ox = -18.5;
    const oz = -29.5;
    const oy = getGroundHeight(ox, oz, 'alpine');
    const outpost = new THREE.Group();
    outpost.position.set(ox, oy, oz);
    outpost.rotation.y = 0.55;

    const oBase = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.8, 3.2), concreteMat);
    oBase.position.y = 0.9;
    oBase.castShadow = true;
    outpost.add(oBase);

    const oRoof = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.28, 3.5), steelMat);
    oRoof.position.y = 1.9;
    outpost.add(oRoof);

    const oWin = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), new THREE.MeshBasicMaterial({ color: 0xfde68a }));
    oWin.position.set(0, 1.2, 1.62);
    outpost.add(oWin);

    const oRadarPivot = new THREE.Group();
    oRadarPivot.position.set(1.1, 2.55, 0);
    const oDish = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 0.12), new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4, metalness: 0.6 }));
    oRadarPivot.add(oDish);
    outpost.add(oRadarPivot);
    spinners.push({ obj: oRadarPivot, speed: 1.8 });

    group.add(outpost);

    return { group, waterMesh, bobbingShips, spinners, blinkingMats };
  }

  if (biome === 'coastal') {
    // 1. Low-Poly Animated Twilight Ocean (24x24 faceted grid)
    const oceanBase = new THREE.PlaneGeometry(268, 268, 24, 24);
    oceanBase.rotateX(-Math.PI / 2);
    const oceanGeo = oceanBase.toNonIndexed();
    oceanBase.dispose();
    oceanGeo.computeVertexNormals();

    const posArr = oceanGeo.attributes.position.array as Float32Array;
    const waterBaseY = new Float32Array(posArr.length / 3);
    for (let i = 0; i < waterBaseY.length; i++) {
      waterBaseY[i] = posArr[i * 3 + 1];
    }

    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0e3350,
      roughness: 0.18,
      metalness: 0.54,
      flatShading: true,
      transparent: true,
      opacity: 0.94,
    });
    const waterMesh = new THREE.Mesh(oceanGeo, oceanMat);
    waterMesh.position.y = -2.15;
    waterMesh.receiveShadow = true;
    group.add(waterMesh);

    // Animated translucent shoreline foam band along the beach slope
    const shoreFoamMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const foamStrip = new THREE.Mesh(new THREE.PlaneGeometry(46, 2.2), shoreFoamMat);
    foamStrip.rotation.x = -Math.PI / 2;
    foamStrip.rotation.z = Math.PI / 4;
    foamStrip.position.set(14.0, -1.96, 13.5);
    group.add(foamStrip);

    // 2. Concrete Naval Pier, Shipping Containers & Towering Harbor Gantry Crane
    const pierGroup = new THREE.Group();
    pierGroup.position.set(13.5, -1.35, 11.5);
    pierGroup.rotation.y = -Math.PI / 4;

    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85, flatShading: true });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.55, 15.2), concreteMat);
    deck.castShadow = true;
    deck.receiveShadow = true;
    pierGroup.add(deck);

    for (const px of [-2.2, 2.2]) {
      for (const pz of [-5.8, -1.8, 2.2, 6.2]) {
        const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 2.6, 6), concreteMat);
        piling.position.set(px, -1.3, pz);
        pierGroup.add(piling);
      }
    }

    const containerColors = [0x991b1b, 0x1d4ed8, 0xb45309, 0x0f766e];
    containerColors.forEach((col, i) => {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 1.1, 2.7),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.72, flatShading: true })
      );
      box.position.set(-1.45, i === 3 ? 1.92 : 0.82, -3.6 + (i % 3) * 3.0);
      box.castShadow = true;
      pierGroup.add(box);
    });

    // Iconic Harbor Gantry Crane straddling the pier!
    const craneYellowMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5, metalness: 0.45, flatShading: true });
    const craneGroup = new THREE.Group();
    craneGroup.position.set(0.3, 0.28, 1.5);
    for (const lx of [-1.8, 1.8]) {
      for (const lz of [-1.3, 1.3]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 5.4, 0.28), craneYellowMat);
        leg.position.set(lx, 2.7, lz);
        leg.castShadow = true;
        craneGroup.add(leg);
      }
    }
    const boom = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.45, 2.8), craneYellowMat);
    boom.position.set(1.2, 5.45, 0);
    boom.castShadow = true;
    craneGroup.add(boom);

    const craneCab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 1.2), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
    craneCab.position.set(2.4, 4.8, 0);
    craneGroup.add(craneCab);

    const craneWarnMat = new THREE.MeshBasicMaterial({ color: 0xff2a55 });
    blinkingMats.push(craneWarnMat);
    const craneBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), craneWarnMat);
    craneBeacon.position.set(5.3, 5.8, 0);
    craneGroup.add(craneBeacon);
    pierGroup.add(craneGroup);

    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    for (const lz of [-5.2, 0.4, 6.0]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 2.2, 5), concreteMat);
      post.position.set(2.3, 1.35, lz);
      pierGroup.add(post);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), lampMat);
      bulb.position.set(2.3, 2.5, lz);
      pierGroup.add(bulb);
    }
    group.add(pierGroup);

    // 3. Guided-Missile Frigate (with Spinning Mast Radar!) + Offshore Patrol Corvette
    const buildWarship = (scale: number): { vessel: THREE.Group; radarBar: THREE.Object3D } => {
      const ship = new THREE.Group();
      const hullMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.52, metalness: 0.45, flatShading: true });
      const superMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.48, metalness: 0.4, flatShading: true });

      const hull = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.0, 8.2), hullMat);
      hull.position.y = 0.42;
      hull.castShadow = true;
      ship.add(hull);

      const bow = new THREE.Mesh(new THREE.ConeGeometry(1.52, 2.8, 4), hullMat);
      bow.rotation.x = Math.PI / 2;
      bow.rotation.y = Math.PI / 4;
      bow.position.set(0, 0.48, 5.4);
      ship.add(bow);

      // Deck naval turret on foredeck
      const turret = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.55, 0.9), superMat);
      turret.position.set(0, 1.15, 3.1);
      ship.add(turret);

      const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.55, 2.5), superMat);
      bridge.position.set(0, 1.55, -0.3);
      bridge.castShadow = true;
      ship.add(bridge);

      const bridgeWin = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.36), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      bridgeWin.position.set(0, 1.82, 0.97);
      ship.add(bridgeWin);

      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 1.8, 5), superMat);
      mast.position.set(0, 3.1, -0.4);
      ship.add(mast);

      const radarBar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.16, 0.16), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.6 }));
      radarBar.position.set(0, 3.85, -0.4);
      ship.add(radarBar);

      const navLight = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      navLight.position.set(0, 4.15, -0.4);
      ship.add(navLight);

      ship.scale.setScalar(scale);
      return { vessel: ship, radarBar };
    };

    const frigate = buildWarship(1.05);
    frigate.vessel.position.set(22.0, -2.05, 18.2);
    frigate.vessel.rotation.y = -Math.PI / 4 + 0.15;
    group.add(frigate.vessel);
    bobbingShips.push({ ship: frigate.vessel, baseY: -2.05, phase: 0 });
    spinners.push({ obj: frigate.radarBar, speed: 2.3 });

    const corvette = buildWarship(0.76);
    corvette.vessel.position.set(34.5, -2.08, 7.5);
    corvette.vessel.rotation.y = -Math.PI * 0.65;
    group.add(corvette.vessel);
    bobbingShips.push({ ship: corvette.vessel, baseY: -2.08, phase: 2.1 });
    spinners.push({ obj: corvette.radarBar, speed: 3.0 });

    // 4. Coastal Radar Lighthouse on East Headland
    const lhX = 15.0;
    const lhZ = -9.0;
    const lhY = Math.max(-0.5, getGroundHeight(lhX, lhZ, biome));
    const lhGroup = new THREE.Group();
    lhGroup.position.set(lhX, lhY, lhZ);

    const lhTower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 1.25, 5.4, 8),
      new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.7, flatShading: true })
    );
    lhTower.position.y = 2.7;
    lhTower.castShadow = true;
    lhGroup.add(lhTower);

    const lhBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.08, 1.4, 8),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.7, flatShading: true })
    );
    lhBand.position.y = 2.9;
    lhGroup.add(lhBand);

    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.9, 8), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
    lantern.position.y = 5.85;
    lhGroup.add(lantern);

    const lhBeamGroup = new THREE.Group();
    lhBeamGroup.position.y = 5.85;
    const lhBeamTex = createSearchlightBeamTexture();
    const lhConeGeo = new THREE.ConeGeometry(2.8, 28, 10, 1, true);
    lhConeGeo.translate(0, -14, 0);
    lhConeGeo.rotateX(Math.PI / 2);
    const lhBeam = new THREE.Mesh(
      lhConeGeo,
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        map: lhBeamTex,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    lhBeamGroup.add(lhBeam);
    lhGroup.add(lhBeamGroup);
    group.add(lhGroup);

    return { group, waterMesh, waterBaseY, bobbingShips, spinners, lighthouseBeam: lhBeamGroup, shoreFoamMat, blinkingMats };
  }

  if (biome === 'arctic') {
    // 1. Frozen Arctic Bay Ice Sheet + Floating Glacial Icebergs
    const iceGeo = new THREE.PlaneGeometry(260, 260, 18, 18);
    iceGeo.rotateX(-Math.PI / 2);
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0x1e516b,
      roughness: 0.16,
      metalness: 0.45,
      flatShading: true,
      transparent: true,
      opacity: 0.92,
    });
    const waterMesh = new THREE.Mesh(iceGeo, iceMat);
    waterMesh.position.y = -1.75;
    waterMesh.receiveShadow = true;
    group.add(waterMesh);

    // Snow-Cleared Arctic Forward Airstrip Runway with Cyan Approach Beacons
    const runwayMat = new THREE.MeshStandardMaterial({
      color: 0x26323e,
      roughness: 0.86,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const runway = new THREE.Mesh(new THREE.BoxGeometry(34, 0.12, 5.0), runwayMat);
    runway.position.set(0, 0.06, -11.8);
    runway.receiveShadow = true;
    group.add(runway);

    const markMat = new THREE.MeshBasicMaterial({ color: 0xe2f5ff });
    for (let mx = -13; mx <= 13; mx += 4.0) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.24), markMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(mx, 0.14, -11.8);
      group.add(dash);
    }
    const cyanLampMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const emeraldLampMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
    const lampGeo = new THREE.SphereGeometry(0.14, 6, 6);
    for (let lx = -15.5; lx <= 15.5; lx += 3.85) {
      for (const lz of [-9.1, -14.5]) {
        const lamp = new THREE.Mesh(lampGeo, Math.abs(lx) > 12 ? emeraldLampMat : cyanLampMat);
        lamp.position.set(lx, 0.24, lz);
        group.add(lamp);
      }
    }

    // 2. Twin Geodesic Polar Radar Radome Outpost on West Glacier Ridge
    const domeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.38, metalness: 0.15, flatShading: true });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.55, metalness: 0.6, flatShading: true });
    const radomeCoords: [number, number, number][] = [
      [-19.5, -24.5, 2.35],
      [-24.2, -19.0, 1.75],
    ];
    radomeCoords.forEach(([rx, rz, rad]) => {
      const ry = getGroundHeight(rx, rz, 'arctic');
      const rGroup = new THREE.Group();
      rGroup.position.set(rx, ry, rz);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.85, rad * 1.05, 1.9, 8), steelMat);
      base.position.y = 0.95;
      base.castShadow = true;
      rGroup.add(base);
      const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(rad, 1), domeWhiteMat);
      dome.position.y = 1.9 + rad * 0.65;
      dome.castShadow = true;
      rGroup.add(dome);
      const strobeMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
      blinkingMats.push(strobeMat);
      const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), strobeMat);
      strobe.position.y = 1.9 + rad * 1.65;
      rGroup.add(strobe);
      group.add(rGroup);
    });

    // 3. Polar Heavy Icebreaker Vessel moored in the frozen eastern fjord
    const icebreaker = new THREE.Group();
    const hullRedMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.5, metalness: 0.35, flatShading: true });
    const superWhiteMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45, metalness: 0.25, flatShading: true });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.35, 9.4), hullRedMat);
    hull.position.y = 0.55;
    hull.castShadow = true;
    icebreaker.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.85, 3.1, 4), hullRedMat);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.position.set(0, 0.55, 6.1);
    icebreaker.add(bow);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(2.15, 2.05, 2.9), superWhiteMat);
    bridge.position.set(0, 2.15, -0.4);
    bridge.castShadow = true;
    icebreaker.add(bridge);
    const bridgeWin = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.44), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
    bridgeWin.position.set(0, 2.55, 1.07);
    icebreaker.add(bridgeWin);
    const radarBar = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.16, 0.16), steelMat);
    radarBar.position.set(0, 3.65, -0.4);
    icebreaker.add(radarBar);
    spinners.push({ obj: radarBar, speed: 2.1 });
    icebreaker.position.set(27.5, -1.65, 16.5);
    icebreaker.rotation.y = -Math.PI * 0.35;
    group.add(icebreaker);
    bobbingShips.push({ ship: icebreaker, baseY: -1.65, phase: 0.7 });

    // 4. Jagged Floating Glacial Icebergs in the fjord
    const bergGeo = new THREE.ConeGeometry(3.2, 6.2, 5);
    const bergMat = new THREE.MeshStandardMaterial({
      color: 0xa5e4f5,
      roughness: 0.28,
      metalness: 0.18,
      flatShading: true,
    });
    const bergCoords: [number, number, number][] = [
      [34, 29, 1.25],
      [21, 35, 0.9],
      [42, 8, 1.35],
      [38, -8, 0.85],
    ];
    bergCoords.forEach(([bx, bz, bs], idx) => {
      const berg = new THREE.Mesh(bergGeo, bergMat);
      berg.position.set(bx, -0.4, bz);
      berg.scale.set(bs, bs * (0.8 + (idx % 2) * 0.4), bs * 1.1);
      berg.rotation.y = idx * 1.3;
      berg.castShadow = true;
      group.add(berg);
    });

    return { group, waterMesh, bobbingShips, spinners, blinkingMats };
  }

  // biome === 'desert': Full Forward Operating Airbase (Runway, ATC Tower, Parked Stealth Fighter, Pipeline!)
  const runwayMat = new THREE.MeshStandardMaterial({
    color: 0x2b2724,
    roughness: 0.9,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const runway = new THREE.Mesh(new THREE.BoxGeometry(36, 0.12, 5.2), runwayMat);
  runway.position.set(0, 0.06, -12.0);
  runway.receiveShadow = true;
  group.add(runway);

  // Center runway dashed markings + threshold piano keys
  const markMat = new THREE.MeshBasicMaterial({ color: 0xe7e5e4 });
  for (let mx = -14; mx <= 14; mx += 4.0) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.25), markMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(mx, 0.14, -12.0);
    group.add(dash);
  }
  for (const endX of [-16.6, 16.6]) {
    for (let kz = -1.6; kz <= 1.6; kz += 0.8) {
      const key = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.32), markMat);
      key.rotation.x = -Math.PI / 2;
      key.position.set(endX, 0.14, -12.0 + kz);
      group.add(key);
    }
  }

  // Runway edge approach lights (Instanced spheres)
  const amberMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  const cyanMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const lampGeo = new THREE.SphereGeometry(0.14, 6, 6);
  for (let lx = -16.5; lx <= 16.5; lx += 3.65) {
    for (const lz of [-9.2, -14.8]) {
      const lamp = new THREE.Mesh(lampGeo, Math.abs(lx) > 13.5 ? cyanMat : amberMat);
      lamp.position.set(lx, 0.25, lz);
      group.add(lamp);
    }
  }

  // 2. Air Traffic Control (ATC) Tower beside the desert runway
  const atc = new THREE.Group();
  const ax = 12.8;
  const az = -17.2;
  atc.position.set(ax, getGroundHeight(ax, az, 'desert'), az);

  const sandConcreteMat = new THREE.MeshStandardMaterial({ color: 0x8f7962, roughness: 0.78, flatShading: true });
  const darkRoofMat = new THREE.MeshStandardMaterial({ color: 0x36312d, roughness: 0.55, metalness: 0.4, flatShading: true });
  const atcShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.35, 5.2, 6), sandConcreteMat);
  atcShaft.position.y = 2.6;
  atcShaft.castShadow = true;
  atc.add(atcShaft);

  const atcCab = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.3, 1.25, 8), new THREE.MeshBasicMaterial({ color: 0xfde68a }));
  atcCab.position.y = 5.6;
  atc.add(atcCab);

  const atcRoof = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.75, 0.35, 8), darkRoofMat);
  atcRoof.position.y = 6.35;
  atc.add(atcRoof);

  const atcRadarPivot = new THREE.Group();
  atcRadarPivot.position.y = 7.05;
  const atcDish = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.42, 0.14), new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.55, roughness: 0.4 }));
  atcRadarPivot.add(atcDish);
  atc.add(atcRadarPivot);
  spinners.push({ obj: atcRadarPivot, speed: 1.9 });
  group.add(atc);

  // 3. Blast-Shield Aircraft Revetment + Parked Low-Poly Stealth Fighter Jet!
  const jetGroup = new THREE.Group();
  const jx = -11.5;
  const jz = -17.4;
  jetGroup.position.set(jx, getGroundHeight(jx, jz, 'desert'), jz);
  jetGroup.rotation.y = 0.25;

  // U-shaped blast wall revetment
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.45, 0.45), sandConcreteMat);
  backWall.position.set(0, 0.72, -2.4);
  backWall.castShadow = true;
  jetGroup.add(backWall);
  for (const sx of [-2.8, 2.8]) {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.35, 4.4), sandConcreteMat);
    sideWall.position.set(sx, 0.68, -0.3);
    jetGroup.add(sideWall);
  }

  // Parked Low-Poly Stealth Fighter Jet
  const jetMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.65, flatShading: true });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0x92400e, emissiveIntensity: 0.45, roughness: 0.18, metalness: 0.8 });
  const jetFuse = new THREE.Mesh(new THREE.ConeGeometry(0.55, 4.2, 4), jetMat);
  jetFuse.rotation.x = Math.PI / 2;
  jetFuse.rotation.y = Math.PI / 4;
  jetFuse.position.set(0, 0.62, 0.2);
  jetFuse.castShadow = true;
  jetGroup.add(jetFuse);

  const jetWing = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 1.35), jetMat);
  jetWing.position.set(0, 0.56, -0.35);
  jetGroup.add(jetWing);

  for (const fx of [-0.48, 0.48]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.78, 0.82), jetMat);
    fin.position.set(fx, 0.96, -1.35);
    fin.rotation.z = fx < 0 ? 0.35 : -0.35;
    jetGroup.add(fin);
  }
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 1.1), canopyMat);
  canopy.position.set(0, 0.85, 0.65);
  jetGroup.add(canopy);
  group.add(jetGroup);

  // 4. Instanced desert arid scrub & cacti
  const shrubPositions: { x: number; y: number; z: number; s: number }[] = [];
  for (let i = 0; i < 160 && shrubPositions.length < 55; i++) {
    const a = hash2(i, 211.1) * Math.PI * 2;
    const r = 16.5 + hash2(i, 223.7) * 48.0;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.abs(z + 12.5) < 6.5 && Math.abs(x) < 21) continue;
    const y = getGroundHeight(x, z, biome);
    if (y > 4.5) continue;
    shrubPositions.push({ x, y, z, s: 0.65 + hash2(i, 241.3) * 0.7 });
  }

  if (shrubPositions.length > 0) {
    const shrubGeo = new THREE.DodecahedronGeometry(0.55, 0);
    const shrubMat = new THREE.MeshStandardMaterial({ color: 0x4b5e3c, roughness: 0.9, flatShading: true });
    const inst = new THREE.InstancedMesh(shrubGeo, shrubMat, shrubPositions.length);
    const dummy = new THREE.Object3D();
    shrubPositions.forEach((p, idx) => {
      dummy.position.set(p.x, p.y + 0.28 * p.s, p.z);
      dummy.scale.set(p.s, p.s * 1.15, p.s);
      dummy.rotation.y = idx * 1.2;
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    group.add(inst);
  }

  return { group, bobbingShips, spinners, blinkingMats };
}

/**
 * Zero-Allocation Single-Draw-Call Biome Weather Particle System (240 GPU Points):
 * - Alpine: gentle high-altitude snowfall
 * - Coastal: fast slanted twilight ocean rain
 * - Desert: wind-swept golden sand & dust motes
 */
function buildBiomeWeather(biome: MapBiome): {
  points: THREE.Points;
  updateWeather: (timeSec: number, dt: number) => void;
} {
  const count = 240;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);

  const spreadX = 68;
  const spreadZ = 68;
  const maxY = 26;

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (hash2(i, 31.1) - 0.5) * spreadX;
    positions[i * 3 + 1] = hash2(i, 43.7) * maxY;
    positions[i * 3 + 2] = (hash2(i, 59.3) - 0.5) * spreadZ;
    speeds[i] = 0.75 + hash2(i, 71.9) * 0.65;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const color =
    biome === 'arctic' ? 0xe0f7ff : biome === 'alpine' ? 0xe0f2fe : biome === 'coastal' ? 0x93c5fd : 0xfcd34d;
  const size = biome === 'arctic' ? 0.4 : biome === 'alpine' ? 0.34 : biome === 'coastal' ? 0.24 : 0.32;
  const opacity = biome === 'arctic' ? 0.74 : biome === 'alpine' ? 0.62 : biome === 'coastal' ? 0.45 : 0.36;

  const mat = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  const updateWeather = (timeSec: number, dt: number) => {
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const halfX = spreadX * 0.5;
    const halfZ = spreadZ * 0.5;

    if (biome === 'arctic') {
      // Polar snowstorm blizzard: brisk slanted snowflakes swirling across the ice fortress
      for (let i = 0; i < count; i++) {
        const s = speeds[i];
        let x = arr[i * 3] + (Math.sin(timeSec * 1.4 + i) * 1.4 + 4.8 * s) * dt;
        let y = arr[i * 3 + 1] - 4.4 * s * dt;
        let z = arr[i * 3 + 2] + 1.8 * s * dt;
        if (y < 0.2) {
          y = maxY;
          x = (hash2(i, timeSec) - 0.5) * spreadX;
        }
        if (x > halfX) x -= spreadX;
        if (z > halfZ) z -= spreadZ;
        arr[i * 3] = x;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = z;
      }
    } else if (biome === 'alpine') {
      for (let i = 0; i < count; i++) {
        const s = speeds[i];
        let x = arr[i * 3] + (Math.sin(timeSec * 0.9 + i) * 0.9 + 0.65) * dt;
        let y = arr[i * 3 + 1] - 2.6 * s * dt;
        let z = arr[i * 3 + 2] + 0.35 * dt;
        if (y < 0.2) {
          y = maxY;
          x = (hash2(i, timeSec) - 0.5) * spreadX;
        }
        if (x > halfX) x -= spreadX;
        if (z > halfZ) z -= spreadZ;
        arr[i * 3] = x;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = z;
      }
    } else if (biome === 'coastal') {
      for (let i = 0; i < count; i++) {
        const s = speeds[i];
        let x = arr[i * 3] - 4.2 * s * dt;
        let y = arr[i * 3 + 1] - 16.5 * s * dt;
        let z = arr[i * 3 + 2] - 2.4 * s * dt;
        if (y < 0.2) {
          y = maxY;
          x = (hash2(i, 31.1) - 0.5) * spreadX;
          z = (hash2(i, 59.3) - 0.5) * spreadZ;
        }
        if (x < -halfX) x += spreadX;
        if (z < -halfZ) z += spreadZ;
        arr[i * 3] = x;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = z;
      }
    } else {
      // desert wind-swept sand motes
      for (let i = 0; i < count; i++) {
        const s = speeds[i];
        let x = arr[i * 3] + 7.2 * s * dt;
        let y = arr[i * 3 + 1] + Math.sin(timeSec * 1.6 + i) * 0.45 * dt;
        let z = arr[i * 3 + 2] + 2.2 * s * dt;
        if (x > halfX) x -= spreadX;
        if (z > halfZ) z -= spreadZ;
        if (y < 0.5) y = 12.0;
        if (y > 16.0) y = 1.0;
        arr[i * 3] = x;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = z;
      }
    }
    posAttr.needsUpdate = true;
  };

  return { points, updateWeather };
}

/**
 * Recursively disposes non-shared geometries, materials, and textures in a Three.js Object3D tree.
 */
export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry && !mesh.geometry.userData?.sharedAsset) {
      mesh.geometry.dispose();
    }
    const mat = mesh.material;
    if (mat) {
      const mats = Array.isArray(mat) ? mat : [mat];
      mats.forEach((m) => {
        if (m.userData?.sharedAsset) return;
        const std = m as THREE.MeshStandardMaterial;
        if (std.map && !std.map.userData?.sharedAsset) std.map.dispose();
        if (std.normalMap && !std.normalMap.userData?.sharedAsset) std.normalMap.dispose();
        if (std.roughnessMap && !std.roughnessMap.userData?.sharedAsset) std.roughnessMap.dispose();
        m.dispose();
      });
    }
  });
}

/**
 * Master factory: builds a complete v2.0 High-Detail Low-Poly Twilight Biome World.
 */
export function buildBiomeWorld(biome: MapBiome): BiomeWorldHandle {
  const cfg = BIOME_CONFIGS[biome];
  const group = new THREE.Group();

  // 1. Twilight Sky Dome + Moon Halo + Stars + Drifting Low-Poly Clouds
  const sky = buildTwilightSky(cfg);
  group.add(sky.group);

  // 2. Faceted Low-Poly Terrain
  const terrainMesh = buildLowPolyTerrain(biome);
  group.add(terrainMesh);

  // 3. Upgraded Central Military Base Structures (Helipad Apron, T-Walls, Hangar, Trucks, Radio Mast)
  const baseStructs = buildBaseStructures(biome);
  group.add(baseStructs.group);

  // 4. Sweeping & Target-Tracking Base AA Searchlights
  const { group: searchlightGroup, beamMat: searchlightBeamMat, heads: searchlightHeads } = buildSearchlightTowers(
    biome,
    cfg.searchlightColor
  );
  group.add(searchlightGroup);

  // 5. Biome Foliage & Boulders (Instanced)
  if (biome === 'alpine') {
    group.add(buildInstancedPines(biome, 165));
    const rocks = buildInstancedRocks(biome, 60);
    if (rocks) group.add(rocks);
  } else if (biome === 'coastal') {
    group.add(buildInstancedPines(biome, 65));
    const rocks = buildInstancedRocks(biome, 55);
    if (rocks) group.add(rocks);
  } else {
    const rocks = buildInstancedRocks(biome, 85);
    if (rocks) group.add(rocks);
  }

  // 6. Hero Biome Set-Pieces (Alpine Arch Bridge + Outpost / Coastal Crane + Warships / Desert Airbase + ATC + Stealth Jet)
  const landmarks = buildBiomeLandmarks(biome);
  group.add(landmarks.group);

  // 7. Zero-Allocation Single-Draw-Call Biome Weather (Snow / Rain / Dust)
  const weather = buildBiomeWeather(biome);
  group.add(weather.points);

  // 8. Warm Central Command Point Light (brightens dramatically during Night Operations)
  const baseGlow = new THREE.PointLight(0xffb454, 15, 38, 1.6);
  baseGlow.position.set(0, 4.8, 0);
  group.add(baseGlow);

  const allBlinking = [...baseStructs.blinkingBeacons, ...landmarks.blinkingMats];
  const _cloudNightColor = new THREE.Color(0x060b16);

  const update = (timeSec: number, dt: number, nightFactor = 0, searchTargets?: SearchlightTargetPoint[]) => {
    const nf = Math.max(0, Math.min(1, nightFactor));

    // True Night Operations atmosphere: deep midnight sky dome, dark clouds, luminous stars/moon, vivid AA searchlights
    const skyTint = 1.0 - nf * 0.84;
    sky.skyMat.color.setRGB(
      Math.max(0.04, skyTint * (1 - nf * 0.35)),
      Math.max(0.06, skyTint * (1 - nf * 0.2)),
      Math.max(0.11, skyTint)
    );
    sky.cloudMat.color.copy(sky.cloudDayColor).lerp(_cloudNightColor, nf * 0.9);
    sky.cloudMat.opacity = 0.52 - nf * 0.16;
    sky.starMat.opacity = 0.65 + nf * 0.35;
    sky.starMat.size = 1.05 + nf * 0.72;
    sky.haloMat.opacity = 0.12 + nf * 0.32;
    baseGlow.intensity = 15 + nf * 26;
    searchlightBeamMat.opacity = 0.14 + nf * 0.64;

    // Slowly drift Low-Poly twilight cloud ring & shimmer polar aurora ribbons
    sky.cloudRing.rotation.y += dt * 0.012;
    for (let i = 0; i < sky.auroraRibbons.length; i++) {
      const ar = sky.auroraRibbons[i];
      ar.mesh.rotation.y += dt * (0.015 + i * 0.008);
      ar.mat.opacity = (0.16 + nf * 0.14) + 0.07 * Math.sin(timeSec * 0.85 + ar.phase);
    }

    // Update Zero-Allocation Biome Weather
    weather.updateWeather(timeSec, dt);

    // AA Searchlights: dynamically track airborne targets during Night Raid, or sweep dramatically across the sky
    const slLerp = 1 - Math.exp(-3.6 * dt);
    const hasTargets = nf > 0.2 && searchTargets && searchTargets.length > 0;
    for (let i = 0; i < searchlightHeads.length; i++) {
      const h = searchlightHeads[i];
      let lockedTarget: SearchlightTargetPoint | null = null;
      if (hasTargets && searchTargets) {
        // Assign each tower a distinct nearby target when multiple exist, else lock onto nearest target within 52m
        let bestScore = Infinity;
        for (let tIdx = 0; tIdx < searchTargets.length; tIdx++) {
          const tgt = searchTargets[tIdx];
          const d = Math.hypot(tgt.x - h.wx, tgt.z - h.wz);
          if (d > 54) continue;
          const diversityBias = tIdx % searchlightHeads.length === i ? 0.68 : 1.0;
          const score = d * diversityBias;
          if (score < bestScore) {
            bestScore = score;
            lockedTarget = tgt;
          }
        }
      }

      if (lockedTarget) {
        _slTargetVec.set(lockedTarget.x - h.wx, Math.max(2.0, lockedTarget.y - h.wy), lockedTarget.z - h.wz).normalize();
        _slGoalQuat.setFromUnitVectors(_slUpVec, _slTargetVec);
        h.pivot.quaternion.slerp(_slGoalQuat, slLerp);
      } else {
        const sweepSpeed = h.speed * (1 + nf * 0.45);
        const sweepYaw = h.baseYaw + Math.sin(timeSec * sweepSpeed + h.phase) * 0.92;
        const sweepTilt = 0.34 + Math.sin(timeSec * (sweepSpeed * 0.65) + h.phase * 1.4) * 0.22;
        _slSweepEuler.set(0, sweepYaw, sweepTilt);
        _slGoalQuat.setFromEuler(_slSweepEuler);
        h.pivot.quaternion.slerp(_slGoalQuat, slLerp);
      }
    }

    // Rotate landmark radar dishes (Outpost / Frigate / Corvette / Desert ATC)
    for (let i = 0; i < landmarks.spinners.length; i++) {
      landmarks.spinners[i].obj.rotation.y += dt * landmarks.spinners[i].speed;
    }

    // Blink aviation warning strobes (Radio Mast & Harbor Crane)
    const strobeOn = Math.sin(timeSec * 4.2) > 0.15;
    for (let i = 0; i < allBlinking.length; i++) {
      allBlinking[i].color.setHex(strobeOn ? 0xff2a55 : 0x450a18);
    }

    // Coastal lighthouse rotating beam + bobbing warships + ocean waves + shoreline foam
    if (landmarks.lighthouseBeam) {
      landmarks.lighthouseBeam.rotation.y = timeSec * 0.65;
    }
    if (landmarks.shoreFoamMat) {
      landmarks.shoreFoamMat.opacity = 0.2 + 0.14 * Math.sin(timeSec * 1.8);
    }
    for (let i = 0; i < landmarks.bobbingShips.length; i++) {
      const s = landmarks.bobbingShips[i];
      s.ship.position.y = s.baseY + Math.sin(timeSec * 1.4 + s.phase) * 0.11;
      s.ship.rotation.z = Math.sin(timeSec * 1.1 + s.phase) * 0.035;
    }
    if (biome === 'coastal' && landmarks.waterMesh && landmarks.waterBaseY) {
      const pos = landmarks.waterMesh.geometry.attributes.position;
      const baseY = landmarks.waterBaseY;
      for (let i = 0; i < baseY.length; i++) {
        const vx = pos.getX(i);
        const vz = pos.getZ(i);
        const wave = Math.sin(vx * 0.14 + timeSec * 1.35) * 0.16 + Math.cos(vz * 0.12 + timeSec * 1.05) * 0.14;
        pos.setY(i, baseY[i] + wave);
      }
      pos.needsUpdate = true;
    }
  };

  const dispose = () => {
    disposeObject3D(group);
  };

  return { group, terrainMesh, update, dispose };
}
