import {
  AchievementId,
  MapBiome,
  SaveProfileV2,
  StageConfig,
  TechId,
  TechModifiers,
  WaveConfig,
  WaveEnemySpawn,
} from '../types/game';
import { loadCampaignProgress } from './campaignStages';

export interface TechDoctrine {
  id: TechId;
  titleFa: string;
  subtitleFa: string;
  costs: [number, number, number];
  levelLabels: [string, string, string];
  accent: 'amber' | 'sky' | 'emerald' | 'rose' | 'violet' | 'orange';
}

// Rebalanced ~35% harder progression costs across 40 stages (120 total stars)
export const TECH_DOCTRINES: TechDoctrine[] = [
  {
    id: 'firepower',
    titleFa: 'تقویت آتشبارها',
    subtitleFa: 'افزایش دائمی قدرت تخریب تمام برجک‌های پدافندی',
    costs: [2, 3, 6],
    levelLabels: ['+۱۰٪ خسارت', '+۲۰٪ خسارت', '+۳۲٪ خسارت'],
    accent: 'rose',
  },
  {
    id: 'radar_net',
    titleFa: 'شبکه رادار یکپارچه',
    subtitleFa: 'گسترش برد شلیک و بهبود کشف اهداف در تمام نقشه‌ها',
    costs: [2, 3, 6],
    levelLabels: ['+۱۰٪ برد', '+۱۸٪ برد', '+۲۸٪ برد'],
    accent: 'sky',
  },
  {
    id: 'war_economy',
    titleFa: 'لجستیک و اقتصاد نبرد',
    subtitleFa: 'بودجه شروع بیشتر و پاداش بالاتر برای هر شکار',
    costs: [2, 3, 6],
    levelLabels: ['+$۵۵ · +۸٪ شکار', '+$۱۲۰ · +۱۵٪ شکار', '+$۱۹۵ · +۲۲٪ شکار'],
    accent: 'amber',
  },
  {
    id: 'bunker_armor',
    titleFa: 'زره کامپوزیت پایگاه',
    subtitleFa: 'افزایش مقاومت و حداکثر سلامت پناهگاه مرکزی',
    costs: [2, 3, 6],
    levelLabels: ['+۲۰۰ سلامت', '+۴۵۰ سلامت', '+۷۵۰ سلامت'],
    accent: 'emerald',
  },
  {
    id: 'rapid_command',
    titleFa: 'واکنش سریع فرماندهی',
    subtitleFa: 'کاهش زمان شارژ مجدد EMP، ترمیم اضطراری و اسکادران جنگنده',
    costs: [2, 3, 6],
    levelLabels: ['-۱۲٪ زمان شارژ', '-۲۲٪ زمان شارژ', '-۳۲٪ زمان شارژ'],
    accent: 'violet',
  },
  {
    id: 'blast_warheads',
    titleFa: 'کلاهک انفجار منطقه‌ای',
    subtitleFa: 'افزودن خسارت موج انفجار (Splash) به تمام موشک‌ها',
    costs: [3, 5, 7],
    levelLabels: ['شعاع ۳.۲ متر', 'شعاع ۴.۶ متر', 'شعاع ۶.۰ متر'],
    accent: 'orange',
  },
];

export interface AchievementDef {
  id: AchievementId;
  titleFa: string;
  descFa: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_victory', titleFa: 'نخستین پیروزی', descFa: 'اولین مرحله کمپین را تکمیل کنید' },
  { id: 'flawless_defense', titleFa: 'سپر نفوذناپذیر', descFa: 'یک مرحله را با ۳ ستاره کامل ببرید' },
  { id: 'boss_slayer', titleFa: 'شکارچی فرماندهان', descFa: 'یک باس هوایی را سرنگون کنید' },
  { id: 'tech_commander', titleFa: 'طراح دکترین', descFa: 'حداقل ۳ ارتقا در آزمایشگاه فناوری بخرید' },
  { id: 'cap_ace', titleFa: 'آس نبرد هوایی', descFa: '۵ بار اسکادران جنگنده خودی را اعزام کنید' },
  { id: 'endless_survivor', titleFa: 'افسانه بقا', descFa: 'در حالت بقای بی‌نهایت به موج ۵ یا بالاتر برسید' },
];

export const DEFAULT_TECH_LEVELS: Record<TechId, number> = {
  firepower: 0,
  radar_net: 0,
  war_economy: 0,
  bunker_armor: 0,
  rapid_command: 0,
  blast_warheads: 0,
};

export function computeTechModifiers(levels: Record<TechId, number>): TechModifiers {
  const fp = levels.firepower ?? 0;
  const rn = levels.radar_net ?? 0;
  const we = levels.war_economy ?? 0;
  const ba = levels.bunker_armor ?? 0;
  const rc = levels.rapid_command ?? 0;
  const bw = levels.blast_warheads ?? 0;

  return {
    damageMult: [1.0, 1.1, 1.2, 1.32][fp] ?? 1.0,
    rangeMult: [1.0, 1.1, 1.18, 1.28][rn] ?? 1.0,
    startingCashBonus: [0, 55, 120, 195][we] ?? 0,
    killBountyMult: [1.0, 1.08, 1.15, 1.22][we] ?? 1.0,
    maxBaseHp: 1000 + ([0, 200, 450, 750][ba] ?? 0),
    cooldownMult: [1.0, 0.88, 0.78, 0.68][rc] ?? 1.0,
    missileSplashRadius: [0, 3.2, 4.6, 6.0][bw] ?? 0,
  };
}

export function computeTotalEarnedStars(starsByStage: Record<number, number>): number {
  return (Object.values(starsByStage) as number[]).reduce((acc, s) => acc + s, 0);
}

export function computeSpentStars(levels: Record<TechId, number>): number {
  let spent = 0;
  for (const doc of TECH_DOCTRINES) {
    const lv = levels[doc.id] ?? 0;
    for (let i = 0; i < lv && i < doc.costs.length; i++) {
      spent += doc.costs[i];
    }
  }
  return spent;
}

export function evaluateAchievements(profile: SaveProfileV2): AchievementId[] {
  const validIds: AchievementId[] = [
    'first_victory',
    'boss_slayer',
    'flawless_defense',
    'tech_commander',
    'endless_survivor',
    'cap_ace',
  ];
  const set = new Set<AchievementId>(
    profile.achievements.filter((a): a is AchievementId => validIds.includes(a))
  );
  const stars = Object.values(profile.starsByStage) as number[];
  if (stars.some((s) => s >= 1)) set.add('first_victory');
  if (stars.some((s) => s >= 3)) set.add('flawless_defense');
  if (profile.stats.bossesKilled >= 1) set.add('boss_slayer');
  const totalTechUpgrades = (Object.values(profile.techLevels) as number[]).reduce((a, b) => a + b, 0);
  if (totalTechUpgrades >= 3) set.add('tech_commander');
  if (profile.stats.capScrambles >= 5) set.add('cap_ace');
  const maxEndlessWave = Math.max(
    profile.endlessRecords.alpine.bestWave,
    profile.endlessRecords.coastal.bestWave,
    profile.endlessRecords.desert.bestWave,
    profile.endlessRecords.arctic.bestWave
  );
  if (maxEndlessWave >= 5) set.add('endless_survivor');
  return Array.from(set);
}

const SAVE_KEY_V2 = 'air_shield_save_v2';

export function loadSaveProfileV2(): SaveProfileV2 {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY_V2);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SaveProfileV2> & {
        stats?: { totalKills?: number; bossesKilled?: number; capScrambles?: number; airstrikesCalled?: number };
      };
      const profile: SaveProfileV2 = {
        version: 2,
        highestUnlocked:
          typeof parsed.highestUnlocked === 'number'
            ? Math.max(1, Math.min(40, parsed.highestUnlocked))
            : 1,
        starsByStage: parsed.starsByStage && typeof parsed.starsByStage === 'object' ? parsed.starsByStage : {},
        techLevels: {
          ...DEFAULT_TECH_LEVELS,
          ...(parsed.techLevels ?? {}),
        },
        endlessRecords: {
          alpine: parsed.endlessRecords?.alpine ?? { bestWave: 0, bestScore: 0 },
          coastal: parsed.endlessRecords?.coastal ?? { bestWave: 0, bestScore: 0 },
          desert: parsed.endlessRecords?.desert ?? { bestWave: 0, bestScore: 0 },
          arctic: parsed.endlessRecords?.arctic ?? { bestWave: 0, bestScore: 0 },
        },
        stats: {
          totalKills: parsed.stats?.totalKills ?? 0,
          bossesKilled: parsed.stats?.bossesKilled ?? 0,
          capScrambles: parsed.stats?.capScrambles ?? 0,
        },
        achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      };
      profile.achievements = evaluateAchievements(profile);
      return profile;
    }
  } catch {
    // fallback to migration
  }

  const v1 = loadCampaignProgress();
  const migrated: SaveProfileV2 = {
    version: 2,
    highestUnlocked: Math.min(40, Math.max(1, v1.highestUnlocked)),
    starsByStage: v1.starsByStage,
    techLevels: { ...DEFAULT_TECH_LEVELS },
    endlessRecords: {
      alpine: { bestWave: 0, bestScore: 0 },
      coastal: { bestWave: 0, bestScore: 0 },
      desert: { bestWave: 0, bestScore: 0 },
      arctic: { bestWave: 0, bestScore: 0 },
    },
    stats: {
      totalKills: 0,
      bossesKilled: 0,
      capScrambles: 0,
    },
    achievements: [],
  };
  migrated.achievements = evaluateAchievements(migrated);
  return migrated;
}

export function saveProfileV2(profile: SaveProfileV2): void {
  try {
    window.localStorage.setItem(SAVE_KEY_V2, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors in sandboxed iframes
  }
}

/**
 * Generates an escalating procedural wave for Endless Survival Mode (Waves 1..∞).
 */
export function generateEndlessWave(waveNumber: number): WaveConfig {
  const spawns: WaveEnemySpawn[] = [];
  const tier = Math.floor((waveNumber - 1) / 3);
  const cadence = Math.max(0.55, 1.55 - waveNumber * 0.045);
  const swarmCount = 6 + Math.floor(waveNumber * 2.1);

  spawns.push({
    unitId: waveNumber % 2 === 0 ? 'switchblade_loiter' : 'shahed_136',
    count: swarmCount,
    intervalSec: cadence,
    initialDelaySec: 0.4,
  });

  if (waveNumber >= 2) {
    spawns.push({
      unitId: waveNumber % 3 === 0 ? 'karrar_strike' : 'mohajer_scout',
      count: 3 + tier,
      intervalSec: Math.max(1.2, 2.2 - tier * 0.1),
      initialDelaySec: 2.2,
    });
  }

  if (waveNumber >= 3) {
    spawns.push({
      unitId: waveNumber % 2 === 1 ? 'stealth_ghost' : 'arash_long_range',
      count: 2 + Math.floor(waveNumber * 0.55),
      intervalSec: 1.9,
      initialDelaySec: 3.8,
    });
  }

  if (waveNumber >= 4) {
    spawns.push({
      unitId: waveNumber % 2 === 0 ? 'ew_jammer' : 'cruise_strike',
      count: 1 + Math.floor(tier * 0.7),
      intervalSec: 2.7,
      initialDelaySec: 4.5,
    });
  }

  if (waveNumber >= 5) {
    spawns.push({
      unitId: 'crimson_raptor',
      count: 2 + Math.floor((waveNumber - 4) * 0.45),
      intervalSec: 2.3,
      initialDelaySec: 5.2,
    });
  }

  if (waveNumber >= 6) {
    spawns.push({
      unitId: waveNumber % 2 === 0 ? 'ballistic_strike' : 'reaper_hunter',
      count: 2 + Math.floor((waveNumber - 4) * 0.45),
      intervalSec: 2.3,
      initialDelaySec: 6.4,
    });
  }

  const isBossWave = waveNumber % 5 === 0;
  if (isBossWave) {
    const bossCount = Math.min(3, Math.floor(waveNumber / 5));
    spawns.push({
      unitId: waveNumber >= 10 ? 'sky_dreadnought' : 'heavy_bomber_wing',
      count: bossCount,
      intervalSec: 6.5,
      initialDelaySec: 4.2,
    });
  }

  const bonusReward = Math.round(70 + waveNumber * 15 + (isBossWave ? 85 : 0));

  return {
    waveNumber,
    name: `Endless Wave ${waveNumber}`,
    persianName: isBossWave ? `موج بقای ${waveNumber} (یورش باس)` : `موج بقای ${waveNumber}`,
    description: isBossWave ? 'ورود فرمانده هوایی در حالت بقای بی‌نهایت' : 'موج فزاینده حالت بقای بی‌نهایت',
    spawns,
    bonusReward,
  };
}

/**
 * Builds a StageConfig wrapper for Endless Survival Mode on the chosen biome.
 */
export function createEndlessStageConfig(biome: MapBiome): StageConfig {
  const biomeTitle =
    biome === 'alpine'
      ? 'دره کوهستان'
      : biome === 'coastal'
        ? 'دژ ساحلی'
        : biome === 'desert'
          ? 'طوفان کویر'
          : 'دژ قطبی';
  return {
    stageNumber: 0,
    chapter: biome === 'alpine' ? 1 : biome === 'coastal' ? 2 : biome === 'desert' ? 3 : 4,
    biome,
    titleFa: `بقای بی‌نهایت · ${biomeTitle}`,
    subtitleFa: 'موج‌های بی‌پایان با ثبت خودکار رکورد',
    modifier: 'none',
    modifierLabelFa: 'بقای بی‌نهایت',
    isBossStage: false,
    startingCash: 450,
    starterTowers: [
      { towerId: 'ciws_light', x: 6, z: -4 },
      { towerId: 'avenger_stinger', x: -6, z: -4 },
    ],
    hpMultiplier: 1.0,
    speedMultiplier: 1.0,
    waves: [generateEndlessWave(1)],
  };
}
