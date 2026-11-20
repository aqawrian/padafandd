import { CampaignProgress, MapBiome, StageConfig, StageFacilitySpec, StageModifier, WaveConfig, WaveEnemySpawn } from '../types/game';

export interface ChapterMeta {
  chapter: 1 | 2 | 3 | 4;
  biome: MapBiome;
  titleFa: string;
  subtitleFa: string;
  stageRange: [number, number];
}

export const CAMPAIGN_CHAPTERS: ChapterMeta[] = [
  {
    chapter: 1,
    biome: 'alpine',
    titleFa: 'فصل اول: سپر کوهستان',
    subtitleFa: 'دفاع از دره و پایگاه ارتفاعات شمالی',
    stageRange: [1, 10],
  },
  {
    chapter: 2,
    biome: 'coastal',
    titleFa: 'فصل دوم: دژ ساحلی',
    subtitleFa: 'حفاظت از بندرگاه و ناوگان در برابر حملات دریایی',
    stageRange: [11, 20],
  },
  {
    chapter: 3,
    biome: 'desert',
    titleFa: 'فصل سوم: طوفان کویر',
    subtitleFa: 'نبرد سنگین روی فلات و باند فرودگاه صحرایی',
    stageRange: [21, 30],
  },
  {
    chapter: 4,
    biome: 'arctic',
    titleFa: 'فصل چهارم: دژ قطبی',
    subtitleFa: 'مقاومت نهایی زیر شفق قطبی و بوران یخبندان',
    stageRange: [31, 40],
  },
];

const MODIFIER_LABELS: Record<StageModifier, string> = {
  none: 'عملیات استاندارد',
  stealth_ops: 'نفوذ پنهان‌کار (نیازمند رادار)',
  radar_jam: 'پارازیت الکترونیکی (-۱۵٪ برد بدون رادار)',
  blitz_speed: 'یورش پرشتاب (+۱۸٪ سرعت دشمن)',
  armored_wing: 'زره تقویت‌شده (+۲۵٪ مقاومت دشمن)',
  boss_operation: 'عملیات شکار فرمانده هوایی (باس)',
};

interface StageBlueprint {
  titleFa: string;
  subtitleFa: string;
  modifier: StageModifier;
  waveCount: number;
  startingCash: number;
  isBossStage?: boolean;
  isMidBossStage?: boolean;
  archetype:
    | 'swarm_intro'
    | 'recon_flank'
    | 'fast_raiders'
    | 'stealth_probe'
    | 'mid_boss_alpine'
    | 'jammer_screen'
    | 'cruise_test'
    | 'fighter_clash'
    | 'blitz_assault'
    | 'boss_alpine'
    | 'coastal_landing'
    | 'sea_skimmers'
    | 'stealth_fleet'
    | 'ew_corridor'
    | 'mid_boss_coastal'
    | 'ballistic_intro'
    | 'armored_convoy'
    | 'dual_jammer'
    | 'supersonic_surge'
    | 'boss_coastal'
    | 'desert_outpost'
    | 'canyon_stealth'
    | 'ballistic_rain'
    | 'jammed_skies'
    | 'mid_boss_desert'
    | 'iron_phalanx'
    | 'phantom_blitz'
    | 'siege_barrage'
    | 'final_vanguard'
    | 'boss_desert'
    | 'arctic_outpost'
    | 'polar_interceptors'
    | 'aurora_stealth'
    | 'glacier_jam'
    | 'mid_boss_arctic'
    | 'frost_barrage'
    | 'raptor_wing'
    | 'frozen_siege'
    | 'polar_vanguard'
    | 'boss_arctic_final';
}

const STAGE_BLUEPRINTS: StageBlueprint[] = [
  // === CHAPTER 1: ALPINE VALLEY (1-10) ===
  { titleFa: 'نگهبانی دره', subtitleFa: 'نخستین امواج پهپادهای انتحاری سبک', modifier: 'none', waveCount: 3, startingCash: 330, archetype: 'swarm_intro' },
  { titleFa: 'شناسایی شبانه', subtitleFa: 'پهپادهای مهاجر و گشت‌های سریع شبانه', modifier: 'none', waveCount: 3, startingCash: 345, archetype: 'recon_flank' },
  { titleFa: 'یورش برق‌آسا', subtitleFa: 'ریزپهپادهای سریع سویچ‌بلید از چند جهت', modifier: 'blitz_speed', waveCount: 3, startingCash: 365, archetype: 'fast_raiders' },
  { titleFa: 'سایه‌های خاموش', subtitleFa: 'ورود پهپادهای شبح پنهان‌کار؛ رادار بسازید', modifier: 'stealth_ops', waveCount: 4, startingCash: 385, archetype: 'stealth_probe' },
  { titleFa: 'بمب‌افکن ارتفاعات', subtitleFa: 'میانی‌باس: بمب‌افکن B-2 Spirit با اسکورت ۴ جنگنده', modifier: 'boss_operation', waveCount: 4, startingCash: 430, isMidBossStage: true, archetype: 'mid_boss_alpine' },
  { titleFa: 'اختلال در فرکانس', subtitleFa: 'ورود اخلال‌گرهای الکترونیکی دشمن', modifier: 'radar_jam', waveCount: 4, startingCash: 400, archetype: 'jammer_screen' },
  { titleFa: 'شکارچیان کروز', subtitleFa: 'نفوذ موشک‌های کروز در ارتفاع پست دره', modifier: 'none', waveCount: 4, startingCash: 420, archetype: 'cruise_test' },
  { titleFa: 'نبرد آسمان کوهستان', subtitleFa: 'ماموریت حفاظتی: دفاع از بانکرها در برابر جنگنده‌های ارتفاع‌بالا', modifier: 'armored_wing', waveCount: 4, startingCash: 455, archetype: 'fighter_clash' },
  { titleFa: 'محاصره دره', subtitleFa: 'هجوم پرسرعت ترکیبی و دفاع از تأسیسات پایگاه', modifier: 'blitz_speed', waveCount: 5, startingCash: 465, archetype: 'blitz_assault' },
  { titleFa: 'فرمانده کوهستان', subtitleFa: 'باس فصل اول: اسکادران راهبردی B-2 با ۴ جنگنده اسکورت', modifier: 'boss_operation', waveCount: 5, startingCash: 515, isBossStage: true, archetype: 'boss_alpine' },

  // === CHAPTER 2: COASTAL BASE (11-20) ===
  { titleFa: 'خط مقدم ساحل', subtitleFa: 'استقرار دفاع هوایی روی شبه‌جزیره بندری', modifier: 'none', waveCount: 4, startingCash: 410, archetype: 'coastal_landing' },
  { titleFa: 'موج‌شکن کروز', subtitleFa: 'موشک‌های کروز مماس با سطح دریا', modifier: 'blitz_speed', waveCount: 4, startingCash: 430, archetype: 'sea_skimmers' },
  { titleFa: 'ناوگان اشباح', subtitleFa: 'اسکادران پنهان‌کار در مه ساحلی', modifier: 'stealth_ops', waveCount: 4, startingCash: 440, archetype: 'stealth_fleet' },
  { titleFa: 'توفان الکترونیک', subtitleFa: 'اخلال‌گرهای رادار همراه با جنگنده‌های شاهین', modifier: 'radar_jam', waveCount: 5, startingCash: 450, archetype: 'ew_corridor' },
  { titleFa: 'غول خلیج', subtitleFa: 'میانی‌باس: بمب‌افکن‌های B-2 Spirit و جنگنده‌های اسکورت', modifier: 'boss_operation', waveCount: 5, startingCash: 495, isMidBossStage: true, archetype: 'mid_boss_coastal' },
  { titleFa: 'آسمان آتشین', subtitleFa: 'نخستین شلیک موشک‌های بالستیک ارتفاع بالا', modifier: 'none', waveCount: 5, startingCash: 470, archetype: 'ballistic_intro' },
  { titleFa: 'حفاظت از انبار مهمات', subtitleFa: 'ماموریت حفاظتی: دفاع از ۲ بانکر و مخزن سوخت بندر', modifier: 'armored_wing', waveCount: 5, startingCash: 500, archetype: 'armored_convoy' },
  { titleFa: 'نابینایی رادار', subtitleFa: 'جمینگ شدید و نفوذ هم‌زمان کروز و پنهان‌کار', modifier: 'radar_jam', waveCount: 5, startingCash: 490, archetype: 'dual_jammer' },
  { titleFa: 'هجوم مافوق‌صوت', subtitleFa: 'موج‌های متوالی جنگنده‌های ارتفاع‌بالا، کروز و بالستیک', modifier: 'blitz_speed', waveCount: 5, startingCash: 520, archetype: 'supersonic_surge' },
  { titleFa: 'سلطان دریاها', subtitleFa: 'باس فصل دوم: اسکادران B-2A با پوشش جنگال و اسکورت جنگنده', modifier: 'boss_operation', waveCount: 6, startingCash: 560, isBossStage: true, archetype: 'boss_coastal' },

  // === CHAPTER 3: DESERT CANYON (21-30) ===
  { titleFa: 'پادگان صحرا', subtitleFa: 'دفاع از باند فرودگاه در دل دره‌های کویری', modifier: 'none', waveCount: 5, startingCash: 470, archetype: 'desert_outpost' },
  { titleFa: 'سراب پنهان‌کار', subtitleFa: 'تهاجم شبانه پهپادهای شبح از فراز صخره‌ها', modifier: 'stealth_ops', waveCount: 5, startingCash: 490, archetype: 'canyon_stealth' },
  { titleFa: 'باران بالستیک', subtitleFa: 'رگبار موشک‌های بالستیک و کروز سنگین', modifier: 'armored_wing', waveCount: 5, startingCash: 500, archetype: 'ballistic_rain' },
  { titleFa: 'آسمان مختل', subtitleFa: 'جنگ الکترونیک سنگین و اسکادران شاهین ارتفاع‌بالا', modifier: 'radar_jam', waveCount: 5, startingCash: 510, archetype: 'jammed_skies' },
  { titleFa: 'شکارچیان طوفان', subtitleFa: 'میانی‌باس: بمب‌افکن‌های B-2 Spirit و موشک‌های بالستیک', modifier: 'boss_operation', waveCount: 5, startingCash: 545, isMidBossStage: true, archetype: 'mid_boss_desert' },
  { titleFa: 'دیوار آهنین', subtitleFa: 'انبوه نیروهای زرهی با مقاومت بسیار بالا', modifier: 'armored_wing', waveCount: 6, startingCash: 520, archetype: 'iron_phalanx' },
  { titleFa: 'یورش ارواح', subtitleFa: 'ترکیب مرگبار جنگنده‌های ارتفاع‌بالا و پهپادهای پنهان‌کار', modifier: 'blitz_speed', waveCount: 6, startingCash: 530, archetype: 'phantom_blitz' },
  { titleFa: 'حفاظت از مخازن صحرا', subtitleFa: 'ماموریت حفاظتی: حفظ بانکرها و مخزن سوخت زیر آتشبار محاصره', modifier: 'radar_jam', waveCount: 6, startingCash: 565, archetype: 'siege_barrage' },
  { titleFa: 'پیشقراول طوفان', subtitleFa: 'آخرین خط مقاومت صحرا و دفاع از تأسیسات حیاتی', modifier: 'armored_wing', waveCount: 6, startingCash: 570, archetype: 'final_vanguard' },
  { titleFa: 'فرمانده کویر', subtitleFa: 'باس فصل سوم: دو بمب‌افکن راهبردی B-2A و ۸ جنگنده اسکورت', modifier: 'boss_operation', waveCount: 6, startingCash: 605, isBossStage: true, archetype: 'boss_desert' },

  // === CHAPTER 4: ARCTIC ICE FORTRESS (31-40) ===
  { titleFa: 'پاسگاه یخبندان', subtitleFa: 'آغاز عملیات در پایگاه قطبی زیر بوران برف', modifier: 'none', waveCount: 5, startingCash: 520, archetype: 'arctic_outpost' },
  { titleFa: 'دوئل در شفق', subtitleFa: 'اسکادران جنگنده‌های شاهین دشمن در ارتفاع بالا', modifier: 'blitz_speed', waveCount: 5, startingCash: 540, archetype: 'polar_interceptors' },
  { titleFa: 'شبح قطبی', subtitleFa: 'نفوذ شبانه پنهان‌کارها و بمب‌اندازها میان مه یخی', modifier: 'stealth_ops', waveCount: 6, startingCash: 550, archetype: 'aurora_stealth' },
  { titleFa: 'طوفان مغناطیسی', subtitleFa: 'اخلال راداری شدید همراه با موشک‌های کروز و بالستیک', modifier: 'radar_jam', waveCount: 6, startingCash: 560, archetype: 'glacier_jam' },
  { titleFa: 'شکننده یخچال', subtitleFa: 'میانی‌باس قطبی: بمب‌افکن‌های B-2 Spirit با اسکورت جنگنده', modifier: 'boss_operation', waveCount: 6, startingCash: 600, isMidBossStage: true, archetype: 'mid_boss_arctic' },
  { titleFa: 'تگرگ بالستیک', subtitleFa: 'موج‌های فشرده بالستیک و کروز ضدزره', modifier: 'armored_wing', waveCount: 6, startingCash: 580, archetype: 'frost_barrage' },
  { titleFa: 'بال‌های سرخ قطب', subtitleFa: 'تهاجم تمام‌عیار جنگنده‌های ارتفاع‌بالا و ریپرها', modifier: 'blitz_speed', waveCount: 6, startingCash: 595, archetype: 'raptor_wing' },
  { titleFa: 'دژ منجمد', subtitleFa: 'ماموریت حفاظتی: دفاع از بانکرها و نیروگاه قطبی در محاصره', modifier: 'radar_jam', waveCount: 6, startingCash: 630, archetype: 'frozen_siege' },
  { titleFa: 'دروازه دژ قطبی', subtitleFa: 'آخرین مانع پیش از ورود ناوگان بمب‌افکن‌های راهبردی', modifier: 'armored_wing', waveCount: 6, startingCash: 645, archetype: 'polar_vanguard' },
  { titleFa: 'عملیات سپر نهایی', subtitleFa: 'باس پایانی بازی: ناوگان B-2 Spirit و B-2A با اسکورت کامل جنگنده', modifier: 'boss_operation', waveCount: 7, startingCash: 690, isBossStage: true, archetype: 'boss_arctic_final' },
];

function buildWavesForStage(stageNum: number, bp: StageBlueprint): WaveConfig[] {
  const waves: WaveConfig[] = [];
  const tier = Math.floor((stageNum - 1) / 3); // 0..13 progression intensity

  for (let w = 1; w <= bp.waveCount; w++) {
    const isFinalWave = w === bp.waveCount;
    const spawns: WaveEnemySpawn[] = [];
    const baseCount = 5 + Math.floor(stageNum * 0.42) + w * 2;
    const cadence = Math.max(0.68, 1.85 - stageNum * 0.024 - w * 0.055);

    if (bp.archetype === 'swarm_intro') {
      spawns.push({ unitId: 'shahed_136', count: baseCount, intervalSec: cadence, initialDelaySec: 0.4 });
      if (w >= 2) spawns.push({ unitId: 'mohajer_scout', count: 2 + w, intervalSec: 2.6, initialDelaySec: 3.5 });
      if (isFinalWave) spawns.push({ unitId: 'karrar_strike', count: 3, intervalSec: 2.4, initialDelaySec: 6.0 });
    } else if (bp.archetype === 'recon_flank') {
      spawns.push({ unitId: 'shahed_136', count: baseCount - 1, intervalSec: cadence, initialDelaySec: 0.4 });
      spawns.push({ unitId: 'mohajer_scout', count: 3 + w, intervalSec: 2.1, initialDelaySec: 2.2 });
      if (w >= 2) spawns.push({ unitId: 'karrar_strike', count: 2 + w, intervalSec: 2.2, initialDelaySec: 5.0 });
    } else if (bp.archetype === 'fast_raiders') {
      spawns.push({ unitId: 'switchblade_loiter', count: 5 + w * 2, intervalSec: 1.25, initialDelaySec: 0.5 });
      spawns.push({ unitId: 'karrar_strike', count: 3 + w, intervalSec: 2.1, initialDelaySec: 3.5 });
      if (isFinalWave) spawns.push({ unitId: 'shahed_136', count: 8, intervalSec: 1.1, initialDelaySec: 6.5 });
    } else if (
      bp.archetype === 'fighter_clash' ||
      bp.archetype === 'polar_interceptors' ||
      bp.archetype === 'raptor_wing'
    ) {
      const raptorBase = bp.archetype === 'fighter_clash' ? 2 : 3 + Math.floor(w * 0.65);
      spawns.push({ unitId: 'crimson_raptor', count: raptorBase + Math.floor(w / 2), intervalSec: 2.2, initialDelaySec: 0.8 });
      spawns.push({ unitId: 'arash_long_range', count: 3 + w, intervalSec: 1.9, initialDelaySec: 2.6 });
      if (w >= 2) spawns.push({ unitId: 'reaper_hunter', count: 2 + Math.floor(tier * 0.28), intervalSec: 2.5, initialDelaySec: 5.2 });
      if (isFinalWave && stageNum >= 32) {
        spawns.push({ unitId: 'cruise_strike', count: 4, intervalSec: 1.9, initialDelaySec: 7.5 });
      }
    } else if (
      bp.archetype === 'stealth_probe' ||
      bp.archetype === 'stealth_fleet' ||
      bp.archetype === 'canyon_stealth' ||
      bp.archetype === 'aurora_stealth'
    ) {
      spawns.push({ unitId: 'shahed_136', count: Math.max(5, baseCount - 3), intervalSec: cadence, initialDelaySec: 0.4 });
      spawns.push({ unitId: 'stealth_ghost', count: 3 + Math.floor(tier * 0.5) + w, intervalSec: 2.0, initialDelaySec: 2.6 });
      if (w >= 3) {
        spawns.push({
          unitId: stageNum >= 30 ? 'crimson_raptor' : 'karrar_strike',
          count: 3 + Math.floor(tier * 0.3),
          intervalSec: 2.0,
          initialDelaySec: 5.8,
        });
      }
      if (isFinalWave && stageNum >= 13) {
        spawns.push({ unitId: 'cruise_strike', count: 3 + Math.floor(tier * 0.3), intervalSec: 2.2, initialDelaySec: 8.0 });
      }
    } else if (
      bp.archetype === 'jammer_screen' ||
      bp.archetype === 'ew_corridor' ||
      bp.archetype === 'dual_jammer' ||
      bp.archetype === 'jammed_skies' ||
      bp.archetype === 'glacier_jam' ||
      bp.archetype === 'frozen_siege'
    ) {
      spawns.push({ unitId: 'ew_jammer', count: 1 + Math.floor((w + tier * 0.45) / 2), intervalSec: 3.3, initialDelaySec: 0.8 });
      spawns.push({ unitId: 'shahed_136', count: baseCount, intervalSec: cadence, initialDelaySec: 1.5 });
      if (w >= 2) {
        spawns.push({
          unitId: stageNum >= 14 ? 'crimson_raptor' : 'arash_long_range',
          count: 2 + Math.floor(tier * 0.35),
          intervalSec: 2.2,
          initialDelaySec: 4.2,
        });
      }
      if (w >= 3 && stageNum >= 14) {
        spawns.push({ unitId: 'stealth_ghost', count: 3 + Math.floor(w * 0.65), intervalSec: 2.0, initialDelaySec: 6.5 });
      }
      if (isFinalWave && stageNum >= 18) {
        spawns.push({ unitId: 'ballistic_strike', count: 2 + Math.floor(tier * 0.28), intervalSec: 2.6, initialDelaySec: 8.8 });
      }
    } else if (
      bp.archetype === 'cruise_test' ||
      bp.archetype === 'sea_skimmers' ||
      bp.archetype === 'supersonic_surge'
    ) {
      spawns.push({ unitId: 'switchblade_loiter', count: 5 + w * 2, intervalSec: 1.15, initialDelaySec: 0.4 });
      spawns.push({ unitId: 'cruise_strike', count: 2 + Math.floor(tier * 0.4) + Math.floor(w * 0.7), intervalSec: 2.3, initialDelaySec: 2.5 });
      if (w >= 3) {
        spawns.push({
          unitId: stageNum >= 19 ? 'crimson_raptor' : 'karrar_strike',
          count: 3 + Math.floor(tier * 0.35),
          intervalSec: 1.9,
          initialDelaySec: 5.5,
        });
      }
      if (isFinalWave && stageNum >= 19) spawns.push({ unitId: 'ballistic_strike', count: 3, intervalSec: 2.6, initialDelaySec: 8.5 });
    } else if (
      bp.archetype === 'ballistic_intro' ||
      bp.archetype === 'ballistic_rain' ||
      bp.archetype === 'siege_barrage' ||
      bp.archetype === 'frost_barrage'
    ) {
      spawns.push({ unitId: 'arash_long_range', count: 4 + w, intervalSec: 1.8, initialDelaySec: 0.5 });
      spawns.push({ unitId: 'ballistic_strike', count: 2 + Math.floor(w * 0.8) + Math.floor(tier * 0.28), intervalSec: 2.5, initialDelaySec: 2.8 });
      if (w >= 2) spawns.push({ unitId: 'reaper_hunter', count: 2 + Math.floor(tier * 0.3), intervalSec: 2.6, initialDelaySec: 5.5 });
      if (w >= 3 && stageNum >= 23) spawns.push({ unitId: 'ew_jammer', count: 2, intervalSec: 3.5, initialDelaySec: 2.0 });
      if (isFinalWave) {
        spawns.push({ unitId: 'cruise_strike', count: 4 + Math.floor(tier * 0.25), intervalSec: 2.0, initialDelaySec: 8.0 });
        if (stageNum >= 35) spawns.push({ unitId: 'crimson_raptor', count: 3, intervalSec: 2.1, initialDelaySec: 6.2 });
      }
    } else if (bp.isMidBossStage) {
      spawns.push({ unitId: 'shahed_136', count: baseCount, intervalSec: cadence, initialDelaySec: 0.5 });
      if (w >= 2) spawns.push({ unitId: 'arash_long_range', count: 3 + Math.floor(tier * 0.45), intervalSec: 2.1, initialDelaySec: 3.2 });
      if (w >= 3) {
        spawns.push({
          unitId: stageNum >= 35 ? 'crimson_raptor' : stageNum >= 15 ? 'ew_jammer' : 'karrar_strike',
          count: stageNum >= 35 ? 4 : stageNum >= 15 ? 2 : 4,
          intervalSec: 2.4,
          initialDelaySec: 5.0,
        });
      }
      if (isFinalWave) {
        const bomberCount = stageNum >= 35 ? 2 : stageNum >= 15 ? 2 : 1;
        spawns.push({ unitId: 'heavy_bomber_wing', count: bomberCount, intervalSec: 5.5, initialDelaySec: 3.5 });
        if (stageNum >= 25) spawns.push({ unitId: 'ballistic_strike', count: 3, intervalSec: 2.7, initialDelaySec: 7.5 });
        if (stageNum >= 35) spawns.push({ unitId: 'crimson_raptor', count: 3, intervalSec: 2.2, initialDelaySec: 5.5 });
      }
    } else if (bp.isBossStage) {
      spawns.push({ unitId: 'shahed_136', count: baseCount, intervalSec: cadence, initialDelaySec: 0.4 });
      if (w >= 2) spawns.push({ unitId: 'stealth_ghost', count: 3 + Math.floor(tier * 0.35), intervalSec: 2.2, initialDelaySec: 2.8 });
      if (w >= 3) spawns.push({ unitId: 'cruise_strike', count: 2 + Math.floor(tier * 0.35), intervalSec: 2.4, initialDelaySec: 4.5 });
      if (w >= 3 && stageNum >= 10) spawns.push({ unitId: 'crimson_raptor', count: 2 + Math.floor(tier * 0.25), intervalSec: 2.4, initialDelaySec: 5.2 });
      if (w >= 4 && stageNum >= 20) spawns.push({ unitId: 'ew_jammer', count: 2, intervalSec: 3.2, initialDelaySec: 3.0 });
      if (w >= 4 && stageNum >= 20) spawns.push({ unitId: 'ballistic_strike', count: 2 + Math.floor(tier * 0.28), intervalSec: 2.7, initialDelaySec: 6.5 });
      if (isFinalWave) {
        if (stageNum === 10) {
          spawns.push({ unitId: 'heavy_bomber_wing', count: 1, intervalSec: 1.0, initialDelaySec: 2.5 });
          spawns.push({ unitId: 'sky_dreadnought', count: 1, intervalSec: 1.0, initialDelaySec: 8.0 });
        } else if (stageNum === 20) {
          spawns.push({ unitId: 'sky_dreadnought', count: 1, intervalSec: 1.0, initialDelaySec: 3.5 });
          spawns.push({ unitId: 'heavy_bomber_wing', count: 2, intervalSec: 5.0, initialDelaySec: 7.5 });
        } else if (stageNum === 30) {
          spawns.push({ unitId: 'sky_dreadnought', count: 2, intervalSec: 8.5, initialDelaySec: 3.5 });
          spawns.push({ unitId: 'ballistic_strike', count: 4, intervalSec: 2.2, initialDelaySec: 6.5 });
        } else {
          // Stage 40 Arctic Fortress Grand Finale
          spawns.push({ unitId: 'sky_dreadnought', count: 2, intervalSec: 7.5, initialDelaySec: 3.0 });
          spawns.push({ unitId: 'heavy_bomber_wing', count: 2, intervalSec: 5.5, initialDelaySec: 6.0 });
          spawns.push({ unitId: 'crimson_raptor', count: 5, intervalSec: 1.9, initialDelaySec: 4.2 });
          spawns.push({ unitId: 'ballistic_strike', count: 5, intervalSec: 2.1, initialDelaySec: 8.5 });
        }
      }
    } else {
      // Combined arms heavy / blitz / arctic vanguard stages
      spawns.push({ unitId: 'shahed_136', count: baseCount, intervalSec: cadence, initialDelaySec: 0.4 });
      spawns.push({ unitId: 'arash_long_range', count: 3 + Math.floor(w * 0.7) + Math.floor(tier * 0.35), intervalSec: 2.1, initialDelaySec: 2.5 });
      if (w >= 2) spawns.push({ unitId: 'reaper_hunter', count: 2 + Math.floor(tier * 0.38), intervalSec: 2.4, initialDelaySec: 4.8 });
      if (w >= 3) spawns.push({ unitId: stageNum >= 16 ? 'ballistic_strike' : 'cruise_strike', count: 2 + Math.floor(tier * 0.32), intervalSec: 2.5, initialDelaySec: 7.0 });
      if (w >= 4 && stageNum >= 27) {
        spawns.push({ unitId: 'crimson_raptor', count: 2 + Math.floor(tier * 0.25), intervalSec: 2.1, initialDelaySec: 6.2 });
      }
      if (isFinalWave && stageNum >= 21) {
        spawns.push({ unitId: 'stealth_ghost', count: 4 + Math.floor(tier * 0.32), intervalSec: 1.8, initialDelaySec: 5.5 });
        spawns.push({ unitId: 'heavy_bomber_wing', count: 1, intervalSec: 1.0, initialDelaySec: 9.0 });
      }
    }

    const bonusReward = Math.round(54 + stageNum * 1.9 + w * 8 + (isFinalWave ? 22 : 0));

    waves.push({
      waveNumber: w,
      name: `Wave ${w}`,
      persianName: isFinalWave && (bp.isBossStage || bp.isMidBossStage) ? `موج ${w} (ورود فرمانده هوایی)` : `موج ${w}`,
      description: bp.subtitleFa,
      spawns,
      bonusReward,
    });
  }

  return waves;
}

export const CAMPAIGN_STAGES: StageConfig[] = STAGE_BLUEPRINTS.map((bp, idx) => {
  const stageNumber = idx + 1;
  const chapter: 1 | 2 | 3 | 4 =
    stageNumber <= 10 ? 1 : stageNumber <= 20 ? 2 : stageNumber <= 30 ? 3 : 4;
  const biome: MapBiome =
    chapter === 1 ? 'alpine' : chapter === 2 ? 'coastal' : chapter === 3 ? 'desert' : 'arctic';

  // Gradual difficulty scaling across 40 stages
  let hpMultiplier = Number((1.0 + (stageNumber - 1) * 0.044).toFixed(2));
  let speedMultiplier = Number((1.0 + (stageNumber - 1) * 0.0085).toFixed(2));

  if (bp.modifier === 'armored_wing') hpMultiplier = Number((hpMultiplier * 1.25).toFixed(2));
  if (bp.modifier === 'blitz_speed') speedMultiplier = Number((speedMultiplier * 1.18).toFixed(2));

  const starterTowers =
    chapter === 1
      ? [{ towerId: 'ciws_light', x: 6, z: -4 }]
      : chapter === 2
        ? [
            { towerId: 'ciws_light', x: 6, z: -4 },
            { towerId: 'avenger_stinger', x: -6, z: -4 },
          ]
        : chapter === 3
          ? [
              { towerId: 'pantsir_point', x: -6, z: -4 },
              { towerId: 'ciws_light', x: 6, z: -4 },
            ]
          : [
              { towerId: 'iron_dome_pod', x: -6, z: -4 },
              { towerId: 'ciws_light', x: 6, z: -4 },
            ];

  // Destructible Secondary Facilities (2 Reinforced Bunkers + 1 Fuel & Power Depot)
  // Deployed on special protection missions, hard penultimate stages, mid-bosses, and chapter boss finales
  const CRITICAL_PROTECT_STAGES = new Set([8, 10, 17, 20, 28, 30, 38, 40]);
  const BONUS_PROTECT_STAGES = new Set([5, 9, 15, 19, 25, 29, 35, 39]);
  const hasSecondaryFacilities =
    CRITICAL_PROTECT_STAGES.has(stageNumber) || BONUS_PROTECT_STAGES.has(stageNumber);

  const facilityHpScale = 1 + (chapter - 1) * 0.18;
  const secondaryFacilities: StageFacilitySpec[] = hasSecondaryFacilities
    ? [
        {
          id: 'bunker_west',
          kind: 'ammo_bunker',
          titleFa: 'بانکر مهمات غربی',
          x: -9.8,
          z: 2.2,
          maxHp: Math.round(305 * facilityHpScale),
        },
        {
          id: 'bunker_east',
          kind: 'ammo_bunker',
          titleFa: 'بانکر فرماندهی شرقی',
          x: 9.8,
          z: 2.2,
          maxHp: Math.round(305 * facilityHpScale),
        },
        {
          id: 'fuel_depot_north',
          kind: 'fuel_depot',
          titleFa: 'مخزن سوخت و نیروگاه',
          x: 0.0,
          z: -9.6,
          maxHp: Math.round(260 * facilityHpScale),
        },
      ]
    : [];

  return {
    stageNumber,
    chapter,
    biome,
    titleFa: bp.titleFa,
    subtitleFa: bp.subtitleFa,
    modifier: bp.modifier,
    modifierLabelFa: MODIFIER_LABELS[bp.modifier],
    isBossStage: Boolean(bp.isBossStage),
    isMidBossStage: Boolean(bp.isMidBossStage),
    isNightStage: Boolean(
      stageNumber === 2 ||
        stageNumber === 33 ||
        bp.modifier === 'stealth_ops' ||
        bp.isBossStage ||
        bp.isMidBossStage
    ),
    secondaryObjectives: hasSecondaryFacilities
      ? {
          facilities: secondaryFacilities,
          failOnAllLost: CRITICAL_PROTECT_STAGES.has(stageNumber),
          labelFa: CRITICAL_PROTECT_STAGES.has(stageNumber)
            ? 'حفاظت حیاتی: ۲ بانکر و مخزن سوخت'
            : 'تأسیسات جانبی: ۲ بانکر و مخزن سوخت',
        }
      : undefined,
    startingCash: bp.startingCash,
    starterTowers,
    hpMultiplier,
    speedMultiplier,
    waves: buildWavesForStage(stageNumber, bp),
  };
});

const STORAGE_KEY = 'air_shield_campaign_progress_v1';

export function loadCampaignProgress(): CampaignProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { highestUnlocked: 1, starsByStage: {} };
    }
    const parsed = JSON.parse(raw) as Partial<CampaignProgress>;
    const highest =
      typeof parsed.highestUnlocked === 'number'
        ? Math.max(1, Math.min(40, parsed.highestUnlocked))
        : 1;
    const stars = parsed.starsByStage && typeof parsed.starsByStage === 'object' ? parsed.starsByStage : {};
    return { highestUnlocked: highest, starsByStage: stars };
  } catch {
    return { highestUnlocked: 1, starsByStage: {} };
  }
}

export function saveCampaignProgress(progress: CampaignProgress): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota errors in sandboxed iframes
  }
}
