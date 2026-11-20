export type MapBiome = 'alpine' | 'coastal' | 'desert' | 'arctic';

export type GameMode = 'campaign' | 'endless';

export type TargetingPriority = 'closest' | 'strongest' | 'fastest' | 'boss_first';

export type TechId =
  | 'firepower'
  | 'radar_net'
  | 'war_economy'
  | 'bunker_armor'
  | 'rapid_command'
  | 'blast_warheads';

export interface TechModifiers {
  damageMult: number;
  rangeMult: number;
  startingCashBonus: number;
  killBountyMult: number;
  maxBaseHp: number;
  cooldownMult: number;
  missileSplashRadius: number;
}

export interface EndlessBiomeRecord {
  bestWave: number;
  bestScore: number;
}

export type AchievementId =
  | 'first_victory'
  | 'boss_slayer'
  | 'flawless_defense'
  | 'tech_commander'
  | 'endless_survivor'
  | 'cap_ace';

export interface SaveProfileV2 {
  version: 2;
  highestUnlocked: number; // 1..40
  starsByStage: Record<number, number>; // stageNumber -> 1 | 2 | 3
  techLevels: Record<TechId, number>; // 0..3
  endlessRecords: Record<MapBiome, EndlessBiomeRecord>;
  stats: {
    totalKills: number;
    bossesKilled: number;
    capScrambles: number;
  };
  achievements: AchievementId[];
}

export interface RadarEntityBlip {
  x: number;
  z: number;
  kind: 'tower' | 'radar_tower' | 'facility' | 'ally_fighter' | 'enemy' | 'boss' | 'stealth' | 'jammer' | 'ordnance';
  color?: string;
}

export type FacilityKind = 'ammo_bunker' | 'fuel_depot';

export interface StageFacilitySpec {
  id: string;
  kind: FacilityKind;
  titleFa: string;
  x: number;
  z: number;
  maxHp: number;
}

export interface BaseFacilityStatus {
  id: string;
  kind: FacilityKind;
  titleFa: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  x: number;
  z: number;
}

export type DefeatReason = 'hq_destroyed' | 'facilities_lost';

export interface RadarZone {
  x: number;
  z: number;
  radius: number;
}

export interface RadarSnapshot {
  blips: RadarEntityBlip[];
  radarZones: RadarZone[];
  incomingSectors: number[]; // compass angles (radians) for upcoming wave
  waveActive: boolean;
}

export type StageModifier =
  | 'none'
  | 'stealth_ops'
  | 'radar_jam'
  | 'blitz_speed'
  | 'armored_wing'
  | 'boss_operation';

export type FlightDoctrine =
  | 'swarm_kamikaze'
  | 'recon_diver'
  | 'strike_fighter'
  | 'dogfight_interceptor'
  | 'cruise_missile'
  | 'ballistic_missile'
  | 'fighter_bomber'
  | 'command_orbit';

export interface EnemyUnit {
  id: string;
  name: string;
  persianName?: string;
  type: string;
  hp: number;
  speed: number; // m/s
  killReward: number; // cash/points
  damageToBase: number;
  shape:
    | 'delta_wing'
    | 'swept_drone'
    | 'scout_hex'
    | 'heavy_bomber'
    | 'b2_spirit'
    | 'cruise_missile'
    | 'loiter_pod'
    | 'stealth_wing'
    | 'jammer_orb'
    | 'ballistic_missile'
    | 'sky_dreadnought'
    | 'enemy_fighter';
  color: string;
  altitude: number;
  description: string;
  doctrine?: FlightDoctrine;
  ordnanceCount?: number;
  ordnanceDamage?: number;
  ordnanceCooldown?: number;
  ordnanceHp?: number;
  isStealth?: boolean;
  jammerRadius?: number;
  isBoss?: boolean;
  isHeavyStrategic?: boolean;
  escortUnitId?: string;
  escortCount?: number;
  flaresCount?: number;
  flareCooldownSec?: number;
  canCrashWreck?: boolean;
}

export type TowerTier = 1 | 2 | 3 | 4;

export interface DefenseTower {
  id: string;
  name: string;
  persianName?: string;
  type: string;
  tier: TowerTier;
  tierLabelFa: string;
  buildCost: number;
  maxHp: number;
  damagePerShot: number;
  fireRate: number; // shots/sec
  range: number; // meters
  weakness: string;
  strategicTargetOnly?: boolean;
  shape:
    | 'gatling_box'
    | 'missile_battery'
    | 'silo_vertical'
    | 'radar_dish'
    | 's400_launcher'
    | 'iron_dome_pod';
  color: string;
  description: string;
}

export interface ActiveEnemy {
  instanceId: string;
  unit: EnemyUnit;
  x: number;
  y: number;
  z: number;
  currentHp: number;
  maxHp: number;
  vx: number;
  vz: number;
  targetBaseX: number;
  targetBaseZ: number;
  rotationY: number;
  speed: number;
  alive: boolean;
  empSlowUntil: number;
  radarIlluminated?: boolean;
  flaresRemaining?: number;
  flareCooldownUntil?: number;
}

export interface ActiveTower {
  instanceId: string;
  tower: DefenseTower;
  x: number;
  y: number;
  z: number;
  level: number;
  hp: number;
  maxHp: number;
  damage: number;
  range: number;
  fireRate: number;
  lastFireTime: number;
  targetEnemyId: string | null;
  targetingPriority: TargetingPriority;
  turretYaw: number;
  turretPitch: number;
  killCount: number;
  radarBoosted?: boolean;
}

export interface Projectile {
  id: string;
  type: 'bullet' | 'missile';
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  targetEnemyId: string;
  speed: number;
  damage: number;
  progress: number; // 0 to 1
  color: string;
  maxLifetime: number;
  age: number;
}

export interface VisualParticle {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface WaveEnemySpawn {
  unitId: string;
  count: number;
  intervalSec: number;
  initialDelaySec: number;
}

export interface WaveConfig {
  waveNumber: number;
  name: string;
  persianName: string;
  description: string;
  spawns: WaveEnemySpawn[];
  bonusReward: number;
}

export interface StageConfig {
  stageNumber: number; // 1..40
  chapter: 1 | 2 | 3 | 4;
  biome: MapBiome;
  titleFa: string;
  subtitleFa: string;
  modifier: StageModifier;
  modifierLabelFa: string;
  isBossStage: boolean;
  isMidBossStage?: boolean;
  isNightStage?: boolean;
  secondaryObjectives?: {
    facilities: StageFacilitySpec[];
    failOnAllLost: boolean;
    labelFa: string;
  };
  startingCash: number;
  starterTowers: { towerId: string; x: number; z: number }[];
  hpMultiplier: number;
  speedMultiplier: number;
  waves: WaveConfig[];
}

export interface CampaignProgress {
  highestUnlocked: number; // 1..40
  starsByStage: Record<number, number>; // stageNumber -> 1 | 2 | 3
}

export interface PlacedEntity {
  id: string;
  dataId: string;
  category: 'tower' | 'enemy';
  x: number;
  z: number;
  y: number;
  rotation: number;
}
