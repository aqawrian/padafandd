import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DEFENSE_TOWERS, ENEMY_UNITS } from '../data/gameData';
import {
  DefenseTower,
  EnemyUnit,
  ActiveEnemy,
  ActiveTower,
  FlightDoctrine,
  GameMode,
  MapBiome,
  RadarEntityBlip,
  RadarSnapshot,
  RadarZone,
  StageConfig,
  TargetingPriority,
  TechModifiers,
  WaveConfig,
} from '../types/game';
import {
  buildTower3D,
  buildTowerGhost3D,
  buildEnemy3D,
  buildBaseBunker3D,
  buildAllyFighter3D,
  TowerRig,
  EnemyRig,
  BunkerRig,
  AllyFighterRig,
} from '../utils/meshFactory';
import {
  BIOME_CONFIGS,
  BiomeWorldHandle,
  SearchlightTargetPoint,
  buildBiomeWorld,
  disposeObject3D,
  getGroundHeight,
  isBuildableSpot,
} from '../utils/mapBuilder';
import { generateEndlessWave } from '../data/techAndSave';
import { soundManager } from '../utils/audio';
import { GameHud, KillCallout } from './GameHud';

interface Viewport3DProps {
  gameMode: GameMode;
  stageConfig: StageConfig;
  techModifiers: TechModifiers;
  availableStars: number;
  endlessBestWave: number;
  onSelectUnit?: (unit: DefenseTower | EnemyUnit | null) => void;
  selectedUnitId?: string | null;
  onOpenMenu: () => void;
  onOpenRoadmap: () => void;
  onOpenTechLab: () => void;
  onStageComplete: (stageNumber: number, stars: number) => void;
  onRecordKill: (isBoss: boolean) => void;
  onRecordCapScramble: () => void;
  onEndlessRecordUpdate: (biome: MapBiome, wave: number, score: number) => void;
  onNextStage: () => void;
  hasNextStage: boolean;
  biome: MapBiome;
  onChangeBiome: (biome: MapBiome) => void;
}

interface SharedCombatAssets {
  bulletGeo: THREE.CylinderGeometry;
  bulletMat: THREE.MeshBasicMaterial;
  missileBodyGeo: THREE.CylinderGeometry;
  missileNoseGeo: THREE.ConeGeometry;
  missileFinGeo: THREE.BoxGeometry;
  missileBodyMat: THREE.MeshStandardMaterial;
  missileNoseMat: THREE.MeshStandardMaterial;
  missileFinMat: THREE.MeshStandardMaterial;
  missileFlameGeo: THREE.ConeGeometry;
  missileFlameMat: THREE.MeshBasicMaterial;
  laserCoreGeo: THREE.CylinderGeometry;
  laserCoreMat: THREE.MeshBasicMaterial;
  laserHaloGeo: THREE.CylinderGeometry;
  laserHaloMat: THREE.MeshBasicMaterial;
  muzzleFlashGeo: THREE.OctahedronGeometry;
  muzzleFlashMats: THREE.MeshBasicMaterial[];
  smokeGeo: THREE.DodecahedronGeometry;
  smokeMat: THREE.MeshBasicMaterial;
  particleGeo: THREE.OctahedronGeometry;
  particleMats: THREE.MeshBasicMaterial[];
  sparkMatCyan: THREE.MeshBasicMaterial;
  shockwaveGeo: THREE.RingGeometry;
  ordnanceBodyGeo: THREE.CylinderGeometry;
  ordnanceNoseGeo: THREE.ConeGeometry;
  ordnanceBodyMat: THREE.MeshStandardMaterial;
  ordnanceNoseMat: THREE.MeshBasicMaterial;
  flareGeo: THREE.OctahedronGeometry;
  flareMat: THREE.MeshBasicMaterial;
  allyBulletMat: THREE.MeshBasicMaterial;
}

interface PooledFlareSlot {
  active: boolean;
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
  lastSmokeTime: number;
}

interface CrashingWreckSlot {
  group: THREE.Group;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  rollVel: number;
  pitchVel: number;
  yawVel: number;
  lastSmokeTime: number;
  isBoss: boolean;
  scale: number;
}

interface CapFighterState {
  rig: AllyFighterRig;
  active: boolean;
  exiting: boolean;
  x: number;
  y: number;
  z: number;
  heading: number;
  bankAngle: number;
  alt: number;
  orbitDir: number;
  orbitPhase: number;
  targetEnemyId: string;
  lastGunTime: number;
  lastMissileTime: number;
  pylonCursor: number;
  lastContrailTime: number;
}

interface PooledOrdnanceSlot {
  active: boolean;
  id: string;
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  age: number;
  maxAge: number;
  lastSmokeTime: number;
  isBomb: boolean;
}

interface PooledProjectileSlot {
  active: boolean;
  type: 'bullet' | 'missile';
  mesh: THREE.Object3D;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  targetEnemyId: string;
  targetOrdnanceIdx: number;
  targetFlareIdx: number;
  speed: number;
  damage: number;
  age: number;
  maxLifetime: number;
  lastSmokeTime: number;
  weavePhase: number;
  weaveFreq: number;
  weaveAmp: number;
  turnRate: number;
}

interface PooledLaserSlot {
  active: boolean;
  coreMesh: THREE.Mesh;
  haloMesh: THREE.Mesh;
  expiresAt: number;
}

interface PooledShockwaveSlot {
  active: boolean;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
  maxAge: number;
  startScale: number;
  maxScale: number;
}

interface PooledMuzzleSlot {
  active: boolean;
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
  baseScale: number;
}

interface PooledSmokeSlot {
  active: boolean;
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vy: number;
  age: number;
  maxAge: number;
  startSize: number;
}

interface PooledParticleSlot {
  active: boolean;
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  life: number;
  maxLife: number;
}

interface FlashLightSlot {
  light: THREE.PointLight;
  age: number;
  maxAge: number;
  peakIntensity: number;
}

interface CombatPools {
  bullets: PooledProjectileSlot[];
  missiles: PooledProjectileSlot[];
  ordnances: PooledOrdnanceSlot[];
  flares: PooledFlareSlot[];
  lasers: PooledLaserSlot[];
  muzzles: PooledMuzzleSlot[];
  smokes: PooledSmokeSlot[];
  particles: PooledParticleSlot[];
  shockwaves: PooledShockwaveSlot[];
}

// Pre-allocated scratch math helpers for zero-GC render & raycast loop
const _targetPos = new THREE.Vector3();
const _spawnPos = new THREE.Vector3();
const _hitPoint = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _dayColor = new THREE.Color();
const _nightColor = new THREE.Color();
const _blendColor = new THREE.Color();
const _searchTargetsBuf: SearchlightTargetPoint[] = [];

// Hard fixed pool capacities (ZERO mid-battle object/material/scene allocations!)
const POOL_BULLETS = 64;
const POOL_MISSILES = 56;
const POOL_ENEMY_ORDNANCE = 24;
const POOL_FLARES = 28;
const POOL_LASERS = 12;
const POOL_MUZZLES = 24;
const POOL_SMOKES = 76;
const POOL_PARTICLES = 112;
const POOL_SHOCKWAVES = 16;
const MAX_CRASHING_WRECKS = 6;

const EMP_BASE_COOLDOWN = 45;
const REPAIR_BASE_COOLDOWN = 55;
const CAP_BASE_COOLDOWN = 36;
const CAP_PATROL_DURATION = 12;

const COMPASS_ANGLES = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

function getRadarCoverageRadius(level: number, rangeMult: number): number {
  const base = level >= 3 ? 39 : level === 2 ? 31 : 24;
  return base * rangeMult;
}

function normalizeAngle(a: number): number {
  let out = a;
  while (out > Math.PI) out -= Math.PI * 2;
  while (out < -Math.PI) out += Math.PI * 2;
  return out;
}

function getUpcomingSectors(waveNum: number, hasBoss: boolean): number[] {
  if (hasBoss || waveNum >= 5) return [0, 1, 2, 3];
  if (waveNum >= 3) {
    const start = (waveNum - 1) % 4;
    return [start, (start + 1) % 4, (start + 2) % 4];
  }
  const start = (waveNum - 1) % 4;
  return [start, (start + 2) % 4];
}

function buildWavePreviewSummary(waveCfg: WaveConfig | null): string {
  if (!waveCfg) return '';
  const counts = new Map<string, number>();
  let hasBoss = false;
  waveCfg.spawns.forEach((sp) => {
    counts.set(sp.unitId, (counts.get(sp.unitId) ?? 0) + sp.count);
    const u = ENEMY_UNITS.find((e) => e.id === sp.unitId);
    if (u?.isBoss) hasBoss = true;
  });

  const parts: string[] = [];
  counts.forEach((count, unitId) => {
    const u = ENEMY_UNITS.find((e) => e.id === unitId);
    if (u && parts.length < 3) {
      parts.push(`${count} ${u.persianName}`);
    }
  });
  if (hasBoss) parts.push('باس هوایی');
  return parts.join(' · ');
}

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  gameMode,
  stageConfig,
  techModifiers,
  availableStars,
  endlessBestWave,
  onSelectUnit,
  onOpenMenu,
  onOpenRoadmap,
  onOpenTechLab,
  onStageComplete,
  onRecordKill,
  onRecordCapScramble,
  onEndlessRecordUpdate,
  onNextStage,
  hasNextStage,
  biome,
  onChangeBiome,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Game UI state
  const maxBaseHp = techModifiers.maxBaseHp;
  const empMaxCooldown = Math.max(12, Math.round(EMP_BASE_COOLDOWN * techModifiers.cooldownMult));
  const repairMaxCooldown = Math.max(15, Math.round(REPAIR_BASE_COOLDOWN * techModifiers.cooldownMult));
  const capMaxCooldown = Math.max(20, Math.round(CAP_BASE_COOLDOWN * techModifiers.cooldownMult));

  const [baseHp, setBaseHp] = useState(maxBaseHp);
  const [cash, setCash] = useState(stageConfig.startingCash + techModifiers.startingCashBonus);
  const [currentWaveIndex, setCurrentWaveIndex] = useState(0);
  const [waveState, setWaveState] = useState<'idle' | 'spawning' | 'in_progress' | 'wave_cleared' | 'victory' | 'defeat'>('idle');
  const [earnedStars, setEarnedStars] = useState(3);
  const [enemiesRemaining, setEnemiesRemaining] = useState(0);
  const [endlessScore, setEndlessScore] = useState(0);
  const [gameSpeed, setGameSpeed] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [showRangeRings, setShowRangeRings] = useState(false);
  const [cameraMode, setCameraMode] = useState<'isometric' | 'topdown'>('isometric');
  const [contextLost, setContextLost] = useState(false);
  const [killCallouts, setKillCallouts] = useState<KillCallout[]>([]);

  // Commander Tactical Abilities UI state
  const [empCooldownLeft, setEmpCooldownLeft] = useState(0);
  const [repairCooldownLeft, setRepairCooldownLeft] = useState(0);
  const [capCooldownLeft, setCapCooldownLeft] = useState(0);
  const [capActiveLeft, setCapActiveLeft] = useState(0);
  const [isNightRaid, setIsNightRaid] = useState(Boolean(gameMode === 'campaign' && stageConfig.isNightStage));

  // Tower Building & Selection State
  const [selectedTowerToBuild, setSelectedTowerToBuild] = useState<DefenseTower | null>(null);
  const [selectedPlacedTower, setSelectedPlacedTower] = useState<ActiveTower | null>(null);

  // Compute upcoming wave configuration & preview summary
  const upcomingWaveCfg: WaveConfig | null =
    gameMode === 'endless'
      ? generateEndlessWave(currentWaveIndex + 1)
      : stageConfig.waves[currentWaveIndex] ?? null;
  const upcomingHasBoss = Boolean(
    upcomingWaveCfg?.spawns.some((s) => s.unitId === 'heavy_bomber_wing' || s.unitId === 'sky_dreadnought')
  );
  const upcomingSectors = getUpcomingSectors(currentWaveIndex + 1, upcomingHasBoss);
  const wavePreviewSummary = buildWavePreviewSummary(upcomingWaveCfg);

  // Live state mirrors for zero-stale-closure WebGL loop
  const gameModeRef = useRef<GameMode>(gameMode);
  const stageConfigRef = useRef(stageConfig);
  const techModifiersRef = useRef<TechModifiers>(techModifiers);
  const maxBaseHpRef = useRef(maxBaseHp);
  const baseHpRef = useRef(maxBaseHp);
  const defeatTriggeredRef = useRef(false);
  const contextLostRef = useRef(false);
  const gameSpeedRef = useRef(gameSpeed);
  const cashRef = useRef(cash);
  const currentWaveIndexRef = useRef(currentWaveIndex);
  const waveStateRef = useRef(waveState);
  const endlessScoreRef = useRef(0);
  const upcomingSectorsRef = useRef<number[]>(upcomingSectors);
  const activeWaveConfigRef = useRef<WaveConfig | null>(upcomingWaveCfg);
  const selectedTowerToBuildRef = useRef<DefenseTower | null>(selectedTowerToBuild);
  const selectedPlacedTowerRef = useRef<ActiveTower | null>(selectedPlacedTower);
  const showRangeRingsRef = useRef(showRangeRings);
  const biomeRef = useRef<MapBiome>(biome);
  const onSelectUnitRef = useRef(onSelectUnit);
  const onStageCompleteRef = useRef(onStageComplete);
  const onRecordKillRef = useRef(onRecordKill);
  const onRecordCapScrambleRef = useRef(onRecordCapScramble);
  const onEndlessRecordUpdateRef = useRef(onEndlessRecordUpdate);

  gameModeRef.current = gameMode;
  stageConfigRef.current = stageConfig;
  techModifiersRef.current = techModifiers;
  maxBaseHpRef.current = maxBaseHp;
  gameSpeedRef.current = gameSpeed;
  cashRef.current = cash;
  currentWaveIndexRef.current = currentWaveIndex;
  waveStateRef.current = waveState;
  upcomingSectorsRef.current = upcomingSectors;
  selectedTowerToBuildRef.current = selectedTowerToBuild;
  selectedPlacedTowerRef.current = selectedPlacedTower;
  showRangeRingsRef.current = showRangeRings;
  biomeRef.current = biome;
  onSelectUnitRef.current = onSelectUnit;
  onStageCompleteRef.current = onStageComplete;
  onRecordKillRef.current = onRecordKill;
  onRecordCapScrambleRef.current = onRecordCapScramble;
  onEndlessRecordUpdateRef.current = onEndlessRecordUpdate;

  // Simulation clock, skill timers, bunker shield & live radar ref
  const simCombatSecRef = useRef(0);
  const empCooldownRef = useRef(0);
  const repairCooldownRef = useRef(0);
  const capCooldownRef = useRef(0);
  const capActiveUntilRef = useRef(0);
  const overdriveUntilRef = useRef(0);
  const bunkerShieldTimerRef = useRef(0);
  const lastBunkerSmokeRef = useRef(0);
  const lastCalloutTimeRef = useRef(0);
  const crashingWrecksRef = useRef<CrashingWreckSlot[]>([]);
  const capFightersRef = useRef<CapFighterState[]>([]);
  const nightFactorRef = useRef(gameMode === 'campaign' && stageConfig.isNightStage ? 1 : 0);
  const isNightRaidRef = useRef(Boolean(gameMode === 'campaign' && stageConfig.isNightStage));
  const waveHasBossRef = useRef(false);
  const cameraShakeRef = useRef({ intensity: 0, phase: 0 });
  const bossHornPlayedForWaveRef = useRef<number>(-1);
  const radarSnapshotRef = useRef<RadarSnapshot>({
    blips: [],
    radarZones: [],
    incomingSectors: [COMPASS_ANGLES[0], COMPASS_ANGLES[2]],
    waveActive: false,
  });

  // 3D Scene References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const worldHandleRef = useRef<BiomeWorldHandle | null>(null);
  const bunkerRigRef = useRef<BunkerRig | null>(null);
  const sharedAssetsRef = useRef<SharedCombatAssets | null>(null);
  const poolsRef = useRef<CombatPools | null>(null);
  const flashLightRef = useRef<FlashLightSlot | null>(null);
  const lightsRef = useRef<{
    dirLight: THREE.DirectionalLight;
    hemiLight: THREE.HemisphereLight;
    rimLight: THREE.DirectionalLight;
  } | null>(null);

  const activeTowersRef = useRef<
    Map<
      string,
      {
        towerState: ActiveTower;
        rig: TowerRig;
        rangeMesh: THREE.Mesh;
        muzzleCursor: number;
      }
    >
  >(new Map());
  const activeEnemiesRef = useRef<
    Map<
      string,
      {
        enemyState: ActiveEnemy;
        rig: EnemyRig;
        lastSmokeTime: number;
        spawnDist: number;
        baseAngle: number;
        travelProgress: number;
        cruiseAlt: number;
        maneuverPhase: number;
        maneuverFreq: number;
        maneuverAmpLat: number;
        maneuverAmpVert: number;
        flankAmp: number;
        curveDir: number;
        prevX: number;
        prevY: number;
        prevZ: number;
        bankAngle: number;
        doctrine: FlightDoctrine;
        flightPhase: 'approach' | 'egress' | 'turnaround' | 'orbit';
        heading: number;
        turnRate: number;
        passOffset: number;
        passSide: number;
        releaseRange: number;
        turnaroundDist: number;
        orbitRadius: number;
        salvoRemaining: number;
        nextReleaseAt: number;
        ordnanceCooldownAt: number;
        egressHeading: number;
        lastDogfightGunTime: number;
      }
    >
  >(new Map());

  // Wave queue reference (uses simCombatSecRef for pause/2x consistency)
  const waveQueueRef = useRef<{ unitId: string; spawnTime: number }[]>([]);
  const waveStartTimeRef = useRef<number>(0);
  const isSpawningRef = useRef<boolean>(false);

  // Single-material holographic placement ghost (zero material cloning!)
  const ghostGroupRef = useRef<THREE.Group | null>(null);
  const ghostMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const ghostRangeRingRef = useRef<THREE.Mesh | null>(null);
  const placementValidRef = useRef<boolean>(false);
  const ghostPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  // Pre-allocated 4 perimeter incoming sector chevrons
  const approachChevronsRef = useRef<THREE.Mesh[]>([]);

  // Wide panoramic tactical camera with smooth exponential damping targets
  const cameraState = useRef({
    isDragging: false,
    dragMoved: false,
    previousMousePosition: { x: 0, y: 0 },
    target: new THREE.Vector3(0, 0, 0),
    distance: 60,
    pitch: 33 * (Math.PI / 180),
    yaw: 44 * (Math.PI / 180),
    transitioning: false,
    goalDistance: 60,
    goalPitch: 33 * (Math.PI / 180),
    goalYaw: 44 * (Math.PI / 180),
  });

  const addCameraShake = (amount: number) => {
    cameraShakeRef.current.intensity = Math.min(0.85, Math.max(cameraShakeRef.current.intensity, amount));
  };

  const applyCameraTransform = () => {
    const camera = cameraRef.current;
    if (!camera) return;
    const { target, distance, pitch, yaw } = cameraState.current;

    const horizDist = distance * Math.cos(pitch);
    const eyeY = target.y + distance * Math.sin(pitch);
    const eyeX = target.x + horizDist * Math.sin(yaw);
    const eyeZ = target.z + horizDist * Math.cos(yaw);

    const shake = cameraShakeRef.current;
    let sx = 0;
    let sy = 0;
    let sz = 0;
    if (shake.intensity > 0.005) {
      sx = Math.sin(shake.phase * 37.3) * shake.intensity;
      sy = Math.cos(shake.phase * 43.1) * shake.intensity * 0.7;
      sz = Math.sin(shake.phase * 29.7) * shake.intensity;
    }

    camera.position.set(eyeX + sx, eyeY + sy, eyeZ + sz);
    camera.lookAt(target.x + sx * 0.25, target.y + sy * 0.25, target.z + sz * 0.25);
  };

  const handleSetCameraView = (mode: 'isometric' | 'topdown') => {
    setCameraMode(mode);
    cameraState.current.transitioning = true;
    if (mode === 'isometric') {
      cameraState.current.goalDistance = 60;
      cameraState.current.goalPitch = 33 * (Math.PI / 180);
      cameraState.current.goalYaw = 44 * (Math.PI / 180);
    } else {
      cameraState.current.goalDistance = 74;
      cameraState.current.goalPitch = 82 * (Math.PI / 180);
      cameraState.current.goalYaw = 0;
    }
  };

  const syncRangeRingVisibility = () => {
    const selectedId = selectedPlacedTowerRef.current?.instanceId;
    const showAll = showRangeRingsRef.current;
    const placingAny = Boolean(selectedTowerToBuildRef.current);
    activeTowersRef.current.forEach(({ towerState, rangeMesh }, id) => {
      const mat = rangeMesh.material as THREE.MeshBasicMaterial;
      if (towerState.tower.shape === 'radar_dish') {
        rangeMesh.visible = true;
        mat.opacity = showAll || id === selectedId || placingAny ? 0.44 : 0.17;
      } else {
        rangeMesh.visible = showAll || id === selectedId;
        mat.opacity = 0.34;
      }
    });
  };

  // Recompute regional Radar Network linkage for all placed combat towers immediately (works even when paused)
  const refreshTowerRadarLinks = () => {
    const rangeMult = techModifiersRef.current.rangeMult;
    const zones: { x: number; z: number; r: number }[] = [];
    activeTowersRef.current.forEach(({ towerState }) => {
      if (towerState.tower.shape === 'radar_dish') {
        zones.push({
          x: towerState.x,
          z: towerState.z,
          r: getRadarCoverageRadius(towerState.level, rangeMult),
        });
      }
    });

    activeTowersRef.current.forEach(({ towerState }) => {
      if (towerState.tower.shape === 'radar_dish') {
        towerState.radarBoosted = false;
        return;
      }
      let linked = false;
      for (let i = 0; i < zones.length; i++) {
        const dz = zones[i];
        if (Math.hypot(towerState.x - dz.x, towerState.z - dz.z) <= dz.r) {
          linked = true;
          break;
        }
      }
      towerState.radarBoosted = linked;
    });
  };

  // Helper: Trigger single reusable dynamic twilight flash light (ZERO allocations!)
  const triggerFlashLight = (x: number, y: number, z: number, colorHex: number, peakIntensity: number, maxAge: number) => {
    const slot = flashLightRef.current;
    if (!slot) return;
    // Let brighter/longer explosions keep priority over tiny CIWS ticks
    if (slot.age < slot.maxAge && slot.light.intensity > peakIntensity * 1.15) return;
    slot.light.position.set(x, y, z);
    slot.light.color.setHex(colorHex);
    slot.light.intensity = peakIntensity;
    slot.peakIntensity = peakIntensity;
    slot.age = 0;
    slot.maxAge = maxAge;
  };

  // Helper: Acquire pooled muzzle flash (ZERO new Mesh / scene.add!)
  const spawnMuzzleFlash = (x: number, y: number, z: number, scale = 0.55, colorIdx = 0) => {
    const pools = poolsRef.current;
    const assets = sharedAssetsRef.current;
    if (!pools || !assets) return;

    for (let i = 0; i < pools.muzzles.length; i++) {
      const slot = pools.muzzles[i];
      if (!slot.active) {
        slot.active = true;
        slot.age = 0;
        slot.maxAge = 0.075;
        slot.baseScale = scale;
        slot.mesh.material = assets.muzzleFlashMats[colorIdx % assets.muzzleFlashMats.length];
        slot.mesh.position.set(x, y, z);
        slot.mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        slot.mesh.scale.setScalar(scale);
        slot.mesh.visible = true;
        return;
      }
    }
  };

  // Helper: Acquire pooled smoke puff (ZERO new Mesh / scene.add!)
  const spawnSmokePuff = (x: number, y: number, z: number, startSize = 0.24, maxAge = 0.52) => {
    const pools = poolsRef.current;
    if (!pools) return;

    for (let i = 0; i < pools.smokes.length; i++) {
      const slot = pools.smokes[i];
      if (!slot.active) {
        slot.active = true;
        slot.x = x;
        slot.y = y;
        slot.z = z;
        slot.vy = 0.72 + Math.random() * 0.5;
        slot.age = 0;
        slot.maxAge = maxAge;
        slot.startSize = startSize;
        slot.mesh.position.set(x, y, z);
        slot.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
        slot.mesh.scale.setScalar(startSize);
        slot.mesh.visible = true;
        return;
      }
    }
  };

  // Helper: Acquire pooled 3D shockwave ring (ZERO material creation or disposal!)
  const spawnShockwaveRing = (
    x: number,
    y: number,
    z: number,
    colorHex: number,
    startScale: number,
    maxScale: number,
    maxAge: number
  ) => {
    const pools = poolsRef.current;
    if (!pools) return;

    let chosen: PooledShockwaveSlot | null = null;
    for (let i = 0; i < pools.shockwaves.length; i++) {
      if (!pools.shockwaves[i].active) {
        chosen = pools.shockwaves[i];
        break;
      }
    }
    if (!chosen) return;

    chosen.active = true;
    chosen.age = 0;
    chosen.maxAge = maxAge;
    chosen.startScale = startScale;
    chosen.maxScale = maxScale;
    chosen.mat.color.setHex(colorHex);
    chosen.mat.opacity = 0.85;
    chosen.mesh.position.set(x, y, z);
    chosen.mesh.scale.setScalar(startScale);
    chosen.mesh.visible = true;
  };

  // Helper: Acquire pooled cyan impact sparks for laser hits
  const spawnLaserSparks = (x: number, y: number, z: number) => {
    const pools = poolsRef.current;
    const assets = sharedAssetsRef.current;
    if (!pools || !assets) return;

    let spawned = 0;
    for (let i = 0; i < pools.particles.length && spawned < 3; i++) {
      const slot = pools.particles[i];
      if (!slot.active) {
        const a = Math.random() * Math.PI * 2;
        const spd = 2.6 + Math.random() * 3.4;
        slot.active = true;
        slot.x = x;
        slot.y = y;
        slot.z = z;
        slot.vx = Math.cos(a) * spd;
        slot.vy = 1.0 + Math.random() * 2.2;
        slot.vz = Math.sin(a) * spd;
        slot.size = 0.17;
        slot.life = 0;
        slot.maxLife = 0.22 + Math.random() * 0.14;
        slot.mesh.material = assets.sparkMatCyan;
        slot.mesh.position.set(x, y, z);
        slot.mesh.scale.setScalar(slot.size);
        slot.mesh.visible = true;
        spawned++;
      }
    }
  };

  // Helper: Trigger cinematic multi-layer pooled explosion (100% zero-allocation!)
  const triggerExplosion = (x: number, y: number, z: number, scale = 1.0) => {
    const pools = poolsRef.current;
    const assets = sharedAssetsRef.current;
    if (!pools || !assets) return;

    soundManager.playExplosion(scale);

    // 1. Bright core flash + dynamic twilight flash light
    spawnMuzzleFlash(x, y, z, 0.95 * scale, 0);
    triggerFlashLight(x, y + 0.6, z, 0xff8c2a, 16 * Math.min(2.0, scale), 0.2);

    // 2. Expanding localized shockwave ring
    spawnShockwaveRing(x, y, z, scale >= 1.7 ? 0xfbbf24 : 0xff7b00, 0.45, 3.5 * scale, 0.35 + scale * 0.08);

    // 3. Subtle camera micro-shake for heavy missile / boss blasts
    if (scale >= 1.75) {
      addCameraShake(0.62);
    } else if (scale >= 1.25) {
      addCameraShake(0.14);
    }

    // 4. Rising smoke puffs at blast center
    const smokeCount = scale >= 1.7 ? 3 : 2;
    for (let s = 0; s < smokeCount; s++) {
      spawnSmokePuff(
        x + (Math.random() - 0.5) * 0.8 * scale,
        y + (Math.random() - 0.3) * 0.55,
        z + (Math.random() - 0.5) * 0.8 * scale,
        0.36 * Math.min(1.7, scale),
        0.72 + Math.random() * 0.26
      );
    }

    // 5. Fiery debris & hot ember particles from pre-allocated pool
    const desiredCount = Math.min(18, Math.floor(11 * scale));
    let spawned = 0;
    for (let i = 0; i < pools.particles.length && spawned < desiredCount; i++) {
      const slot = pools.particles[i];
      if (!slot.active) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.6 + Math.random() * 5.4 * scale;
        slot.active = true;
        slot.x = x;
        slot.y = y;
        slot.z = z;
        slot.vx = Math.cos(angle) * speed;
        slot.vy = (Math.random() - 0.12) * 6.2 * scale;
        slot.vz = Math.sin(angle) * speed;
        slot.size = (0.24 + Math.random() * 0.34) * Math.min(1.45, scale);
        slot.life = 0;
        slot.maxLife = 0.4 + Math.random() * 0.32;
        slot.mesh.material = assets.particleMats[spawned % assets.particleMats.length];
        slot.mesh.position.set(x, y, z);
        slot.mesh.scale.setScalar(slot.size);
        slot.mesh.visible = true;
        spawned++;
      }
    }
  };

  // Helper: Acquire pooled enemy bomb / standoff air-to-surface missile (ZERO allocations!)
  const spawnEnemyOrdnance = (
    x: number,
    y: number,
    z: number,
    initVx: number,
    initVy: number,
    initVz: number,
    damage: number,
    hp: number,
    speed: number,
    isBomb: boolean,
    simSec: number
  ) => {
    const pools = poolsRef.current;
    if (!pools) return;
    for (let i = 0; i < pools.ordnances.length; i++) {
      const slot = pools.ordnances[i];
      if (!slot.active) {
        slot.active = true;
        slot.x = x;
        slot.y = y;
        slot.z = z;
        slot.vx = initVx;
        slot.vy = initVy;
        slot.vz = initVz;
        slot.hp = hp;
        slot.maxHp = hp;
        slot.damage = damage;
        slot.speed = speed;
        slot.age = 0;
        slot.maxAge = 7.5;
        slot.lastSmokeTime = simSec;
        slot.isBomb = isBomb;
        slot.mesh.position.set(x, y, z);
        slot.mesh.scale.setScalar(isBomb ? 0.92 : 1.05);
        slot.mesh.lookAt(x + initVx, y + initVy, z + initVz);
        slot.mesh.visible = true;
        return;
      }
    }
  };

  // Helper: Acquire pooled bullet or maneuvering SAM interceptor missile (supports aircraft & enemy ordnance!)
  const spawnPooledProjectile = (
    type: 'bullet' | 'missile',
    spawnX: number,
    spawnY: number,
    spawnZ: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    targetEnemyId: string,
    speed: number,
    damage: number,
    maxLifetime: number,
    simSec: number,
    isHeavySam = false,
    targetOrdnanceIdx = -1
  ) => {
    const pools = poolsRef.current;
    if (!pools) return;
    const list = type === 'bullet' ? pools.bullets : pools.missiles;

    for (let i = 0; i < list.length; i++) {
      const slot = list[i];
      if (!slot.active) {
        slot.active = true;
        slot.x = spawnX;
        slot.y = spawnY;
        slot.z = spawnZ;
        slot.targetX = targetX;
        slot.targetY = targetY;
        slot.targetZ = targetZ;
        slot.targetEnemyId = targetEnemyId;
        slot.targetOrdnanceIdx = targetOrdnanceIdx;
        slot.targetFlareIdx = -1;
        slot.speed = speed;
        slot.damage = damage;
        slot.age = 0;
        slot.maxLifetime = maxLifetime;
        slot.lastSmokeTime = simSec;

        const dx = targetX - spawnX;
        const dy = targetY - spawnY;
        const dz = targetZ - spawnZ;
        const dist = Math.max(0.01, Math.hypot(dx, dy, dz));
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;

        if (type === 'missile') {
          // Angled SAM boost + slight lateral flare so interceptors arc naturally onto target
          const sideSign = Math.random() > 0.5 ? 1 : -1;
          const perpX = -nz * sideSign;
          const perpZ = nx * sideSign;
          const flare = isHeavySam ? 0.36 : 0.24;
          const loft = isHeavySam ? 0.44 : 0.26;
          const ivx = nx + perpX * flare;
          const ivy = ny + loft;
          const ivz = nz + perpZ * flare;
          const ilen = Math.max(0.01, Math.hypot(ivx, ivy, ivz));
          slot.vx = (ivx / ilen) * speed;
          slot.vy = (ivy / ilen) * speed;
          slot.vz = (ivz / ilen) * speed;
          slot.weavePhase = Math.random() * Math.PI * 2;
          slot.weaveFreq = isHeavySam ? 5.2 : 7.0;
          slot.weaveAmp = isHeavySam ? 1.65 : 1.05;
          slot.turnRate = isHeavySam ? 5.8 : 7.8;
        } else {
          slot.vx = nx * speed;
          slot.vy = ny * speed;
          slot.vz = nz * speed;
          slot.weavePhase = 0;
          slot.weaveFreq = 0;
          slot.weaveAmp = 0;
          slot.turnRate = 20;
          if (sharedAssetsRef.current) {
            (slot.mesh as THREE.Mesh).material = isHeavySam
              ? sharedAssetsRef.current.allyBulletMat
              : sharedAssetsRef.current.bulletMat;
          }
        }

        slot.mesh.position.set(spawnX, spawnY, spawnZ);
        slot.mesh.scale.setScalar(type === 'missile' && isHeavySam ? 1.12 : 0.94);
        slot.mesh.lookAt(spawnX + slot.vx, spawnY + slot.vy, spawnZ + slot.vz);
        slot.mesh.visible = true;
        return;
      }
    }
  };

  // Helper: Deploy a cluster of pooled incandescent thermal countermeasure flares from a threatened aircraft
  const deployCountermeasureFlares = (
    x: number,
    y: number,
    z: number,
    heading: number,
    simSec: number
  ): number => {
    const pools = poolsRef.current;
    if (!pools) return -1;
    let primaryIdx = -1;
    let spawned = 0;
    const fwdX = Math.sin(heading);
    const fwdZ = Math.cos(heading);
    const rightX = fwdZ;
    const rightZ = -fwdX;

    for (let i = 0; i < pools.flares.length && spawned < 4; i++) {
      const slot = pools.flares[i];
      if (!slot.active) {
        const side = spawned % 2 === 0 ? 1 : -1;
        const spread = 2.6 + spawned * 0.75;
        slot.active = true;
        slot.x = x - fwdX * 0.8 + rightX * side * 0.5;
        slot.y = y - 0.35;
        slot.z = z - fwdZ * 0.8 + rightZ * side * 0.5;
        slot.vx = rightX * side * spread - fwdX * 2.2 + (Math.random() - 0.5) * 1.4;
        slot.vy = -1.2 - Math.random() * 1.1;
        slot.vz = rightZ * side * spread - fwdZ * 2.2 + (Math.random() - 0.5) * 1.4;
        slot.age = 0;
        slot.maxAge = 2.35 + Math.random() * 0.45;
        slot.lastSmokeTime = simSec;
        slot.mesh.position.set(slot.x, slot.y, slot.z);
        slot.mesh.scale.setScalar(0.38);
        slot.mesh.visible = true;
        if (primaryIdx < 0) primaryIdx = i;
        spawned++;
      }
    }
    if (primaryIdx >= 0) {
      soundManager.playFlarePop();
      spawnMuzzleFlash(x, y - 0.35, z, 0.55, 0);
    }
    return primaryIdx;
  };

  // Helper: Acquire pooled dual-layer laser beam
  const spawnPooledLaser = (
    spawnPos: THREE.Vector3,
    targetPos: THREE.Vector3,
    towerLevel: number,
    expiresAt: number
  ) => {
    const pools = poolsRef.current;
    if (!pools) return;

    for (let i = 0; i < pools.lasers.length; i++) {
      const slot = pools.lasers[i];
      if (!slot.active) {
        const beamLen = Math.max(0.2, spawnPos.distanceTo(targetPos));
        const midX = (spawnPos.x + targetPos.x) * 0.5;
        const midY = (spawnPos.y + targetPos.y) * 0.5;
        const midZ = (spawnPos.z + targetPos.z) * 0.5;
        const haloThickness = 1 + (towerLevel - 1) * 0.22;

        slot.active = true;
        slot.expiresAt = expiresAt;
        slot.coreMesh.scale.set(1, 1, beamLen);
        slot.haloMesh.scale.set(haloThickness, haloThickness, beamLen);
        slot.coreMesh.position.set(midX, midY, midZ);
        slot.haloMesh.position.set(midX, midY, midZ);
        slot.coreMesh.lookAt(targetPos);
        slot.haloMesh.lookAt(targetPos);
        slot.coreMesh.visible = true;
        slot.haloMesh.visible = true;
        return;
      }
    }
  };

  // Helper: Reset all pooled VFX slots without ever removing from scene or disposing
  const clearAllPools = () => {
    const pools = poolsRef.current;
    if (!pools) return;

    for (let i = 0; i < pools.bullets.length; i++) {
      pools.bullets[i].active = false;
      pools.bullets[i].mesh.visible = false;
    }
    for (let i = 0; i < pools.missiles.length; i++) {
      pools.missiles[i].active = false;
      pools.missiles[i].mesh.visible = false;
    }
    for (let i = 0; i < pools.ordnances.length; i++) {
      pools.ordnances[i].active = false;
      pools.ordnances[i].mesh.visible = false;
    }
    for (let i = 0; i < pools.flares.length; i++) {
      pools.flares[i].active = false;
      pools.flares[i].mesh.visible = false;
    }
    for (let i = 0; i < pools.lasers.length; i++) {
      pools.lasers[i].active = false;
      pools.lasers[i].coreMesh.visible = false;
      pools.lasers[i].haloMesh.visible = false;
    }
    for (let i = 0; i < pools.muzzles.length; i++) {
      pools.muzzles[i].active = false;
      pools.muzzles[i].mesh.visible = false;
    }
    for (let i = 0; i < pools.smokes.length; i++) {
      pools.smokes[i].active = false;
      pools.smokes[i].mesh.visible = false;
    }
    for (let i = 0; i < pools.particles.length; i++) {
      pools.particles[i].active = false;
      pools.particles[i].mesh.visible = false;
    }
    for (let i = 0; i < pools.shockwaves.length; i++) {
      pools.shockwaves[i].active = false;
      pools.shockwaves[i].mesh.visible = false;
    }
    if (flashLightRef.current) {
      flashLightRef.current.age = 1;
      flashLightRef.current.maxAge = 1;
      flashLightRef.current.light.intensity = 0;
    }
  };

  // Helper: Emit throttled floating kill bounty callout projected from 3D space
  const pushKillCallout = (wx: number, wy: number, wz: number, reward: number, isBoss: boolean) => {
    const now = performance.now();
    if (!isBoss && now - lastCalloutTimeRef.current < 360) return;
    lastCalloutTimeRef.current = now;

    const camera = cameraRef.current;
    const container = mountRef.current;
    if (!camera || !container) return;

    _projVec.set(wx, wy + 0.9, wz).project(camera);
    if (_projVec.z > 1) return;

    const px = (_projVec.x * 0.5 + 0.5) * container.clientWidth;
    const py = (-_projVec.y * 0.5 + 0.5) * container.clientHeight;
    if (px < 20 || px > container.clientWidth - 20 || py < 40 || py > container.clientHeight - 40) return;

    const id = 'kc_' + Math.random().toString(36).substring(2, 8);
    const text = isBoss ? `+$${reward} شکار باس!` : `+$${reward}`;
    setKillCallouts((prev) => [...prev.slice(-4), { id, x: px, y: py, text, isBoss }]);
    window.setTimeout(() => {
      setKillCallouts((prev) => prev.filter((item) => item.id !== id));
    }, 850);
  };

  // Helper: Award kill bounty, career stats, endless score, and floating callout
  const awardEnemyKill = (enemy: ActiveEnemy) => {
    const mods = techModifiersRef.current;
    const reward = Math.max(1, Math.round(enemy.unit.killReward * mods.killBountyMult));
    setCash((prev) => prev + reward);
    onRecordKillRef.current(Boolean(enemy.unit.isBoss));
    if (gameModeRef.current === 'endless') {
      const pts = enemy.unit.isBoss ? 220 : 25;
      endlessScoreRef.current += pts;
      setEndlessScore(endlessScoreRef.current);
    }
    pushKillCallout(enemy.x, enemy.y, enemy.z, reward, Boolean(enemy.unit.isBoss));
  };

  // Unified Enemy Kill Handler: transitions medium/heavy aircraft into physics-driven Crashing Wreckage!
  const destroyEnemyEntry = (enemyId: string, explosionScale: number) => {
    const scene = sceneRef.current;
    const entry = activeEnemiesRef.current.get(enemyId);
    if (!entry) return;

    const { enemyState, rig } = entry;
    enemyState.alive = false;
    activeEnemiesRef.current.delete(enemyId);
    triggerExplosion(enemyState.x, enemyState.y, enemyState.z, explosionScale);
    awardEnemyKill(enemyState);

    if (!scene) return;

    const gy = getGroundHeight(enemyState.x, enemyState.z, biomeRef.current);
    const shouldCrashWreck = Boolean(enemyState.unit.canCrashWreck) && enemyState.y > gy + 2.2;

    if (shouldCrashWreck) {
      // Reuse existing enemy airframe directly (ZERO mesh allocation!)
      rig.healthBar.mesh.visible = false;

      // Enforce hard cap on simultaneous crashing wrecks
      if (crashingWrecksRef.current.length >= MAX_CRASHING_WRECKS) {
        const oldest = crashingWrecksRef.current.shift();
        if (oldest) {
          scene.remove(oldest.group);
          disposeObject3D(oldest.group);
        }
      }

      const hdg = entry.heading || enemyState.rotationY;
      const fwdSpd = Math.max(5.5, enemyState.speed * 1.1);
      const rollSign = Math.random() > 0.5 ? 1 : -1;
      crashingWrecksRef.current.push({
        group: rig.group,
        x: enemyState.x,
        y: enemyState.y,
        z: enemyState.z,
        vx: Math.sin(hdg) * fwdSpd + (Math.random() - 0.5) * 2.2,
        vy: 1.4 + Math.random() * 1.2,
        vz: Math.cos(hdg) * fwdSpd + (Math.random() - 0.5) * 2.2,
        rx: rig.group.rotation.x,
        ry: rig.group.rotation.y,
        rz: rig.group.rotation.z,
        rollVel: rollSign * (enemyState.unit.isBoss ? 1.85 : 3.6 + Math.random() * 1.8),
        pitchVel: enemyState.unit.isBoss ? 0.55 : 0.95,
        yawVel: rollSign * (0.45 + Math.random() * 0.45),
        lastSmokeTime: simCombatSecRef.current,
        isBoss: Boolean(enemyState.unit.isBoss),
        scale: enemyState.unit.isBoss ? 1.75 : 1.15,
      });
    } else {
      scene.remove(rig.group);
      disposeObject3D(rig.group);
    }
  };

  // Helper: Place a detailed defense tower entity on the map with Tech Lab modifiers applied
  const placeTowerEntity = (config: DefenseTower, x: number, z: number, targetBiome: MapBiome) => {
    const scene = sceneRef.current;
    if (!scene) return;

    const mods = techModifiersRef.current;
    const effectiveDamage = Math.round(config.damagePerShot * mods.damageMult);
    const effectiveRange = Math.round(config.range * mods.rangeMult);

    const instanceId = 'tower_' + Math.random().toString(36).substring(2, 9);
    const gy = getGroundHeight(x, z, targetBiome);
    const rig = buildTower3D(config, 1);
    rig.group.position.set(x, gy, z);
    scene.add(rig.group);

    const isRadar = config.shape === 'radar_dish';
    const ringRadius = isRadar ? getRadarCoverageRadius(1, mods.rangeMult) : effectiveRange * 0.12;
    const ringGeo = new THREE.RingGeometry(Math.max(0.5, ringRadius - (isRadar ? 0.22 : 0.14)), ringRadius, 64);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(isRadar ? '#f59e0b' : config.color),
      transparent: true,
      opacity: isRadar ? 0.22 : 0.34,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const rangeMesh = new THREE.Mesh(ringGeo, ringMat);
    rangeMesh.position.set(x, gy + 0.14, z);
    rangeMesh.visible = isRadar || showRangeRingsRef.current;
    scene.add(rangeMesh);

    const activeTower: ActiveTower = {
      instanceId,
      tower: config,
      x,
      y: gy,
      z,
      level: 1,
      damage: effectiveDamage,
      range: effectiveRange,
      fireRate: config.fireRate,
      lastFireTime: -10,
      targetEnemyId: null,
      turretYaw: 0,
      turretPitch: 0,
      killCount: 0,
      targetingPriority: 'closest',
      radarBoosted: false,
    };

    rig.group.userData = { instanceId, category: 'tower' };
    activeTowersRef.current.set(instanceId, { towerState: activeTower, rig, rangeMesh, muzzleCursor: 0 });
    refreshTowerRadarLinks();
    syncRangeRingVisibility();
  };

  // Helper: Mount or swap biome world cleanly
  const mountBiomeWorld = (targetBiome: MapBiome) => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (worldHandleRef.current) {
      scene.remove(worldHandleRef.current.group);
      worldHandleRef.current.dispose();
      worldHandleRef.current = null;
    }

    const cfg = BIOME_CONFIGS[targetBiome];
    scene.background = new THREE.Color(cfg.fogColor);
    scene.fog = new THREE.FogExp2(cfg.fogColor, cfg.fogDensity);

    if (lightsRef.current) {
      lightsRef.current.dirLight.color.setHex(cfg.keyColor);
      lightsRef.current.dirLight.intensity = cfg.keyIntensity;
      lightsRef.current.hemiLight.color.setHex(cfg.hemiSky);
      lightsRef.current.hemiLight.groundColor.setHex(cfg.hemiGround);
      lightsRef.current.hemiLight.intensity = cfg.hemiIntensity;
      lightsRef.current.rimLight.color.setHex(cfg.rimColor);
      lightsRef.current.rimLight.intensity = cfg.rimIntensity;
    }

    const handle = buildBiomeWorld(targetBiome);
    scene.add(handle.group);
    worldHandleRef.current = handle;

    if (bunkerRigRef.current) {
      bunkerRigRef.current.group.position.y = getGroundHeight(0, 0, targetBiome);
    }
    activeTowersRef.current.forEach(({ towerState, rig, rangeMesh }) => {
      const gy = getGroundHeight(towerState.x, towerState.z, targetBiome);
      towerState.y = gy;
      rig.group.position.set(towerState.x, gy, towerState.z);
      rangeMesh.position.set(towerState.x, gy + 0.14, towerState.z);
    });
  };

  // Helper: Clear combat entities & initialize a StageConfig cleanly
  const setupStageBoard = useCallback((stage: StageConfig, activeBiome: MapBiome) => {
    const scene = sceneRef.current;
    if (scene) {
      activeEnemiesRef.current.forEach(({ rig }) => {
        scene.remove(rig.group);
        disposeObject3D(rig.group);
      });
      activeEnemiesRef.current.clear();

      for (let w = 0; w < crashingWrecksRef.current.length; w++) {
        scene.remove(crashingWrecksRef.current[w].group);
        disposeObject3D(crashingWrecksRef.current[w].group);
      }
      crashingWrecksRef.current = [];

      for (let f = 0; f < capFightersRef.current.length; f++) {
        capFightersRef.current[f].active = false;
        capFightersRef.current[f].exiting = false;
        capFightersRef.current[f].rig.group.visible = false;
      }

      clearAllPools();

      activeTowersRef.current.forEach(({ rig, rangeMesh }) => {
        scene.remove(rig.group);
        disposeObject3D(rig.group);
        scene.remove(rangeMesh);
        rangeMesh.geometry.dispose();
        (rangeMesh.material as THREE.Material).dispose();
      });
      activeTowersRef.current.clear();

      stage.starterTowers.forEach(({ towerId, x, z }) => {
        const cfg = DEFENSE_TOWERS.find((t) => t.id === towerId);
        if (cfg) placeTowerEntity(cfg, x, z, activeBiome);
      });
    }

    const mods = techModifiersRef.current;
    const startHp = mods.maxBaseHp;
    baseHpRef.current = startHp;
    defeatTriggeredRef.current = false;
    bossHornPlayedForWaveRef.current = -1;
    endlessScoreRef.current = 0;
    bunkerShieldTimerRef.current = 0;
    setBaseHp(startHp);
    setCash(stage.startingCash + mods.startingCashBonus);
    setCurrentWaveIndex(0);
    setEndlessScore(0);
    setWaveState('idle');
    setEnemiesRemaining(0);
    setKillCallouts([]);
    isSpawningRef.current = false;
    waveQueueRef.current = [];
    empCooldownRef.current = 0;
    repairCooldownRef.current = 0;
    capCooldownRef.current = 0;
    capActiveUntilRef.current = 0;
    overdriveUntilRef.current = 0;
    waveHasBossRef.current = false;
    const startNight = gameModeRef.current === 'campaign' && Boolean(stage.isNightStage);
    nightFactorRef.current = startNight ? 1 : 0;
    isNightRaidRef.current = startNight;
    setIsNightRaid(startNight);
    setEmpCooldownLeft(0);
    setRepairCooldownLeft(0);
    setCapCooldownLeft(0);
    setCapActiveLeft(0);
    setSelectedPlacedTower(null);
    setSelectedTowerToBuild(null);
    soundManager.setMusicMode('prep');
  }, []);

  // Unlock adaptive Web Audio cleanly on first user gesture
  useEffect(() => {
    const unlockOnce = () => {
      soundManager.unlock();
    };
    window.addEventListener('pointerdown', unlockOnce, { once: true });
    window.addEventListener('keydown', unlockOnce, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockOnce);
      window.removeEventListener('keydown', unlockOnce);
    };
  }, []);

  // 1. Initial 3D Scene Setup (mounted once)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const initialCfg = BIOME_CONFIGS[biomeRef.current];

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(initialCfg.fogColor);
    scene.fog = new THREE.FogExp2(initialCfg.fogColor, initialCfg.fogDensity);
    sceneRef.current = scene;

    const aspect = Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(54, aspect, 0.5, 420);
    cameraRef.current = camera;
    applyCameraTransform();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    const isTouchOrShort =
      window.innerHeight <= 520 ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;
    // Cap pixel ratio on mobile/GPU (prevents thermal throttling & Retina GPU TDR overload)
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, isTouchOrShort ? 1.25 : 1.5)
    );
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.touchAction = 'none';
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // Pre-allocate ALL shared combat geometries & materials once (ZERO mid-battle GPU churn!)
    const bulletGeo = new THREE.CylinderGeometry(0.048, 0.048, 1.15, 4);
    bulletGeo.rotateX(Math.PI / 2);

    const missileBodyGeo = new THREE.CylinderGeometry(0.08, 0.09, 1.02, 6);
    missileBodyGeo.rotateX(Math.PI / 2);
    const missileNoseGeo = new THREE.ConeGeometry(0.08, 0.28, 6);
    missileNoseGeo.rotateX(Math.PI / 2);
    const missileFinGeo = new THREE.BoxGeometry(0.32, 0.035, 0.2);
    const missileFlameGeo = new THREE.ConeGeometry(0.15, 0.62, 6);
    missileFlameGeo.rotateX(-Math.PI / 2);

    const ordnanceBodyGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.96, 6);
    ordnanceBodyGeo.rotateX(Math.PI / 2);
    const ordnanceNoseGeo = new THREE.ConeGeometry(0.12, 0.32, 6);
    ordnanceNoseGeo.rotateX(Math.PI / 2);

    const laserCoreGeo = new THREE.CylinderGeometry(0.075, 0.075, 1.0, 6);
    laserCoreGeo.rotateX(Math.PI / 2);
    const laserHaloGeo = new THREE.CylinderGeometry(0.22, 0.22, 1.0, 6);
    laserHaloGeo.rotateX(Math.PI / 2);

    const sharedAssets: SharedCombatAssets = {
      bulletGeo,
      bulletMat: new THREE.MeshBasicMaterial({ color: 0xfef08a }),
      missileBodyGeo,
      missileNoseGeo,
      missileFinGeo,
      missileBodyMat: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.35 }),
      missileNoseMat: new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.3 }),
      missileFinMat: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.6 }),
      missileFlameGeo,
      missileFlameMat: new THREE.MeshBasicMaterial({ color: 0xff7b00 }),
      laserCoreGeo,
      laserCoreMat: new THREE.MeshBasicMaterial({ color: 0xe0f2fe }),
      laserHaloGeo,
      laserHaloMat: new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      muzzleFlashGeo: new THREE.OctahedronGeometry(0.65, 0),
      muzzleFlashMats: [
        new THREE.MeshBasicMaterial({
          color: 0xfff3b0,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
        new THREE.MeshBasicMaterial({
          color: 0xff8c24,
          transparent: true,
          opacity: 0.88,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ],
      smokeGeo: new THREE.DodecahedronGeometry(1.0, 0),
      smokeMat: new THREE.MeshBasicMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      }),
      particleGeo: new THREE.OctahedronGeometry(1.0, 0),
      particleMats: [
        new THREE.MeshBasicMaterial({ color: 0xfffbeb }),
        new THREE.MeshBasicMaterial({ color: 0xfde047 }),
        new THREE.MeshBasicMaterial({ color: 0xff7b00 }),
        new THREE.MeshBasicMaterial({ color: 0xef4444 }),
      ],
      sparkMatCyan: new THREE.MeshBasicMaterial({ color: 0x67e8f9 }),
      shockwaveGeo: new THREE.RingGeometry(0.84, 1.0, 36),
      ordnanceBodyGeo,
      ordnanceNoseGeo,
      ordnanceBodyMat: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.38, metalness: 0.65 }),
      ordnanceNoseMat: new THREE.MeshBasicMaterial({ color: 0xf97316 }),
      flareGeo: new THREE.OctahedronGeometry(0.42, 0),
      flareMat: new THREE.MeshBasicMaterial({ color: 0xfffbeb }),
      allyBulletMat: new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
    };
    sharedAssetsRef.current = sharedAssets;

    // Build ALL fixed pre-allocated VFX & Projectile object pools ONCE!
    const poolContainer = new THREE.Group();
    scene.add(poolContainer);

    const bullets: PooledProjectileSlot[] = [];
    for (let i = 0; i < POOL_BULLETS; i++) {
      const mesh = new THREE.Mesh(sharedAssets.bulletGeo, sharedAssets.bulletMat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      poolContainer.add(mesh);
      bullets.push({
        active: false,
        type: 'bullet',
        mesh,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        targetX: 0,
        targetY: 0,
        targetZ: 0,
        targetEnemyId: '',
        targetOrdnanceIdx: -1,
        targetFlareIdx: -1,
        speed: 46,
        damage: 0,
        age: 0,
        maxLifetime: 1,
        lastSmokeTime: 0,
        weavePhase: 0,
        weaveFreq: 0,
        weaveAmp: 0,
        turnRate: 20,
      });
    }

    const missiles: PooledProjectileSlot[] = [];
    for (let i = 0; i < POOL_MISSILES; i++) {
      const mGroup = new THREE.Group();
      const mBody = new THREE.Mesh(sharedAssets.missileBodyGeo, sharedAssets.missileBodyMat);
      const mNose = new THREE.Mesh(sharedAssets.missileNoseGeo, sharedAssets.missileNoseMat);
      mNose.position.z = 0.64;
      const mFin = new THREE.Mesh(sharedAssets.missileFinGeo, sharedAssets.missileFinMat);
      mFin.position.z = -0.34;
      const mFlame = new THREE.Mesh(sharedAssets.missileFlameGeo, sharedAssets.missileFlameMat);
      mFlame.position.z = -0.74;
      mGroup.add(mBody, mNose, mFin, mFlame);
      mGroup.visible = false;
      poolContainer.add(mGroup);
      missiles.push({
        active: false,
        type: 'missile',
        mesh: mGroup,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        targetX: 0,
        targetY: 0,
        targetZ: 0,
        targetEnemyId: '',
        targetOrdnanceIdx: -1,
        targetFlareIdx: -1,
        speed: 26,
        damage: 0,
        age: 0,
        maxLifetime: 3.4,
        lastSmokeTime: 0,
        weavePhase: 0,
        weaveFreq: 6,
        weaveAmp: 1.5,
        turnRate: 6,
      });
    }

    const ordnances: PooledOrdnanceSlot[] = [];
    for (let i = 0; i < POOL_ENEMY_ORDNANCE; i++) {
      const oGroup = new THREE.Group();
      const oBody = new THREE.Mesh(sharedAssets.ordnanceBodyGeo, sharedAssets.ordnanceBodyMat);
      const oNose = new THREE.Mesh(sharedAssets.ordnanceNoseGeo, sharedAssets.ordnanceNoseMat);
      oNose.position.z = 0.62;
      const oFin = new THREE.Mesh(sharedAssets.missileFinGeo, sharedAssets.missileFinMat);
      oFin.position.z = -0.32;
      const oFlame = new THREE.Mesh(sharedAssets.missileFlameGeo, sharedAssets.missileFlameMat);
      oFlame.position.z = -0.7;
      oFlame.scale.setScalar(0.85);
      oGroup.add(oBody, oNose, oFin, oFlame);
      oGroup.visible = false;
      poolContainer.add(oGroup);
      ordnances.push({
        active: false,
        id: `ord_${i}`,
        mesh: oGroup,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        hp: 30,
        maxHp: 30,
        damage: 35,
        speed: 10,
        age: 0,
        maxAge: 7.5,
        lastSmokeTime: 0,
        isBomb: true,
      });
    }

    const lasers: PooledLaserSlot[] = [];
    for (let i = 0; i < POOL_LASERS; i++) {
      const coreMesh = new THREE.Mesh(sharedAssets.laserCoreGeo, sharedAssets.laserCoreMat);
      const haloMesh = new THREE.Mesh(sharedAssets.laserHaloGeo, sharedAssets.laserHaloMat);
      coreMesh.visible = false;
      haloMesh.visible = false;
      coreMesh.frustumCulled = false;
      haloMesh.frustumCulled = false;
      poolContainer.add(coreMesh, haloMesh);
      lasers.push({ active: false, coreMesh, haloMesh, expiresAt: 0 });
    }

    const muzzles: PooledMuzzleSlot[] = [];
    for (let i = 0; i < POOL_MUZZLES; i++) {
      const mesh = new THREE.Mesh(sharedAssets.muzzleFlashGeo, sharedAssets.muzzleFlashMats[0]);
      mesh.visible = false;
      mesh.frustumCulled = false;
      poolContainer.add(mesh);
      muzzles.push({ active: false, mesh, age: 0, maxAge: 0.075, baseScale: 0.5 });
    }

    const smokes: PooledSmokeSlot[] = [];
    for (let i = 0; i < POOL_SMOKES; i++) {
      const mesh = new THREE.Mesh(sharedAssets.smokeGeo, sharedAssets.smokeMat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      poolContainer.add(mesh);
      smokes.push({ active: false, mesh, x: 0, y: 0, z: 0, vy: 0.8, age: 0, maxAge: 0.5, startSize: 0.24 });
    }

    const particles: PooledParticleSlot[] = [];
    for (let i = 0; i < POOL_PARTICLES; i++) {
      const mesh = new THREE.Mesh(sharedAssets.particleGeo, sharedAssets.particleMats[i % sharedAssets.particleMats.length]);
      mesh.visible = false;
      mesh.frustumCulled = false;
      poolContainer.add(mesh);
      particles.push({
        active: false,
        mesh,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 0.25,
        life: 0,
        maxLife: 0.5,
      });
    }

    const shockwaves: PooledShockwaveSlot[] = [];
    for (let i = 0; i < POOL_SHOCKWAVES; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff7b00,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(sharedAssets.shockwaveGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      mesh.frustumCulled = false;
      poolContainer.add(mesh);
      shockwaves.push({ active: false, mesh, mat, age: 0, maxAge: 0.4, startScale: 0.5, maxScale: 3.0 });
    }

    const flares: PooledFlareSlot[] = [];
    for (let i = 0; i < POOL_FLARES; i++) {
      const mesh = new THREE.Mesh(sharedAssets.flareGeo, sharedAssets.flareMat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      poolContainer.add(mesh);
      flares.push({
        active: false,
        mesh,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        maxAge: 2.4,
        lastSmokeTime: 0,
      });
    }

    poolsRef.current = { bullets, missiles, ordnances, flares, lasers, muzzles, smokes, particles, shockwaves };

    // Pre-allocate 2 Friendly Scramble CAP Interceptor Jets (ZERO runtime allocation!)
    const capFighters: CapFighterState[] = [];
    for (let i = 0; i < 2; i++) {
      const rig = buildAllyFighter3D();
      rig.group.rotation.order = 'YXZ';
      rig.group.visible = false;
      scene.add(rig.group);
      capFighters.push({
        rig,
        active: false,
        exiting: false,
        x: i === 0 ? -4 : 4,
        y: 2,
        z: 16,
        heading: Math.PI,
        bankAngle: 0,
        alt: 11.8 + i * 1.4,
        orbitDir: i === 0 ? 1 : -1,
        orbitPhase: i * Math.PI,
        targetEnemyId: '',
        lastGunTime: -10,
        lastMissileTime: -10,
        pylonCursor: 0,
        lastContrailTime: 0,
      });
    }
    capFightersRef.current = capFighters;

    // Single reusable dynamic twilight flash light (keeps PBR fragment shader lightweight!)
    if (!isSoftwareGl) {
      const pt = new THREE.PointLight(0xff8c2a, 0, 16, 2);
      pt.position.set(0, -50, 0);
      scene.add(pt);
      flashLightRef.current = { light: pt, age: 1, maxAge: 1, peakIntensity: 0 };
    } else {
      flashLightRef.current = null;
    }

    // Studio PBR reflection map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.48;
    pmremGenerator.dispose();

    // Twilight 3-Point Lighting Rig (1024x1024 shadow map for silky frame budget)
    const hemiLight = new THREE.HemisphereLight(
      initialCfg.hemiSky,
      initialCfg.hemiGround,
      initialCfg.hemiIntensity
    );
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(initialCfg.keyColor, initialCfg.keyIntensity);
    dirLight.position.set(-34, 46, -28);
    dirLight.castShadow = !isSoftwareGl;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 2;
    dirLight.shadow.camera.far = 165;
    const d = 52;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0006;
    dirLight.shadow.normalBias = 0.03;
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(initialCfg.rimColor, initialCfg.rimIntensity);
    rimLight.position.set(36, 16, 40);
    scene.add(rimLight);

    lightsRef.current = { dirLight, hemiLight, rimLight };

    // Build initial world, upgraded command bunker, and stage starter towers
    mountBiomeWorld(biomeRef.current);

    const bunkerRig = buildBaseBunker3D();
    bunkerRig.group.position.set(0, getGroundHeight(0, 0, biomeRef.current), 0);
    scene.add(bunkerRig.group);
    bunkerRigRef.current = bunkerRig;

    // Pre-allocate 4 glowing perimeter approach chevrons showing upcoming wave entry vectors
    const chevronGeo = new THREE.ConeGeometry(1.25, 2.9, 4);
    chevronGeo.rotateX(Math.PI / 2);
    const chevronMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const chevrons: THREE.Mesh[] = [];
    for (let s = 0; s < 4; s++) {
      const ang = COMPASS_ANGLES[s];
      const cx = Math.cos(ang) * 49.5;
      const cz = Math.sin(ang) * 49.5;
      const chev = new THREE.Mesh(chevronGeo, chevronMat);
      chev.position.set(cx, 6.4, cz);
      chev.lookAt(0, 6.4, 0);
      chev.visible = false;
      scene.add(chev);
      chevrons.push(chev);
    }
    approachChevronsRef.current = chevrons;

    setupStageBoard(stageConfigRef.current, biomeRef.current);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const domElement = renderer.domElement;
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      contextLostRef.current = true;
      setContextLost(true);
    };
    const handleContextRestored = () => {
      contextLostRef.current = false;
      setContextLost(false);
    };
    domElement.addEventListener('webglcontextlost', handleContextLost);
    domElement.addEventListener('webglcontextrestored', handleContextRestored);

    // Pointer, Wheel & Native Multi-Touch Controls (O(1) analytic ground plane intersection)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const setRayFromClient = (clientX: number, clientY: number) => {
      const rect = domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      mouse.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
    };

    const evaluateBuildSpotAt = (clientX: number, clientY: number): boolean => {
      setRayFromClient(clientX, clientY);
      if (!raycaster.ray.intersectPlane(_groundPlane, _hitPoint)) {
        placementValidRef.current = false;
        return false;
      }

      const gx = Math.round(_hitPoint.x / 2) * 2;
      const gz = Math.round(_hitPoint.z / 2) * 2;
      const gy = getGroundHeight(gx, gz, biomeRef.current);

      if (ghostGroupRef.current) {
        ghostGroupRef.current.position.set(gx, gy, gz);
      }
      if (ghostRangeRingRef.current) {
        ghostRangeRingRef.current.position.set(gx, gy + 0.16, gz);
      }
      ghostPosRef.current.set(gx, gy, gz);

      let collidesWithTower = false;
      activeTowersRef.current.forEach(({ towerState }) => {
        if (Math.hypot(gx - towerState.x, gz - towerState.z) < 2.6) {
          collidesWithTower = true;
        }
      });

      const isValid = isBuildableSpot(gx, gz, biomeRef.current) && !collidesWithTower;
      placementValidRef.current = isValid;

      const colorHex = isValid ? 0x10b981 : 0xef4444;
      if (ghostMatRef.current) {
        ghostMatRef.current.color.setHex(colorHex);
      }
      if (ghostRangeRingRef.current) {
        (ghostRangeRingRef.current.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
      }
      return isValid;
    };

    const handlePrimaryTapOrClick = (clientX: number, clientY: number, isTouch: boolean) => {
      setRayFromClient(clientX, clientY);

      // Tower Placement (always evaluate fresh coordinates so touch taps work without prior hover!)
      const pendingBuild = selectedTowerToBuildRef.current;
      if (pendingBuild) {
        const spotValid = evaluateBuildSpotAt(clientX, clientY);
        if (spotValid) {
          const gx = ghostPosRef.current.x;
          const gz = ghostPosRef.current.z;

          if (cashRef.current >= pendingBuild.buildCost) {
            setCash((prev) => prev - pendingBuild.buildCost);
            soundManager.playBuild();
            placeTowerEntity(pendingBuild, gx, gz, biomeRef.current);
            spawnShockwaveRing(gx, getGroundHeight(gx, gz, biomeRef.current) + 0.3, gz, 0x38bdf8, 0.5, 3.2, 0.35);
            setSelectedTowerToBuild(null);
          }
        }
        return;
      }

      // Inspect Placed Tower (direct 3D hit + generous thumb-radius fallback on touchscreens)
      const towerGroups: THREE.Object3D[] = [];
      activeTowersRef.current.forEach((val) => {
        towerGroups.push(val.rig.group);
      });
      const hits = raycaster.intersectObjects(towerGroups, true);
      if (hits.length > 0) {
        let cur: THREE.Object3D | null = hits[0].object;
        while (cur && !cur.userData?.instanceId) {
          cur = cur.parent;
        }
        if (cur && cur.userData?.instanceId) {
          const entry = activeTowersRef.current.get(cur.userData.instanceId);
          if (entry) {
            refreshTowerRadarLinks();
            setSelectedPlacedTower({ ...entry.towerState });
            if (onSelectUnitRef.current) onSelectUnitRef.current(entry.towerState.tower);
            return;
          }
        }
      }

      if (isTouch && raycaster.ray.intersectPlane(_groundPlane, _hitPoint)) {
        let closestEntry: { towerState: ActiveTower } | null = null;
        let closestDist = 2.9;
        activeTowersRef.current.forEach((entry) => {
          const d = Math.hypot(entry.towerState.x - _hitPoint.x, entry.towerState.z - _hitPoint.z);
          if (d < closestDist) {
            closestDist = d;
            closestEntry = entry;
          }
        });
        if (closestEntry) {
          refreshTowerRadarLinks();
          const found = closestEntry as { towerState: ActiveTower };
          setSelectedPlacedTower({ ...found.towerState });
          if (onSelectUnitRef.current) onSelectUnitRef.current(found.towerState.tower);
          return;
        }
      }

      setSelectedPlacedTower(null);
    };

    let lastTouchEndMs = 0;

    const handleMouseDown = (e: MouseEvent) => {
      if (performance.now() - lastTouchEndMs < 450) return;
      soundManager.unlock();
      if (e.button === 0) {
        cameraState.current.isDragging = true;
        cameraState.current.dragMoved = false;
        cameraState.current.previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (performance.now() - lastTouchEndMs < 450) return;
      if (ghostGroupRef.current) {
        evaluateBuildSpotAt(e.clientX, e.clientY);
      }

      if (cameraState.current.isDragging) {
        const deltaX = e.clientX - cameraState.current.previousMousePosition.x;
        const deltaY = e.clientY - cameraState.current.previousMousePosition.y;
        if (Math.hypot(deltaX, deltaY) > 2) {
          cameraState.current.dragMoved = true;
          cameraState.current.transitioning = false;
        }

        cameraState.current.yaw -= deltaX * 0.0055;
        cameraState.current.pitch = Math.max(
          16 * (Math.PI / 180),
          Math.min(82 * (Math.PI / 180), cameraState.current.pitch + deltaY * 0.0055)
        );

        applyCameraTransform();
        cameraState.current.previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseUp = () => {
      cameraState.current.isDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraState.current.transitioning = false;
      cameraState.current.distance = Math.max(18, Math.min(112, cameraState.current.distance + e.deltaY * 0.055));
      applyCameraTransform();
    };

    const handleClick = (e: MouseEvent) => {
      if (performance.now() - lastTouchEndMs < 450) return;
      if (cameraState.current.dragMoved) return;
      handlePrimaryTapOrClick(e.clientX, e.clientY, false);
    };

    // Native Mobile Touch Gestures: 1-finger orbit / tap-to-build & 2-finger pinch-to-zoom
    let touchStartX = 0;
    let touchStartY = 0;
    let touchLastX = 0;
    let touchLastY = 0;
    let touchMoved = false;
    let touchWasPinch = false;
    let lastPinchDist = 0;

    const getPinchDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      soundManager.unlock();

      if (e.touches.length === 1) {
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        touchLastX = t.clientX;
        touchLastY = t.clientY;
        touchMoved = false;
        touchWasPinch = false;
        cameraState.current.isDragging = true;

        // Instant visual feedback on finger-down when placing tower
        if (ghostGroupRef.current) {
          evaluateBuildSpotAt(t.clientX, t.clientY);
        }
      } else if (e.touches.length >= 2) {
        touchWasPinch = true;
        touchMoved = true;
        cameraState.current.isDragging = false;
        cameraState.current.transitioning = false;
        lastPinchDist = getPinchDistance(e.touches);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();

      if (e.touches.length >= 2) {
        touchWasPinch = true;
        touchMoved = true;
        const nextDist = getPinchDistance(e.touches);
        if (lastPinchDist > 0) {
          const deltaPinch = lastPinchDist - nextDist;
          cameraState.current.transitioning = false;
          cameraState.current.distance = Math.max(
            18,
            Math.min(112, cameraState.current.distance + deltaPinch * 0.14)
          );
          applyCameraTransform();
        }
        lastPinchDist = nextDist;
        return;
      }

      if (e.touches.length === 1 && !touchWasPinch) {
        const t = e.touches[0];
        const totalDist = Math.hypot(t.clientX - touchStartX, t.clientY - touchStartY);
        if (totalDist > 9) {
          touchMoved = true;
          cameraState.current.transitioning = false;
        }

        if (touchMoved) {
          const dx = t.clientX - touchLastX;
          const dy = t.clientY - touchLastY;
          cameraState.current.yaw -= dx * 0.0066;
          cameraState.current.pitch = Math.max(
            16 * (Math.PI / 180),
            Math.min(82 * (Math.PI / 180), cameraState.current.pitch + dy * 0.0066)
          );
          applyCameraTransform();
        }

        touchLastX = t.clientX;
        touchLastY = t.clientY;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      lastTouchEndMs = performance.now();

      if (e.touches.length === 0) {
        cameraState.current.isDragging = false;
        if (!touchMoved && !touchWasPinch && e.changedTouches.length > 0) {
          const t = e.changedTouches[0];
          handlePrimaryTapOrClick(t.clientX, t.clientY, true);
        }
        touchWasPinch = false;
        lastPinchDist = 0;
      } else if (e.touches.length === 1) {
        // Finger lifted from 2-finger pinch; reset anchor cleanly without snapping camera
        touchLastX = e.touches[0].clientX;
        touchLastY = e.touches[0].clientY;
        lastPinchDist = 0;
      }
    };

    const handleTouchCancel = () => {
      cameraState.current.isDragging = false;
      touchMoved = true;
      touchWasPinch = false;
      lastPinchDist = 0;
    };

    domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domElement.addEventListener('wheel', handleWheel, { passive: false });
    domElement.addEventListener('click', handleClick);
    domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    domElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    domElement.addEventListener('touchend', handleTouchEnd, { passive: false });
    domElement.addEventListener('touchcancel', handleTouchCancel);

    // Main 60 FPS Zero-Allocation Combat, Weapon Animation & Cinematic VFX Loop
    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let visualTimeSec = 0;
    let lastHudEnemyCount = -1;
    let lastCooldownSync = 0;
    let lastRadarSync = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl && gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      if (gl) gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl?.SIGNALED;
        if (state === gl?.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync && gl) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const applyBaseDamage = (
      damage: number,
      ix: number,
      iy: number,
      iz: number,
      blastScale: number,
      shakeAmt: number
    ) => {
      triggerExplosion(ix, Math.max(1.3, iy), iz, blastScale);
      soundManager.playBaseHit();
      addCameraShake(shakeAmt);

      const nextHp = Math.max(0, baseHpRef.current - damage);
      baseHpRef.current = nextHp;
      setBaseHp(nextHp);
      if (nextHp <= 0 && !defeatTriggeredRef.current) {
        defeatTriggeredRef.current = true;
        isSpawningRef.current = false;
        if (gameModeRef.current === 'endless') {
          onEndlessRecordUpdateRef.current(
            biomeRef.current,
            Math.max(1, currentWaveIndexRef.current),
            endlessScoreRef.current
          );
        }
        setWaveState('defeat');
        soundManager.setMusicMode('prep');
        soundManager.playDefeatHorn();
      }
    };

    const updateEnemyOrdnancePool = (dt: number, simSec: number) => {
      const pools = poolsRef.current;
      if (!pools) return;
      const ordnances = pools.ordnances;
      const baseY = getGroundHeight(0, 0, biomeRef.current) + 1.65;

      for (let i = 0; i < ordnances.length; i++) {
        const ord = ordnances[i];
        if (!ord.active) continue;

        ord.age += dt;
        const dx = -ord.x;
        const dy = baseY - ord.y;
        const dz = -ord.z;
        const dist = Math.hypot(dx, dy, dz);

        if (dist < 2.05 || ord.age >= ord.maxAge) {
          ord.active = false;
          ord.mesh.visible = false;
          applyBaseDamage(
            ord.damage,
            ord.x,
            ord.y,
            ord.z,
            ord.damage >= 50 ? 1.5 : 1.15,
            ord.damage >= 50 ? 0.44 : 0.28
          );
          continue;
        }

        // Smooth homing dive curve from aircraft release velocity onto HQ bunker
        const nx = dx / Math.max(0.01, dist);
        const ny = dy / Math.max(0.01, dist);
        const nz = dz / Math.max(0.01, dist);
        const desiredSpeed = ord.speed * (ord.isBomb ? 1 + Math.min(0.45, ord.age * 0.28) : 1.12);
        const guideRate = ord.isBomb ? 2.8 + (dist < 10 ? 2.5 : 0) : 4.2 + (dist < 10 ? 3.2 : 0);
        const blend = 1 - Math.exp(-guideRate * dt);
        ord.vx += (nx * desiredSpeed - ord.vx) * blend;
        ord.vy += (ny * desiredSpeed - ord.vy) * blend;
        ord.vz += (nz * desiredSpeed - ord.vz) * blend;

        ord.x += ord.vx * dt;
        ord.y = Math.max(1.1, ord.y + ord.vy * dt);
        ord.z += ord.vz * dt;
        ord.mesh.position.set(ord.x, ord.y, ord.z);
        ord.mesh.lookAt(ord.x + ord.vx, ord.y + ord.vy, ord.z + ord.vz);

        if (simSec - ord.lastSmokeTime > 0.08) {
          ord.lastSmokeTime = simSec;
          spawnSmokePuff(ord.x, ord.y, ord.z, 0.16, 0.36);
        }
      }
    };

    const updateProjectilePool = (
      list: PooledProjectileSlot[],
      dt: number,
      simSec: number
    ) => {
      const pools = poolsRef.current;
      for (let i = 0; i < list.length; i++) {
        const slot = list[i];
        if (!slot.active) continue;

        slot.age += dt;
        const targetFlare =
          slot.targetFlareIdx >= 0 && pools ? pools.flares[slot.targetFlareIdx] : undefined;
        const targetOrd =
          slot.targetOrdnanceIdx >= 0 && pools ? pools.ordnances[slot.targetOrdnanceIdx] : undefined;
        let targetEntry = slot.targetEnemyId ? activeEnemiesRef.current.get(slot.targetEnemyId) : undefined;
        let targetEnemy = targetEntry?.enemyState;

        // If missile was deflected onto a thermal flare that already burned out, detonate harmlessly mid-air
        if (slot.targetFlareIdx >= 0 && (!targetFlare || !targetFlare.active)) {
          slot.active = false;
          slot.mesh.visible = false;
          slot.targetFlareIdx = -1;
          spawnMuzzleFlash(slot.x, slot.y, slot.z, 0.52, 0);
          spawnSmokePuff(slot.x, slot.y, slot.z, 0.3, 0.5);
          continue;
        }

        // Smart mid-flight retargeting for SAM missiles so they NEVER fly aimlessly into empty sky!
        if (
          slot.type === 'missile' &&
          !(targetFlare && targetFlare.active) &&
          !(targetOrd && targetOrd.active) &&
          (!targetEnemy || !targetEnemy.alive)
        ) {
          slot.targetOrdnanceIdx = -1;
          let nearestDist = 28;
          let nearestId = '';
          activeEnemiesRef.current.forEach((cand, cid) => {
            if (!cand.enemyState.alive) return;
            const dCand = Math.hypot(
              cand.enemyState.x - slot.x,
              cand.enemyState.y - slot.y,
              cand.enemyState.z - slot.z
            );
            if (dCand < nearestDist) {
              nearestDist = dCand;
              nearestId = cid;
            }
          });
          if (nearestId) {
            slot.targetEnemyId = nearestId;
            targetEntry = activeEnemiesRef.current.get(nearestId);
            targetEnemy = targetEntry?.enemyState;
          } else {
            // Sky clear: clean flak airburst self-destruct instead of drifting into space
            slot.active = false;
            slot.mesh.visible = false;
            spawnMuzzleFlash(slot.x, slot.y, slot.z, 0.42, 1);
            spawnSmokePuff(slot.x, slot.y, slot.z, 0.28, 0.48);
            continue;
          }
        }

        let destX = slot.targetX;
        let destY = slot.targetY;
        let destZ = slot.targetZ;

        if (targetFlare && targetFlare.active) {
          destX = targetFlare.x;
          destY = targetFlare.y;
          destZ = targetFlare.z;
          slot.targetX = destX;
          slot.targetY = destY;
          slot.targetZ = destZ;
        } else if (targetOrd && targetOrd.active) {
          destX = targetOrd.x;
          destY = targetOrd.y;
          destZ = targetOrd.z;
          slot.targetX = destX;
          slot.targetY = destY;
          slot.targetZ = destZ;
        } else if (slot.type === 'missile' && targetEnemy && targetEnemy.alive) {
          destX = targetEnemy.x;
          destY = targetEnemy.y;
          destZ = targetEnemy.z;
          slot.targetX = destX;
          slot.targetY = destY;
          slot.targetZ = destZ;
        }

        let dx = destX - slot.x;
        let dy = destY - slot.y;
        let dz = destZ - slot.z;
        let dist = Math.hypot(dx, dy, dz);

        // Balanced Countermeasure Flares: deflects ONLY the first incoming SAM missile when closing within 8.8m
        if (
          slot.type === 'missile' &&
          slot.targetFlareIdx < 0 &&
          targetEnemy &&
          targetEnemy.alive &&
          dist < 8.8 &&
          dist > 2.2 &&
          (targetEnemy.flaresRemaining ?? 0) > 0 &&
          simSec >= (targetEnemy.flareCooldownUntil ?? 0)
        ) {
          targetEnemy.flaresRemaining = Math.max(0, (targetEnemy.flaresRemaining ?? 1) - 1);
          targetEnemy.flareCooldownUntil = simSec + (targetEnemy.unit.flareCooldownSec ?? 12);
          const primaryFlareIdx = deployCountermeasureFlares(
            targetEnemy.x,
            targetEnemy.y,
            targetEnemy.z,
            targetEntry?.heading ?? targetEnemy.rotationY,
            simSec
          );
          if (primaryFlareIdx >= 0 && pools) {
            const decoy = pools.flares[primaryFlareIdx];
            slot.targetFlareIdx = primaryFlareIdx;
            slot.targetEnemyId = '';
            targetEnemy = undefined;
            targetEntry = undefined;
            destX = decoy.x;
            destY = decoy.y;
            destZ = decoy.z;
            slot.targetX = destX;
            slot.targetY = destY;
            slot.targetZ = destZ;
            dx = destX - slot.x;
            dy = destY - slot.y;
            dz = destZ - slot.z;
            dist = Math.hypot(dx, dy, dz);
          }
        }

        if (dist < 1.35 || slot.age >= slot.maxLifetime) {
          slot.active = false;
          slot.mesh.visible = false;

          // Deflected missile detonates harmlessly on decoy flare (zero enemy damage, zero splash)
          if (slot.targetFlareIdx >= 0) {
            if (targetFlare && targetFlare.active) {
              targetFlare.active = false;
              targetFlare.mesh.visible = false;
            }
            slot.targetFlareIdx = -1;
            spawnMuzzleFlash(slot.x, slot.y, slot.z, 0.72, 0);
            spawnSmokePuff(slot.x, slot.y, slot.z, 0.34, 0.56);
            spawnShockwaveRing(slot.x, slot.y, slot.z, 0xfef08a, 0.25, 2.2, 0.26);
            continue;
          }

          if (targetOrd && targetOrd.active) {
            targetOrd.hp -= slot.damage;
            if (targetOrd.hp <= 0) {
              targetOrd.active = false;
              targetOrd.mesh.visible = false;
              triggerExplosion(targetOrd.x, targetOrd.y, targetOrd.z, 0.85);
            } else {
              spawnMuzzleFlash(targetOrd.x, targetOrd.y, targetOrd.z, 0.35, 0);
            }
            continue;
          }

          const impactX = targetEnemy ? targetEnemy.x : slot.x;
          const impactY = targetEnemy ? targetEnemy.y : slot.y;
          const impactZ = targetEnemy ? targetEnemy.z : slot.z;

          if (targetEnemy && targetEnemy.alive && targetEntry) {
            targetEnemy.currentHp -= slot.damage;
            targetEntry.rig.healthBar.updateHp(targetEnemy.currentHp);
            if (targetEnemy.currentHp <= 0) {
              destroyEnemyEntry(
                slot.targetEnemyId,
                targetEnemy.unit.isBoss ? 2.25 : slot.type === 'missile' ? 1.35 : 0.9
              );
            } else if (slot.type === 'missile') {
              spawnMuzzleFlash(targetEnemy.x, targetEnemy.y, targetEnemy.z, 0.5, 1);
            }
          }

          // Tech Lab Doctrine: Blast Warheads AoE Missile Splash Damage
          const splashRadius = slot.type === 'missile' ? techModifiersRef.current.missileSplashRadius : 0;
          if (splashRadius > 0) {
            spawnShockwaveRing(impactX, impactY, impactZ, 0xfb923c, 0.5, splashRadius * 0.88, 0.32);
            const splashDmg = Math.round(slot.damage * 0.55);
            const splashKills: { id: string; scale: number }[] = [];
            activeEnemiesRef.current.forEach((otherEntry, otherId) => {
              if (otherId === slot.targetEnemyId || !otherEntry.enemyState.alive) return;
              const dSplash = Math.hypot(
                otherEntry.enemyState.x - impactX,
                otherEntry.enemyState.z - impactZ
              );
              if (dSplash <= splashRadius) {
                otherEntry.enemyState.currentHp -= splashDmg;
                otherEntry.rig.healthBar.updateHp(otherEntry.enemyState.currentHp);
                if (otherEntry.enemyState.currentHp <= 0) {
                  otherEntry.enemyState.alive = false;
                  splashKills.push({
                    id: otherId,
                    scale: otherEntry.enemyState.unit.isBoss ? 2.1 : 1.05,
                  });
                }
              }
            });
            for (let k = 0; k < splashKills.length; k++) {
              destroyEnemyEntry(splashKills[k].id, splashKills[k].scale);
            }
          }
          continue;
        }

        if (dist > 0.001) {
          if (slot.type === 'missile') {
            // Dynamic curved maneuvering homing with gentle lateral S-weave & vertical arch that tightens near target
            const nx = dx / dist;
            const ny = dy / dist;
            const nz = dz / dist;

            const weaveFade = Math.max(0, Math.min(1, (dist - 4.5) / 14));
            const horizNorm = Math.max(0.01, Math.hypot(nx, nz));
            const px = -nz / horizNorm;
            const pz = nx / horizNorm;
            const latWave = Math.sin(slot.age * slot.weaveFreq + slot.weavePhase) * slot.weaveAmp * weaveFade;
            const vertWave = Math.cos(slot.age * (slot.weaveFreq * 0.72) + slot.weavePhase) * (slot.weaveAmp * 0.45) * weaveFade;

            const desX = dx + px * latWave;
            const desY = dy + vertWave;
            const desZ = dz + pz * latWave;
            const desLen = Math.max(0.01, Math.hypot(desX, desY, desZ));

            const tvx = (desX / desLen) * slot.speed;
            const tvy = (desY / desLen) * slot.speed;
            const tvz = (desZ / desLen) * slot.speed;

            // Tighten steering aggressively when close to target so missiles never orbit/miss
            const agility = slot.turnRate + (dist < 10 ? (10 - dist) * 1.45 : 0);
            const blend = 1 - Math.exp(-agility * dt);
            slot.vx += (tvx - slot.vx) * blend;
            slot.vy += (tvy - slot.vy) * blend;
            slot.vz += (tvz - slot.vz) * blend;

            // Normalize to constant interceptor cruise speed
            const curSpd = Math.max(0.01, Math.hypot(slot.vx, slot.vy, slot.vz));
            slot.vx = (slot.vx / curSpd) * slot.speed;
            slot.vy = (slot.vy / curSpd) * slot.speed;
            slot.vz = (slot.vz / curSpd) * slot.speed;

            slot.x += slot.vx * dt;
            slot.y = Math.max(0.8, slot.y + slot.vy * dt);
            slot.z += slot.vz * dt;
            slot.mesh.position.set(slot.x, slot.y, slot.z);
            slot.mesh.lookAt(slot.x + slot.vx, slot.y + slot.vy, slot.z + slot.vz);

            if (simSec - slot.lastSmokeTime > 0.055) {
              slot.lastSmokeTime = simSec;
              spawnSmokePuff(slot.x, slot.y, slot.z, 0.18, 0.44);
            }
          } else {
            const step = Math.min(dist, slot.speed * dt);
            slot.x += (dx / dist) * step;
            slot.y += (dy / dist) * step;
            slot.z += (dz / dist) * step;
            slot.mesh.position.set(slot.x, slot.y, slot.z);
            slot.mesh.lookAt(destX, destY, destZ);
          }
        }
      }
    };

    // Update pooled falling incandescent countermeasure flares
    const updateFlarePool = (dt: number, simSec: number) => {
      const pools = poolsRef.current;
      if (!pools) return;
      const curBiome = biomeRef.current;
      for (let i = 0; i < pools.flares.length; i++) {
        const fl = pools.flares[i];
        if (!fl.active) continue;
        fl.age += dt;
        const drag = Math.exp(-1.25 * dt);
        fl.vx *= drag;
        fl.vz *= drag;
        fl.vy = Math.max(-9.5, fl.vy - 5.2 * dt);
        fl.x += fl.vx * dt;
        fl.y += fl.vy * dt;
        fl.z += fl.vz * dt;

        const gy = getGroundHeight(fl.x, fl.z, curBiome);
        if (fl.age >= fl.maxAge || fl.y <= gy + 0.25) {
          fl.active = false;
          fl.mesh.visible = false;
          continue;
        }

        fl.mesh.position.set(fl.x, fl.y, fl.z);
        const fade = Math.max(0.15, 1 - fl.age / fl.maxAge);
        const flicker = 0.85 + Math.sin(simSec * 42 + i * 2.1) * 0.22;
        fl.mesh.scale.setScalar(0.38 * fade * flicker);

        if (simSec - fl.lastSmokeTime > 0.075) {
          fl.lastSmokeTime = simSec;
          spawnSmokePuff(fl.x, fl.y, fl.z, 0.15, 0.42);
        }
      }
    };

    // Update physics-driven spinning/burning crashing aircraft wrecks + secondary ground impact blast
    const updateCrashingWrecks = (dt: number, simSec: number) => {
      const wrecks = crashingWrecksRef.current;
      if (wrecks.length === 0) return;
      const curBiome = biomeRef.current;
      const assets = sharedAssetsRef.current;
      const pools = poolsRef.current;

      for (let i = wrecks.length - 1; i >= 0; i--) {
        const w = wrecks[i];
        const drag = Math.exp(-0.32 * dt);
        w.vx *= drag;
        w.vz *= drag;
        w.vy -= 14.5 * dt;

        w.x += w.vx * dt;
        w.y += w.vy * dt;
        w.z += w.vz * dt;

        w.rx += w.pitchVel * dt;
        w.ry += w.yawVel * dt;
        w.rz += w.rollVel * dt;

        w.group.position.set(w.x, w.y, w.z);
        w.group.rotation.set(w.rx, w.ry, w.rz);

        // Trailing thick dark smoke & glowing fire sparks during spiral descent
        if (simSec - w.lastSmokeTime >= 0.065) {
          w.lastSmokeTime = simSec;
          spawnSmokePuff(
            w.x + (Math.random() - 0.5) * 0.6,
            w.y + 0.2,
            w.z + (Math.random() - 0.5) * 0.6,
            w.isBoss ? 0.58 : 0.34,
            0.88
          );
          if (pools && assets) {
            for (let pi = 0; pi < pools.particles.length; pi++) {
              const p = pools.particles[pi];
              if (!p.active) {
                p.active = true;
                p.x = w.x;
                p.y = w.y;
                p.z = w.z;
                p.vx = (Math.random() - 0.5) * 3.2;
                p.vy = 0.8 + Math.random() * 2.2;
                p.vz = (Math.random() - 0.5) * 3.2;
                p.size = w.isBoss ? 0.34 : 0.22;
                p.life = 0;
                p.maxLife = 0.35 + Math.random() * 0.2;
                p.mesh.material = assets.particleMats[pi % assets.particleMats.length];
                p.mesh.position.set(w.x, w.y, w.z);
                p.mesh.scale.setScalar(p.size);
                p.mesh.visible = true;
                break;
              }
            }
          }
        }

        const gy = getGroundHeight(w.x, w.z, curBiome);
        if (w.y <= gy + 0.35 || w.y < -12) {
          const impactY = Math.max(gy + 0.45, 0.45);
          triggerExplosion(w.x, impactY, w.z, w.isBoss ? 2.35 : 1.35);
          spawnShockwaveRing(
            w.x,
            impactY + 0.1,
            w.z,
            w.isBoss ? 0xfbbf24 : 0xf97316,
            0.65,
            w.isBoss ? 9.5 : 5.2,
            w.isBoss ? 0.62 : 0.42
          );
          triggerFlashLight(w.x, impactY + 2.2, w.z, 0xff7b00, w.isBoss ? 28 : 16, 0.34);
          addCameraShake(w.isBoss ? 0.72 : 0.24);
          soundManager.playGroundCrash(w.isBoss);

          scene.remove(w.group);
          disposeObject3D(w.group);
          wrecks.splice(i, 1);
        }
      }
    };

    // Update Scramble CAP Allied Twin Fighter Squadron (dogfight pursuit, cyan cannon + air-to-air missiles)
    const updateCapFighters = (dt: number, simSec: number, visSec: number) => {
      const fighters = capFightersRef.current;
      if (fighters.length === 0) return;

      const patrolActive = simSec < capActiveUntilRef.current;
      const dmgMult = techModifiersRef.current.damageMult;

      for (let i = 0; i < fighters.length; i++) {
        const f = fighters[i];
        if (!f.active) continue;

        if (!patrolActive && !f.exiting) {
          f.exiting = true;
          f.targetEnemyId = '';
        }

        const otherTargetId = fighters[1 - i]?.targetEnemyId ?? '';
        let targetEntry = !f.exiting && f.targetEnemyId ? activeEnemiesRef.current.get(f.targetEnemyId) : undefined;
        if (!targetEntry || !targetEntry.enemyState.alive) {
          f.targetEnemyId = '';
          targetEntry = undefined;
        }

        // Acquire priority airborne threat (split targets between Wingman 0 & Wingman 1 when possible)
        if (!f.exiting && !targetEntry && activeEnemiesRef.current.size > 0) {
          let bestId = '';
          let bestScore = -Infinity;
          activeEnemiesRef.current.forEach((entry, id) => {
            if (!entry.enemyState.alive) return;
            const dJet = Math.hypot(entry.enemyState.x - f.x, entry.enemyState.z - f.z);
            const dBase = Math.hypot(entry.enemyState.x, entry.enemyState.z);
            let score = 95 - dBase * 0.75 - dJet * 0.45;
            if (entry.enemyState.unit.shape === 'enemy_fighter') score += 38;
            if (entry.enemyState.unit.isBoss) score += 26;
            if (entry.enemyState.unit.doctrine === 'fighter_bomber' || entry.enemyState.unit.doctrine === 'command_orbit') {
              score += 14;
            }
            if (id === otherTargetId && activeEnemiesRef.current.size > 1) {
              score -= 34;
            }
            if (score > bestScore) {
              bestScore = score;
              bestId = id;
            }
          });
          if (bestId) {
            f.targetEnemyId = bestId;
            targetEntry = activeEnemiesRef.current.get(bestId);
          }
        }

        let goalX = 0;
        let goalY = f.alt;
        let goalZ = 0;
        let speed = 20.5;

        if (f.exiting) {
          // Afterburner climb-out exit to northern perimeter
          const exitAng = i === 0 ? -0.35 : 0.35;
          goalX = Math.sin(exitAng) * 95;
          goalY = 24;
          goalZ = -Math.cos(exitAng) * 95;
          speed = 25;
          if (Math.hypot(f.x, f.z) > 82) {
            f.active = false;
            f.exiting = false;
            f.rig.group.visible = false;
            continue;
          }
        } else if (targetEntry && targetEntry.enemyState.alive) {
          const te = targetEntry.enemyState;
          const leadX = te.x + te.vx * 0.45;
          const leadZ = te.z + te.vz * 0.45;
          const dTgt = Math.hypot(leadX - f.x, leadZ - f.z);
          if (dTgt < 7.5) {
            // Break away slightly to avoid overlapping mesh while setting up next gun pass
            const perpAng = f.heading + f.orbitDir * 1.15;
            goalX = te.x + Math.sin(perpAng) * 14;
            goalZ = te.z + Math.cos(perpAng) * 14;
          } else {
            goalX = leadX;
            goalZ = leadZ;
          }
          goalY = Math.max(7.8, Math.min(18.5, te.y + 1.4));
          speed = 21.5;
        } else {
          // Crisp CAP racetrack patrol circle around the base perimeter
          f.orbitPhase += f.orbitDir * 0.62 * dt;
          const patrolR = i === 0 ? 22 : 26;
          goalX = Math.sin(f.orbitPhase) * patrolR;
          goalZ = Math.cos(f.orbitPhase) * patrolR;
          goalY = f.alt + Math.sin(visSec * 1.3 + i * 2) * 0.9;
          speed = 18.5;
        }

        const desiredHeading = Math.atan2(goalX - f.x, goalZ - f.z);
        const turnDelta = normalizeAngle(desiredHeading - f.heading);
        const maxTurn = 2.65 * dt;
        const appliedTurn = Math.max(-maxTurn, Math.min(maxTurn, turnDelta));
        f.heading = normalizeAngle(f.heading + appliedTurn);

        const targetBank = Math.max(-0.88, Math.min(0.88, -(turnDelta * 1.45)));
        f.bankAngle = THREE.MathUtils.damp(f.bankAngle, targetBank, 6.5, dt);

        const vx = Math.sin(f.heading) * speed;
        const vz = Math.cos(f.heading) * speed;
        const prevY = f.y;
        f.x += vx * dt;
        f.z += vz * dt;
        f.y = THREE.MathUtils.damp(f.y, goalY, 2.4, dt);
        const vy = (f.y - prevY) / Math.max(0.001, dt);
        const pitch = Math.max(-0.42, Math.min(0.42, -Math.atan2(vy, speed)));

        f.rig.group.position.set(f.x, f.y, f.z);
        f.rig.group.rotation.set(pitch, f.heading, f.bankAngle);
        f.rig.updateAnim(dt, visSec);

        // Twin wingtip vapor / engine contrails
        if (simSec - f.lastContrailTime > 0.085) {
          f.lastContrailTime = simSec;
          const tailX = f.x - Math.sin(f.heading) * 1.55;
          const tailZ = f.z - Math.cos(f.heading) * 1.55;
          spawnSmokePuff(tailX, f.y - 0.06, tailZ, 0.16, 0.42);
        }

        // Engage airborne target with forward cyan autocannon + underwing air-to-air missiles
        if (!f.exiting && targetEntry && targetEntry.enemyState.alive) {
          const te = targetEntry.enemyState;
          const d3 = Math.hypot(te.x - f.x, te.y - f.y, te.z - f.z);
          const bearingDelta = Math.abs(normalizeAngle(Math.atan2(te.x - f.x, te.z - f.z) - f.heading));

          // Rapid 20mm cyan autocannon burst in forward cone
          if (d3 < 19 && bearingDelta < 0.58 && simSec - f.lastGunTime >= 0.21) {
            f.lastGunTime = simSec;
            const muzzleX = f.x + Math.sin(f.heading) * 1.35;
            const muzzleZ = f.z + Math.cos(f.heading) * 1.35;
            soundManager.playGatling();
            spawnMuzzleFlash(muzzleX, f.y - 0.1, muzzleZ, 0.36, 0);
            spawnPooledProjectile(
              'bullet',
              muzzleX,
              f.y - 0.1,
              muzzleZ,
              te.x,
              te.y,
              te.z,
              te.instanceId,
              54,
              Math.round(22 * dmgMult),
              0.9,
              simSec,
              true, // cyan allied tracer material
              -1
            );
          }

          // Agile air-to-air missile from alternating underwing pylons
          if (d3 >= 9 && d3 <= 38 && bearingDelta < 0.85 && simSec - f.lastMissileTime >= 2.25) {
            f.lastMissileTime = simSec;
            const pylon = f.rig.pylonAnchors[f.pylonCursor % f.rig.pylonAnchors.length];
            f.pylonCursor++;
            if (pylon) {
              pylon.getWorldPosition(_spawnPos);
            } else {
              _spawnPos.set(f.x, f.y - 0.25, f.z);
            }
            soundManager.playMissileLaunch(false);
            spawnMuzzleFlash(_spawnPos.x, _spawnPos.y, _spawnPos.z, 0.48, 1);
            spawnPooledProjectile(
              'missile',
              _spawnPos.x,
              _spawnPos.y,
              _spawnPos.z,
              te.x,
              te.y,
              te.z,
              te.instanceId,
              34,
              Math.round(92 * dmgMult),
              3.4,
              simSec,
              false,
              -1
            );
          }
        }
      }
    };

    const tick = () => {
      if (disposed) return;

      try {
        const currentTime = performance.now();
        const dtRaw = Math.min(0.06, Math.max(0.001, (currentTime - lastTime) / 1000));
        lastTime = currentTime;

        // Pause cleanly if WebGL context is currently recovering
        if (contextLostRef.current) {
          frameId = requestAnimationFrame(tick);
          return;
        }

        const dt = dtRaw * gameSpeedRef.current;
        visualTimeSec += dtRaw;

        // Smooth exponential camera preset damping & micro camera shake decay
        const cs = cameraState.current;
        let cameraDirty = false;
        if (cs.transitioning) {
          cs.distance = THREE.MathUtils.damp(cs.distance, cs.goalDistance, 7, dtRaw);
          cs.pitch = THREE.MathUtils.damp(cs.pitch, cs.goalPitch, 7, dtRaw);
          cs.yaw = THREE.MathUtils.damp(cs.yaw, cs.goalYaw, 7, dtRaw);
          cameraDirty = true;
          if (
            Math.abs(cs.distance - cs.goalDistance) < 0.05 &&
            Math.abs(cs.pitch - cs.goalPitch) < 0.003 &&
            Math.abs(cs.yaw - cs.goalYaw) < 0.003
          ) {
            cs.transitioning = false;
          }
        }
        if (cameraShakeRef.current.intensity > 0.004) {
          cameraShakeRef.current.phase += dtRaw;
          cameraShakeRef.current.intensity = THREE.MathUtils.damp(cameraShakeRef.current.intensity, 0, 10, dtRaw);
          if (cameraShakeRef.current.intensity <= 0.005) cameraShakeRef.current.intensity = 0;
          cameraDirty = true;
        }
        if (cameraDirty) {
          applyCameraTransform();
        }

        // Automatic Night Raid atmosphere (special night/stealth stages & boss waves) + active AA searchlight target feed
        let anyAliveBoss = false;
        let searchCount = 0;
        activeEnemiesRef.current.forEach(({ enemyState }) => {
          if (!enemyState.alive) return;
          if (enemyState.unit.isBoss) anyAliveBoss = true;
          if (searchCount < 18) {
            if (_searchTargetsBuf[searchCount]) {
              _searchTargetsBuf[searchCount].x = enemyState.x;
              _searchTargetsBuf[searchCount].y = enemyState.y;
              _searchTargetsBuf[searchCount].z = enemyState.z;
            } else {
              _searchTargetsBuf.push({ x: enemyState.x, y: enemyState.y, z: enemyState.z });
            }
            searchCount++;
          }
        });
        _searchTargetsBuf.length = searchCount;

        const shouldBeNight =
          (gameModeRef.current === 'campaign' && Boolean(stageConfigRef.current.isNightStage)) ||
          waveHasBossRef.current ||
          anyAliveBoss;
        if (shouldBeNight !== isNightRaidRef.current) {
          isNightRaidRef.current = shouldBeNight;
          setIsNightRaid(shouldBeNight);
        }

        const nf = THREE.MathUtils.damp(nightFactorRef.current, shouldBeNight ? 1 : 0, 1.35, dtRaw);
        nightFactorRef.current = nf;

        // Smoothly modulate scene atmosphere, moonlight & bright night tracers (ZERO per-frame color allocation)
        const bCfg = BIOME_CONFIGS[biomeRef.current];
        _dayColor.setHex(bCfg.fogColor);
        _nightColor.setHex(0x040712);
        _blendColor.copy(_dayColor).lerp(_nightColor, nf * 0.85);
        if (scene.background instanceof THREE.Color) {
          scene.background.copy(_blendColor);
        }
        if (scene.fog instanceof THREE.FogExp2) {
          scene.fog.color.copy(_blendColor);
          scene.fog.density = bCfg.fogDensity * (1 + nf * 0.2);
        }

        _dayColor.setHex(bCfg.keyColor);
        _nightColor.setHex(0x93c5fd);
        dirLight.color.copy(_dayColor).lerp(_nightColor, nf * 0.72);
        dirLight.intensity = bCfg.keyIntensity * (1 - nf * 0.38);

        hemiLight.intensity = bCfg.hemiIntensity * (1 - nf * 0.45);
        rimLight.intensity = bCfg.rimIntensity * (1 + nf * 0.08);
        sharedAssets.bulletMat.color.setHex(nf > 0.45 ? 0xfff7c2 : 0xfef08a);

        // Animate biome atmosphere, live weather, target-tracking AA searchlights & base glow
        worldHandleRef.current?.update(visualTimeSec, dtRaw, nf, _searchTargetsBuf);

        if (bunkerShieldTimerRef.current > 0) {
          bunkerShieldTimerRef.current = Math.max(0, bunkerShieldTimerRef.current - dtRaw);
        }
        const hpRatio = baseHpRef.current / Math.max(1, maxBaseHpRef.current);
        bunkerRigRef.current?.updateAnim(dtRaw, visualTimeSec, hpRatio, bunkerShieldTimerRef.current);

        // Diegetic bunker damage smoke & embers when HQ is damaged
        if (hpRatio < 0.65 && !defeatTriggeredRef.current) {
          const smokeInterval = hpRatio < 0.35 ? 0.3 : 0.72;
          if (visualTimeSec - lastBunkerSmokeRef.current >= smokeInterval) {
            lastBunkerSmokeRef.current = visualTimeSec;
            const gy = getGroundHeight(0, 0, biomeRef.current);
            const sx = (Math.random() > 0.5 ? 1 : -1) * (0.85 + Math.random() * 0.5);
            const sz = (Math.random() > 0.5 ? 1 : -1) * (0.85 + Math.random() * 0.5);
            spawnSmokePuff(sx, gy + 2.25, sz, hpRatio < 0.35 ? 0.44 : 0.3, 0.85);
            if (hpRatio < 0.35 && Math.random() < 0.45) {
              spawnMuzzleFlash(sx, gy + 2.15, sz, 0.38, 1);
            }
          }
        }

        // Pre-wave glowing perimeter approach chevrons
        const showApproachChevrons =
          !isSpawningRef.current &&
          activeEnemiesRef.current.size === 0 &&
          !defeatTriggeredRef.current &&
          waveStateRef.current !== 'victory';
        const sectors = upcomingSectorsRef.current;
        for (let s = 0; s < approachChevronsRef.current.length; s++) {
          const chev = approachChevronsRef.current[s];
          const shouldShow = showApproachChevrons && sectors.includes(s);
          chev.visible = shouldShow;
          if (shouldShow) {
            const ang = COMPASS_ANGLES[s];
            const pulseR = 49.5 + Math.sin(visualTimeSec * 4.2 + s) * 1.5;
            chev.position.set(Math.cos(ang) * pulseR, 6.4 + Math.sin(visualTimeSec * 3.0 + s) * 0.45, Math.sin(ang) * pulseR);
          }
        }

        // Update single reusable twilight flash light
        const fl = flashLightRef.current;
        if (fl) {
          if (fl.age < fl.maxAge) {
            fl.age += dtRaw;
            const remain = Math.max(0, 1 - fl.age / fl.maxAge);
            fl.light.intensity = fl.peakIntensity * remain * remain;
          } else if (fl.light.intensity > 0) {
            fl.light.intensity = 0;
          }
        }

        // Publish zero-React-re-render Tactical Radar snapshot at ~12-15 FPS
        if (currentTime - lastRadarSync > 78) {
          lastRadarSync = currentTime;
          const blips: RadarEntityBlip[] = [];
          const radarZones: RadarZone[] = [];
          const rMult = techModifiersRef.current.rangeMult;

          activeTowersRef.current.forEach(({ towerState }) => {
            if (towerState.tower.shape === 'radar_dish') {
              blips.push({ x: towerState.x, z: towerState.z, kind: 'radar_tower' });
              radarZones.push({
                x: towerState.x,
                z: towerState.z,
                radius: getRadarCoverageRadius(towerState.level, rMult),
              });
            } else {
              blips.push({ x: towerState.x, z: towerState.z, kind: 'tower' });
            }
          });
          activeEnemiesRef.current.forEach(({ enemyState }) => {
            if (!enemyState.alive) return;
            // Stealth aircraft only show crisply on tactical radar if inside a regional radar bubble or close to HQ
            if (
              enemyState.unit.isStealth &&
              !enemyState.radarIlluminated &&
              Math.hypot(enemyState.x, enemyState.z) > 22
            ) {
              return;
            }
            const kind: RadarEntityBlip['kind'] = enemyState.unit.isBoss
              ? 'boss'
              : enemyState.unit.jammerRadius
                ? 'jammer'
                : enemyState.unit.isStealth
                  ? 'stealth'
                  : 'enemy';
            blips.push({ x: enemyState.x, z: enemyState.z, kind });
          });
          const curPools = poolsRef.current;
          if (curPools) {
            for (let oi = 0; oi < curPools.ordnances.length; oi++) {
              const ord = curPools.ordnances[oi];
              if (ord.active) {
                blips.push({ x: ord.x, z: ord.z, kind: 'ordnance' });
              }
            }
          }
          for (let fi = 0; fi < capFightersRef.current.length; fi++) {
            const cf = capFightersRef.current[fi];
            if (cf.active) {
              blips.push({ x: cf.x, z: cf.z, kind: 'ally_fighter' });
            }
          }
          radarSnapshotRef.current = {
            blips,
            radarZones,
            incomingSectors: sectors.map((idx) => COMPASS_ANGLES[idx] ?? 0),
            waveActive: isSpawningRef.current || activeEnemiesRef.current.size > 0,
          };
        }

        const pools = poolsRef.current;

        if (dt > 0 && !defeatTriggeredRef.current && pools) {
          simCombatSecRef.current += dt;
          const simSec = simCombatSecRef.current;
          const stage = stageConfigRef.current;

          // Tick Commander Skill Cooldowns & CAP Patrol Timer
          if (empCooldownRef.current > 0) empCooldownRef.current = Math.max(0, empCooldownRef.current - dt);
          if (repairCooldownRef.current > 0) repairCooldownRef.current = Math.max(0, repairCooldownRef.current - dt);
          const capRemActive = Math.max(0, capActiveUntilRef.current - simSec);
          if (capRemActive <= 0 && capCooldownRef.current > 0) {
            capCooldownRef.current = Math.max(0, capCooldownRef.current - dt);
          }
          if (currentTime - lastCooldownSync > 140) {
            lastCooldownSync = currentTime;
            setEmpCooldownLeft(empCooldownRef.current);
            setRepairCooldownLeft(repairCooldownRef.current);
            setCapCooldownLeft(capCooldownRef.current);
            setCapActiveLeft(capRemActive);
          }

          // 1. WAVE SPAWN PROCESSOR (capped at max 3 spawns per tick to prevent GC/frame spikes)
          if (isSpawningRef.current && waveQueueRef.current.length > 0) {
            const elapsedWaveSec = simSec - waveStartTimeRef.current;
            let spawnedThisTick = 0;
            const waveNum = currentWaveIndexRef.current + 1;
            const hpScale =
              gameModeRef.current === 'endless'
                ? 1 + (waveNum - 1) * 0.16
                : stage.hpMultiplier;
            const speedScale =
              gameModeRef.current === 'endless'
                ? 1 + Math.min(0.45, (waveNum - 1) * 0.016)
                : stage.speedMultiplier;
            const activeSectors = upcomingSectorsRef.current.length > 0 ? upcomingSectorsRef.current : [0, 1, 2, 3];

            while (
              spawnedThisTick < 3 &&
              waveQueueRef.current.length > 0 &&
              waveQueueRef.current[0].spawnTime <= elapsedWaveSec
            ) {
              spawnedThisTick++;
              const nextEnemy = waveQueueRef.current.shift()!;
              const unitConfig = ENEMY_UNITS.find((u) => u.id === nextEnemy.unitId);
              if (unitConfig) {
                const chosenSector = activeSectors[Math.floor(Math.random() * activeSectors.length)];
                const angle = COMPASS_ANGLES[chosenSector] + (Math.random() - 0.5) * 0.72;
                const spawnDist = 62 + Math.random() * 10;
                const sx = Math.cos(angle) * spawnDist;
                const sz = Math.sin(angle) * spawnDist;
                const startAlt =
                  unitConfig.shape === 'ballistic_missile'
                    ? unitConfig.altitude + 2.5
                    : unitConfig.altitude + (Math.random() - 0.5) * 1.1;

                const scaledHp = Math.round(unitConfig.hp * hpScale);
                const scaledUnit: EnemyUnit = { ...unitConfig, hp: scaledHp };
                const instanceId = 'enemy_' + Math.random().toString(36).substring(2, 9);
                const rig = buildEnemy3D(scaledUnit);
                rig.group.rotation.order = 'YXZ';
                rig.group.position.set(sx, startAlt, sz);
                const initialHeading = Math.atan2(-sx, -sz);
                rig.group.rotation.y = initialHeading;
                scene.add(rig.group);

                if (scaledUnit.isBoss && bossHornPlayedForWaveRef.current !== currentWaveIndexRef.current) {
                  bossHornPlayedForWaveRef.current = currentWaveIndexRef.current;
                  soundManager.setMusicMode('boss');
                  soundManager.playBossHorn();
                  addCameraShake(0.32);
                }

                // 5-Class Flight Doctrine Calibration (maneuver scales cleanly by aircraft size & mission)
                const doctrine: FlightDoctrine =
                  unitConfig.doctrine ??
                  (unitConfig.shape === 'ballistic_missile'
                    ? 'ballistic_missile'
                    : unitConfig.shape === 'cruise_missile'
                      ? 'cruise_missile'
                      : 'swarm_kamikaze');
                const isSmallAgile =
                  unitConfig.id === 'shahed_136' || unitConfig.id === 'switchblade_loiter';
                const maneuverAmpLat =
                  doctrine === 'ballistic_missile'
                    ? 0.2
                    : doctrine === 'cruise_missile'
                      ? 0.55
                      : doctrine === 'recon_diver'
                        ? 0.45
                        : isSmallAgile
                          ? 3.4 + Math.random() * 1.3
                          : 1.45 + Math.random() * 0.55;
                const maneuverAmpVert =
                  doctrine === 'ballistic_missile'
                    ? 0.25
                    : doctrine === 'cruise_missile'
                      ? 0.45
                      : isSmallAgile
                        ? 1.55 + Math.random() * 0.7
                        : 0.75 + Math.random() * 0.35;
                const flankAmp =
                  doctrine === 'ballistic_missile'
                    ? 1.6
                    : doctrine === 'cruise_missile'
                      ? 6.5 + Math.random() * 3.0
                      : doctrine === 'recon_diver'
                        ? 10.5 + Math.random() * 4.0
                        : 6.0 + Math.random() * 4.5;
                const maneuverFreq = isSmallAgile
                  ? 2.25 + Math.random() * 0.95
                  : doctrine === 'recon_diver'
                    ? 1.05
                    : 1.45 + Math.random() * 0.4;
                const passSide = Math.random() > 0.5 ? 1 : -1;
                const isBossUnit = Boolean(unitConfig.isBoss);
                const turnRate =
                  doctrine === 'dogfight_interceptor'
                    ? 2.45
                    : doctrine === 'command_orbit'
                      ? isBossUnit
                        ? 0.52
                        : 0.92
                      : doctrine === 'fighter_bomber'
                        ? isBossUnit
                          ? 0.72
                          : 1.05
                        : 1.38;
                const passOffset =
                  doctrine === 'dogfight_interceptor'
                    ? 7.4 + Math.random() * 2.2
                    : doctrine === 'fighter_bomber'
                      ? (isBossUnit ? 8.5 : 7.0) + Math.random() * 2.5
                      : 6.2 + Math.random() * 2.4;
                const releaseRange =
                  doctrine === 'dogfight_interceptor'
                    ? 21.5
                    : doctrine === 'fighter_bomber'
                      ? isBossUnit
                        ? 17.5
                        : 16.0
                      : 18.5;
                const turnaroundDist =
                  doctrine === 'dogfight_interceptor'
                    ? 36 + Math.random() * 6
                    : doctrine === 'fighter_bomber'
                      ? (isBossUnit ? 33 : 31) + Math.random() * 5
                      : 30 + Math.random() * 4;
                const orbitRadius =
                  unitConfig.shape === 'sky_dreadnought'
                    ? 21.5 + Math.random() * 3.0
                    : 15.8 + Math.random() * 2.6;

                const activeEnemy: ActiveEnemy = {
                  instanceId,
                  unit: scaledUnit,
                  x: sx,
                  y: startAlt,
                  z: sz,
                  currentHp: scaledHp,
                  maxHp: scaledHp,
                  vx: 0,
                  vz: 0,
                  targetBaseX: (Math.random() - 0.5) * 1.4,
                  targetBaseZ: (Math.random() - 0.5) * 1.4,
                  rotationY: initialHeading,
                  speed: unitConfig.speed * 0.25 * speedScale,
                  alive: true,
                  empSlowUntil: 0,
                  radarIlluminated: false,
                  flaresRemaining: unitConfig.flaresCount ?? 0,
                  flareCooldownUntil: 0,
                };

                activeEnemiesRef.current.set(instanceId, {
                  enemyState: activeEnemy,
                  rig,
                  lastSmokeTime: simSec,
                  spawnDist,
                  baseAngle: angle,
                  travelProgress: 0,
                  cruiseAlt: startAlt,
                  maneuverPhase: Math.random() * Math.PI * 2,
                  maneuverFreq,
                  maneuverAmpLat,
                  maneuverAmpVert,
                  flankAmp,
                  curveDir: passSide,
                  prevX: sx,
                  prevY: startAlt,
                  prevZ: sz,
                  bankAngle: 0,
                  doctrine,
                  flightPhase: 'approach',
                  heading: initialHeading,
                  turnRate,
                  passOffset,
                  passSide,
                  releaseRange,
                  turnaroundDist,
                  orbitRadius,
                  salvoRemaining: unitConfig.ordnanceCount ?? 0,
                  nextReleaseAt: simSec,
                  ordnanceCooldownAt: simSec + 1.5,
                  egressHeading: normalizeAngle(initialHeading),
                  lastDogfightGunTime: simSec,
                });
              }
            }
          }

          // Count active airborne enemy ordnance before checking wave completion
          let activeOrdnanceCount = 0;
          for (let oi = 0; oi < pools.ordnances.length; oi++) {
            if (pools.ordnances[oi].active) activeOrdnanceCount++;
          }

          // Check wave completion (only once all aircraft AND incoming bombs/missiles are resolved)
          if (
            isSpawningRef.current &&
            waveQueueRef.current.length === 0 &&
            activeEnemiesRef.current.size === 0 &&
            activeOrdnanceCount === 0
          ) {
            isSpawningRef.current = false;
            waveHasBossRef.current = false;
            const waveIdx = currentWaveIndexRef.current;
            const clearedWaveNum = waveIdx + 1;
            const reward = activeWaveConfigRef.current
              ? activeWaveConfigRef.current.bonusReward
              : stage.waves[waveIdx]?.bonusReward ?? 80;
            setCash((prev) => prev + reward);
            soundManager.setMusicMode('prep');

            if (gameModeRef.current === 'endless') {
              endlessScoreRef.current += 150 * clearedWaveNum;
              setEndlessScore(endlessScoreRef.current);
              onEndlessRecordUpdateRef.current(biomeRef.current, clearedWaveNum, endlessScoreRef.current);
              setWaveState('wave_cleared');
              setCurrentWaveIndex((prev) => prev + 1);
            } else if (waveIdx + 1 >= stage.waves.length) {
              const finalHpRatio = baseHpRef.current / Math.max(1, maxBaseHpRef.current);
              const stars = finalHpRatio >= 0.90 ? 3 : finalHpRatio >= 0.60 ? 2 : 1;
              setEarnedStars(stars);
              setWaveState('victory');
              soundManager.playVictoryFanfare();
              onStageCompleteRef.current(stage.stageNumber, stars);
            } else {
              setWaveState('wave_cleared');
              setCurrentWaveIndex((prev) => prev + 1);
            }
          }

          const totalRem = waveQueueRef.current.length + activeEnemiesRef.current.size;
          if (totalRem !== lastHudEnemyCount) {
            lastHudEnemyCount = totalRem;
            setEnemiesRemaining(totalRem);
          }

          // 2. REGIONAL RADAR NETWORK (IADS) COVERAGE ZONES
          const activeRadars: RadarZone[] = [];
          const techRangeMult = techModifiersRef.current.rangeMult;
          activeTowersRef.current.forEach(({ towerState }) => {
            if (towerState.tower.shape === 'radar_dish') {
              activeRadars.push({
                x: towerState.x,
                z: towerState.z,
                radius: getRadarCoverageRadius(towerState.level, techRangeMult),
              });
            }
          });

          // 3. ENEMY 5-CLASS FLIGHT DOCTRINES, BOMBER RUNS, STANDOFF ORBITS & BILLBOARD HP BARS
          const enemiesToRemove: string[] = [];
          const activeJammers: { x: number; z: number; radius: number }[] = [];

          activeEnemiesRef.current.forEach((entry, enemyId) => {
            const { enemyState, rig } = entry;
            if (!enemyState.alive) {
              enemiesToRemove.push(enemyId);
              return;
            }

            // Pass camera.quaternion so zero-canvas 3D HP bar always faces the viewer!
            rig.updateAnim(dt, visualTimeSec, camera.quaternion);

            // Check regional radar illumination for early warning & localized stealth reveal
            let illuminated = false;
            for (let r = 0; r < activeRadars.length; r++) {
              const rz = activeRadars[r];
              if (Math.hypot(enemyState.x - rz.x, enemyState.z - rz.z) <= rz.radius) {
                illuminated = true;
                break;
              }
            }
            enemyState.radarIlluminated = illuminated;

            if (enemyState.unit.jammerRadius) {
              activeJammers.push({ x: enemyState.x, z: enemyState.z, radius: enemyState.unit.jammerRadius });
            }

            const slowFactor = simSec < enemyState.empSlowUntil ? 0.35 : 1.0;
            const prevX = enemyState.x;
            const prevY = enemyState.y;
            const prevZ = enemyState.z;

            // NON-KAMIKAZE DOCTRINES: Enemy Air-Superiority Fighters, Fighter-Bombers, Strike Fighters & Command Orbiters
            if (
              entry.doctrine === 'dogfight_interceptor' ||
              entry.doctrine === 'strike_fighter' ||
              entry.doctrine === 'fighter_bomber' ||
              entry.doctrine === 'command_orbit'
            ) {
              const distToHq = Math.hypot(enemyState.x, enemyState.z);
              const radAngle = Math.atan2(enemyState.z, enemyState.x); // angle from HQ to aircraft
              let desiredHeading = entry.heading;
              let speedMult = 1.0;
              let targetAlt = entry.cruiseAlt;

              // Check if an Allied CAP fighter is actively contesting airspace for dynamic sky dogfights!
              let engagedCap: CapFighterState | null = null;
              if (entry.doctrine === 'dogfight_interceptor') {
                let bestCapDist = Infinity;
                const caps = capFightersRef.current;
                for (let ci = 0; ci < caps.length; ci++) {
                  const cf = caps[ci];
                  if (cf.active && !cf.exiting) {
                    const dc = Math.hypot(cf.x - enemyState.x, cf.z - enemyState.z);
                    if (dc < bestCapDist) {
                      bestCapDist = dc;
                      engagedCap = cf;
                    }
                  }
                }
              }

              if (engagedCap) {
                // LIVE AIR-TO-AIR DOGFIGHT: high-G pursuit, scissor break-turns & glowing visual autocannon tracers!
                const dCap = Math.hypot(engagedCap.x - enemyState.x, engagedCap.z - enemyState.z);
                if (dCap < 7.2) {
                  const breakAng = entry.heading + entry.passSide * 1.25;
                  const gx = engagedCap.x + Math.sin(breakAng) * 14.5;
                  const gz = engagedCap.z + Math.cos(breakAng) * 14.5;
                  desiredHeading = Math.atan2(gx - enemyState.x, gz - enemyState.z);
                } else {
                  desiredHeading = Math.atan2(engagedCap.x - enemyState.x, engagedCap.z - enemyState.z);
                }
                targetAlt = THREE.MathUtils.clamp(engagedCap.y + 0.55, 8.2, 18.5);
                speedMult = 1.24;

                const bearingToCap = Math.abs(
                  normalizeAngle(Math.atan2(engagedCap.x - enemyState.x, engagedCap.z - enemyState.z) - entry.heading)
                );
                if (dCap < 24 && bearingToCap < 0.55 && simSec - entry.lastDogfightGunTime >= 0.34) {
                  entry.lastDogfightGunTime = simSec;
                  const mx = enemyState.x + Math.sin(entry.heading) * 1.4;
                  const mz = enemyState.z + Math.cos(entry.heading) * 1.4;
                  spawnMuzzleFlash(mx, enemyState.y - 0.1, mz, 0.34, 1);
                  spawnPooledProjectile(
                    'bullet',
                    mx,
                    enemyState.y - 0.1,
                    mz,
                    engagedCap.x,
                    engagedCap.y,
                    engagedCap.z,
                    '',
                    50,
                    0,
                    0.72,
                    simSec,
                    false,
                    -1
                  );
                }
              } else if (entry.doctrine === 'command_orbit') {
                if (entry.flightPhase === 'approach') {
                  // Approach smoothly onto tangent of standoff orbit ring
                  const tangentAngle = radAngle + entry.passSide * (Math.PI * 0.5);
                  const tx = Math.cos(radAngle) * entry.orbitRadius + Math.cos(tangentAngle) * 10;
                  const tz = Math.sin(radAngle) * entry.orbitRadius + Math.sin(tangentAngle) * 10;
                  desiredHeading = Math.atan2(tx - enemyState.x, tz - enemyState.z);
                  if (distToHq <= entry.orbitRadius + 4.8) {
                    entry.flightPhase = 'orbit';
                  }
                } else {
                  // Majestic circular standoff orbit around the mid-perimeter
                  const radialErr = (distToHq - entry.orbitRadius) / Math.max(1, entry.orbitRadius);
                  const tangentHeading = Math.atan2(
                    -Math.sin(radAngle) * entry.passSide,
                    Math.cos(radAngle) * entry.passSide
                  );
                  const inwardPull = THREE.MathUtils.clamp(radialErr * 1.45, -0.58, 0.58);
                  const toHqHeading = Math.atan2(-enemyState.x, -enemyState.z);
                  const pullDiff = normalizeAngle(toHqHeading - tangentHeading);
                  desiredHeading = normalizeAngle(tangentHeading + pullDiff * Math.max(0, inwardPull));
                  if (radialErr < -0.06) {
                    const awayHeading = Math.atan2(enemyState.x, enemyState.z);
                    const pushDiff = normalizeAngle(awayHeading - tangentHeading);
                    desiredHeading = normalizeAngle(tangentHeading + pushDiff * Math.min(0.45, -radialErr * 1.4));
                  }
                  speedMult = 0.92;
                  targetAlt = entry.cruiseAlt + Math.sin(simSec * 0.85 + entry.maneuverPhase) * 0.75;
                }

                // Standoff ordnance salvo timer (Sky Dreadnought & EW Jammer)
                if (distToHq <= entry.orbitRadius + 7.5 && (enemyState.unit.ordnanceCount ?? 0) > 0) {
                  if (entry.salvoRemaining <= 0 && simSec >= entry.ordnanceCooldownAt) {
                    entry.salvoRemaining = enemyState.unit.ordnanceCount ?? 1;
                    entry.nextReleaseAt = simSec;
                  }
                  if (entry.salvoRemaining > 0 && simSec >= entry.nextReleaseAt) {
                    entry.salvoRemaining -= 1;
                    entry.nextReleaseAt = simSec + 0.48;
                    if (entry.salvoRemaining <= 0) {
                      entry.ordnanceCooldownAt = simSec + (enemyState.unit.ordnanceCooldown ?? 6.5);
                    }
                    const fwdX = Math.sin(entry.heading);
                    const fwdZ = Math.cos(entry.heading);
                    const toHqX = -enemyState.x / Math.max(0.1, distToHq);
                    const toHqZ = -enemyState.z / Math.max(0.1, distToHq);
                    const ordSpd = enemyState.unit.isBoss ? 10.5 : 9.2;
                    spawnEnemyOrdnance(
                      enemyState.x + (Math.random() - 0.5) * 1.2,
                      enemyState.y - 0.65,
                      enemyState.z + (Math.random() - 0.5) * 1.2,
                      (fwdX * 0.45 + toHqX * 0.55) * ordSpd,
                      -1.8,
                      (fwdZ * 0.45 + toHqZ * 0.55) * ordSpd,
                      enemyState.unit.ordnanceDamage ?? 42,
                      enemyState.unit.ordnanceHp ?? 36,
                      ordSpd,
                      false,
                      simSec
                    );
                    spawnMuzzleFlash(enemyState.x, enemyState.y - 0.65, enemyState.z, 0.55, 1);
                  }
                }
              } else {
                // FIGHTER-BOMBER & STRIKE FIGHTER 3-PHASE BOMBING RUN: Approach -> Egress -> Wide Turnaround
                if (entry.flightPhase === 'approach') {
                  // Offset attack aim point beside HQ so aircraft sweeps cleanly across base and bombs it
                  const toHqLen = Math.max(1, distToHq);
                  const ux = -enemyState.x / toHqLen;
                  const uz = -enemyState.z / toHqLen;
                  const px = -uz * entry.passSide;
                  const pz = ux * entry.passSide;
                  const aimX = px * entry.passOffset;
                  const aimZ = pz * entry.passOffset;
                  desiredHeading = Math.atan2(aimX - enemyState.x, aimZ - enemyState.z);
                  targetAlt =
                    entry.cruiseAlt -
                    Math.max(0, Math.min(1, (30 - distToHq) / 18)) * (enemyState.unit.isBoss ? 1.2 : 1.7);

                  // Release visible 3D bombs/air-to-surface missiles on entering strike envelope!
                  if (distToHq <= entry.releaseRange && entry.salvoRemaining > 0 && simSec >= entry.nextReleaseAt) {
                    entry.salvoRemaining -= 1;
                    entry.nextReleaseAt = simSec + (enemyState.unit.isBoss ? 0.4 : 0.32);
                    const fwdX = Math.sin(entry.heading);
                    const fwdZ = Math.cos(entry.heading);
                    const curSpd = enemyState.speed * slowFactor;
                    const isBomb = entry.doctrine === 'fighter_bomber';
                    const ordSpd = isBomb ? 9.8 : 12.2;
                    const sideOff = (entry.salvoRemaining % 2 === 0 ? 1 : -1) * (enemyState.unit.isBoss ? 1.3 : 0.65);
                    spawnEnemyOrdnance(
                      enemyState.x - fwdZ * sideOff,
                      enemyState.y - 0.55,
                      enemyState.z + fwdX * sideOff,
                      fwdX * Math.max(curSpd * 1.15, 5.2),
                      -2.2,
                      fwdZ * Math.max(curSpd * 1.15, 5.2),
                      enemyState.unit.ordnanceDamage ?? 36,
                      enemyState.unit.ordnanceHp ?? 28,
                      ordSpd,
                      isBomb,
                      simSec
                    );
                    spawnMuzzleFlash(enemyState.x, enemyState.y - 0.55, enemyState.z, 0.45, 1);
                  }

                  if (entry.salvoRemaining <= 0 || distToHq < 10.2) {
                    entry.flightPhase = 'egress';
                    entry.egressHeading = normalizeAngle(entry.heading + entry.passSide * 0.28);
                  }
                } else if (entry.flightPhase === 'egress') {
                  speedMult = 1.14;
                  targetAlt = entry.cruiseAlt + 2.2;
                  desiredHeading = entry.egressHeading;
                  if (distToHq >= entry.turnaroundDist) {
                    entry.flightPhase = 'turnaround';
                    entry.passSide = -entry.passSide; // bank cleanly back on opposite flank
                    entry.salvoRemaining = enemyState.unit.ordnanceCount ?? 2;
                  }
                } else {
                  // Wide sweeping aerodynamic turnaround arc back toward HQ
                  speedMult = 1.02;
                  targetAlt = entry.cruiseAlt + 1.4;
                  const toHqHeading = Math.atan2(-enemyState.x, -enemyState.z);
                  desiredHeading = toHqHeading;
                  if (Math.abs(normalizeAngle(toHqHeading - entry.heading)) < 0.36 && distToHq > 22) {
                    entry.flightPhase = 'approach';
                  }
                }
              }

              // Smooth heading turn & aerodynamic banking proportional to actual turn rate
              const effTurnRate = entry.turnRate * slowFactor;
              const yawDiff = normalizeAngle(desiredHeading - entry.heading);
              const yawStep = THREE.MathUtils.clamp(yawDiff, -effTurnRate * dt, effTurnRate * dt);
              entry.heading = normalizeAngle(entry.heading + yawStep);

              const moveStep = enemyState.speed * speedMult * slowFactor * dt;
              enemyState.x += Math.sin(entry.heading) * moveStep;
              enemyState.z += Math.cos(entry.heading) * moveStep;

              const minClearY = getGroundHeight(enemyState.x, enemyState.z, biomeRef.current) + 3.2;
              const nextY = THREE.MathUtils.damp(enemyState.y, Math.max(minClearY, targetAlt), 2.8, dt);
              enemyState.y = nextY;

              const vx = enemyState.x - prevX;
              const vy = enemyState.y - prevY;
              const vz = enemyState.z - prevZ;
              const horizStep = Math.hypot(vx, vz);

              rig.group.position.set(enemyState.x, enemyState.y, enemyState.z);
              const rawPitch = horizStep > 0.0002 ? -Math.atan2(vy, horizStep) : 0;
              const clampedPitch = THREE.MathUtils.clamp(rawPitch, -0.45, 0.55);
              const turnVel = dt > 0.0001 ? yawStep / dt : 0;
              const maxBank = enemyState.unit.isBoss
                ? 0.28
                : entry.doctrine === 'dogfight_interceptor'
                  ? 0.78
                  : 0.52;
              const targetBank = THREE.MathUtils.clamp(
                -turnVel * (enemyState.unit.isBoss ? 0.45 : entry.doctrine === 'dogfight_interceptor' ? 0.56 : 0.52),
                -maxBank,
                maxBank
              );
              entry.bankAngle = THREE.MathUtils.damp(entry.bankAngle, targetBank, 5.5, dt);
              rig.group.rotation.order = 'YXZ';
              rig.group.rotation.set(clampedPitch, entry.heading, entry.bankAngle);

              // Crisp jet contrails for Crimson Raptor, Karrar Strike & Heavy Bomber
              if (
                (enemyState.unit.shape === 'enemy_fighter' ||
                  enemyState.unit.id === 'karrar_strike' ||
                  enemyState.unit.shape === 'heavy_bomber') &&
                simSec - entry.lastSmokeTime > (enemyState.unit.shape === 'enemy_fighter' ? 0.095 : 0.14)
              ) {
                entry.lastSmokeTime = simSec;
                spawnSmokePuff(
                  enemyState.x - Math.sin(entry.heading) * 1.4,
                  enemyState.y,
                  enemyState.z - Math.cos(entry.heading) * 1.4,
                  0.17,
                  0.4
                );
              }
              return;
            }

            // KAMIKAZE / DIRECT-STRIKE DOCTRINES: Swarm Micro-Drones, Recon Diver, Cruise & Ballistic Missiles
            entry.travelProgress = Math.min(
              1.02,
              entry.travelProgress + (enemyState.speed * slowFactor * dt) / Math.max(12, entry.spawnDist)
            );
            const p = Math.min(1, entry.travelProgress);

            const radX = Math.cos(entry.baseAngle);
            const radZ = Math.sin(entry.baseAngle);
            const perpX = -radZ;
            const perpZ = radX;

            const centerX = enemyState.targetBaseX + radX * ((1 - p) * entry.spawnDist);
            const centerZ = enemyState.targetBaseZ + radZ * ((1 - p) * entry.spawnDist);
            const flankOffset = entry.curveDir * entry.flankAmp * Math.sin(p * Math.PI) * (1 - p * 0.35);
            const weaveFade = Math.min(1, p * 4.5) * Math.max(0, 1 - Math.pow(p, 2.2));
            const weaveSin = Math.sin(simSec * entry.maneuverFreq + entry.maneuverPhase);
            const weaveCos = Math.cos(simSec * entry.maneuverFreq + entry.maneuverPhase);
            const weaveOffset = weaveSin * entry.maneuverAmpLat * weaveFade;
            const totalLat = flankOffset + weaveOffset;

            enemyState.x = centerX + perpX * totalLat;
            enemyState.z = centerZ + perpZ * totalLat;

            const targetImpactY = 1.55;
            const vertBob =
              Math.sin(simSec * (entry.maneuverFreq * 1.25) + entry.maneuverPhase * 1.6) *
              entry.maneuverAmpVert *
              (1 - p * 0.8);

            let desiredY: number;
            if (entry.doctrine === 'ballistic_missile') {
              const arc = Math.sin(p * Math.PI) * 16.0;
              const baseLine = entry.cruiseAlt * (1 - p) + targetImpactY * p;
              desiredY = baseLine + arc;
            } else if (entry.doctrine === 'cruise_missile') {
              const popUp = Math.exp(-Math.pow((p - 0.72) / 0.12, 2)) * 3.8;
              const diveT = Math.max(0, Math.min(1, (p - 0.75) / 0.25));
              const smoothDive = diveT * diveT * (3 - 2 * diveT);
              const cruiseY = Math.max(3.3, entry.cruiseAlt - 0.5) + vertBob * 0.5 + popUp;
              desiredY = cruiseY * (1 - smoothDive) + targetImpactY * smoothDive;
            } else {
              const diveStart = entry.doctrine === 'recon_diver' ? 0.72 : 0.66;
              const diveT = Math.max(0, Math.min(1, (p - diveStart) / (1 - diveStart)));
              const smoothDive = diveT * diveT * (3 - 2 * diveT);
              const cruiseY = entry.cruiseAlt + vertBob;
              desiredY = cruiseY * (1 - smoothDive) + targetImpactY * smoothDive;
            }

            const groundClearance = getGroundHeight(enemyState.x, enemyState.z, biomeRef.current) + (p > 0.88 ? 1.25 : 2.35);
            enemyState.y = Math.max(groundClearance, desiredY);

            const vx = enemyState.x - prevX;
            const vy = enemyState.y - prevY;
            const vz = enemyState.z - prevZ;
            const horizStep = Math.hypot(vx, vz);

            rig.group.position.set(enemyState.x, enemyState.y, enemyState.z);
            if (horizStep > 0.0002) {
              const yaw = Math.atan2(vx, vz);
              const rawPitch = -Math.atan2(vy, horizStep);
              const clampedPitch = THREE.MathUtils.clamp(rawPitch, -0.95, 1.05);
              const isMissile = entry.doctrine === 'cruise_missile' || entry.doctrine === 'ballistic_missile';
              const maxBank = isMissile ? 0.14 : 0.46;
              const targetBank = THREE.MathUtils.clamp(
                (weaveCos * (isMissile ? 0.08 : 0.34) * weaveFade + entry.curveDir * 0.15 * (1 - p)),
                -maxBank,
                maxBank
              );
              entry.bankAngle = THREE.MathUtils.damp(entry.bankAngle, targetBank, 6.5, dt);
              rig.group.rotation.order = 'YXZ';
              rig.group.rotation.set(clampedPitch, yaw, entry.bankAngle);
            }

            if (
              (entry.doctrine === 'cruise_missile' || entry.doctrine === 'ballistic_missile') &&
              simSec - entry.lastSmokeTime > 0.085
            ) {
              entry.lastSmokeTime = simSec;
              const stepLen = Math.max(0.001, Math.hypot(vx, vy, vz));
              spawnSmokePuff(
                enemyState.x - (vx / stepLen) * 1.2,
                enemyState.y - (vy / stepLen) * 1.2,
                enemyState.z - (vz / stepLen) * 1.2,
                0.21,
                0.44
              );
            }

            const distToBase = Math.hypot(enemyState.targetBaseX - enemyState.x, enemyState.targetBaseZ - enemyState.z);
            if (distToBase < 2.25 || entry.travelProgress >= 0.995) {
              enemyState.alive = false;
              enemiesToRemove.push(enemyId);
              applyBaseDamage(
                enemyState.unit.damageToBase,
                enemyState.x,
                enemyState.y,
                enemyState.z,
                enemyState.unit.isBoss ? 2.2 : 1.35,
                enemyState.unit.isBoss ? 0.72 : 0.45
              );
              return;
            }
          });

          for (let i = 0; i < enemiesToRemove.length; i++) {
            const id = enemiesToRemove[i];
            const entry = activeEnemiesRef.current.get(id);
            if (entry) {
              scene.remove(entry.rig.group);
              disposeObject3D(entry.rig.group);
              activeEnemiesRef.current.delete(id);
            }
          }

          const overdriveMultiplier = simSec < overdriveUntilRef.current ? 1.35 : 1.0;

          // 4. TOWER COMBAT (REGIONAL RADAR LINK + POINT-DEFENSE ORDNANCE INTERCEPTION)
          activeTowersRef.current.forEach((towerEntry) => {
            const { towerState, rig } = towerEntry;

            if (towerState.tower.shape === 'radar_dish') {
              rig.turretHead.rotation.y += dt * (1.7 + towerState.level * 0.35);
              rig.updateAnim(dt, visualTimeSec, true);
              return;
            }

            let jammed = false;
            for (let j = 0; j < activeJammers.length; j++) {
              const jm = activeJammers[j];
              if (Math.hypot(towerState.x - jm.x, towerState.z - jm.z) <= jm.radius) {
                jammed = true;
                break;
              }
            }

            // Regional Radar Boost: tower must sit inside at least one Radar Uplink's coverage bubble!
            let inRadarBubble = false;
            for (let r = 0; r < activeRadars.length; r++) {
              const rz = activeRadars[r];
              if (Math.hypot(towerState.x - rz.x, towerState.z - rz.z) <= rz.radius) {
                inRadarBubble = true;
                break;
              }
            }
            towerState.radarBoosted = inRadarBubble;

            const localJamPenalty = stage.modifier === 'radar_jam' && !inRadarBubble ? 0.85 : 1.0;
            const baseRange = towerState.range * 0.12 * (inRadarBubble ? 1.35 : 1.0) * localJamPenalty;
            let bestTarget: ActiveEnemy | null = null;
            let bestOrdnanceIdx = -1;
            let bestScore = -Infinity;
            const prio = towerState.targetingPriority ?? 'closest';

            // A) Scan airborne enemies (stealth revealed locally inside radar bubbles; illuminated targets get +12% early lock!)
            activeEnemiesRef.current.forEach(({ enemyState }) => {
              if (!enemyState.alive) return;
              const stealthHidden = Boolean(enemyState.unit.isStealth && !enemyState.radarIlluminated);
              const earlyLockBonus = inRadarBubble && enemyState.radarIlluminated ? 1.12 : 1.0;
              const detectRange = stealthHidden ? baseRange * 0.42 : baseRange * earlyLockBonus;
              const dist = Math.hypot(enemyState.x - towerState.x, enemyState.z - towerState.z);
              if (dist > detectRange) return;

              let score = 0;
              const distToHq = Math.hypot(enemyState.x, enemyState.z);
              if (prio === 'strongest') {
                score = enemyState.currentHp;
              } else if (prio === 'fastest') {
                score = enemyState.speed * 100 - distToHq * 0.1;
              } else if (prio === 'boss_first') {
                score = (enemyState.unit.isBoss ? 100000 : 0) - distToHq;
              } else {
                score = -distToHq;
              }

              if (score > bestScore) {
                bestScore = score;
                bestTarget = enemyState;
                bestOrdnanceIdx = -1;
              }
            });

            // B) Point-Defense Interception of incoming Bomber Bombs & Standoff Missiles!
            const canInterceptOrdnance =
              towerState.tower.id === 'ciws_light' ||
              towerState.tower.id === 'laser_beam_c' ||
              towerState.tower.id === 'pantsir_point' ||
              towerState.tower.id === 'avenger_stinger' ||
              towerState.tower.id === 'iron_dome_pod';
            if (canInterceptOrdnance) {
              const isIronDome = towerState.tower.id === 'iron_dome_pod';
              for (let oi = 0; oi < pools.ordnances.length; oi++) {
                const ord = pools.ordnances[oi];
                if (!ord.active) continue;
                const dTower = Math.hypot(ord.x - towerState.x, ord.z - towerState.z);
                if (dTower > baseRange) continue;
                const dHq = Math.hypot(ord.x, ord.z);
                // Urgent interception priority when bombs/missiles close in on the bunker!
                const ordScore = (dHq < (isIronDome ? 24 : 17) ? (isIronDome ? 6200 : 4500) : isIronDome ? 260 : 80) - dHq;
                if (ordScore > bestScore) {
                  bestScore = ordScore;
                  bestTarget = null;
                  bestOrdnanceIdx = oi;
                }
              }
            }

            const hasTarget = Boolean(bestTarget) || bestOrdnanceIdx >= 0;
            rig.updateAnim(dt, visualTimeSec, hasTarget);

            if (hasTarget) {
              const ordTarget = bestOrdnanceIdx >= 0 ? pools.ordnances[bestOrdnanceIdx] : null;
              const enemyTarget = bestTarget as ActiveEnemy | null;
              const tx = ordTarget ? ordTarget.x : enemyTarget!.x;
              const ty = ordTarget ? ordTarget.y : enemyTarget!.y;
              const tz = ordTarget ? ordTarget.z : enemyTarget!.z;

              towerState.targetEnemyId = enemyTarget ? enemyTarget.instanceId : ordTarget ? ordTarget.id : null;
              _targetPos.set(tx, ty, tz);
              rig.turretHead.lookAt(_targetPos);

              const effectiveFireRate = towerState.fireRate * overdriveMultiplier * (jammed ? 0.7 : 1.0);
              const fireInterval = 1.0 / Math.max(0.1, effectiveFireRate);

              if (simSec - towerState.lastFireTime >= fireInterval) {
                towerState.lastFireTime = simSec;
                rig.triggerRecoil();

                // Pick alternating visible muzzle anchor cleanly (zero array allocation!)
                let chosenAnchor: THREE.Object3D | undefined;
                const anchors = rig.muzzleAnchors;
                if (anchors.length > 0) {
                  for (let k = 0; k < anchors.length; k++) {
                    const candidate = anchors[(towerEntry.muzzleCursor + k) % anchors.length];
                    if (!candidate.parent || candidate.parent.visible) {
                      chosenAnchor = candidate;
                      break;
                    }
                  }
                  if (!chosenAnchor) chosenAnchor = anchors[0];
                  towerEntry.muzzleCursor = (towerEntry.muzzleCursor + 1) % anchors.length;
                }

                if (chosenAnchor) {
                  chosenAnchor.getWorldPosition(_spawnPos);
                } else {
                  _spawnPos.set(towerState.x, towerState.y + 1.5, towerState.z);
                }

                if (towerState.tower.id === 'railgun_turret') {
                  // Hypersonic Electromagnetic Railgun: instant armor-piercing kinetic beam (100% immune to thermal flares!)
                  soundManager.playRailgun();
                  spawnPooledLaser(_spawnPos, _targetPos, towerState.level + 2, simSec + 0.14);
                  spawnMuzzleFlash(_spawnPos.x, _spawnPos.y, _spawnPos.z, 0.85, 0);
                  spawnLaserSparks(_targetPos.x, _targetPos.y, _targetPos.z);
                  spawnShockwaveRing(_targetPos.x, _targetPos.y, _targetPos.z, 0x38bdf8, 0.35, 2.8, 0.25);
                  triggerFlashLight(_spawnPos.x, _spawnPos.y, _spawnPos.z, 0x38bdf8, 18, 0.14);

                  if (ordTarget) {
                    ordTarget.hp -= towerState.damage;
                    if (ordTarget.hp <= 0) {
                      ordTarget.active = false;
                      ordTarget.mesh.visible = false;
                      triggerExplosion(ordTarget.x, ordTarget.y, ordTarget.z, 0.95);
                      towerState.killCount++;
                    }
                  } else if (enemyTarget) {
                    enemyTarget.currentHp -= towerState.damage;
                    const enemyEntry = activeEnemiesRef.current.get(enemyTarget.instanceId);
                    if (enemyEntry) {
                      enemyEntry.rig.healthBar.updateHp(enemyTarget.currentHp);
                      if (enemyTarget.currentHp <= 0) {
                        destroyEnemyEntry(
                          enemyTarget.instanceId,
                          enemyTarget.unit.isBoss ? 2.25 : 1.35
                        );
                        towerState.killCount++;
                      }
                    }
                  }
                } else if (towerState.tower.id === 'laser_beam_c') {
                  soundManager.playLaser();
                  spawnPooledLaser(_spawnPos, _targetPos, towerState.level, simSec + 0.1);
                  spawnLaserSparks(_targetPos.x, _targetPos.y, _targetPos.z);
                  triggerFlashLight(_spawnPos.x, _spawnPos.y, _spawnPos.z, 0x22d3ee, 8, 0.09);

                  if (ordTarget) {
                    ordTarget.hp -= towerState.damage;
                    if (ordTarget.hp <= 0) {
                      ordTarget.active = false;
                      ordTarget.mesh.visible = false;
                      triggerExplosion(ordTarget.x, ordTarget.y, ordTarget.z, 0.85);
                      towerState.killCount++;
                    }
                  } else if (enemyTarget) {
                    enemyTarget.currentHp -= towerState.damage;
                    const enemyEntry = activeEnemiesRef.current.get(enemyTarget.instanceId);
                    if (enemyEntry) {
                      enemyEntry.rig.healthBar.updateHp(enemyTarget.currentHp);
                      if (enemyTarget.currentHp <= 0) {
                        destroyEnemyEntry(
                          enemyTarget.instanceId,
                          enemyTarget.unit.isBoss ? 2.2 : 1.05
                        );
                        towerState.killCount++;
                      }
                    }
                  }
                } else if (towerState.tower.id === 'iron_dome_pod') {
                  // Multi-Tube Point Defense Pod: 3-micro-missile rapid interceptor salvo!
                  soundManager.playMissileLaunch(false);
                  spawnMuzzleFlash(_spawnPos.x, _spawnPos.y, _spawnPos.z, 0.56, 1);
                  spawnSmokePuff(_spawnPos.x, _spawnPos.y, _spawnPos.z, 0.25, 0.48);
                  triggerFlashLight(_spawnPos.x, _spawnPos.y, _spawnPos.z, 0xf59e0b, 10, 0.11);

                  // Collect up to 3 distinct threats in range (prioritizing incoming bombs/missiles, then swarms)
                  const salvoTargets: { x: number; y: number; z: number; enemyId: string; ordIdx: number }[] = [
                    {
                      x: tx,
                      y: ty,
                      z: tz,
                      enemyId: enemyTarget ? enemyTarget.instanceId : '',
                      ordIdx: bestOrdnanceIdx,
                    },
                  ];
                  for (let oi = 0; oi < pools.ordnances.length && salvoTargets.length < 3; oi++) {
                    if (oi === bestOrdnanceIdx) continue;
                    const ord = pools.ordnances[oi];
                    if (ord.active && Math.hypot(ord.x - towerState.x, ord.z - towerState.z) <= baseRange) {
                      salvoTargets.push({ x: ord.x, y: ord.y, z: ord.z, enemyId: '', ordIdx: oi });
                    }
                  }
                  if (salvoTargets.length < 3) {
                    activeEnemiesRef.current.forEach(({ enemyState: cand }) => {
                      if (salvoTargets.length >= 3 || !cand.alive) return;
                      if (enemyTarget && cand.instanceId === enemyTarget.instanceId) return;
                      if (Math.hypot(cand.x - towerState.x, cand.z - towerState.z) <= baseRange) {
                        salvoTargets.push({ x: cand.x, y: cand.y, z: cand.z, enemyId: cand.instanceId, ordIdx: -1 });
                      }
                    });
                  }

                  for (let m = 0; m < 3; m++) {
                    const tgt = salvoTargets[m % salvoTargets.length];
                    const tubeAnchor = anchors.length > 0 ? anchors[(towerEntry.muzzleCursor + m) % anchors.length] : undefined;
                    if (tubeAnchor) {
                      tubeAnchor.getWorldPosition(_spawnPos);
                    } else {
                      _spawnPos.set(towerState.x + (m - 1) * 0.24, towerState.y + 1.45, towerState.z);
                    }
                    spawnPooledProjectile(
                      'missile',
                      _spawnPos.x,
                      _spawnPos.y,
                      _spawnPos.z,
                      tgt.x,
                      tgt.y,
                      tgt.z,
                      tgt.enemyId,
                      35,
                      towerState.damage,
                      3.2,
                      simSec,
                      false,
                      tgt.ordIdx
                    );
                  }
                  towerEntry.muzzleCursor = (towerEntry.muzzleCursor + 2) % Math.max(1, anchors.length);
                } else if (towerState.tower.id === 'ciws_light') {
                  soundManager.playGatling();
                  spawnMuzzleFlash(_spawnPos.x, _spawnPos.y, _spawnPos.z, 0.4, 0);
                  triggerFlashLight(_spawnPos.x, _spawnPos.y, _spawnPos.z, 0xffd166, 6, 0.05);
                  spawnPooledProjectile(
                    'bullet',
                    _spawnPos.x,
                    _spawnPos.y,
                    _spawnPos.z,
                    tx,
                    ty,
                    tz,
                    enemyTarget ? enemyTarget.instanceId : '',
                    48,
                    towerState.damage,
                    1.15,
                    simSec,
                    false,
                    bestOrdnanceIdx
                  );
                } else {
                  const isHeavySam =
                    towerState.tower.id === 'patriot_battery' || towerState.tower.id === 'system_358';
                  soundManager.playMissileLaunch(isHeavySam);
                  spawnMuzzleFlash(_spawnPos.x, _spawnPos.y, _spawnPos.z, isHeavySam ? 0.68 : 0.5, 1);
                  spawnSmokePuff(_spawnPos.x, _spawnPos.y, _spawnPos.z, isHeavySam ? 0.3 : 0.22, 0.52);
                  triggerFlashLight(_spawnPos.x, _spawnPos.y, _spawnPos.z, 0xff7b00, isHeavySam ? 12 : 8, 0.12);
                  spawnPooledProjectile(
                    'missile',
                    _spawnPos.x,
                    _spawnPos.y,
                    _spawnPos.z,
                    tx,
                    ty,
                    tz,
                    enemyTarget ? enemyTarget.instanceId : '',
                    isHeavySam ? 29 : 31,
                    towerState.damage,
                    3.8,
                    simSec,
                    isHeavySam,
                    bestOrdnanceIdx
                  );
                }
              }
            }
          });

          // 5. UPDATE POOLED LASERS
          for (let i = 0; i < pools.lasers.length; i++) {
            const slot = pools.lasers[i];
            if (slot.active && simSec >= slot.expiresAt) {
              slot.active = false;
              slot.coreMesh.visible = false;
              slot.haloMesh.visible = false;
            }
          }

          // 6. UPDATE POOLED PROJECTILES, ORDNANCE, FLARES, CRASHING WRECKS & ALLIED CAP JETS
          updateEnemyOrdnancePool(dt, simSec);
          updateProjectilePool(pools.bullets, dt, simSec);
          updateProjectilePool(pools.missiles, dt, simSec);
          updateFlarePool(dt, simSec);
          updateCrashingWrecks(dt, simSec);
          updateCapFighters(dt, simSec, visualTimeSec);

          // 7. UPDATE POOLED EXPLOSION EMBER PARTICLES
          for (let i = 0; i < pools.particles.length; i++) {
            const slot = pools.particles[i];
            if (!slot.active) continue;
            slot.life += dt;
            if (slot.life >= slot.maxLife) {
              slot.active = false;
              slot.mesh.visible = false;
              continue;
            }
            slot.x += slot.vx * dt;
            slot.y += slot.vy * dt;
            slot.z += slot.vz * dt;
            slot.vy -= 4.6 * dt;

            slot.mesh.position.set(slot.x, slot.y, slot.z);
            slot.mesh.rotation.x += dt * 7;
            slot.mesh.rotation.y += dt * 5;
            const scaleFactor = Math.max(0.01, slot.size * (1 - slot.life / slot.maxLife));
            slot.mesh.scale.setScalar(scaleFactor);
          }

          // 8. UPDATE POOLED MUZZLE FLASHES
          for (let i = 0; i < pools.muzzles.length; i++) {
            const mf = pools.muzzles[i];
            if (!mf.active) continue;
            mf.age += dtRaw;
            if (mf.age >= mf.maxAge) {
              mf.active = false;
              mf.mesh.visible = false;
            } else {
              const t = mf.age / mf.maxAge;
              mf.mesh.scale.setScalar(Math.max(0.01, mf.baseScale * (1.2 - t * 1.1)));
            }
          }

          // 9. UPDATE POOLED SMOKE PUFFS
          for (let i = 0; i < pools.smokes.length; i++) {
            const sm = pools.smokes[i];
            if (!sm.active) continue;
            sm.age += dt;
            if (sm.age >= sm.maxAge) {
              sm.active = false;
              sm.mesh.visible = false;
            } else {
              const t = sm.age / sm.maxAge;
              sm.y += sm.vy * dt;
              sm.mesh.position.set(sm.x, sm.y, sm.z);
              const curve = t < 0.35 ? 1 + t * 2.2 : Math.max(0.01, (1 - (t - 0.35) / 0.65) * 1.77);
              sm.mesh.scale.setScalar(sm.startSize * curve);
            }
          }

          // 10. UPDATE POOLED 3D SHOCKWAVE RINGS
          for (let i = 0; i < pools.shockwaves.length; i++) {
            const sw = pools.shockwaves[i];
            if (!sw.active) continue;
            sw.age += dtRaw;
            if (sw.age >= sw.maxAge) {
              sw.active = false;
              sw.mesh.visible = false;
            } else {
              const t = sw.age / sw.maxAge;
              sw.mesh.scale.setScalar(sw.startScale + t * sw.maxScale);
              sw.mat.opacity = Math.max(0, 0.85 * (1 - t));
            }
          }
        }

        renderer.render(scene, camera);
      } catch {
        // Recover cleanly on next frame rather than terminating the RAF loop
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const height = entry.contentRect.height;
        if (width > 0 && height > 0) {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      resizeObserver.disconnect();
      domElement.removeEventListener('webglcontextlost', handleContextLost);
      domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      domElement.removeEventListener('wheel', handleWheel);
      domElement.removeEventListener('click', handleClick);
      domElement.removeEventListener('touchstart', handleTouchStart);
      domElement.removeEventListener('touchmove', handleTouchMove);
      domElement.removeEventListener('touchend', handleTouchEnd);
      domElement.removeEventListener('touchcancel', handleTouchCancel);

      if (ghostGroupRef.current) {
        scene.remove(ghostGroupRef.current);
        ghostGroupRef.current = null;
      }
      if (ghostMatRef.current) {
        ghostMatRef.current.dispose();
        ghostMatRef.current = null;
      }
      if (ghostRangeRingRef.current) {
        scene.remove(ghostRangeRingRef.current);
        ghostRangeRingRef.current.geometry.dispose();
        (ghostRangeRingRef.current.material as THREE.Material).dispose();
        ghostRangeRingRef.current = null;
      }

      if (approachChevronsRef.current.length > 0) {
        approachChevronsRef.current.forEach((c) => scene.remove(c));
        approachChevronsRef.current[0].geometry.dispose();
        (approachChevronsRef.current[0].material as THREE.Material).dispose();
        approachChevronsRef.current = [];
      }

      activeTowersRef.current.forEach(({ rangeMesh }) => {
        rangeMesh.geometry.dispose();
        (rangeMesh.material as THREE.Material).dispose();
      });
      activeTowersRef.current.clear();
      activeEnemiesRef.current.clear();
      crashingWrecksRef.current.forEach((w) => {
        scene.remove(w.group);
        disposeObject3D(w.group);
      });
      crashingWrecksRef.current = [];
      capFightersRef.current.forEach((f) => {
        scene.remove(f.rig.group);
        disposeObject3D(f.rig.group);
      });
      capFightersRef.current = [];

      if (worldHandleRef.current) {
        worldHandleRef.current.dispose();
        worldHandleRef.current = null;
      }
      if (poolsRef.current) {
        poolsRef.current.shockwaves.forEach((sw) => sw.mat.dispose());
        poolsRef.current = null;
      }
      if (sharedAssetsRef.current) {
        const sa = sharedAssetsRef.current;
        sa.bulletGeo.dispose();
        sa.bulletMat.dispose();
        sa.allyBulletMat.dispose();
        sa.missileBodyGeo.dispose();
        sa.missileNoseGeo.dispose();
        sa.missileFinGeo.dispose();
        sa.missileBodyMat.dispose();
        sa.missileNoseMat.dispose();
        sa.missileFinMat.dispose();
        sa.missileFlameGeo.dispose();
        sa.missileFlameMat.dispose();
        sa.laserCoreGeo.dispose();
        sa.laserCoreMat.dispose();
        sa.laserHaloGeo.dispose();
        sa.laserHaloMat.dispose();
        sa.muzzleFlashGeo.dispose();
        sa.muzzleFlashMats.forEach((m) => m.dispose());
        sa.smokeGeo.dispose();
        sa.smokeMat.dispose();
        sa.particleGeo.dispose();
        sa.particleMats.forEach((m) => m.dispose());
        sa.sparkMatCyan.dispose();
        sa.shockwaveGeo.dispose();
        sa.ordnanceBodyGeo.dispose();
        sa.ordnanceNoseGeo.dispose();
        sa.ordnanceBodyMat.dispose();
        sa.ordnanceNoseMat.dispose();
        sa.flareGeo.dispose();
        sa.flareMat.dispose();
        sharedAssetsRef.current = null;
      }
      envTex.dispose();
      if (container.contains(domElement)) {
        container.removeChild(domElement);
      }
      renderer.dispose();
    };
  }, [setupStageBoard]);

  // Swap Low-Poly Biome World when biome changes
  useEffect(() => {
    if (sceneRef.current && worldHandleRef.current) {
      mountBiomeWorld(biome);
    }
  }, [biome]);

  // Reload Stage board cleanly whenever selected Stage or GameMode changes
  const prevBoardKeyRef = useRef(`${gameMode}_${stageConfig.stageNumber}_${gameMode === 'endless' ? biome : ''}`);
  useEffect(() => {
    const nextKey = `${gameMode}_${stageConfig.stageNumber}_${gameMode === 'endless' ? biome : ''}`;
    if (prevBoardKeyRef.current !== nextKey) {
      prevBoardKeyRef.current = nextKey;
      setupStageBoard(stageConfig, biome);
    }
  }, [gameMode, stageConfig, biome, setupStageBoard]);

  // Reactively apply Tech Lab Doctrine upgrades mid-session
  const prevMaxHpRef = useRef(maxBaseHp);
  useEffect(() => {
    const prevHpCap = prevMaxHpRef.current;
    if (maxBaseHp !== prevHpCap) {
      const delta = maxBaseHp - prevHpCap;
      prevMaxHpRef.current = maxBaseHp;
      if (delta > 0) {
        const next = Math.min(maxBaseHp, baseHpRef.current + delta);
        baseHpRef.current = next;
        setBaseHp(next);
      } else if (baseHpRef.current > maxBaseHp) {
        baseHpRef.current = maxBaseHp;
        setBaseHp(maxBaseHp);
      }
    }

    activeTowersRef.current.forEach((entry) => {
      const { towerState, rangeMesh } = entry;
      const lvl = towerState.level;
      towerState.damage = Math.round(towerState.tower.damagePerShot * Math.pow(1.45, lvl - 1) * techModifiers.damageMult);
      towerState.range = Math.round(towerState.tower.range * Math.pow(1.18, lvl - 1) * techModifiers.rangeMult);

      const isRadar = towerState.tower.shape === 'radar_dish';
      const newRadius = isRadar ? getRadarCoverageRadius(lvl, techModifiers.rangeMult) : towerState.range * 0.12;
      rangeMesh.geometry.dispose();
      const updatedRingGeo = new THREE.RingGeometry(Math.max(0.5, newRadius - (isRadar ? 0.22 : 0.14)), newRadius, 64);
      updatedRingGeo.rotateX(-Math.PI / 2);
      rangeMesh.geometry = updatedRingGeo;
    });

    refreshTowerRadarLinks();
    if (selectedPlacedTowerRef.current) {
      const updated = activeTowersRef.current.get(selectedPlacedTowerRef.current.instanceId);
      if (updated) setSelectedPlacedTower({ ...updated.towerState });
    }
  }, [techModifiers, maxBaseHp]);

  // Update Range Rings visibility (also brightens regional radar zones while placing a new tower!)
  useEffect(() => {
    syncRangeRingVisibility();
  }, [showRangeRings, selectedPlacedTower, selectedTowerToBuild]);

  // Single-Material Holographic Tower Silhouette Preview (ZERO material cloning!)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (ghostGroupRef.current) {
      scene.remove(ghostGroupRef.current);
      ghostGroupRef.current = null;
    }
    if (ghostMatRef.current) {
      ghostMatRef.current.dispose();
      ghostMatRef.current = null;
    }
    if (ghostRangeRingRef.current) {
      scene.remove(ghostRangeRingRef.current);
      ghostRangeRingRef.current.geometry.dispose();
      (ghostRangeRingRef.current.material as THREE.Material).dispose();
      ghostRangeRingRef.current = null;
    }

    if (selectedTowerToBuild) {
      const { group, ghostMat } = buildTowerGhost3D(selectedTowerToBuild);
      group.position.set(0, -100, 0);
      scene.add(group);
      ghostGroupRef.current = group;
      ghostMatRef.current = ghostMat;

      const isRadar = selectedTowerToBuild.shape === 'radar_dish';
      const ringRadius = isRadar
        ? getRadarCoverageRadius(1, techModifiersRef.current.rangeMult)
        : selectedTowerToBuild.range * techModifiersRef.current.rangeMult * 0.12;
      const ringGeo = new THREE.RingGeometry(
        Math.max(0.5, ringRadius - (isRadar ? 0.24 : 0.16)),
        ringRadius,
        64
      );
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: isRadar ? 0xf59e0b : 0x10b981,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const rangeRing = new THREE.Mesh(ringGeo, ringMat);
      rangeRing.position.set(0, -100, 0);
      scene.add(rangeRing);
      ghostRangeRingRef.current = rangeRing;
    }
  }, [selectedTowerToBuild]);

  // Launch Next Wave in current Stage or Endless Survival & shift Adaptive Epic Soundtrack
  const startNextWave = () => {
    soundManager.unlock();
    const stage = stageConfigRef.current;
    let waveConfig: WaveConfig | null = null;
    if (gameModeRef.current === 'endless') {
      waveConfig = generateEndlessWave(currentWaveIndex + 1);
    } else {
      if (currentWaveIndex >= stage.waves.length) return;
      waveConfig = stage.waves[currentWaveIndex];
    }
    if (!waveConfig) return;

    activeWaveConfigRef.current = waveConfig;
    setWaveState('spawning');

    const queue: { unitId: string; spawnTime: number }[] = [];
    let hasBossInWave = false;
    waveConfig.spawns.forEach((spawn) => {
      if (spawn.unitId === 'heavy_bomber_wing' || spawn.unitId === 'sky_dreadnought') {
        hasBossInWave = true;
      }
      for (let i = 0; i < spawn.count; i++) {
        queue.push({
          unitId: spawn.unitId,
          spawnTime: spawn.initialDelaySec + i * spawn.intervalSec,
        });
      }
    });

    queue.sort((a, b) => a.spawnTime - b.spawnTime);
    waveQueueRef.current = queue;
    waveStartTimeRef.current = simCombatSecRef.current;
    waveHasBossRef.current = hasBossInWave;
    isSpawningRef.current = true;
    soundManager.playRadarPing();
    soundManager.setMusicMode(hasBossInWave ? 'boss' : 'combat');
  };

  // Commander Skill 1: EMP Shockwave Pulse (Q)
  const handleTriggerEmp = useCallback(() => {
    soundManager.unlock();
    if (empCooldownRef.current > 0.05 || defeatTriggeredRef.current) return;
    const cd = Math.max(12, Math.round(EMP_BASE_COOLDOWN * techModifiersRef.current.cooldownMult));
    empCooldownRef.current = cd;
    setEmpCooldownLeft(cd);
    soundManager.playEmpPulse();
    addCameraShake(0.38);

    const gy = getGroundHeight(0, 0, biomeRef.current);
    spawnShockwaveRing(0, gy + 2.2, 0, 0x38bdf8, 1.5, 36, 1.15);
    triggerFlashLight(0, gy + 4, 0, 0x38bdf8, 22, 0.42);

    const simSec = simCombatSecRef.current;
    const killedIds: string[] = [];

    activeEnemiesRef.current.forEach(({ enemyState, rig }, id) => {
      if (!enemyState.alive) return;
      enemyState.empSlowUntil = simSec + 5.0;
      enemyState.currentHp -= Math.round(28 * techModifiersRef.current.damageMult);
      rig.healthBar.updateHp(enemyState.currentHp);
      if (enemyState.currentHp <= 0) {
        enemyState.alive = false;
        killedIds.push(id);
      }
    });

    killedIds.forEach((id) => {
      destroyEnemyEntry(id, 1.0);
    });
  }, []);

  // Commander Skill 2: Emergency Base Repair + Energy Shield + Fire-Rate Overdrive (E)
  const handleTriggerRepair = useCallback(() => {
    soundManager.unlock();
    if (repairCooldownRef.current > 0.05 || defeatTriggeredRef.current) return;
    const cd = Math.max(15, Math.round(REPAIR_BASE_COOLDOWN * techModifiersRef.current.cooldownMult));
    repairCooldownRef.current = cd;
    setRepairCooldownLeft(cd);
    overdriveUntilRef.current = simCombatSecRef.current + 6.0;
    bunkerShieldTimerRef.current = 3.2;
    soundManager.playRepairBoost();

    const gy = getGroundHeight(0, 0, biomeRef.current);
    spawnShockwaveRing(0, gy + 0.9, 0, 0x10b981, 1.2, 18, 0.95);
    triggerFlashLight(0, gy + 3, 0, 0x10b981, 16, 0.35);

    const nextHp = Math.min(maxBaseHpRef.current, baseHpRef.current + 240);
    baseHpRef.current = nextHp;
    setBaseHp(nextHp);
  }, []);

  // Commander Skill 3: Scramble Allied CAP Twin Fighter Squadron (F) — 12s Active / 36s Recharge
  const handleTriggerCap = useCallback(() => {
    soundManager.unlock();
    const simSec = simCombatSecRef.current;
    if (
      capCooldownRef.current > 0.05 ||
      simSec < capActiveUntilRef.current ||
      defeatTriggeredRef.current
    ) {
      return;
    }

    const cd = Math.max(20, Math.round(CAP_BASE_COOLDOWN * techModifiersRef.current.cooldownMult));
    capActiveUntilRef.current = simSec + CAP_PATROL_DURATION;
    capCooldownRef.current = cd;
    setCapActiveLeft(CAP_PATROL_DURATION);
    setCapCooldownLeft(cd);
    onRecordCapScrambleRef.current();

    const gy = getGroundHeight(0, 0, biomeRef.current);
    soundManager.playJetScramble();
    spawnShockwaveRing(0, gy + 1.4, 14, 0x38bdf8, 1.0, 14, 0.72);
    triggerFlashLight(0, gy + 4.0, 14, 0x38bdf8, 18, 0.35);

    const fighters = capFightersRef.current;
    for (let i = 0; i < fighters.length; i++) {
      const f = fighters[i];
      f.active = true;
      f.exiting = false;
      f.x = i === 0 ? -4.2 : 4.2;
      f.y = gy + 2.6 + i * 0.6;
      f.z = 16 + i * 2.0;
      f.heading = Math.PI; // Climb north across base
      f.bankAngle = 0;
      f.orbitPhase = i * Math.PI;
      f.targetEnemyId = '';
      f.lastGunTime = simSec - 1;
      f.lastMissileTime = simSec - 1;
      f.lastContrailTime = simSec;
      f.rig.group.position.set(f.x, f.y, f.z);
      f.rig.group.rotation.set(-0.25, f.heading, 0);
      f.rig.group.visible = true;
    }
  }, []);

  // Update Tower Targeting Priority
  const handleChangeTowerPriority = (instanceId: string, priority: TargetingPriority) => {
    const entry = activeTowersRef.current.get(instanceId);
    if (!entry) return;
    entry.towerState.targetingPriority = priority;
    setSelectedPlacedTower({ ...entry.towerState });
  };

  // Upgrade Tower (Real physical Level 2 & Level 3 hardware evolution + golden upgrade shockwave!)
  const handleUpgradeTower = (instanceId: string) => {
    soundManager.unlock();
    const entry = activeTowersRef.current.get(instanceId);
    if (!entry) return;
    const upgradeCost = Math.round(entry.towerState.tower.buildCost * (0.62 + entry.towerState.level * 0.45));
    if (cash >= upgradeCost && entry.towerState.level < 3) {
      setCash((prev) => prev - upgradeCost);
      entry.towerState.level += 1;
      const lvl = entry.towerState.level;
      const mods = techModifiersRef.current;
      entry.towerState.damage = Math.round(entry.towerState.tower.damagePerShot * Math.pow(1.45, lvl - 1) * mods.damageMult);
      entry.towerState.range = Math.round(entry.towerState.tower.range * Math.pow(1.18, lvl - 1) * mods.rangeMult);

      entry.rig.applyLevel(lvl);

      const isRadar = entry.towerState.tower.shape === 'radar_dish';
      const newRadius = isRadar ? getRadarCoverageRadius(lvl, mods.rangeMult) : entry.towerState.range * 0.12;
      entry.rangeMesh.geometry.dispose();
      const updatedRingGeo = new THREE.RingGeometry(Math.max(0.5, newRadius - (isRadar ? 0.22 : 0.14)), newRadius, 64);
      updatedRingGeo.rotateX(-Math.PI / 2);
      entry.rangeMesh.geometry = updatedRingGeo;

      const fxColor = lvl >= 3 ? 0xfbbf24 : 0x34d399;
      spawnShockwaveRing(entry.towerState.x, entry.towerState.y + 0.65, entry.towerState.z, fxColor, 0.6, 3.8, 0.45);
      triggerFlashLight(entry.towerState.x, entry.towerState.y + 2.0, entry.towerState.z, fxColor, 14, 0.25);

      soundManager.playUpgrade(lvl);
      refreshTowerRadarLinks();
      setSelectedPlacedTower({ ...entry.towerState });
    }
  };

  // Sell Tower
  const handleSellTower = (instanceId: string) => {
    const entry = activeTowersRef.current.get(instanceId);
    if (!entry || !sceneRef.current) return;
    const refund = Math.round(entry.towerState.tower.buildCost * 0.65 * (1 + (entry.towerState.level - 1) * 0.5));
    setCash((prev) => prev + refund);
    soundManager.playBuild();

    sceneRef.current.remove(entry.rig.group);
    disposeObject3D(entry.rig.group);
    sceneRef.current.remove(entry.rangeMesh);
    entry.rangeMesh.geometry.dispose();
    (entry.rangeMesh.material as THREE.Material).dispose();
    activeTowersRef.current.delete(instanceId);
    refreshTowerRadarLinks();
    setSelectedPlacedTower(null);
  };

  const handleResetStage = () => {
    setupStageBoard(stageConfigRef.current, biomeRef.current);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#090d16] select-none">
      <div
        id="tactical-viewport-canvas"
        ref={mountRef}
        className="w-full h-full touch-none cursor-grab active:cursor-grabbing"
      />

      {contextLost && (
        <div className="absolute inset-0 bg-[#090d16]/90 flex items-center justify-center z-40 text-sm text-slate-300">
          در حال بازیابی موتور گرافیکی سه‌بعدی...
        </div>
      )}

      <GameHud
        gameMode={gameMode}
        stageConfig={stageConfig}
        baseHp={baseHp}
        maxBaseHp={maxBaseHp}
        cash={cash}
        currentWave={currentWaveIndex + 1}
        totalWaves={stageConfig.waves.length}
        waveState={waveState}
        enemiesRemaining={enemiesRemaining}
        wavePreviewSummary={wavePreviewSummary}
        endlessScore={endlessScore}
        endlessBestWave={endlessBestWave}
        availableStars={availableStars}
        biome={biome}
        onChangeBiome={onChangeBiome}
        selectedTowerToBuild={selectedTowerToBuild}
        onSelectTowerToBuild={setSelectedTowerToBuild}
        selectedPlacedTower={selectedPlacedTower}
        onUpgradeTower={handleUpgradeTower}
        onSellTower={handleSellTower}
        onChangeTowerPriority={handleChangeTowerPriority}
        onCloseInspect={() => setSelectedPlacedTower(null)}
        onStartNextWave={startNextWave}
        gameSpeed={gameSpeed}
        onSetGameSpeed={setGameSpeed}
        soundEnabled={soundEnabled}
        onToggleSound={() => {
          const next = !soundEnabled;
          setSoundEnabled(next);
          soundManager.enabled = next;
        }}
        musicEnabled={musicEnabled}
        onToggleMusic={() => {
          const next = !musicEnabled;
          setMusicEnabled(next);
          soundManager.setMusicEnabled(next);
        }}
        onResetGame={handleResetStage}
        onNextStage={onNextStage}
        onOpenRoadmap={onOpenRoadmap}
        onOpenTechLab={onOpenTechLab}
        earnedStars={earnedStars}
        hasNextStage={hasNextStage}
        cameraMode={cameraMode}
        onSetCameraView={handleSetCameraView}
        showRangeRings={showRangeRings}
        onToggleRangeRings={() => setShowRangeRings((prev) => !prev)}
        onOpenMenu={onOpenMenu}
        empCooldownLeft={empCooldownLeft}
        empMaxCooldown={empMaxCooldown}
        onTriggerEmp={handleTriggerEmp}
        repairCooldownLeft={repairCooldownLeft}
        repairMaxCooldown={repairMaxCooldown}
        onTriggerRepair={handleTriggerRepair}
        capCooldownLeft={capCooldownLeft}
        capMaxCooldown={capMaxCooldown}
        capActiveLeft={capActiveLeft}
        onTriggerCap={handleTriggerCap}
        isNightRaid={isNightRaid}
        radarSnapshotRef={radarSnapshotRef}
        killCallouts={killCallouts}
      />
    </div>
  );
};
