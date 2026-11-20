import * as THREE from 'three';
import { DefenseTower, EnemyUnit, FacilityKind } from '../types/game';

/**
 * Crash-Proof High-Detail Procedural 3D Military Mesh Factory for Air Shield (پدافند هوایی)
 * - 7 unique multi-part articulated defense systems with real Level 1 -> Level 2 -> Level 3 upgrades
 * - ZERO-CANVAS / ZERO-TEXTURE 3D Health Bars (eliminates GPU texture upload storms & VRAM crashes!)
 * - Cached shared enemy geometries & materials (userData.sharedAsset = true -> zero mid-battle GPU churn!)
 * - Selective shadow casting (main silhouettes only -> ~70% fewer shadow-pass draw calls)
 * - Single-material holographic tower silhouette preview (zero 50-material cloning!)
 */

export interface TowerRig {
  group: THREE.Group;
  turretHead: THREE.Object3D;
  firePoints: THREE.Vector3[];
  muzzleAnchors: THREE.Object3D[];
  applyLevel: (level: number) => void;
  triggerRecoil: () => void;
  updateAnim: (dt: number, timeSec: number, isFiring: boolean, hasLock?: boolean) => void;
}

export interface EnemyRig {
  group: THREE.Group;
  healthBar: { mesh: THREE.Object3D; updateHp: (current: number) => void };
  updateAnim: (dt: number, timeSec: number, cameraQuat?: THREE.Quaternion) => void;
}

export interface BunkerRig {
  group: THREE.Group;
  updateAnim: (dt: number, timeSec: number, hpRatio?: number, shieldTimer?: number, alertLevel?: number) => void;
}

// =========================================================================
// MODULE-LEVEL SHARED ASSET CACHES (Zero Runtime GPU Buffer / Texture Churn)
// =========================================================================
function markShared<T extends { userData: Record<string, unknown> }>(asset: T): T {
  asset.userData.sharedAsset = true;
  return asset;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
const matCache = new Map<string, THREE.Material>();

function getSharedGeo(key: string, factory: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    g = markShared(factory());
    geoCache.set(key, g);
  }
  return g;
}

function getSharedMat<T extends THREE.Material>(key: string, factory: () => T): T {
  let m = matCache.get(key) as T | undefined;
  if (!m) {
    m = markShared(factory());
    matCache.set(key, m);
  }
  return m;
}

// Zero-Canvas, Zero-Texture 3D Health Bar (100% shared geometry & 4 shared materials!)
export function createHealthBarBillboard(
  maxHp: number,
  sizeClass: boolean | 'small' | 'medium' | 'boss' = 'medium'
): {
  mesh: THREE.Object3D;
  updateHp: (current: number, maxOverride?: number) => void;
} {
  const tier =
    sizeClass === true || sizeClass === 'boss'
      ? 'boss'
      : sizeClass === 'small'
        ? 'small'
        : 'medium';
  const barWidth = tier === 'boss' ? 3.25 : tier === 'small' ? 1.55 : 2.05;
  const barHeight = tier === 'boss' ? 0.34 : tier === 'small' ? 0.2 : 0.25;

  const planeGeo = getSharedGeo('hp_plane', () => new THREE.PlaneGeometry(1, 1));
  const bgMat = getSharedMat('hp_bg', () =>
    new THREE.MeshBasicMaterial({ color: 0x0a0f1c, transparent: true, opacity: 0.85, depthTest: false })
  );
  const greenMat = getSharedMat('hp_green', () =>
    new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false })
  );
  const amberMat = getSharedMat('hp_amber', () =>
    new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false })
  );
  const redMat = getSharedMat('hp_red', () =>
    new THREE.MeshBasicMaterial({ color: 0xef4444, depthTest: false })
  );

  const holder = new THREE.Group();
  holder.position.y = tier === 'boss' ? 2.55 : tier === 'small' ? 1.4 : 1.85;

  const bgMesh = new THREE.Mesh(planeGeo, bgMat);
  bgMesh.scale.set(barWidth + 0.14, barHeight + 0.12, 1);
  bgMesh.renderOrder = 10;
  holder.add(bgMesh);

  const fillMesh = new THREE.Mesh(planeGeo, greenMat);
  fillMesh.scale.set(barWidth, barHeight, 1);
  fillMesh.position.z = 0.02;
  fillMesh.renderOrder = 11;
  holder.add(fillMesh);

  let currentMax = Math.max(1, maxHp);
  const updateHp = (current: number, maxOverride?: number) => {
    if (typeof maxOverride === 'number' && maxOverride > 0) {
      currentMax = maxOverride;
    }
    const ratio = Math.max(0.001, Math.min(1, current / currentMax));
    fillMesh.scale.x = barWidth * ratio;
    fillMesh.position.x = -(barWidth * (1 - ratio)) * 0.5;
    fillMesh.material = ratio > 0.6 ? greenMat : ratio > 0.3 ? amberMat : redMat;
  };

  updateHp(currentMax);
  return { mesh: holder, updateHp };
}

function getArmorMat(colorHex: number | string, roughness = 0.52, metalness = 0.38): THREE.MeshStandardMaterial {
  const key = `armor_${colorHex}_${roughness}_${metalness}`;
  return getSharedMat(
    key,
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex),
        roughness,
        metalness,
        flatShading: true,
      })
  );
}

function getGunmetalMat(colorHex = 0x1e242c, roughness = 0.34, metalness = 0.82): THREE.MeshStandardMaterial {
  const key = `gun_${colorHex}_${roughness}_${metalness}`;
  return getSharedMat(
    key,
    () =>
      new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness,
        metalness,
        flatShading: true,
      })
  );
}

function getGlowMat(colorHex: number, emissiveIntensity = 1.6): THREE.MeshStandardMaterial {
  const key = `glow_${colorHex}_${emissiveIntensity}`;
  return getSharedMat(
    key,
    () =>
      new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity,
        roughness: 0.2,
        metalness: 0.1,
      })
  );
}

function getBasicGlowMat(colorHex: number, opacity = 1): THREE.MeshBasicMaterial {
  const key = `basic_${colorHex}_${opacity}`;
  return getSharedMat(
    key,
    () =>
      new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: opacity < 1,
        opacity,
      })
  );
}

// Helper to build octagonal military base plinth (selective shadow casting on slab only!)
function buildMilitaryPlinth(
  group: THREE.Group,
  accentColor: string,
  radius = 1.48
): { rankRingMat: THREE.MeshStandardMaterial; tier2BaseParts: THREE.Object3D[]; tier3BaseParts: THREE.Object3D[] } {
  const concreteMat = getArmorMat(0x28313e, 0.78, 0.22);
  const steelMat = getGunmetalMat(0x1b2129, 0.42, 0.72);
  const paintMat = getArmorMat(accentColor, 0.52, 0.34);
  const goldMat = getArmorMat(0xd4a438, 0.32, 0.78);

  const slabGeo = getSharedGeo(`plinth_slab_${radius}`, () => new THREE.CylinderGeometry(radius * 0.94, radius * 1.06, 0.32, 8));
  const slab = new THREE.Mesh(slabGeo, concreteMat);
  slab.position.y = 0.16;
  slab.castShadow = true;
  slab.receiveShadow = true;
  group.add(slab);

  const collarGeo = getSharedGeo(`plinth_collar_${radius}`, () => new THREE.CylinderGeometry(radius * 0.72, radius * 0.82, 0.22, 8));
  const collar = new THREE.Mesh(collarGeo, steelMat);
  collar.position.y = 0.42;
  collar.receiveShadow = true;
  group.add(collar);

  const legGeo = getSharedGeo('plinth_leg', () => new THREE.BoxGeometry(0.32, 0.24, 0.56));
  const padGeo = getSharedGeo('plinth_pad', () => new THREE.CylinderGeometry(0.18, 0.22, 0.1, 6));
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const leg = new THREE.Mesh(legGeo, steelMat);
    leg.position.set(Math.sin(a) * (radius * 0.92), 0.15, Math.cos(a) * (radius * 0.92));
    leg.rotation.y = a;
    group.add(leg);

    const pad = new THREE.Mesh(padGeo, paintMat);
    pad.position.set(Math.sin(a) * (radius * 1.12), 0.05, Math.cos(a) * (radius * 1.12));
    group.add(pad);
  }

  // Per-tower rank LED ring (unique material so each tower shows its own Lv1/Lv2/Lv3 color!)
  const rankRingMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.7,
    roughness: 0.3,
    metalness: 0.5,
  });
  const rankRingGeo = getSharedGeo(`plinth_ring_${radius}`, () => new THREE.TorusGeometry(radius * 0.76, 0.045, 6, 16));
  const rankRing = new THREE.Mesh(rankRingGeo, rankRingMat);
  rankRing.rotation.x = Math.PI / 2;
  rankRing.position.y = 0.34;
  group.add(rankRing);

  // Level 2 Base Addition: Armored side blast skirts
  const tier2BaseParts: THREE.Object3D[] = [];
  const skirtGeo = getSharedGeo('plinth_skirt', () => new THREE.BoxGeometry(0.95, 0.28, 0.14));
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const skirt = new THREE.Mesh(skirtGeo, paintMat);
    skirt.position.set(Math.sin(a) * (radius * 0.86), 0.28, Math.cos(a) * (radius * 0.86));
    skirt.rotation.y = a;
    skirt.visible = false;
    group.add(skirt);
    tier2BaseParts.push(skirt);
  }

  // Level 3 Base Addition: Gold veteran trim ring & corner beacons
  const tier3BaseParts: THREE.Object3D[] = [];
  const goldCollarGeo = getSharedGeo(`plinth_gold_${radius}`, () => new THREE.TorusGeometry(radius * 0.88, 0.055, 6, 8));
  const goldCollar = new THREE.Mesh(goldCollarGeo, goldMat);
  goldCollar.rotation.x = Math.PI / 2;
  goldCollar.rotation.z = Math.PI / 8;
  goldCollar.position.y = 0.52;
  goldCollar.visible = false;
  group.add(goldCollar);
  tier3BaseParts.push(goldCollar);

  const beaconGeo = getSharedGeo('plinth_beacon', () => new THREE.BoxGeometry(0.12, 0.12, 0.12));
  const beaconMat = getGlowMat(0xfbbf24, 1.8);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(Math.sin(a) * (radius * 1.12), 0.15, Math.cos(a) * (radius * 1.12));
    beacon.visible = false;
    group.add(beacon);
    tier3BaseParts.push(beacon);
  }

  return { rankRingMat, tier2BaseParts, tier3BaseParts };
}

// Helper: 6-barrel rotary vulcan cannon bundle (100% shared geometries!)
function buildRotaryBarrelCluster(gunmetalMat: THREE.Material, clampMat: THREE.Material, length = 1.65): THREE.Group {
  const cluster = new THREE.Group();
  const barrelGeo = getSharedGeo(`vulcan_barrel_${length}`, () => {
    const g = new THREE.CylinderGeometry(0.038, 0.038, length, 5);
    g.rotateX(Math.PI / 2);
    return g;
  });

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const b = new THREE.Mesh(barrelGeo, gunmetalMat);
    b.position.set(Math.cos(angle) * 0.095, Math.sin(angle) * 0.095, length * 0.5);
    cluster.add(b);
  }

  const clampGeo = getSharedGeo('vulcan_clamp', () => {
    const g = new THREE.CylinderGeometry(0.155, 0.155, 0.08, 8);
    g.rotateX(Math.PI / 2);
    return g;
  });
  for (const zPos of [length * 0.35, length * 0.72, length * 0.94]) {
    const clamp = new THREE.Mesh(clampGeo, clampMat);
    clamp.position.z = zPos;
    cluster.add(clamp);
  }

  return cluster;
}

// Main Defense Tower 3D Builder (7 unique military designs + Lv1/Lv2/Lv3 visual hardware evolution)
export function buildTower3D(tower: DefenseTower, initialLevel = 1, playDeployAnim = false): TowerRig {
  const group = new THREE.Group();
  const baseMat = getArmorMat(tower.color, 0.48, 0.36);
  const darkArmorMat = getArmorMat(0x242c36, 0.52, 0.5);
  const gunmetalMat = getGunmetalMat(0x171c22, 0.32, 0.85);
  const lightCeramicMat = getArmorMat(0xe2e8f0, 0.3, 0.15);
  const goldTrimMat = getArmorMat(0xd4a438, 0.3, 0.8);
  const opticGreenMat = getGlowMat(0x10b981, 1.5);
  const opticCyanMat = getGlowMat(0x22d3ee, 1.8);
  const opticAmberMat = getGlowMat(0xf59e0b, 1.6);
  const warheadRedMat = getArmorMat(0xc83e37, 0.38, 0.25);

  const { rankRingMat, tier2BaseParts, tier3BaseParts } = buildMilitaryPlinth(group, tower.color);
  const tier2Parts: THREE.Object3D[] = [...tier2BaseParts];
  const tier3Parts: THREE.Object3D[] = [...tier3BaseParts];

  const turretHead = new THREE.Group();
  turretHead.position.y = 1.05;
  group.add(turretHead);

  const firePoints: THREE.Vector3[] = [];
  const muzzleAnchors: THREE.Object3D[] = [];
  const spinners: { obj: THREE.Object3D; axis: 'x' | 'y' | 'z'; baseSpeed: number; fireSpeed: number; curSpeed: number; inertial?: boolean }[] = [];
  const recoilParts: { obj: THREE.Object3D; restZ: number; kick: number }[] = [];
  const altRecoilParts: { obj: THREE.Object3D; restZ: number; kick: number; val: number }[] = [];
  const pitchKickParts: { obj: THREE.Object3D; restX: number; kick: number }[] = [];
  const hatchPivots: { pivot: THREE.Object3D; axis: 'x' | 'z'; closedAngle: number; openAngle: number }[] = [];
  const oscillators: { obj: THREE.Object3D; axis: 'x' | 'y'; base: number; amp: number; speed: number; phase: number }[] = [];
  const pulseMats: { mat: THREE.MeshStandardMaterial; base: number; boost: number }[] = [];
  let barrelHeatMat: THREE.MeshStandardMaterial | null = null;

  const registerMuzzle = (parent: THREE.Object3D, x: number, y: number, z: number) => {
    const anchor = new THREE.Object3D();
    anchor.position.set(x, y, z);
    parent.add(anchor);
    muzzleAnchors.push(anchor);
    firePoints.push(new THREE.Vector3(x, y, z));
  };

  // 1. CIWS LIGHT — Phalanx White Radome + 6-Barrel Rotary Vulcan
  if (tower.id === 'ciws_light') {
    const pedestal = new THREE.Mesh(
      getSharedGeo('ciws_ped', () => new THREE.CylinderGeometry(0.76, 0.92, 0.82, 10)),
      baseMat
    );
    pedestal.position.y = 0.05;
    pedestal.castShadow = true;
    turretHead.add(pedestal);

    const ammoDrum = new THREE.Mesh(
      getSharedGeo('ciws_ammo', () => new THREE.CylinderGeometry(0.42, 0.42, 0.72, 10)),
      darkArmorMat
    );
    ammoDrum.rotation.z = Math.PI / 2;
    ammoDrum.position.set(0, -0.02, -0.42);
    turretHead.add(ammoDrum);

    const domeBody = new THREE.Mesh(
      getSharedGeo('ciws_dome_b', () => new THREE.CylinderGeometry(0.56, 0.62, 0.92, 10)),
      lightCeramicMat
    );
    domeBody.position.set(0, 0.88, -0.08);
    domeBody.castShadow = true;
    turretHead.add(domeBody);

    const domeCap = new THREE.Mesh(
      getSharedGeo('ciws_dome_c', () => new THREE.SphereGeometry(0.56, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2)),
      lightCeramicMat
    );
    domeCap.position.set(0, 1.34, -0.08);
    turretHead.add(domeCap);

    const domeBand = new THREE.Mesh(
      getSharedGeo('ciws_band', () => new THREE.CylinderGeometry(0.585, 0.585, 0.14, 10)),
      gunmetalMat
    );
    domeBand.position.set(0, 0.68, -0.08);
    turretHead.add(domeBand);

    const flirBox = new THREE.Mesh(
      getSharedGeo('ciws_flir', () => new THREE.BoxGeometry(0.28, 0.3, 0.44)),
      darkArmorMat
    );
    flirBox.position.set(0.68, 0.56, 0.16);
    turretHead.add(flirBox);

    const flirLens = new THREE.Mesh(
      getSharedGeo('ciws_lens', () => new THREE.CylinderGeometry(0.08, 0.08, 0.06, 6)),
      opticGreenMat
    );
    flirLens.rotation.x = Math.PI / 2;
    flirLens.position.set(0.68, 0.56, 0.39);
    turretHead.add(flirLens);

    const gunCradle = new THREE.Group();
    gunCradle.position.set(0, 0.25, 0.35);
    turretHead.add(gunCradle);

    const breech = new THREE.Mesh(
      getSharedGeo('ciws_breech', () => new THREE.BoxGeometry(0.42, 0.38, 0.65)),
      darkArmorMat
    );
    breech.position.z = 0.08;
    gunCradle.add(breech);

    const rotary1 = buildRotaryBarrelCluster(gunmetalMat, baseMat, 1.65);
    rotary1.position.set(0, 0.02, 0.25);
    gunCradle.add(rotary1);

    // Thermal barrel heat sleeve (glows cherry-orange during sustained bursts!)
    barrelHeatMat = new THREE.MeshStandardMaterial({
      color: 0x3f241c,
      emissive: 0xff5a1f,
      emissiveIntensity: 0.0,
      roughness: 0.45,
      metalness: 0.72,
    });
    const heatSleeve = new THREE.Mesh(
      getSharedGeo('ciws_heat', () => {
        const g = new THREE.CylinderGeometry(0.145, 0.145, 0.65, 8);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      barrelHeatMat
    );
    heatSleeve.position.set(0, 0.02, 1.48);
    gunCradle.add(heatSleeve);

    spinners.push({ obj: rotary1, axis: 'z', baseSpeed: 1.2, fireSpeed: 32, curSpeed: 1.2, inertial: true });
    recoilParts.push({ obj: gunCradle, restZ: 0.35, kick: 0.22 });
    oscillators.push({ obj: flirBox, axis: 'y', base: 0, amp: 0.26, speed: 1.8, phase: 0.4 });
    registerMuzzle(gunCradle, 0, 0.02, 1.98);

    // Level 2: Armored Gun Shield + Side Feed Chute + Sight
    const shield = new THREE.Mesh(
      getSharedGeo('ciws_shield', () => new THREE.BoxGeometry(1.18, 0.68, 0.12)),
      baseMat
    );
    shield.position.set(0, 0.38, 0.52);
    shield.rotation.x = -0.18;
    shield.visible = false;
    turretHead.add(shield);
    tier2Parts.push(shield);

    const ammoBoxL = new THREE.Mesh(
      getSharedGeo('ciws_ammoL', () => new THREE.BoxGeometry(0.32, 0.46, 0.62)),
      darkArmorMat
    );
    ammoBoxL.position.set(-0.68, 0.28, -0.05);
    ammoBoxL.visible = false;
    turretHead.add(ammoBoxL);
    tier2Parts.push(ammoBoxL);

    const sightStrip = new THREE.Mesh(
      getSharedGeo('ciws_sight', () => new THREE.BoxGeometry(0.55, 0.07, 0.08)),
      opticGreenMat
    );
    sightStrip.position.set(0, 0.64, 0.56);
    sightStrip.visible = false;
    turretHead.add(sightStrip);
    tier2Parts.push(sightStrip);

    // Level 3: Twin Linked Vulcan Barrel + Top Mini-Radar
    const sideCradle = new THREE.Group();
    sideCradle.position.set(-0.46, 0.25, 0.35);
    sideCradle.visible = false;
    turretHead.add(sideCradle);
    const rotary2 = buildRotaryBarrelCluster(gunmetalMat, goldTrimMat, 1.55);
    rotary2.position.set(0, 0.02, 0.22);
    sideCradle.add(rotary2);
    tier3Parts.push(sideCradle);
    spinners.push({ obj: rotary2, axis: 'z', baseSpeed: -1.2, fireSpeed: -32, curSpeed: -1.2, inertial: true });
    recoilParts.push({ obj: sideCradle, restZ: 0.35, kick: 0.22 });
    registerMuzzle(sideCradle, 0, 0.02, 1.85);

    const topRadarBar = new THREE.Mesh(
      getSharedGeo('ciws_topradar', () => new THREE.BoxGeometry(0.86, 0.14, 0.12)),
      goldTrimMat
    );
    topRadarBar.position.set(0, 1.98, -0.08);
    topRadarBar.visible = false;
    turretHead.add(topRadarBar);
    tier3Parts.push(topRadarBar);
    spinners.push({ obj: topRadarBar, axis: 'y', baseSpeed: 3.8, fireSpeed: 6.2, curSpeed: 3.8 });
  }

  // 2. PANTSIR POINT — Twin 30mm Autocannons + Flanking SAM Pods + Rotating Radar
  else if (tower.id === 'pantsir_point') {
    const hull = new THREE.Mesh(
      getSharedGeo('pan_hull', () => new THREE.BoxGeometry(1.75, 0.62, 1.85)),
      baseMat
    );
    hull.position.y = 0.02;
    hull.castShadow = true;
    turretHead.add(hull);

    const glacis = new THREE.Mesh(
      getSharedGeo('pan_glacis', () => new THREE.BoxGeometry(1.48, 0.42, 0.55)),
      darkArmorMat
    );
    glacis.position.set(0, 0.16, 0.85);
    glacis.rotation.x = 0.42;
    turretHead.add(glacis);

    const cab = new THREE.Mesh(
      getSharedGeo('pan_cab', () => new THREE.BoxGeometry(1.05, 0.65, 1.2)),
      darkArmorMat
    );
    cab.position.set(0, 0.58, -0.05);
    cab.castShadow = true;
    turretHead.add(cab);

    const eoBall = new THREE.Mesh(
      getSharedGeo('pan_eo', () => new THREE.SphereGeometry(0.24, 8, 6)),
      gunmetalMat
    );
    eoBall.position.set(0, 0.68, 0.62);
    turretHead.add(eoBall);

    const eoLens = new THREE.Mesh(
      getSharedGeo('pan_lens', () => new THREE.SphereGeometry(0.11, 6, 6)),
      opticAmberMat
    );
    eoLens.position.set(0, 0.68, 0.81);
    turretHead.add(eoLens);

    const barrelGeo = getSharedGeo('pan_barrel', () => {
      const g = new THREE.CylinderGeometry(0.055, 0.075, 1.35, 6);
      g.rotateX(Math.PI / 2);
      return g;
    });
    const brakeGeo = getSharedGeo('pan_brake', () => {
      const g = new THREE.CylinderGeometry(0.085, 0.065, 0.18, 6);
      g.rotateX(Math.PI / 2);
      return g;
    });

    for (const sx of [-0.42, 0.42]) {
      const cannonGroup = new THREE.Group();
      cannonGroup.position.set(sx, 0.48, 0.52);
      const barrel = new THREE.Mesh(barrelGeo, gunmetalMat);
      barrel.position.z = 0.65;
      cannonGroup.add(barrel);
      const brake = new THREE.Mesh(brakeGeo, darkArmorMat);
      brake.position.z = 1.35;
      cannonGroup.add(brake);
      turretHead.add(cannonGroup);
      // Alternating left/right 30mm autocannon recoil kick!
      altRecoilParts.push({ obj: cannonGroup, restZ: 0.52, kick: 0.26, val: 0 });
      registerMuzzle(cannonGroup, 0, 0, 1.46);
    }

    const tubeGeo = getSharedGeo('pan_tube', () => {
      const g = new THREE.CylinderGeometry(0.11, 0.11, 1.55, 6);
      g.rotateX(Math.PI / 2);
      return g;
    });
    const capGeo = getSharedGeo('pan_cap', () => {
      const g = new THREE.CylinderGeometry(0.09, 0.09, 0.06, 6);
      g.rotateX(Math.PI / 2);
      return g;
    });

    for (const sx of [-0.92, 0.92]) {
      const podGroup = new THREE.Group();
      podGroup.position.set(sx, 0.62, 0.05);
      podGroup.rotation.x = -0.22;
      for (let row = 0; row < 3; row++) {
        const tube = new THREE.Mesh(tubeGeo, baseMat);
        tube.position.set(0, (row - 1) * 0.23, 0);
        podGroup.add(tube);
        const cap = new THREE.Mesh(capGeo, warheadRedMat);
        cap.position.set(0, (row - 1) * 0.23, 0.78);
        podGroup.add(cap);
      }
      turretHead.add(podGroup);
    }

    const radarMast = new THREE.Group();
    radarMast.position.set(0, 1.15, -0.35);
    radarMast.add(new THREE.Mesh(getSharedGeo('pan_pole', () => new THREE.CylinderGeometry(0.08, 0.11, 0.52, 6)), gunmetalMat));
    const panel = new THREE.Mesh(getSharedGeo('pan_panel', () => new THREE.BoxGeometry(1.12, 0.52, 0.12)), lightCeramicMat);
    panel.position.y = 0.36;
    panel.rotation.x = -0.15;
    radarMast.add(panel);
    turretHead.add(radarMast);
    spinners.push({ obj: radarMast, axis: 'y', baseSpeed: 2.8, fireSpeed: 4.4, curSpeed: 2.8 });
    oscillators.push({ obj: eoBall, axis: 'y', base: 0, amp: 0.35, speed: 2.4, phase: 1.1 });

    // Level 2: Outer Doubled Missile Banks
    for (const sx of [-1.18, 1.18]) {
      const extraPod = new THREE.Group();
      extraPod.position.set(sx, 0.62, 0.05);
      extraPod.rotation.x = -0.22;
      extraPod.visible = false;
      for (let row = 0; row < 3; row++) {
        const tube = new THREE.Mesh(tubeGeo, darkArmorMat);
        tube.position.set(0, (row - 1) * 0.23, 0);
        extraPod.add(tube);
        const cap = new THREE.Mesh(capGeo, opticAmberMat);
        cap.position.set(0, (row - 1) * 0.23, 0.78);
        extraPod.add(cap);
      }
      turretHead.add(extraPod);
      tier2Parts.push(extraPod);
    }

    // Level 3: Gold-Framed Dual-Face Tracking Radar + Armored Brow
    const heavyRadarBar = new THREE.Mesh(
      getSharedGeo('pan_heavybar', () => new THREE.BoxGeometry(1.25, 0.16, 0.18)),
      goldTrimMat
    );
    heavyRadarBar.position.set(0, 0.68, 0);
    heavyRadarBar.visible = false;
    radarMast.add(heavyRadarBar);
    tier3Parts.push(heavyRadarBar);

    const frontBrow = new THREE.Mesh(
      getSharedGeo('pan_brow', () => new THREE.BoxGeometry(1.3, 0.18, 0.42)),
      goldTrimMat
    );
    frontBrow.position.set(0, 0.94, 0.35);
    frontBrow.visible = false;
    turretHead.add(frontBrow);
    tier3Parts.push(frontBrow);
  }

  // 3. PATRIOT BATTERY — Elevating 4 -> 6 -> 8 Ribbed Missile Canister Array
  else if (tower.id === 'patriot_battery') {
    const bed = new THREE.Mesh(
      getSharedGeo('pat_bed', () => new THREE.BoxGeometry(2.1, 0.45, 2.35)),
      darkArmorMat
    );
    bed.position.y = -0.1;
    bed.castShadow = true;
    turretHead.add(bed);

    const blastShield = new THREE.Mesh(
      getSharedGeo('pat_blast', () => new THREE.BoxGeometry(1.85, 0.68, 0.16)),
      gunmetalMat
    );
    blastShield.position.set(0, 0.28, -1.05);
    blastShield.rotation.x = 0.48;
    turretHead.add(blastShield);

    const ramGeo = getSharedGeo('pat_ram', () => new THREE.CylinderGeometry(0.08, 0.1, 1.25, 6));
    for (const sx of [-0.72, 0.72]) {
      const ram = new THREE.Mesh(ramGeo, lightCeramicMat);
      ram.position.set(sx, 0.52, 0.32);
      ram.rotation.x = 0.38;
      turretHead.add(ram);
    }

    const rack = new THREE.Group();
    rack.position.set(0, 0.78, 0);
    rack.rotation.x = -0.58;
    turretHead.add(rack);
    recoilParts.push({ obj: rack, restZ: 0, kick: 0.25 });
    pitchKickParts.push({ obj: rack, restX: -0.58, kick: 0.09 });

    const canBodyGeo = getSharedGeo('pat_can_b', () => new THREE.BoxGeometry(0.46, 0.46, 2.55));
    const canRibGeo = getSharedGeo('pat_can_r', () => new THREE.BoxGeometry(0.51, 0.51, 0.11));
    const canHatchGeo = getSharedGeo('pat_can_h', () => new THREE.BoxGeometry(0.36, 0.36, 0.08));

    const buildCanister = (x: number, y: number, mat: THREE.Material, hatchMat: THREE.Material, cast = false) => {
      const can = new THREE.Group();
      can.position.set(x, y, 0);
      const body = new THREE.Mesh(canBodyGeo, mat);
      body.castShadow = cast;
      can.add(body);
      for (const rz of [-0.75, 0, 0.75]) {
        const rib = new THREE.Mesh(canRibGeo, gunmetalMat);
        rib.position.z = rz;
        can.add(rib);
      }
      // Articulated hinged front canister lid that swings open on target lock/fire!
      const hatchPivot = new THREE.Group();
      hatchPivot.position.set(0, 0.19, 1.28);
      const hatch = new THREE.Mesh(canHatchGeo, hatchMat);
      hatch.position.set(0, -0.19, 0);
      hatchPivot.add(hatch);
      can.add(hatchPivot);
      hatchPivots.push({ pivot: hatchPivot, axis: 'x', closedAngle: 0, openAngle: -1.32 });
      return can;
    };

    const baseCoords: [number, number][] = [
      [-0.28, 0.28],
      [0.28, 0.28],
      [-0.28, -0.28],
      [0.28, -0.28],
    ];
    baseCoords.forEach(([cx, cy], idx) => {
      rack.add(buildCanister(cx, cy, baseMat, lightCeramicMat, idx < 2));
      registerMuzzle(rack, cx, cy, 1.38);
    });

    // Level 2: +2 Outer Canisters (6-Pack) + Generator Box
    for (const cx of [-0.84, 0.84]) {
      const extraCan = buildCanister(cx, -0.28, baseMat, opticAmberMat);
      extraCan.visible = false;
      rack.add(extraCan);
      tier2Parts.push(extraCan);
    }
    const genBox = new THREE.Mesh(
      getSharedGeo('pat_gen', () => new THREE.BoxGeometry(0.45, 0.52, 0.78)),
      darkArmorMat
    );
    genBox.position.set(0.95, 0.22, -0.55);
    genBox.visible = false;
    turretHead.add(genBox);
    tier2Parts.push(genBox);

    // Level 3: Full 8-Pack Super-Battery + Gold Gantry Bar
    for (const cx of [-0.84, 0.84]) {
      const topCan = buildCanister(cx, 0.28, darkArmorMat, goldTrimMat);
      topCan.visible = false;
      rack.add(topCan);
      tier3Parts.push(topCan);
    }
    const gantryBar = new THREE.Mesh(
      getSharedGeo('pat_gantry', () => new THREE.BoxGeometry(2.22, 0.12, 0.18)),
      goldTrimMat
    );
    gantryBar.position.set(0, 0.58, 0.95);
    gantryBar.visible = false;
    rack.add(gantryBar);
    tier3Parts.push(gantryBar);
  }

  // 4. SYSTEM 358 — Open-Rail Loitering SAM Launcher with Visible Winged Missiles
  else if (tower.id === 'system_358') {
    const turretBody = new THREE.Mesh(
      getSharedGeo('s358_body', () => new THREE.CylinderGeometry(0.85, 1.02, 0.58, 8)),
      baseMat
    );
    turretBody.position.y = 0.02;
    turretBody.castShadow = true;
    turretHead.add(turretBody);

    const guideArm = new THREE.Mesh(
      getSharedGeo('s358_arm', () => new THREE.BoxGeometry(0.26, 0.45, 0.32)),
      darkArmorMat
    );
    guideArm.position.set(-0.88, 0.48, 0.15);
    turretHead.add(guideArm);

    const guideDish = new THREE.Mesh(
      getSharedGeo('s358_dish', () => new THREE.CylinderGeometry(0.36, 0.14, 0.16, 8)),
      lightCeramicMat
    );
    guideDish.rotation.x = Math.PI / 2 - 0.25;
    guideDish.position.set(-0.88, 0.76, 0.34);
    turretHead.add(guideDish);

    const guideLens = new THREE.Mesh(
      getSharedGeo('s358_lens', () => new THREE.SphereGeometry(0.11, 6, 6)),
      opticAmberMat
    );
    guideLens.position.set(-0.88, 0.76, 0.44);
    turretHead.add(guideLens);

    const railCradle = new THREE.Group();
    railCradle.position.set(0.08, 0.65, 0);
    railCradle.rotation.x = -0.42;
    turretHead.add(railCradle);
    recoilParts.push({ obj: railCradle, restZ: 0, kick: 0.2 });
    pitchKickParts.push({ obj: railCradle, restX: -0.42, kick: 0.08 });
    oscillators.push({ obj: guideDish, axis: 'y', base: 0, amp: 0.32, speed: 2.1, phase: 0.7 });

    const railGeo = getSharedGeo('s358_rail', () => new THREE.BoxGeometry(0.1, 0.12, 2.2));
    const mBodyGeo = getSharedGeo('s358_mb', () => {
      const g = new THREE.CylinderGeometry(0.11, 0.12, 1.95, 6);
      g.rotateX(Math.PI / 2);
      return g;
    });
    const mNoseGeo = getSharedGeo('s358_mn', () => {
      const g = new THREE.ConeGeometry(0.11, 0.42, 6);
      g.rotateX(Math.PI / 2);
      return g;
    });
    const mFinHGeo = getSharedGeo('s358_fh', () => new THREE.BoxGeometry(0.54, 0.04, 0.32));
    const mFinVGeo = getSharedGeo('s358_fv', () => new THREE.BoxGeometry(0.04, 0.54, 0.32));

    const buildVisibleLoiterMissile = (x: number, y: number, noseMat: THREE.Material) => {
      const m = new THREE.Group();
      m.position.set(x, y, 0);
      const rail = new THREE.Mesh(railGeo, gunmetalMat);
      rail.position.y = -0.15;
      m.add(rail);
      const body = new THREE.Mesh(mBodyGeo, lightCeramicMat);
      body.castShadow = true;
      m.add(body);
      const nose = new THREE.Mesh(mNoseGeo, noseMat);
      nose.position.z = 1.18;
      m.add(nose);
      const finH = new THREE.Mesh(mFinHGeo, darkArmorMat);
      finH.position.z = -0.45;
      m.add(finH);
      const finV = new THREE.Mesh(mFinVGeo, darkArmorMat);
      finV.position.z = -0.45;
      m.add(finV);
      return m;
    };

    railCradle.add(buildVisibleLoiterMissile(-0.34, 0.08, warheadRedMat));
    railCradle.add(buildVisibleLoiterMissile(0.34, 0.08, warheadRedMat));
    registerMuzzle(railCradle, -0.34, 0.08, 1.35);
    registerMuzzle(railCradle, 0.34, 0.08, 1.35);

    const midMissile = buildVisibleLoiterMissile(0, 0.48, opticAmberMat);
    midMissile.visible = false;
    railCradle.add(midMissile);
    tier2Parts.push(midMissile);

    const sensorR = new THREE.Mesh(
      getSharedGeo('s358_sr', () => new THREE.BoxGeometry(0.32, 0.32, 0.46)),
      darkArmorMat
    );
    sensorR.position.set(0.86, 0.45, 0.25);
    sensorR.visible = false;
    turretHead.add(sensorR);
    tier2Parts.push(sensorR);

    const upperL = buildVisibleLoiterMissile(-0.56, 0.52, goldTrimMat);
    const upperR = buildVisibleLoiterMissile(0.56, 0.52, goldTrimMat);
    upperL.visible = false;
    upperR.visible = false;
    railCradle.add(upperL, upperR);
    tier3Parts.push(upperL, upperR);

    const heatShield = new THREE.Mesh(
      getSharedGeo('s358_hs', () => new THREE.BoxGeometry(1.55, 0.55, 0.12)),
      goldTrimMat
    );
    heatShield.position.set(0, 0.24, -1.15);
    heatShield.visible = false;
    railCradle.add(heatShield);
    tier3Parts.push(heatShield);
  }

  // 5. AVENGER STINGER — Armored Gunner Cab + Dual Quad Stinger Pods
  else if (tower.id === 'avenger_stinger') {
    const cab = new THREE.Mesh(
      getSharedGeo('avg_cab', () => new THREE.BoxGeometry(0.92, 0.78, 1.18)),
      baseMat
    );
    cab.position.set(0, 0.34, -0.05);
    cab.castShadow = true;
    turretHead.add(cab);

    const glassMat = getSharedMat('avg_glass', () =>
      new THREE.MeshStandardMaterial({
        color: 0x0f2942,
        emissive: 0x0e4d64,
        emissiveIntensity: 0.65,
        roughness: 0.15,
        metalness: 0.85,
      })
    );
    const canopy = new THREE.Mesh(
      getSharedGeo('avg_canopy', () => new THREE.BoxGeometry(0.76, 0.36, 0.35)),
      glassMat
    );
    canopy.position.set(0, 0.56, 0.48);
    canopy.rotation.x = -0.35;
    turretHead.add(canopy);

    const flirPod = new THREE.Mesh(
      getSharedGeo('avg_flir', () => {
        const g = new THREE.CylinderGeometry(0.16, 0.18, 0.35, 8);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      gunmetalMat
    );
    flirPod.position.set(0, 0.86, 0.28);
    turretHead.add(flirPod);
    const flirGlass = new THREE.Mesh(getSharedGeo('avg_lens', () => new THREE.SphereGeometry(0.1, 6, 6)), opticGreenMat);
    flirGlass.position.set(0, 0.86, 0.46);
    turretHead.add(flirGlass);

    const podBoxGeo = getSharedGeo('avg_podbox', () => new THREE.BoxGeometry(0.54, 0.54, 1.68));
    const holeGeo = getSharedGeo('avg_hole', () => {
      const g = new THREE.CylinderGeometry(0.085, 0.085, 0.06, 6);
      g.rotateX(Math.PI / 2);
      return g;
    });

    const buildStingerPod = (x: number, y: number, bodyMat: THREE.Material, cast = false) => {
      const pod = new THREE.Group();
      pod.position.set(x, y, 0.1);
      pod.rotation.x = -0.2;
      const box = new THREE.Mesh(podBoxGeo, bodyMat);
      box.castShadow = cast;
      pod.add(box);
      for (const mx of [-0.13, 0.13]) {
        for (const my of [-0.13, 0.13]) {
          const hole = new THREE.Mesh(holeGeo, gunmetalMat);
          hole.position.set(mx, my, 0.85);
          pod.add(hole);
        }
      }
      return pod;
    };

    const podL = buildStingerPod(-0.82, 0.46, baseMat, true);
    const podR = buildStingerPod(0.82, 0.46, baseMat, true);
    turretHead.add(podL, podR);
    recoilParts.push({ obj: podL, restZ: 0.1, kick: 0.14 });
    recoilParts.push({ obj: podR, restZ: 0.1, kick: 0.14 });
    pitchKickParts.push({ obj: podL, restX: -0.2, kick: 0.1 });
    pitchKickParts.push({ obj: podR, restX: -0.2, kick: 0.1 });
    oscillators.push({ obj: flirPod, axis: 'y', base: 0, amp: 0.38, speed: 2.2, phase: 1.9 });
    registerMuzzle(podL, 0, 0, 0.92);
    registerMuzzle(podR, 0, 0, 0.92);

    const auxGun = new THREE.Group();
    auxGun.position.set(0.82, 0.02, 0.28);
    auxGun.visible = false;
    auxGun.add(new THREE.Mesh(getSharedGeo('avg_gb', () => new THREE.BoxGeometry(0.2, 0.2, 0.62)), darkArmorMat));
    const gunBarrel = new THREE.Mesh(
      getSharedGeo('avg_gbr', () => {
        const g = new THREE.CylinderGeometry(0.04, 0.05, 1.05, 6);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      gunmetalMat
    );
    gunBarrel.position.z = 0.65;
    auxGun.add(gunBarrel);
    turretHead.add(auxGun);
    tier2Parts.push(auxGun);
    recoilParts.push({ obj: auxGun, restZ: 0.28, kick: 0.18 });

    const superPodL = buildStingerPod(-0.82, 1.02, darkArmorMat);
    const superPodR = buildStingerPod(0.82, 1.02, darkArmorMat);
    superPodL.visible = false;
    superPodR.visible = false;
    turretHead.add(superPodL, superPodR);
    tier3Parts.push(superPodL, superPodR);

    const rollBar = new THREE.Mesh(
      getSharedGeo('avg_roll', () => new THREE.BoxGeometry(2.15, 0.1, 0.14)),
      goldTrimMat
    );
    rollBar.position.set(0, 1.36, 0.05);
    rollBar.visible = false;
    turretHead.add(rollBar);
    tier3Parts.push(rollBar);
  }

  // 7. IRON DOME POD — Angled 12 -> 16 -> 20-Cell Multi-Tube Point-Defense Micro-Missile Battery
  else if (tower.id === 'iron_dome_pod') {
    const pedestal = new THREE.Mesh(
      getSharedGeo('id_ped', () => new THREE.BoxGeometry(1.72, 0.44, 1.88)),
      darkArmorMat
    );
    pedestal.position.y = -0.08;
    pedestal.castShadow = true;
    turretHead.add(pedestal);

    // Side optical fire-control turret
    const trackerArm = new THREE.Mesh(
      getSharedGeo('id_tarm', () => new THREE.BoxGeometry(0.28, 0.56, 0.34)),
      gunmetalMat
    );
    trackerArm.position.set(0.92, 0.38, 0.25);
    turretHead.add(trackerArm);

    const trackerSphere = new THREE.Mesh(
      getSharedGeo('id_tsph', () => new THREE.SphereGeometry(0.26, 8, 6)),
      lightCeramicMat
    );
    trackerSphere.position.set(0.92, 0.72, 0.28);
    turretHead.add(trackerSphere);

    const trackerEye = new THREE.Mesh(
      getSharedGeo('id_teye', () => new THREE.SphereGeometry(0.11, 6, 6)),
      opticCyanMat
    );
    trackerEye.position.set(0.92, 0.72, 0.5);
    turretHead.add(trackerEye);

    // Hydraulic elevation frame
    const podCradle = new THREE.Group();
    podCradle.position.set(-0.08, 0.72, -0.05);
    podCradle.rotation.x = -0.52;
    turretHead.add(podCradle);
    recoilParts.push({ obj: podCradle, restZ: -0.05, kick: 0.18 });
    pitchKickParts.push({ obj: podCradle, restX: -0.52, kick: 0.11 });
    oscillators.push({ obj: trackerSphere, axis: 'y', base: 0, amp: 0.42, speed: 2.5, phase: 2.3 });

    const podShell = new THREE.Mesh(
      getSharedGeo('id_shell', () => new THREE.BoxGeometry(1.52, 1.06, 1.86)),
      baseMat
    );
    podShell.castShadow = true;
    podCradle.add(podShell);

    const podFrame = new THREE.Mesh(
      getSharedGeo('id_frame', () => new THREE.BoxGeometry(1.6, 1.14, 0.16)),
      gunmetalMat
    );
    podFrame.position.z = 0.88;
    podCradle.add(podFrame);

    // 4x3 = 12 visible interceptor tube mouths on the front face
    const cellGeo = getSharedGeo('id_cell', () => {
      const g = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 6);
      g.rotateX(Math.PI / 2);
      return g;
    });
    const noseCapGeo = getSharedGeo('id_ncap', () => {
      const g = new THREE.ConeGeometry(0.08, 0.12, 6);
      g.rotateX(Math.PI / 2);
      return g;
    });
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 3; row++) {
        const cx = (col - 1.5) * 0.34;
        const cy = (row - 1) * 0.31;
        const cell = new THREE.Mesh(cellGeo, gunmetalMat);
        cell.position.set(cx, cy, 0.94);
        podCradle.add(cell);
        const cap = new THREE.Mesh(noseCapGeo, lightCeramicMat);
        cap.position.set(cx, cy, 0.99);
        podCradle.add(cap);
      }
    }
    registerMuzzle(podCradle, -0.45, 0.25, 1.06);
    registerMuzzle(podCradle, 0.0, 0.0, 1.06);
    registerMuzzle(podCradle, 0.45, 0.25, 1.06);

    // Level 2: Side Counter-Rocket Ammo Drums + Top Sensor Bar
    const sideDrumGeo = getSharedGeo('id_sdrum', () => new THREE.BoxGeometry(0.38, 0.82, 1.56));
    const sideDrumL = new THREE.Mesh(sideDrumGeo, darkArmorMat);
    sideDrumL.position.set(-0.96, -0.05, 0);
    sideDrumL.visible = false;
    podCradle.add(sideDrumL);
    tier2Parts.push(sideDrumL);

    const radarPlate = new THREE.Mesh(
      getSharedGeo('id_rplate', () => new THREE.BoxGeometry(1.15, 0.34, 0.14)),
      lightCeramicMat
    );
    radarPlate.position.set(0, 0.78, -0.25);
    radarPlate.rotation.x = 0.25;
    radarPlate.visible = false;
    podCradle.add(radarPlate);
    tier2Parts.push(radarPlate);

    // Level 3: Upper 8-Cell Super-Pod Rack + Gold Command Trim
    const upperPod = new THREE.Group();
    upperPod.position.set(0, 0.86, 0.04);
    upperPod.visible = false;
    upperPod.add(new THREE.Mesh(getSharedGeo('id_upbox', () => new THREE.BoxGeometry(1.48, 0.56, 1.65)), darkArmorMat));
    for (let col = 0; col < 4; col++) {
      const cx = (col - 1.5) * 0.34;
      const cell = new THREE.Mesh(cellGeo, goldTrimMat);
      cell.position.set(cx, 0, 0.84);
      upperPod.add(cell);
    }
    podCradle.add(upperPod);
    tier3Parts.push(upperPod);

    const goldBar = new THREE.Mesh(
      getSharedGeo('id_gbar', () => new THREE.BoxGeometry(1.66, 0.12, 0.16)),
      goldTrimMat
    );
    goldBar.position.set(0, 1.2, 0.72);
    goldBar.visible = false;
    podCradle.add(goldBar);
    tier3Parts.push(goldBar);
  }

  // 7. S-400 / THAAD — Real-World Vertical Cold-Launch Strategic Anti-Ballistic TEL Battery
  else if (tower.id === 's400_thaad') {
    const oliveArmorMat = getArmorMat(0x364137, 0.58, 0.34);

    // Heavy armored 8x8 TEL deck chassis & stabilizer outrigger frame
    const chassis = new THREE.Mesh(
      getSharedGeo('s400_chas', () => new THREE.BoxGeometry(2.08, 0.46, 2.38)),
      darkArmorMat
    );
    chassis.position.set(0, -0.08, 0);
    chassis.castShadow = true;
    turretHead.add(chassis);

    // Armored forward fire-control cab with tinted command visor
    const ctrlCab = new THREE.Mesh(
      getSharedGeo('s400_cab', () => new THREE.BoxGeometry(1.66, 0.56, 0.76)),
      oliveArmorMat
    );
    ctrlCab.position.set(0, 0.38, 0.78);
    ctrlCab.castShadow = true;
    turretHead.add(ctrlCab);

    const visorMat = getGlowMat(0xf59e0b, 1.15);
    const cabVisor = new THREE.Mesh(
      getSharedGeo('s400_vis', () => new THREE.BoxGeometry(1.24, 0.16, 0.08)),
      visorMat
    );
    cabVisor.position.set(0, 0.48, 1.17);
    turretHead.add(cabVisor);

    // Rear thermal exhaust blast deflector skirt
    const blastSkirt = new THREE.Mesh(
      getSharedGeo('s400_blast', () => new THREE.BoxGeometry(1.92, 0.38, 0.55)),
      gunmetalMat
    );
    blastSkirt.position.set(0, 0.24, -1.04);
    blastSkirt.rotation.x = -0.35;
    turretHead.add(blastSkirt);

    // Twin hydraulic erection pistons supporting the vertical canister frame
    const pistonGeo = getSharedGeo('s400_pist', () => new THREE.CylinderGeometry(0.075, 0.095, 1.45, 6));
    for (const sx of [-0.76, 0.76]) {
      const piston = new THREE.Mesh(pistonGeo, lightCeramicMat);
      piston.position.set(sx, 0.72, 0.08);
      piston.rotation.x = -0.22;
      turretHead.add(piston);
    }

    // Erected Vertical Cold-Launch Canister Frame (~80 deg steep S-400/THAAD posture)
    const erector = new THREE.Group();
    erector.position.set(0, 0.36, -0.36);
    erector.rotation.x = -0.16;
    turretHead.add(erector);
    recoilParts.push({ obj: erector, restZ: -0.36, kick: 0.16 });
    pitchKickParts.push({ obj: erector, restX: -0.16, kick: 0.08 });

    const tubeGeo = getSharedGeo('s400_tube', () => new THREE.CylinderGeometry(0.24, 0.26, 2.95, 10));
    const bandGeo = getSharedGeo('s400_band', () => new THREE.CylinderGeometry(0.275, 0.275, 0.14, 10));
    const capGeo = getSharedGeo('s400_cap', () => new THREE.CylinderGeometry(0.23, 0.24, 0.1, 10));

    const buildVerticalCanister = (x: number, z: number, bodyMat: THREE.Material, capMat: THREE.Material, cast = false) => {
      const c = new THREE.Group();
      c.position.set(x, 1.45, z);
      const body = new THREE.Mesh(tubeGeo, bodyMat);
      body.castShadow = cast;
      c.add(body);
      for (const ry of [-0.95, 0, 0.95]) {
        const band = new THREE.Mesh(bandGeo, gunmetalMat);
        band.position.y = ry;
        c.add(band);
      }
      // Articulated hinged vertical cold-launch tube lid (flips open when tracking strategic targets!)
      const capPivot = new THREE.Group();
      capPivot.position.set(0, 1.48, -0.22);
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(0, 0.02, 0.22);
      capPivot.add(cap);
      c.add(capPivot);
      hatchPivots.push({ pivot: capPivot, axis: 'x', closedAngle: 0, openAngle: -1.45 });
      return c;
    };

    // Level 1: 4 Vertical Strategic Launch Tubes (2x2)
    const baseTubes: [number, number][] = [
      [-0.32, 0.26],
      [0.32, 0.26],
      [-0.32, -0.32],
      [0.32, -0.32],
    ];
    baseTubes.forEach(([tx, tz], idx) => {
      erector.add(buildVerticalCanister(tx, tz, oliveArmorMat, baseMat, idx < 2));
      registerMuzzle(erector, tx, 3.05, tz);
    });

    // Steel truss cradle binding the 4 tubes
    const trussFrame = new THREE.Mesh(
      getSharedGeo('s400_truss', () => new THREE.BoxGeometry(1.32, 0.24, 1.2)),
      gunmetalMat
    );
    trussFrame.position.set(0, 0.95, -0.03);
    erector.add(trussFrame);

    // Level 2: +2 Outer Strategic Launch Tubes (6-Tube Battery) + 92N6E Fire-Control Radar Mast
    for (const tx of [-0.88, 0.88]) {
      const extTube = buildVerticalCanister(tx, -0.03, oliveArmorMat, opticAmberMat);
      extTube.visible = false;
      erector.add(extTube);
      tier2Parts.push(extTube);
    }

    const fcRadar = new THREE.Group();
    fcRadar.position.set(0.62, 0.86, 0.78);
    fcRadar.visible = false;
    fcRadar.add(new THREE.Mesh(getSharedGeo('s400_rpole', () => new THREE.CylinderGeometry(0.07, 0.1, 0.56, 6)), gunmetalMat));
    const fcPanel = new THREE.Mesh(getSharedGeo('s400_rpan', () => new THREE.BoxGeometry(0.86, 0.44, 0.14)), lightCeramicMat);
    fcPanel.position.y = 0.42;
    fcPanel.rotation.x = -0.22;
    fcRadar.add(fcPanel);
    turretHead.add(fcRadar);
    tier2Parts.push(fcRadar);
    spinners.push({ obj: fcRadar, axis: 'y', baseSpeed: 2.2, fireSpeed: 4.2, curSpeed: 2.2 });

    // Level 3: Full 8-Tube Strategic Battery + Gold Command Gantry & Telemetry Radome
    for (const tx of [-0.88, 0.88]) {
      const rearTube = buildVerticalCanister(tx, -0.58, darkArmorMat, goldTrimMat);
      rearTube.visible = false;
      erector.add(rearTube);
      tier3Parts.push(rearTube);
    }

    const goldCollar = new THREE.Mesh(
      getSharedGeo('s400_gcol', () => new THREE.BoxGeometry(2.3, 0.14, 0.18)),
      goldTrimMat
    );
    goldCollar.position.set(0, 2.38, 0.46);
    goldCollar.visible = false;
    erector.add(goldCollar);
    tier3Parts.push(goldCollar);

    const satDome = new THREE.Mesh(
      getSharedGeo('s400_dome', () => new THREE.SphereGeometry(0.32, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2)),
      lightCeramicMat
    );
    satDome.position.set(-0.56, 0.66, 0.78);
    satDome.visible = false;
    turretHead.add(satDome);
    tier3Parts.push(satDome);
  }

  // 9. RADAR UPLINK — Phased-Array 3D Surveillance Mast + Parabolic Dish
  else {
    const serverBox = new THREE.Mesh(
      getSharedGeo('rad_srv', () => new THREE.BoxGeometry(1.35, 0.62, 1.35)),
      darkArmorMat
    );
    serverBox.position.y = 0.05;
    serverBox.castShadow = true;
    group.add(serverBox);

    const mast = new THREE.Mesh(
      getSharedGeo('rad_mast', () => new THREE.CylinderGeometry(0.22, 0.38, 1.45, 6)),
      gunmetalMat
    );
    mast.position.y = 0.98;
    mast.castShadow = true;
    group.add(mast);

    turretHead.position.y = 1.9;

    const dishFrame = new THREE.Mesh(
      getSharedGeo('rad_dish', () => new THREE.BoxGeometry(2.35, 1.05, 0.18)),
      goldTrimMat
    );
    dishFrame.rotation.x = -0.18;
    dishFrame.position.set(0, 0.35, 0);
    dishFrame.castShadow = true;
    turretHead.add(dishFrame);

    const slatGeo = getSharedGeo('rad_slat', () => new THREE.BoxGeometry(2.2, 0.08, 0.22));
    for (let i = -2; i <= 2; i++) {
      const slat = new THREE.Mesh(slatGeo, gunmetalMat);
      slat.position.set(0, 0.35 + i * 0.18, 0.04);
      slat.rotation.x = -0.18;
      turretHead.add(slat);
    }

    const feedBoom = new THREE.Mesh(
      getSharedGeo('rad_boom', () => {
        const g = new THREE.CylinderGeometry(0.05, 0.05, 0.85, 6);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      gunmetalMat
    );
    feedBoom.position.set(0, 0.35, 0.45);
    turretHead.add(feedBoom);

    const emitterMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.9,
      roughness: 0.2,
      metalness: 0.1,
    });
    pulseMats.push({ mat: emitterMat, base: 1.4, boost: 2.6 });
    const emitter = new THREE.Mesh(getSharedGeo('rad_emit', () => new THREE.OctahedronGeometry(0.18, 0)), emitterMat);
    emitter.position.set(0, 0.35, 0.92);
    turretHead.add(emitter);

    registerMuzzle(turretHead, 0, 0.35, 0.92);

    const iffBar = new THREE.Mesh(getSharedGeo('rad_iff', () => new THREE.BoxGeometry(1.75, 0.16, 0.14)), lightCeramicMat);
    iffBar.position.set(0, 1.08, 0);
    iffBar.visible = false;
    turretHead.add(iffBar);
    tier2Parts.push(iffBar);

    const satGeo = getSharedGeo('rad_sat', () => new THREE.SphereGeometry(0.28, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2));
    for (const sx of [-0.95, 0.95]) {
      const satDome = new THREE.Mesh(satGeo, lightCeramicMat);
      satDome.position.set(sx, 0.52, 0.72);
      satDome.visible = false;
      group.add(satDome);
      tier2Parts.push(satDome);
    }

    const upperArray = new THREE.Mesh(
      getSharedGeo('rad_up', () => new THREE.BoxGeometry(2.65, 0.42, 0.16)),
      goldTrimMat
    );
    upperArray.position.set(0, 1.42, 0);
    upperArray.visible = false;
    turretHead.add(upperArray);
    tier3Parts.push(upperArray);

    const topBeacon = new THREE.Mesh(getSharedGeo('rad_topb', () => new THREE.SphereGeometry(0.16, 6, 6)), opticAmberMat);
    topBeacon.position.set(0, 1.78, 0);
    topBeacon.visible = false;
    turretHead.add(topBeacon);
    tier3Parts.push(topBeacon);

    // Translucent 3D Holographic Surveillance Radar Sweep Wedge projected from dish!
    const sweepConeGeo = getSharedGeo('rad_sweep_wedge', () => {
      const g = new THREE.ConeGeometry(2.6, 7.2, 6, 1, true);
      g.translate(0, -3.6, 0);
      g.rotateX(-Math.PI / 2);
      return g;
    });
    const sweepMat = getSharedMat('rad_sweep_mat', () =>
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    const sweepWedge = new THREE.Mesh(sweepConeGeo, sweepMat);
    sweepWedge.position.set(0, 0.35, 0.65);
    turretHead.add(sweepWedge);
    spinners.push({ obj: upperArray, axis: 'y', baseSpeed: -2.4, fireSpeed: -3.2, curSpeed: -2.4 });
  }

  let recoilVal = 0;
  let altCursor = 0;
  let hatchOpenFactor = 0;
  let barrelHeat = 0;
  const restHeadY = turretHead.position.y;
  let deployProgress = playDeployAnim ? 0 : 1;

  const TOWER_SCALES: Record<string, number> = {
    s400_thaad: 0.78,
    patriot_battery: 0.76,
    radar_uplink: 0.78,
    pantsir_point: 0.8,
    system_358: 0.8,
    iron_dome_pod: 0.82,
    avenger_stinger: 0.84,
    ciws_light: 0.84,
  };
  const targetScale = TOWER_SCALES[tower.id] ?? 0.82;
  if (playDeployAnim) {
    group.scale.set(targetScale * 0.7, targetScale * 0.14, targetScale * 0.7);
    turretHead.position.y = restHeadY - 0.85;
  } else {
    group.scale.setScalar(targetScale);
  }

  const applyLevel = (level: number) => {
    tier2Parts.forEach((p) => {
      p.visible = level >= 2;
    });
    tier3Parts.forEach((p) => {
      p.visible = level >= 3;
    });
    if (level >= 3) {
      rankRingMat.color.setHex(0xfbbf24);
      rankRingMat.emissive.setHex(0xf59e0b);
      rankRingMat.emissiveIntensity = 1.5;
    } else if (level === 2) {
      rankRingMat.color.setHex(0x34d399);
      rankRingMat.emissive.setHex(0x10b981);
      rankRingMat.emissiveIntensity = 1.15;
    } else {
      rankRingMat.color.setHex(0x38bdf8);
      rankRingMat.emissive.setHex(0x0ea5e9);
      rankRingMat.emissiveIntensity = 0.7;
    }
  };

  applyLevel(initialLevel);

  const triggerRecoil = () => {
    recoilVal = 1.0;
    if (altRecoilParts.length > 0) {
      altRecoilParts[altCursor % altRecoilParts.length].val = 1.0;
      altCursor = (altCursor + 1) % altRecoilParts.length;
    }
    if (barrelHeatMat) {
      barrelHeat = Math.min(1.0, barrelHeat + 0.14);
    }
  };

  const updateAnim = (dt: number, timeSec: number, isFiring: boolean, hasLock = isFiring) => {
    // 1. Hydraulic Deployment Construction Unfold Animation (~0.52s ease-out spring)
    if (deployProgress < 1) {
      deployProgress = Math.min(1, deployProgress + dt / 0.52);
      const ease = 1 - Math.pow(1 - deployProgress, 3);
      const xz = targetScale * (0.7 + 0.3 * ease);
      const yy = targetScale * (0.14 + 0.86 * ease);
      group.scale.set(xz, yy, xz);
      turretHead.position.y = restHeadY - (1 - ease) * 0.85;
    }

    // 2. Standard Recoil & Pitch Kickback
    if (recoilVal > 0.001) {
      recoilVal = Math.max(0, recoilVal - dt * 6.2);
      for (let i = 0; i < recoilParts.length; i++) {
        const rp = recoilParts[i];
        rp.obj.position.z = rp.restZ - recoilVal * rp.kick;
      }
      for (let i = 0; i < pitchKickParts.length; i++) {
        const pk = pitchKickParts[i];
        pk.obj.rotation.x = pk.restX - recoilVal * pk.kick;
      }
    }

    // 3. Alternating Twin-Barrel Recoil (Pantsir 30mm Autocannons)
    for (let i = 0; i < altRecoilParts.length; i++) {
      const ar = altRecoilParts[i];
      if (ar.val > 0.001) {
        ar.val = Math.max(0, ar.val - dt * 8.5);
        ar.obj.position.z = ar.restZ - ar.val * ar.kick;
      }
    }

    // 4. Articulated Canister Launch Hatches (S-400 & Patriot open on target lock, seal shut when idle)
    if (hatchPivots.length > 0) {
      const goalHatch = isFiring || hasLock ? 1 : 0;
      const rate = goalHatch > hatchOpenFactor ? 5.2 : 2.1;
      hatchOpenFactor += (goalHatch - hatchOpenFactor) * Math.min(1, dt * rate);
      for (let i = 0; i < hatchPivots.length; i++) {
        const hp = hatchPivots[i];
        hp.pivot.rotation[hp.axis] = hp.closedAngle + (hp.openAngle - hp.closedAngle) * hatchOpenFactor;
      }
    }

    // 5. Inertial Gatling Spinners & Continuous Radar Arrays
    for (let i = 0; i < spinners.length; i++) {
      const sp = spinners[i];
      if (!sp.obj.visible) continue;
      const goalSpd = isFiring ? sp.fireSpeed : sp.baseSpeed;
      if (sp.inertial) {
        const accel = isFiring ? 7.5 : 2.6;
        sp.curSpeed += (goalSpd - sp.curSpeed) * Math.min(1, dt * accel);
      } else {
        sp.curSpeed = goalSpd;
      }
      sp.obj.rotation[sp.axis] += dt * sp.curSpeed;
    }

    // 6. CIWS Thermal Barrel Heat Glow Decay
    if (barrelHeatMat) {
      if (isFiring) {
        barrelHeat = Math.min(1.0, barrelHeat + dt * 0.42);
      } else {
        barrelHeat = Math.max(0, barrelHeat - dt * 0.28);
      }
      barrelHeatMat.emissiveIntensity = barrelHeat * 2.15;
    }

    // 7. Active Optical Sensor & Tracker Micro-Scanning
    for (let i = 0; i < oscillators.length; i++) {
      const osc = oscillators[i];
      const amp = isFiring ? osc.amp * 0.18 : osc.amp;
      osc.obj.rotation[osc.axis] = osc.base + Math.sin(timeSec * osc.speed + osc.phase) * amp;
    }

    // 8. Emissive Pulse Materials
    for (let i = 0; i < pulseMats.length; i++) {
      const pm = pulseMats[i];
      const wave = 0.5 + 0.5 * Math.sin(timeSec * (isFiring ? 18 : 4));
      pm.mat.emissiveIntensity = isFiring ? pm.boost * (0.8 + 0.3 * wave) : pm.base * (0.85 + 0.25 * wave);
    }
  };

  return {
    group,
    turretHead,
    firePoints,
    muzzleAnchors,
    applyLevel,
    triggerRecoil,
    updateAnim,
  };
}

// Single-Material Holographic Tower Ghost Preview (ZERO material cloning!)
export function buildTowerGhost3D(tower: DefenseTower): {
  group: THREE.Group;
  ghostMat: THREE.MeshBasicMaterial;
} {
  const rig = buildTower3D(tower, 1);
  const ghostMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
  });

  rig.group.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      // Only dispose non-shared per-tower mats (e.g. rankRingMat/plasmaMat)
      if (mesh.material && !Array.isArray(mesh.material) && !mesh.material.userData?.sharedAsset) {
        mesh.material.dispose();
      }
      mesh.material = ghostMat;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    }
  });

  return { group: rig.group, ghostMat };
}

// Detailed Airborne Enemy Builder (100% Cached Shared Geometries + Zero-Canvas HP Bar!)
export function buildEnemy3D(enemy: EnemyUnit): EnemyRig {
  const group = new THREE.Group();
  const droneMat = getArmorMat(enemy.color, 0.42, 0.45);
  const darkMat = getGunmetalMat(0x181f28, 0.4, 0.72);
  const propSpinners: THREE.Object3D[] = [];
  const flamePlumes: THREE.Object3D[] = [];
  const orbitRings: THREE.Object3D[] = [];

  const buildPropeller = (radius = 0.48) => {
    const prop = new THREE.Group();
    const b1 = getSharedGeo(`prop1_${radius}`, () => new THREE.BoxGeometry(radius * 2, 0.06, 0.03));
    const b2 = getSharedGeo(`prop2_${radius}`, () => new THREE.BoxGeometry(0.06, radius * 2, 0.03));
    prop.add(new THREE.Mesh(b1, darkMat), new THREE.Mesh(b2, darkMat));
    return prop;
  };

  if (enemy.shape === 'delta_wing') {
    const wingGeo = getSharedGeo('en_delta_wing', () => {
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 1.45);
      wingShape.lineTo(1.85, -1.05);
      wingShape.lineTo(0.48, -0.75);
      wingShape.lineTo(-0.48, -0.75);
      wingShape.lineTo(-1.85, -1.05);
      wingShape.closePath();
      const g = new THREE.ExtrudeGeometry(wingShape, {
        depth: 0.2,
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: 0.06,
        bevelThickness: 0.06,
      });
      g.center();
      g.rotateX(Math.PI / 2);
      return g;
    });
    const wingMesh = new THREE.Mesh(wingGeo, droneMat);
    wingMesh.castShadow = true;
    group.add(wingMesh);

    const tipFinGeo = getSharedGeo('en_delta_fin', () => new THREE.BoxGeometry(0.07, 0.55, 0.65));
    for (const sx of [-1.72, 1.72]) {
      const tipFin = new THREE.Mesh(tipFinGeo, darkMat);
      tipFin.position.set(sx, 0.14, -0.82);
      group.add(tipFin);
    }

    const motor = new THREE.Mesh(
      getSharedGeo('en_delta_mot', () => {
        const g = new THREE.CylinderGeometry(0.14, 0.16, 0.45, 6);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      darkMat
    );
    motor.position.z = -1.08;
    group.add(motor);

    const prop = buildPropeller(0.5);
    prop.position.z = -1.34;
    group.add(prop);
    propSpinners.push(prop);
  } else if (enemy.shape === 'heavy_bomber') {
    const fuselage = new THREE.Mesh(
      getSharedGeo('en_hb_fus', () => {
        const g = new THREE.CylinderGeometry(0.75, 0.88, 4.8, 8);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      droneMat
    );
    fuselage.castShadow = true;
    group.add(fuselage);

    const cockpit = new THREE.Mesh(
      getSharedGeo('en_hb_cock', () => new THREE.BoxGeometry(0.95, 0.35, 1.15)),
      getGlowMat(0xf43f5e, 1.4)
    );
    cockpit.position.set(0, 0.52, 1.65);
    group.add(cockpit);

    const mainWings = new THREE.Mesh(
      getSharedGeo('en_hb_wing', () => new THREE.BoxGeometry(6.8, 0.24, 1.65)),
      droneMat
    );
    mainWings.position.set(0, 0.18, 0.1);
    mainWings.castShadow = true;
    group.add(mainWings);

    const podGeo = getSharedGeo('en_hb_pod', () => {
      const g = new THREE.CylinderGeometry(0.28, 0.32, 1.6, 6);
      g.rotateX(Math.PI / 2);
      return g;
    });
    const plumeGeo = getSharedGeo('en_hb_plume', () => {
      const g = new THREE.ConeGeometry(0.26, 1.35, 6);
      g.rotateX(-Math.PI / 2);
      return g;
    });
    const plumeMat = getBasicGlowMat(0xff6b00);

    for (const sx of [-2.1, 2.1]) {
      const pod = new THREE.Mesh(podGeo, darkMat);
      pod.position.set(sx, -0.18, 0.1);
      group.add(pod);
      const plume = new THREE.Mesh(plumeGeo, plumeMat);
      plume.position.set(sx, -0.18, -1.32);
      group.add(plume);
      flamePlumes.push(plume);
    }

    const tail = new THREE.Mesh(getSharedGeo('en_hb_tail', () => new THREE.BoxGeometry(2.6, 0.16, 0.85)), droneMat);
    tail.position.set(0, 0.32, -2.0);
    group.add(tail);
    const fin = new THREE.Mesh(getSharedGeo('en_hb_fin', () => new THREE.BoxGeometry(0.18, 1.35, 0.95)), darkMat);
    fin.position.set(0, 0.95, -2.0);
    group.add(fin);
  } else if (enemy.shape === 'cruise_missile') {
    const body = new THREE.Mesh(
      getSharedGeo('en_cm_body', () => {
        const g = new THREE.CylinderGeometry(0.24, 0.26, 2.9, 6);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      droneMat
    );
    body.castShadow = true;
    group.add(body);

    const nose = new THREE.Mesh(
      getSharedGeo('en_cm_nose', () => {
        const g = new THREE.ConeGeometry(0.24, 0.82, 6);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      getArmorMat(0xe11d48, 0.3, 0.3)
    );
    nose.position.z = 1.85;
    group.add(nose);

    const fins = new THREE.Mesh(getSharedGeo('en_cm_fins', () => new THREE.BoxGeometry(1.85, 0.08, 0.52)), darkMat);
    fins.position.z = 0.15;
    group.add(fins);

    const tailFin = new THREE.Mesh(getSharedGeo('en_cm_tf', () => new THREE.BoxGeometry(0.08, 0.72, 0.45)), darkMat);
    tailFin.position.set(0, 0.28, -1.2);
    group.add(tailFin);

    const plume = new THREE.Mesh(
      getSharedGeo('en_cm_plume', () => {
        const g = new THREE.ConeGeometry(0.24, 1.45, 6);
        g.rotateX(-Math.PI / 2);
        return g;
      }),
      getBasicGlowMat(0xff7b00)
    );
    plume.position.z = -2.15;
    group.add(plume);
    flamePlumes.push(plume);
  } else if (enemy.shape === 'loiter_pod') {
    const pod = new THREE.Mesh(getSharedGeo('en_lp_pod', () => new THREE.BoxGeometry(0.32, 0.28, 1.45)), droneMat);
    pod.castShadow = true;
    group.add(pod);
    const wings = new THREE.Mesh(getSharedGeo('en_lp_w', () => new THREE.BoxGeometry(1.65, 0.05, 0.34)), darkMat);
    wings.position.set(0, 0.1, 0.15);
    group.add(wings);
    const prop = buildPropeller(0.32);
    prop.position.z = -0.82;
    group.add(prop);
    propSpinners.push(prop);
  } else if (enemy.shape === 'stealth_wing') {
    const stealthMat = getSharedMat('en_stealth_mat', () =>
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.22,
        metalness: 0.82,
        transparent: true,
        opacity: 0.62,
        flatShading: true,
      })
    );
    const wingGeo = getSharedGeo('en_stealth_geo', () => {
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 1.45);
      wingShape.lineTo(2.55, -0.58);
      wingShape.lineTo(1.15, -1.02);
      wingShape.lineTo(0, -0.45);
      wingShape.lineTo(-1.15, -1.02);
      wingShape.lineTo(-2.55, -0.58);
      wingShape.closePath();
      const g = new THREE.ExtrudeGeometry(wingShape, {
        depth: 0.18,
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: 0.06,
        bevelThickness: 0.05,
      });
      g.center();
      g.rotateX(Math.PI / 2);
      return g;
    });
    group.add(new THREE.Mesh(wingGeo, stealthMat));

    const strip = new THREE.Mesh(
      getSharedGeo('en_stealth_strip', () => new THREE.BoxGeometry(2.1, 0.06, 0.12)),
      getBasicGlowMat(0x38bdf8, 0.78)
    );
    strip.position.set(0, 0.15, 0.15);
    group.add(strip);
  } else if (enemy.shape === 'jammer_orb') {
    // Realistic Twin-Engine Electronic Warfare / AWACS Jammer Aircraft (EA-18G / Il-22PP style)
    const ewHullMat = getArmorMat(0x475569, 0.45, 0.52);
    const radomeMat = getArmorMat(0xcbd5e1, 0.36, 0.22);

    const fuselage = new THREE.Mesh(
      getSharedGeo('en_ew_fus', () => {
        const g = new THREE.CylinderGeometry(0.36, 0.42, 3.3, 8);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      ewHullMat
    );
    fuselage.castShadow = true;
    group.add(fuselage);

    const nose = new THREE.Mesh(
      getSharedGeo('en_ew_nose', () => {
        const g = new THREE.ConeGeometry(0.36, 0.92, 8);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      darkMat
    );
    nose.position.z = 2.1;
    group.add(nose);

    const wings = new THREE.Mesh(
      getSharedGeo('en_ew_wing', () => new THREE.BoxGeometry(4.4, 0.14, 0.96)),
      ewHullMat
    );
    wings.position.set(0, 0.04, 0.12);
    wings.castShadow = true;
    group.add(wings);

    // Underwing ALQ-style EW jamming pods
    const podGeo = getSharedGeo('en_ew_pod', () => {
      const g = new THREE.CylinderGeometry(0.14, 0.14, 1.35, 6);
      g.rotateX(Math.PI / 2);
      return g;
    });
    for (const sx of [-1.25, 1.25]) {
      const pod = new THREE.Mesh(podGeo, darkMat);
      pod.position.set(sx, -0.22, 0.15);
      group.add(pod);
    }

    // Dorsal AWACS / EW rotodome dish
    const strut = new THREE.Mesh(
      getSharedGeo('en_ew_str', () => new THREE.BoxGeometry(0.16, 0.48, 0.42)),
      darkMat
    );
    strut.position.set(0, 0.48, -0.2);
    group.add(strut);

    const rotodome = new THREE.Mesh(
      getSharedGeo('en_ew_dish', () => new THREE.CylinderGeometry(0.86, 0.86, 0.18, 12)),
      radomeMat
    );
    rotodome.position.set(0, 0.78, -0.2);
    group.add(rotodome);

    const tail = new THREE.Mesh(getSharedGeo('en_ew_tail', () => new THREE.BoxGeometry(1.7, 0.1, 0.52)), ewHullMat);
    tail.position.set(0, 0.15, -1.55);
    group.add(tail);
    const tailFin = new THREE.Mesh(getSharedGeo('en_ew_tfin', () => new THREE.BoxGeometry(0.12, 0.85, 0.62)), darkMat);
    tailFin.position.set(0, 0.56, -1.55);
    group.add(tailFin);

    // Subtle electromagnetic jammer sweep ring beneath aircraft
    const jamRing = new THREE.Mesh(
      getSharedGeo('en_jam_r', () => new THREE.TorusGeometry(1.45, 0.045, 5, 18)),
      getBasicGlowMat(0x818cf8, 0.48)
    );
    jamRing.rotation.x = Math.PI / 2;
    jamRing.position.y = -0.35;
    group.add(jamRing);
    orbitRings.push(jamRing);
  } else if (enemy.shape === 'ballistic_missile') {
    const body = new THREE.Mesh(
      getSharedGeo('en_bm_b', () => {
        const g = new THREE.CylinderGeometry(0.3, 0.38, 3.4, 8);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      droneMat
    );
    body.castShadow = true;
    group.add(body);

    const warhead = new THREE.Mesh(
      getSharedGeo('en_bm_w', () => {
        const g = new THREE.ConeGeometry(0.32, 1.15, 8);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      getArmorMat(0xfef08a, 0.28, 0.45)
    );
    warhead.position.z = 2.25;
    group.add(warhead);

    const finH = new THREE.Mesh(getSharedGeo('en_bm_fh', () => new THREE.BoxGeometry(1.42, 0.08, 0.72)), darkMat);
    finH.position.z = -1.25;
    group.add(finH);
    const finV = new THREE.Mesh(getSharedGeo('en_bm_fv', () => new THREE.BoxGeometry(0.08, 1.42, 0.72)), darkMat);
    finV.position.z = -1.25;
    group.add(finV);

    const plume = new THREE.Mesh(
      getSharedGeo('en_bm_plume', () => {
        const g = new THREE.ConeGeometry(0.32, 1.6, 6);
        g.rotateX(-Math.PI / 2);
        return g;
      }),
      getBasicGlowMat(0xff7b00)
    );
    plume.position.z = -2.45;
    group.add(plume);
    flamePlumes.push(plume);
  } else if (enemy.shape === 'sky_dreadnought') {
    // Realistic 4-Engine Swept-Wing Strategic Heavy Command Bomber (Tu-160 / B-52H style)
    const armorMat = getArmorMat(0x283240, 0.42, 0.58);
    const accentMat = getArmorMat(0x881337, 0.44, 0.42);
    const radomeMat = getArmorMat(0xe2e8f0, 0.35, 0.2);

    const centerHull = new THREE.Mesh(
      getSharedGeo('en_sb_fus', () => {
        const g = new THREE.CylinderGeometry(0.68, 0.82, 6.2, 10);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      armorMat
    );
    centerHull.castShadow = true;
    group.add(centerHull);

    const noseCone = new THREE.Mesh(
      getSharedGeo('en_sb_nose', () => {
        const g = new THREE.ConeGeometry(0.68, 1.9, 10);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      darkMat
    );
    noseCone.position.z = 4.02;
    group.add(noseCone);

    const cockpit = new THREE.Mesh(
      getSharedGeo('en_sb_cock', () => new THREE.BoxGeometry(0.76, 0.28, 1.05)),
      getGlowMat(0xf59e0b, 1.25)
    );
    cockpit.position.set(0, 0.56, 2.35);
    group.add(cockpit);

    // Swept strategic main wings
    const mainWing = new THREE.Mesh(
      getSharedGeo('en_sb_wing', () => {
        const s = new THREE.Shape();
        s.moveTo(0, 1.25);
        s.lineTo(4.75, -0.95);
        s.lineTo(4.45, -1.65);
        s.lineTo(0.85, -0.65);
        s.lineTo(-0.85, -0.65);
        s.lineTo(-4.45, -1.65);
        s.lineTo(-4.75, -0.95);
        s.closePath();
        const g = new THREE.ExtrudeGeometry(s, { depth: 0.24, bevelEnabled: false });
        g.rotateX(Math.PI / 2);
        return g;
      }),
      armorMat
    );
    mainWing.position.set(0, 0.16, 0.35);
    mainWing.castShadow = true;
    group.add(mainWing);

    // 4 Heavy Turbofan Engine Nacelles + Warm Afterburners
    const nacGeo = getSharedGeo('en_sb_nac', () => {
      const g = new THREE.CylinderGeometry(0.28, 0.32, 2.1, 8);
      g.rotateX(Math.PI / 2);
      return g;
    });
    const thrustGeo = getSharedGeo('en_sb_th', () => {
      const g = new THREE.ConeGeometry(0.24, 1.4, 6);
      g.rotateX(-Math.PI / 2);
      return g;
    });
    const thrustMat = getBasicGlowMat(0xff6b00);

    for (const [sx, sz] of [
      [-1.45, -0.15],
      [1.45, -0.15],
      [-2.85, -0.68],
      [2.85, -0.68],
    ]) {
      const nac = new THREE.Mesh(nacGeo, darkMat);
      nac.position.set(sx, -0.22, sz);
      group.add(nac);

      const thruster = new THREE.Mesh(thrustGeo, thrustMat);
      thruster.position.set(sx, -0.22, sz - 1.65);
      group.add(thruster);
      flamePlumes.push(thruster);
    }

    // Swept tailplane + tall strategic vertical stabilizer
    const tailPlane = new THREE.Mesh(
      getSharedGeo('en_sb_tp', () => new THREE.BoxGeometry(3.2, 0.14, 0.95)),
      armorMat
    );
    tailPlane.position.set(0, 0.25, -2.75);
    group.add(tailPlane);

    const vTail = new THREE.Mesh(
      getSharedGeo('en_sb_vt', () => new THREE.BoxGeometry(0.2, 1.85, 1.35)),
      accentMat
    );
    vTail.position.set(0, 1.15, -2.65);
    group.add(vTail);

    // Dorsal Command AWACS Radome
    const awacsMount = new THREE.Mesh(
      getSharedGeo('en_sb_am', () => new THREE.BoxGeometry(0.24, 0.55, 0.52)),
      darkMat
    );
    awacsMount.position.set(0, 0.92, -0.65);
    group.add(awacsMount);

    const awacsDish = new THREE.Mesh(
      getSharedGeo('en_sb_ad', () => new THREE.CylinderGeometry(1.15, 1.15, 0.22, 14)),
      radomeMat
    );
    awacsDish.position.set(0, 1.24, -0.65);
    group.add(awacsDish);

    const jamRing = new THREE.Mesh(
      getSharedGeo('en_dr_jr', () => new THREE.TorusGeometry(2.15, 0.055, 5, 20)),
      getBasicGlowMat(0x818cf8, 0.36)
    );
    jamRing.rotation.x = Math.PI / 2;
    jamRing.position.y = -0.45;
    group.add(jamRing);
    orbitRings.push(jamRing);
  } else if (enemy.shape === 'b2_spirit') {
    // Authentic Northrop B-2 Spirit Stealth Flying-Wing Strategic Bomber (Sawtooth W-Trailing Edge)
    const ramMat = getArmorMat(0x1f242d, 0.72, 0.24); // Matte charcoal Radar-Absorbent Material
    const panelMat = getArmorMat(0x2d3542, 0.58, 0.35);
    const cockpitGlassMat = getGlowMat(0x94a3b8, 0.55);
    const intakeMat = getGunmetalMat(0x111419, 0.4, 0.78);
    const exhaustGlowMat = getBasicGlowMat(0xf97316, 0.85);

    // 1. Primary Iconic Sawtooth Flying-Wing Planform
    const flyingWingGeo = getSharedGeo('en_b2_wing', () => {
      const s = new THREE.Shape();
      // Nose apex at +Z (in shape Y before rotateX(PI/2))
      s.moveTo(0, 2.55);
      // Swept leading edge to starboard wingtip
      s.lineTo(5.35, -0.58);
      s.lineTo(4.92, -1.25);
      // Iconic B-2 W-shaped sawtooth trailing edge
      s.lineTo(2.95, -0.35);
      s.lineTo(1.72, -1.42);
      s.lineTo(0.0, -0.62);
      s.lineTo(-1.72, -1.42);
      s.lineTo(-2.95, -0.35);
      s.lineTo(-4.92, -1.25);
      // Swept leading edge from port wingtip back to nose
      s.lineTo(-5.35, -0.58);
      s.closePath();

      const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.24,
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: 0.08,
        bevelThickness: 0.06,
      });
      g.center();
      g.rotateX(Math.PI / 2);
      return g;
    });
    const wingBody = new THREE.Mesh(flyingWingGeo, ramMat);
    wingBody.castShadow = true;
    group.add(wingBody);

    // 2. Blended Dorsal Center Fuselage Spine (raises smoothly along centerline)
    const centerSpine = new THREE.Mesh(
      getSharedGeo('en_b2_spine', () => {
        const g = new THREE.CylinderGeometry(0.42, 0.92, 2.75, 6);
        g.rotateX(Math.PI / 2);
        g.scale(1.45, 0.45, 1.0);
        return g;
      }),
      panelMat
    );
    centerSpine.position.set(0, 0.22, 0.42);
    group.add(centerSpine);

    // 3. Recessed Panoramic 4-Pane Stealth Cockpit Canopy
    const canopy = new THREE.Mesh(
      getSharedGeo('en_b2_canopy', () => new THREE.BoxGeometry(0.92, 0.16, 0.72)),
      cockpitGlassMat
    );
    canopy.position.set(0, 0.34, 1.28);
    canopy.rotation.x = 0.22;
    group.add(canopy);

    // 4. Twin Serrated Dorsal S-Duct Engine Intakes + Recessed Over-Wing Exhaust Troughs
    const intakeGeo = getSharedGeo('en_b2_in', () => new THREE.BoxGeometry(0.68, 0.26, 1.85));
    const exhaustGeo = getSharedGeo('en_b2_ex', () => new THREE.BoxGeometry(0.54, 0.08, 0.48));
    for (const sx of [-1.08, 1.08]) {
      const intake = new THREE.Mesh(intakeGeo, panelMat);
      intake.position.set(sx, 0.24, 0.18);
      group.add(intake);

      const scoop = new THREE.Mesh(
        getSharedGeo('en_b2_scoop', () => new THREE.BoxGeometry(0.56, 0.18, 0.12)),
        intakeMat
      );
      scoop.position.set(sx, 0.24, 1.12);
      group.add(scoop);

      // Shielded low-observable exhaust trough on upper trailing deck
      const exhaust = new THREE.Mesh(exhaustGeo, exhaustGlowMat);
      exhaust.position.set(sx, 0.19, -0.82);
      group.add(exhaust);
      flamePlumes.push(exhaust);
    }

    // 5. Underbelly Rotary Bomb-Bay Doors (visible when flying overhead)
    const bombBay = new THREE.Mesh(
      getSharedGeo('en_b2_bay', () => new THREE.BoxGeometry(1.55, 0.1, 1.65)),
      intakeMat
    );
    bombBay.position.set(0, -0.18, 0.12);
    group.add(bombBay);

    // 6. Subtle Formation Wingtip Marker Lights
    const tipGeo = getSharedGeo('en_b2_tip', () => new THREE.SphereGeometry(0.11, 5, 5));
    const portLight = new THREE.Mesh(tipGeo, getBasicGlowMat(0xf43f5e));
    portLight.position.set(-5.15, 0.06, -0.78);
    group.add(portLight);
    const stbdLight = new THREE.Mesh(tipGeo, getBasicGlowMat(0xf43f5e));
    stbdLight.position.set(5.15, 0.06, -0.78);
    group.add(stbdLight);
  } else if (enemy.shape === 'enemy_fighter') {
    // Sleek crimson-and-charcoal twin-tail enemy interceptor jet mirroring allied CAP fighters
    const hullMat = getArmorMat(0x272a36, 0.34, 0.68);
    const crimsonMat = getArmorMat(enemy.color, 0.32, 0.55);
    const canopyMat = getGlowMat(0xfb7185, 1.35);
    const afterburnerMat = getBasicGlowMat(0xff5500);
    const coreMat = getBasicGlowMat(0xfef08a);

    const fuselage = new THREE.Mesh(
      getSharedGeo('en_f_fus', () => new THREE.BoxGeometry(0.66, 0.3, 2.5)),
      hullMat
    );
    fuselage.castShadow = true;
    group.add(fuselage);

    const nose = new THREE.Mesh(
      getSharedGeo('en_f_nose', () => {
        const g = new THREE.ConeGeometry(0.35, 1.38, 6);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      crimsonMat
    );
    nose.position.set(0, -0.02, 1.92);
    group.add(nose);

    for (const sx of [-0.44, 0.44]) {
      const intake = new THREE.Mesh(
        getSharedGeo('en_f_in', () => new THREE.BoxGeometry(0.26, 0.22, 1.36)),
        darkMat
      );
      intake.position.set(sx, -0.04, 0.22);
      group.add(intake);
    }

    const canopy = new THREE.Mesh(
      getSharedGeo('en_f_can', () => new THREE.BoxGeometry(0.34, 0.22, 0.94)),
      canopyMat
    );
    canopy.position.set(0, 0.22, 0.62);
    group.add(canopy);

    const mainWing = new THREE.Mesh(
      getSharedGeo('en_f_wing', () => {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0.92);
        shape.lineTo(2.3, -0.52);
        shape.lineTo(2.15, -0.96);
        shape.lineTo(0.45, -0.64);
        shape.lineTo(-0.45, -0.64);
        shape.lineTo(-2.15, -0.96);
        shape.lineTo(-2.3, -0.52);
        shape.closePath();
        const g = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
        g.rotateX(Math.PI / 2);
        return g;
      }),
      hullMat
    );
    mainWing.position.set(0, 0.04, 0.02);
    mainWing.castShadow = true;
    group.add(mainWing);

    for (const sx of [-1.22, 1.22]) {
      const stripe = new THREE.Mesh(
        getSharedGeo('en_f_str', () => new THREE.BoxGeometry(0.72, 0.095, 0.24)),
        crimsonMat
      );
      stripe.position.set(sx, 0.045, -0.36);
      group.add(stripe);
    }

    const tailFinGeo = getSharedGeo('en_f_tfin', () => new THREE.BoxGeometry(0.08, 0.72, 0.76));
    for (const sx of [-0.48, 0.48]) {
      const fin = new THREE.Mesh(tailFinGeo, crimsonMat);
      fin.position.set(sx, 0.36, -1.02);
      fin.rotation.z = sx < 0 ? 0.36 : -0.36;
      group.add(fin);
    }

    const elevon = new THREE.Mesh(
      getSharedGeo('en_f_el', () => new THREE.BoxGeometry(1.72, 0.07, 0.42)),
      darkMat
    );
    elevon.position.set(0, -0.02, -1.16);
    group.add(elevon);

    const nozzleGeo = getSharedGeo('en_f_noz', () => {
      const g = new THREE.CylinderGeometry(0.15, 0.17, 0.32, 8);
      g.rotateX(Math.PI / 2);
      return g;
    });
    const plumeGeo = getSharedGeo('en_f_pl', () => {
      const g = new THREE.ConeGeometry(0.16, 1.35, 6);
      g.rotateX(-Math.PI / 2);
      return g;
    });
    const coreGeo = getSharedGeo('en_f_pc', () => {
      const g = new THREE.ConeGeometry(0.08, 0.82, 6);
      g.rotateX(-Math.PI / 2);
      return g;
    });
    for (const sx of [-0.22, 0.22]) {
      const nozzle = new THREE.Mesh(nozzleGeo, darkMat);
      nozzle.position.set(sx, -0.02, -1.36);
      group.add(nozzle);

      const plume = new THREE.Mesh(plumeGeo, afterburnerMat);
      plume.position.set(sx, -0.02, -2.14);
      group.add(plume);
      flamePlumes.push(plume);

      const core = new THREE.Mesh(coreGeo, coreMat);
      core.position.set(sx, -0.02, -1.88);
      group.add(core);
      flamePlumes.push(core);
    }
  } else {
    // Swept tactical UAV (Karrar / Mohajer / Reaper)
    const body = new THREE.Mesh(
      getSharedGeo('en_sw_b', () => {
        const g = new THREE.CylinderGeometry(0.32, 0.44, 2.6, 8);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      droneMat
    );
    body.castShadow = true;
    group.add(body);

    const nose = new THREE.Mesh(
      getSharedGeo('en_sw_n', () => {
        const g = new THREE.ConeGeometry(0.32, 0.88, 8);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      droneMat
    );
    nose.position.z = 1.65;
    group.add(nose);

    const wings = new THREE.Mesh(getSharedGeo('en_sw_w', () => new THREE.BoxGeometry(3.85, 0.12, 0.72)), droneMat);
    wings.position.set(0, 0.15, 0.2);
    wings.castShadow = true;
    group.add(wings);

    const vTail = new THREE.Mesh(getSharedGeo('en_sw_t', () => new THREE.BoxGeometry(1.35, 0.1, 0.42)), darkMat);
    vTail.position.set(0, 0.24, -1.18);
    group.add(vTail);

    if (enemy.id === 'karrar_strike') {
      const plume = new THREE.Mesh(
        getSharedGeo('en_sw_plume', () => {
          const g = new THREE.ConeGeometry(0.22, 1.1, 6);
          g.rotateX(-Math.PI / 2);
          return g;
        }),
        getBasicGlowMat(0xff7b00)
      );
      plume.position.z = -1.78;
      group.add(plume);
      flamePlumes.push(plume);
    } else {
      const prop = buildPropeller(0.55);
      prop.position.z = -1.42;
      group.add(prop);
      propSpinners.push(prop);
    }
  }

  if (enemy.shape !== 'stealth_wing') {
    const navHex =
      enemy.shape === 'jammer_orb'
        ? 0xc084fc
        : enemy.shape === 'cruise_missile' || enemy.shape === 'ballistic_missile'
        ? 0xff5500
        : 0xf43f5e;
    const navGlow = new THREE.Mesh(
      getSharedGeo(enemy.isBoss ? 'en_nav_b' : 'en_nav_s', () => new THREE.SphereGeometry(enemy.isBoss ? 0.36 : 0.15, 5, 5)),
      getBasicGlowMat(navHex)
    );
    navGlow.position.set(0, 0.12, enemy.isBoss ? -3.2 : -1.05);
    group.add(navGlow);
  }

  const hpBarClass: 'small' | 'medium' | 'boss' = enemy.isBoss
    ? 'boss'
    : enemy.shape === 'loiter_pod' ||
        enemy.shape === 'delta_wing' ||
        enemy.shape === 'swept_drone' ||
        enemy.shape === 'scout_hex'
      ? 'small'
      : 'medium';
  const healthBar = createHealthBarBillboard(enemy.hp, hpBarClass);
  group.add(healthBar.mesh);

  // Calibrated realistic military proportions relative to HQ bunker & defense towers
  const enemyScale =
    enemy.shape === 'b2_spirit'
      ? 0.62
      : enemy.shape === 'sky_dreadnought'
        ? 0.56
        : enemy.shape === 'heavy_bomber'
          ? 0.56
          : enemy.shape === 'enemy_fighter'
            ? 0.62
            : enemy.shape === 'jammer_orb'
              ? 0.56
              : enemy.shape === 'stealth_wing'
                ? 0.54
                : enemy.shape === 'ballistic_missile'
                  ? 0.52
                  : enemy.shape === 'cruise_missile'
                    ? 0.48
                    : enemy.shape === 'loiter_pod'
                      ? 0.38
                      : enemy.id === 'arash_long_range' || enemy.id === 'reaper_hunter'
                        ? 0.54
                        : enemy.shape === 'delta_wing'
                          ? 0.46
                          : 0.48;
  group.scale.setScalar(enemyScale);
  healthBar.mesh.scale.setScalar(1 / enemyScale);

  const phaseOffset = Math.random() * 10;
  const updateAnim = (dt: number, timeSec: number, cameraQuat?: THREE.Quaternion) => {
    for (let i = 0; i < propSpinners.length; i++) {
      propSpinners[i].rotation.z += dt * 34;
    }
    for (let i = 0; i < flamePlumes.length; i++) {
      const flicker = 0.82 + 0.36 * Math.sin(timeSec * 42 + i * 2.1 + phaseOffset);
      flamePlumes[i].scale.set(1, flicker, 1);
    }
    for (let i = 0; i < orbitRings.length; i++) {
      orbitRings[i].rotation.z += dt * 2.4;
      const pulse = 0.92 + 0.14 * Math.sin(timeSec * 6 + phaseOffset);
      orbitRings[i].scale.setScalar(pulse);
    }
    if (cameraQuat) {
      // Counter-rotate parent yaw so 3D HP bar always faces camera cleanly!
      healthBar.mesh.quaternion.copy(group.quaternion).invert().multiply(cameraQuat);
    }
  };

  return { group, healthBar, updateAnim };
}

// Center Air Base Command Bunker & Fortified HQ with rotating surveillance radar
export function buildBaseBunker3D(): BunkerRig {
  const baseGroup = new THREE.Group();

  const concreteMat = getArmorMat(0x3b4758, 0.78, 0.18);
  const armorMat = getArmorMat(0x212c3b, 0.42, 0.6);
  const gunmetalMat = getGunmetalMat(0x161d26, 0.35, 0.8);
  const domeMat = getArmorMat(0xdbe6f2, 0.32, 0.2);

  const baseRing = new THREE.Mesh(
    getSharedGeo('hq_ring', () => new THREE.CylinderGeometry(3.25, 3.68, 0.56, 8)),
    concreteMat
  );
  baseRing.position.y = 0.28;
  baseRing.castShadow = true;
  baseRing.receiveShadow = true;
  baseGroup.add(baseRing);

  const cornerLightMat = getGlowMat(0xf59e0b, 1.5);
  const barrierGeo = getSharedGeo('hq_bar', () => new THREE.BoxGeometry(1.5, 0.46, 0.32));
  const lampGeo = getSharedGeo('hq_lamp', () => new THREE.BoxGeometry(0.16, 0.16, 0.16));
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const barrier = new THREE.Mesh(barrierGeo, concreteMat);
    barrier.position.set(Math.sin(a) * 3.72, 0.23, Math.cos(a) * 3.72);
    barrier.rotation.y = a;
    baseGroup.add(barrier);

    const lamp = new THREE.Mesh(lampGeo, cornerLightMat);
    lamp.position.set(Math.sin(a) * 3.72, 0.54, Math.cos(a) * 3.72);
    baseGroup.add(lamp);
  }

  const bunker = new THREE.Mesh(
    getSharedGeo('hq_bunk', () => new THREE.CylinderGeometry(2.4, 2.82, 1.28, 8)),
    armorMat
  );
  bunker.position.y = 1.18;
  bunker.castShadow = true;
  bunker.receiveShadow = true;
  baseGroup.add(bunker);

  const roofRim = new THREE.Mesh(
    getSharedGeo('hq_rim', () => new THREE.CylinderGeometry(2.55, 2.42, 0.18, 8)),
    gunmetalMat
  );
  roofRim.position.y = 1.84;
  baseGroup.add(roofRim);

  const winMat = getGlowMat(0xfde68a, 1.5);
  const winGeo = getSharedGeo('hq_win', () => new THREE.BoxGeometry(0.74, 0.22, 0.1));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const win = new THREE.Mesh(winGeo, winMat);
    win.position.set(Math.sin(a) * 2.58, 1.24, Math.cos(a) * 2.58);
    win.rotation.y = a;
    baseGroup.add(win);
  }

  const dome = new THREE.Mesh(
    getSharedGeo('hq_dome', () => new THREE.SphereGeometry(1.28, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2)),
    domeMat
  );
  dome.position.y = 1.88;
  dome.castShadow = true;
  baseGroup.add(dome);

  const hqRadarPivot = new THREE.Group();
  hqRadarPivot.position.set(1.55, 2.05, 0.72);
  hqRadarPivot.add(new THREE.Mesh(getSharedGeo('hq_rp', () => new THREE.CylinderGeometry(0.08, 0.12, 0.65, 6)), gunmetalMat));
  const hqDish = new THREE.Mesh(
    getSharedGeo('hq_rd', () => new THREE.BoxGeometry(1.18, 0.34, 0.1)),
    getArmorMat(0xd4a438, 0.35, 0.72)
  );
  hqDish.position.y = 0.42;
  hqRadarPivot.add(hqDish);
  baseGroup.add(hqRadarPivot);

  const mast = new THREE.Mesh(
    getSharedGeo('hq_mast', () => new THREE.CylinderGeometry(0.07, 0.12, 2.1, 6)),
    gunmetalMat
  );
  mast.position.y = 2.95;
  baseGroup.add(mast);

  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xff2a55,
    emissive: 0xff2a55,
    emissiveIntensity: 2.0,
    roughness: 0.2,
    metalness: 0.1,
  });
  const beacon = new THREE.Mesh(getSharedGeo('hq_beac', () => new THREE.SphereGeometry(0.2, 6, 6)), beaconMat);
  beacon.position.y = 4.05;
  baseGroup.add(beacon);

  // Diegetic perimeter damage warning ring (activates below 65% HP, turns crimson below 30% HP)
  const damageRingMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const damageRing = new THREE.Mesh(
    getSharedGeo('hq_dmg_ring', () => new THREE.RingGeometry(3.45, 3.82, 24)),
    damageRingMat
  );
  damageRing.rotation.x = -Math.PI / 2;
  damageRing.position.y = 0.2;
  damageRing.visible = false;
  baseGroup.add(damageRing);

  // Translucent Emerald Energy Shield Dome (activates briefly on Emergency Repair E!)
  const shieldMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    transparent: true,
    opacity: 0,
    wireframe: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shieldDome = new THREE.Mesh(
    getSharedGeo('hq_shield', () => new THREE.SphereGeometry(4.4, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56)),
    shieldMat
  );
  shieldDome.position.y = 0.05;
  shieldDome.visible = false;
  baseGroup.add(shieldDome);

  // Twin rooftop armored ventilation cooling fans + oscillating tactical satcom dish
  const hqFans: THREE.Object3D[] = [];
  const fanHousingGeo = getSharedGeo('hq_fan_h', () => new THREE.CylinderGeometry(0.32, 0.34, 0.14, 8));
  const fanBladeGeo = getSharedGeo('hq_fan_b', () => new THREE.BoxGeometry(0.48, 0.04, 0.09));
  for (const [fx, fz] of [
    [-1.45, -0.78],
    [-1.45, 0.78],
  ] as [number, number][]) {
    const housing = new THREE.Mesh(fanHousingGeo, gunmetalMat);
    housing.position.set(fx, 1.94, fz);
    baseGroup.add(housing);
    const rotor = new THREE.Group();
    rotor.position.set(fx, 2.02, fz);
    const b1 = new THREE.Mesh(fanBladeGeo, concreteMat);
    const b2 = new THREE.Mesh(fanBladeGeo, concreteMat);
    b2.rotation.y = Math.PI / 2;
    rotor.add(b1, b2);
    baseGroup.add(rotor);
    hqFans.push(rotor);
  }

  const satcomPivot = new THREE.Group();
  satcomPivot.position.set(1.5, 2.02, -0.82);
  const satDish = new THREE.Mesh(
    getSharedGeo('hq_sat', () => new THREE.CylinderGeometry(0.46, 0.16, 0.18, 8)),
    domeMat
  );
  satDish.rotation.x = Math.PI / 3;
  satDish.position.y = 0.25;
  satcomPivot.add(satDish);
  baseGroup.add(satcomPivot);

  const updateAnim = (dt: number, timeSec: number, hpRatio = 1, shieldTimer = 0, alertLevel = 0) => {
    hqRadarPivot.rotation.y += dt * (1.45 + alertLevel * 1.15);
    satcomPivot.rotation.y = Math.sin(timeSec * 0.75) * 0.65;
    for (let i = 0; i < hqFans.length; i++) {
      hqFans[i].rotation.y += dt * (7.5 + i * 1.5);
    }

    const critical = hpRatio < 0.35;
    const damaged = hpRatio < 0.65;
    const pulseRate = critical ? 11.0 : alertLevel > 0.5 ? 8.5 : damaged ? 7.0 : 4.5;
    beaconMat.emissiveIntensity = (1.1 + alertLevel * 0.9) + 1.6 * (0.5 + 0.5 * Math.sin(timeSec * pulseRate));

    if (damaged) {
      damageRing.visible = true;
      damageRingMat.color.setHex(critical ? 0xef4444 : 0xf59e0b);
      damageRingMat.opacity = (critical ? 0.45 : 0.25) + 0.25 * (0.5 + 0.5 * Math.sin(timeSec * pulseRate));
    } else if (damageRing.visible) {
      damageRing.visible = false;
    }

    if (shieldTimer > 0.01) {
      shieldDome.visible = true;
      shieldDome.rotation.y += dt * 0.85;
      const alpha = Math.min(1, shieldTimer / 0.5);
      shieldMat.opacity = 0.34 * alpha;
    } else if (shieldDome.visible) {
      shieldDome.visible = false;
    }
  };

  return { group: baseGroup, updateAnim };
}

export interface AllyFighterRig {
  group: THREE.Group;
  pylons: THREE.Object3D[];
  updateAnim: (dt: number, timeSec: number) => void;
}

/**
 * Builds a sleek multi-part procedural twin-tail air-superiority interceptor jet (Scramble CAP).
 * Oriented along +Z nose-forward so lookAt + banking align cleanly with combat kinematics.
 */
export function buildAllyFighter3D(): AllyFighterRig {
  const group = new THREE.Group();
  const hullMat = getArmorMat(0xcbd5e1, 0.34, 0.62);
  const darkTrimMat = getArmorMat(0x1e293b, 0.42, 0.72);
  const accentMat = getArmorMat(0x0284c7, 0.35, 0.55);
  const canopyMat = getGlowMat(0x38bdf8, 0.95);
  const afterburnerMat = getBasicGlowMat(0x38bdf8);
  const afterburnerCoreMat = getBasicGlowMat(0xe0f2fe);
  const strobeMat = getBasicGlowMat(0x22d3ee);

  // 1. Primary sculpted fuselage + sharp radome nose
  const fuselage = new THREE.Mesh(
    getSharedGeo('ally_fuselage', () => new THREE.BoxGeometry(0.68, 0.32, 2.55)),
    hullMat
  );
  fuselage.castShadow = true;
  group.add(fuselage);

  const nose = new THREE.Mesh(
    getSharedGeo('ally_nose', () => {
      const g = new THREE.ConeGeometry(0.36, 1.35, 6);
      g.rotateX(Math.PI / 2);
      return g;
    }),
    darkTrimMat
  );
  nose.position.set(0, -0.02, 1.92);
  group.add(nose);

  // 2. Twin side air intakes + tinted cockpit canopy
  for (const sx of [-0.46, 0.46]) {
    const intake = new THREE.Mesh(
      getSharedGeo('ally_intake', () => new THREE.BoxGeometry(0.28, 0.24, 1.4)),
      darkTrimMat
    );
    intake.position.set(sx, -0.04, 0.25);
    group.add(intake);
  }

  const canopy = new THREE.Mesh(
    getSharedGeo('ally_canopy', () => new THREE.BoxGeometry(0.36, 0.22, 0.96)),
    canopyMat
  );
  canopy.position.set(0, 0.22, 0.62);
  group.add(canopy);

  // 3. Swept diamond delta main wings + blue squadron stripes
  const mainWing = new THREE.Mesh(
    getSharedGeo('ally_wing', () => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0.85);
      shape.lineTo(2.35, -0.45);
      shape.lineTo(2.25, -0.92);
      shape.lineTo(0.45, -0.68);
      shape.lineTo(-0.45, -0.68);
      shape.lineTo(-2.25, -0.92);
      shape.lineTo(-2.35, -0.45);
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
      g.rotateX(Math.PI / 2);
      return g;
    }),
    hullMat
  );
  mainWing.position.set(0, 0.04, 0.02);
  mainWing.castShadow = true;
  group.add(mainWing);

  for (const sx of [-1.25, 1.25]) {
    const stripe = new THREE.Mesh(
      getSharedGeo('ally_stripe', () => new THREE.BoxGeometry(0.68, 0.095, 0.22)),
      accentMat
    );
    stripe.position.set(sx, 0.04, -0.35);
    group.add(stripe);
  }

  // 4. Twin canted V-tail vertical stabilizers + rear elevons
  const tailFinGeo = getSharedGeo('ally_tail_fin', () => new THREE.BoxGeometry(0.08, 0.72, 0.75));
  for (const sx of [-0.48, 0.48]) {
    const fin = new THREE.Mesh(tailFinGeo, accentMat);
    fin.position.set(sx, 0.36, -1.02);
    fin.rotation.z = sx < 0 ? 0.34 : -0.34;
    group.add(fin);
  }

  const elevon = new THREE.Mesh(
    getSharedGeo('ally_elevon', () => new THREE.BoxGeometry(1.75, 0.07, 0.44)),
    darkTrimMat
  );
  elevon.position.set(0, -0.02, -1.16);
  group.add(elevon);

  // 5. Twin exhaust nozzles + animated glowing cyan afterburners
  const plumes: THREE.Mesh[] = [];
  const nozzleGeo = getSharedGeo('ally_nozzle', () => {
    const g = new THREE.CylinderGeometry(0.16, 0.18, 0.34, 8);
    g.rotateX(Math.PI / 2);
    return g;
  });
  const plumeGeo = getSharedGeo('ally_plume', () => {
    const g = new THREE.ConeGeometry(0.16, 1.35, 6);
    g.rotateX(-Math.PI / 2);
    return g;
  });
  const coreGeo = getSharedGeo('ally_plume_core', () => {
    const g = new THREE.ConeGeometry(0.08, 0.85, 6);
    g.rotateX(-Math.PI / 2);
    return g;
  });

  for (const sx of [-0.22, 0.22]) {
    const nozzle = new THREE.Mesh(nozzleGeo, darkTrimMat);
    nozzle.position.set(sx, -0.02, -1.38);
    group.add(nozzle);

    const plume = new THREE.Mesh(plumeGeo, afterburnerMat);
    plume.position.set(sx, -0.02, -2.18);
    group.add(plume);
    plumes.push(plume);

    const core = new THREE.Mesh(coreGeo, afterburnerCoreMat);
    core.position.set(sx, -0.02, -1.92);
    group.add(core);
    plumes.push(core);
  }

  // 6. Wingtip cyan navigation strobes + underwing weapon pylons
  const pylons: THREE.Object3D[] = [];
  for (const sx of [-2.22, 2.22]) {
    const strobe = new THREE.Mesh(
      getSharedGeo('ally_strobe', () => new THREE.SphereGeometry(0.09, 5, 5)),
      strobeMat
    );
    strobe.position.set(sx, 0.02, -0.68);
    group.add(strobe);
  }
  for (const sx of [-1.15, 1.15]) {
    const pylon = new THREE.Object3D();
    pylon.position.set(sx, -0.18, 0.15);
    group.add(pylon);
    pylons.push(pylon);
  }

  // Realistic military scale matching enemy interceptor jets & defense towers
  group.scale.setScalar(0.64);

  const updateAnim = (_dt: number, timeSec: number) => {
    const pulse = 0.86 + 0.24 * Math.sin(timeSec * 36.0);
    for (let i = 0; i < plumes.length; i++) {
      plumes[i].scale.set(1, 1, pulse);
    }
  };

  return { group, pylons, updateAnim };
}

export interface SecondaryFacilityRig {
  group: THREE.Group;
  intactGroup: THREE.Group;
  ruinedGroup: THREE.Group;
  healthBar: { mesh: THREE.Object3D; updateHp: (current: number, maxOverride?: number) => void };
  setDestroyed: () => void;
  updateAnim: (timeSec: number, cameraQuat?: THREE.Quaternion) => void;
}

/**
 * Builds destructible secondary base structures for special & hard defense missions:
 * - 'ammo_bunker': Reinforced concrete arched munitions/command bunker with blast door & hessco walls
 * - 'fuel_depot': Twin armored horizontal cylindrical fuel tanks + piping manifold & power substation
 */
export function buildSecondaryFacility3D(kind: FacilityKind, maxHp: number): SecondaryFacilityRig {
  const group = new THREE.Group();
  const intactGroup = new THREE.Group();
  const ruinedGroup = new THREE.Group();
  ruinedGroup.visible = false;
  group.add(intactGroup);
  group.add(ruinedGroup);

  const concreteMat = getArmorMat(0x475569, 0.82, 0.14);
  const darkConcreteMat = getArmorMat(0x334155, 0.84, 0.16);
  const steelMat = getGunmetalMat(0x1e293b, 0.42, 0.72);
  const sandbagMat = getArmorMat(0x7c6f5b, 0.88, 0.08);
  const hazardMat = getArmorMat(0xd97706, 0.54, 0.25);
  const charredMat = getArmorMat(0x16181d, 0.92, 0.12);
  const emberMat = getGlowMat(0xf97316, 1.35);

  // Grounded concrete foundation apron shared between intact & ruined states
  const apron = new THREE.Mesh(
    getSharedGeo('fac_apron', () => new THREE.BoxGeometry(4.4, 0.24, 3.8)),
    darkConcreteMat
  );
  apron.position.y = 0.12;
  apron.receiveShadow = true;
  group.add(apron);

  let beaconMat: THREE.MeshStandardMaterial | null = null;
  const spinParts: THREE.Object3D[] = [];

  if (kind === 'ammo_bunker') {
    // 1. Reinforced half-cylinder concrete arch roof
    const arch = new THREE.Mesh(
      getSharedGeo('fac_bk_arch', () => {
        const g = new THREE.CylinderGeometry(1.38, 1.48, 2.95, 10, 1, false, 0, Math.PI);
        g.rotateZ(Math.PI / 2);
        g.rotateY(Math.PI / 2);
        return g;
      }),
      concreteMat
    );
    arch.position.set(0, 0.24, 0);
    arch.castShadow = true;
    arch.receiveShadow = true;
    intactGroup.add(arch);

    // 2. Front & rear armored concrete bulkheads
    const bulkhead = new THREE.Mesh(
      getSharedGeo('fac_bk_wall', () => new THREE.BoxGeometry(2.72, 1.36, 2.7)),
      darkConcreteMat
    );
    bulkhead.position.set(0, 0.92, 0);
    bulkhead.castShadow = true;
    intactGroup.add(bulkhead);

    // 3. Recessed heavy steel blast door + amber hazard lintel
    const door = new THREE.Mesh(
      getSharedGeo('fac_bk_door', () => new THREE.BoxGeometry(1.18, 0.94, 0.18)),
      steelMat
    );
    door.position.set(0, 0.72, 1.38);
    intactGroup.add(door);

    const lintel = new THREE.Mesh(
      getSharedGeo('fac_bk_lin', () => new THREE.BoxGeometry(1.48, 0.16, 0.22)),
      hazardMat
    );
    lintel.position.set(0, 1.24, 1.38);
    intactGroup.add(lintel);

    // 4. Perimeter protective Hesco / sandbag blast walls
    const wallGeo = getSharedGeo('fac_bk_sb', () => new THREE.BoxGeometry(0.42, 0.56, 2.85));
    for (const sx of [-1.86, 1.86]) {
      const sb = new THREE.Mesh(wallGeo, sandbagMat);
      sb.position.set(sx, 0.52, 0);
      sb.castShadow = true;
      intactGroup.add(sb);
    }

    // 5. Roof armored vent hood with spinning cooling fan & status beacon
    const vent = new THREE.Mesh(
      getSharedGeo('fac_bk_vent', () => new THREE.BoxGeometry(0.68, 0.34, 0.68)),
      steelMat
    );
    vent.position.set(-0.55, 1.76, -0.35);
    intactGroup.add(vent);

    const facFan = new THREE.Group();
    facFan.position.set(-0.55, 1.96, -0.35);
    const fbGeo = getSharedGeo('fac_fan_b', () => new THREE.BoxGeometry(0.48, 0.04, 0.08));
    const fb1 = new THREE.Mesh(fbGeo, hazardMat);
    const fb2 = new THREE.Mesh(fbGeo, hazardMat);
    fb2.rotation.y = Math.PI / 2;
    facFan.add(fb1, fb2);
    intactGroup.add(facFan);
    spinParts.push(facFan);

    beaconMat = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x10b981,
      emissiveIntensity: 1.5,
      roughness: 0.25,
      metalness: 0.15,
    });
    const beacon = new THREE.Mesh(getSharedGeo('fac_beac', () => new THREE.SphereGeometry(0.14, 6, 6)), beaconMat);
    beacon.position.set(0.75, 1.82, 0.65);
    intactGroup.add(beacon);

    // Ruined Bunker Sub-group
    const collapsedLeft = new THREE.Mesh(
      getSharedGeo('fac_bk_r1', () => new THREE.BoxGeometry(1.25, 0.72, 2.3)),
      charredMat
    );
    collapsedLeft.position.set(-0.82, 0.52, 0.05);
    collapsedLeft.rotation.z = 0.28;
    ruinedGroup.add(collapsedLeft);

    const collapsedRight = new THREE.Mesh(
      getSharedGeo('fac_bk_r2', () => new THREE.BoxGeometry(1.15, 0.58, 2.1)),
      charredMat
    );
    collapsedRight.position.set(0.78, 0.44, -0.1);
    collapsedRight.rotation.z = -0.34;
    ruinedGroup.add(collapsedRight);

    const emberCore = new THREE.Mesh(
      getSharedGeo('fac_ember', () => new THREE.CylinderGeometry(0.72, 0.95, 0.14, 8)),
      emberMat
    );
    emberCore.position.set(0, 0.28, 0);
    ruinedGroup.add(emberCore);
  } else {
    // FUEL & POWER DEPOT
    const tankMat = getArmorMat(0x94a3b8, 0.42, 0.56);
    const redStripeMat = getArmorMat(0xdc2626, 0.48, 0.28);

    // 1. Twin Horizontal Pressurized Fuel Tanks on Concrete Saddles
    const tankGeo = getSharedGeo('fac_fl_tank', () => {
      const g = new THREE.CylinderGeometry(0.62, 0.62, 2.85, 12);
      g.rotateZ(Math.PI / 2);
      return g;
    });
    const stripeGeo = getSharedGeo('fac_fl_str', () => {
      const g = new THREE.CylinderGeometry(0.64, 0.64, 0.26, 12);
      g.rotateZ(Math.PI / 2);
      return g;
    });
    const saddleGeo = getSharedGeo('fac_fl_sad', () => new THREE.BoxGeometry(0.28, 0.52, 1.05));

    for (const sz of [-0.72, 0.72]) {
      const tank = new THREE.Mesh(tankGeo, tankMat);
      tank.position.set(-0.22, 1.02, sz);
      tank.castShadow = true;
      tank.receiveShadow = true;
      intactGroup.add(tank);

      const stripe = new THREE.Mesh(stripeGeo, redStripeMat);
      stripe.position.set(-0.22, 1.02, sz);
      intactGroup.add(stripe);

      for (const sx of [-1.05, 0.62]) {
        const saddle = new THREE.Mesh(saddleGeo, concreteMat);
        saddle.position.set(sx, 0.48, sz);
        intactGroup.add(saddle);
      }
    }

    // 2. Overhead Steel Manifold Piping
    const pipe = new THREE.Mesh(
      getSharedGeo('fac_fl_pipe', () => {
        const g = new THREE.CylinderGeometry(0.11, 0.11, 1.65, 6);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      hazardMat
    );
    pipe.position.set(-0.22, 1.72, 0);
    intactGroup.add(pipe);

    // 3. Armored Power Transformer Cabinet on East End
    const xfmr = new THREE.Mesh(
      getSharedGeo('fac_fl_xf', () => new THREE.BoxGeometry(0.86, 1.32, 1.88)),
      steelMat
    );
    xfmr.position.set(1.48, 0.9, 0);
    xfmr.castShadow = true;
    intactGroup.add(xfmr);

    beaconMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.5,
      roughness: 0.25,
      metalness: 0.15,
    });
    const beacon = new THREE.Mesh(getSharedGeo('fac_beac', () => new THREE.SphereGeometry(0.14, 6, 6)), beaconMat);
    beacon.position.set(1.48, 1.72, 0);
    intactGroup.add(beacon);

    // Spinning cooling turbine fan on top of transformer substation
    const fuelFan = new THREE.Group();
    fuelFan.position.set(1.48, 1.6, -0.58);
    const ffbGeo = getSharedGeo('fac_fan_b', () => new THREE.BoxGeometry(0.48, 0.04, 0.08));
    const ffb1 = new THREE.Mesh(ffbGeo, hazardMat);
    const ffb2 = new THREE.Mesh(ffbGeo, hazardMat);
    ffb2.rotation.y = Math.PI / 2;
    fuelFan.add(ffb1, ffb2);
    intactGroup.add(fuelFan);
    spinParts.push(fuelFan);

    // Ruined Fuel Depot Sub-group
    const scorchedTank = new THREE.Mesh(
      getSharedGeo('fac_fl_rt', () => {
        const g = new THREE.CylinderGeometry(0.56, 0.52, 2.2, 8);
        g.rotateZ(Math.PI / 2);
        return g;
      }),
      charredMat
    );
    scorchedTank.position.set(-0.25, 0.56, 0.32);
    scorchedTank.rotation.y = 0.24;
    scorchedTank.rotation.z = -0.18;
    ruinedGroup.add(scorchedTank);

    const emberCore = new THREE.Mesh(
      getSharedGeo('fac_ember', () => new THREE.CylinderGeometry(0.72, 0.95, 0.14, 8)),
      emberMat
    );
    emberCore.position.set(0.1, 0.28, -0.25);
    ruinedGroup.add(emberCore);
  }

  const healthBar = createHealthBarBillboard(maxHp, 'medium');
  healthBar.mesh.position.y = 2.65;
  group.add(healthBar.mesh);

  let destroyed = false;
  const setDestroyed = () => {
    destroyed = true;
    intactGroup.visible = false;
    ruinedGroup.visible = true;
    healthBar.mesh.visible = false;
  };

  const updateAnim = (timeSec: number, cameraQuat?: THREE.Quaternion) => {
    if (!destroyed) {
      if (beaconMat) {
        beaconMat.emissiveIntensity = 1.0 + 0.85 * (0.5 + 0.5 * Math.sin(timeSec * 3.8));
      }
      for (let i = 0; i < spinParts.length; i++) {
        spinParts[i].rotation.y = timeSec * (6.2 + i * 1.4);
      }
      if (cameraQuat) {
        healthBar.mesh.quaternion.copy(cameraQuat);
      }
    }
  };

  return { group, intactGroup, ruinedGroup, healthBar, setDestroyed, updateAnim };
}
