import React, { useMemo, useState } from 'react';
import { EnemyUnit, MapBiome, SaveProfileV2, StageConfig } from '../types/game';
import { CAMPAIGN_CHAPTERS, CAMPAIGN_STAGES } from '../data/campaignStages';
import { ENEMY_UNITS } from '../data/gameData';
import { computeSpentStars, computeTotalEarnedStars } from '../data/techAndSave';
import { THEATER_ARTWORK } from '../data/theaterArtwork';
import {
  Check,
  Coins,
  Cpu,
  Crosshair,
  Crown,
  EyeOff,
  Flame,
  Gauge,
  Infinity as InfinityIcon,
  Lock,
  Moon,
  Mountain,
  Play,
  Radio,
  ShieldAlert,
  Snowflake,
  Star,
  Sun,
  Waves,
  X,
} from 'lucide-react';

interface CampaignRoadmapProps {
  currentStageNumber: number;
  initialChapter?: 1 | 2 | 3 | 4;
  profile: SaveProfileV2;
  onSelectStage: (stageNumber: number) => void;
  onStartEndless: (biome: MapBiome) => void;
  onOpenTechLab: () => void;
  onClose: () => void;
}

const CHAPTER_ICONS: Record<1 | 2 | 3 | 4, React.FC<{ className?: string }>> = {
  1: Mountain,
  2: Waves,
  3: Sun,
  4: Snowflake,
};

interface StageEnemySummary {
  unit: EnemyUnit;
  totalCount: number;
}

function getStageEnemyRoster(stage: StageConfig): StageEnemySummary[] {
  const counts = new Map<string, number>();
  for (const w of stage.waves) {
    for (const sp of w.spawns) {
      counts.set(sp.unitId, (counts.get(sp.unitId) ?? 0) + sp.count);
    }
  }
  const roster: StageEnemySummary[] = [];
  counts.forEach((totalCount, unitId) => {
    const found = ENEMY_UNITS.find((u) => u.id === unitId);
    if (found) roster.push({ unit: found, totalCount });
  });
  // Sort bosses & special threats first so commanders immediately spot key dangers
  roster.sort((a, b) => {
    const score = (u: EnemyUnit) =>
      (u.isBoss ? 100 : 0) +
      (u.jammerRadius ? 40 : 0) +
      (u.isStealth ? 30 : 0) +
      (u.flaresCount ? 15 : 0) +
      (u.shape === 'ballistic_missile' ? 25 : 0) +
      (u.shape === 'cruise_missile' ? 20 : 0);
    return score(b.unit) - score(a.unit);
  });
  return roster;
}

function getUnitTraitFa(unit: EnemyUnit): string {
  if (unit.isBoss && unit.escortCount) return `بمب‌افکن B-2 + ${unit.escortCount} جنگنده اسکورت`;
  if (unit.isBoss) return 'باس هوایی سنگین · منور حرارتی';
  if (unit.shape === 'enemy_fighter') return 'جنگنده ارتفاع‌بالا · بمباران برجک و داگ‌فایت';
  if (unit.jammerRadius) return 'اخلال‌گر رادار';
  if (unit.isStealth) return 'رادارگریز (نیازمند رادار)';
  if (unit.shape === 'ballistic_missile') return 'موشک بالستیک پرسرعت';
  if (unit.shape === 'cruise_missile') return 'موشک کروز ارتفاع پست';
  if (unit.flaresCount) return 'مجهز به منور ضدموشک';
  return 'پهپاد تهاجمی · حمله به برجک و پایگاه';
}

export const CampaignRoadmap: React.FC<CampaignRoadmapProps> = ({
  currentStageNumber,
  initialChapter,
  profile,
  onSelectStage,
  onStartEndless,
  onOpenTechLab,
  onClose,
}) => {
  const safeStageIdx = Math.max(0, Math.min(CAMPAIGN_STAGES.length - 1, currentStageNumber - 1));
  const defaultStage = CAMPAIGN_STAGES[safeStageIdx] ?? CAMPAIGN_STAGES[0];
  const resolvedInitChapter = initialChapter ?? defaultStage.chapter;

  const [activeChapter, setActiveChapter] = useState<1 | 2 | 3 | 4>(resolvedInitChapter);
  const [previewStageNum, setPreviewStageNum] = useState<number>(() => {
    if (initialChapter && initialChapter !== defaultStage.chapter) {
      const chapStages = CAMPAIGN_STAGES.filter((s) => s.chapter === initialChapter);
      const bestUnlocked = chapStages.filter((s) => s.stageNumber <= profile.highestUnlocked).pop();
      return bestUnlocked ? bestUnlocked.stageNumber : chapStages[0].stageNumber;
    }
    return defaultStage.stageNumber;
  });
  const [imgFailed, setImgFailed] = useState<Record<string, boolean>>({});

  const chapterMeta = CAMPAIGN_CHAPTERS.find((c) => c.chapter === activeChapter)!;
  const theaterArt = THEATER_ARTWORK[chapterMeta.biome];
  const chapterStages = useMemo(
    () => CAMPAIGN_STAGES.filter((s) => s.chapter === activeChapter),
    [activeChapter]
  );
  const previewStage: StageConfig = CAMPAIGN_STAGES[previewStageNum - 1] ?? chapterStages[0];

  const enemyRoster = useMemo(() => getStageEnemyRoster(previewStage), [previewStage]);
  const totalStageEnemies = useMemo(
    () => enemyRoster.reduce((sum, item) => sum + item.totalCount, 0),
    [enemyRoster]
  );

  const totalStars = computeTotalEarnedStars(profile.starsByStage);
  const availableStars = Math.max(0, totalStars - computeSpentStars(profile.techLevels));
  const isPreviewUnlocked = previewStage.stageNumber <= profile.highestUnlocked;
  const previewStars = profile.starsByStage[previewStage.stageNumber] ?? 0;
  const chapterEndlessRec = profile.endlessRecords[chapterMeta.biome];

  const hpPct = Math.min(100, Math.round(((previewStage.hpMultiplier - 0.85) / 1.9) * 100));
  const speedPct = Math.min(100, Math.round(((previewStage.speedMultiplier - 0.9) / 0.55) * 100));

  const handleSelectChapter = (chapter: 1 | 2 | 3 | 4) => {
    setActiveChapter(chapter);
    const stages = CAMPAIGN_STAGES.filter((s) => s.chapter === chapter);
    const highestInChapter =
      stages.filter((s) => s.stageNumber <= profile.highestUnlocked).pop() ?? stages[0];
    setPreviewStageNum(highestInChapter.stageNumber);
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-[#070b14]/97 backdrop-blur-sm flex flex-col safe-modal-padding overflow-y-auto short:overflow-hidden"
    >
      <div className="max-w-7xl w-full mx-auto flex flex-col flex-1 min-h-0 gap-3.5 short:gap-1.5">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 short:pb-1.5 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-base sm:text-xl short:text-sm font-bold text-white tracking-tight">
              نقشه عملیات تاکتیکی
            </h2>
            <p className="text-xs short:hidden text-slate-400 mt-0.5">
              ۴۰ مرحله در ۴ جبهه کوهستان، ساحل، کویر و دژ قطبی · روی هر پایگاه کلیک کنید تا گزارش اطلاعاتی مأموریت باز شود
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => {
                onClose();
                onOpenTechLab();
              }}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 short:px-2.5 short:py-1 rounded-xl bg-sky-500/12 hover:bg-sky-500/22 border border-sky-400/35 text-sky-200 text-xs short:text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Cpu className="w-3.5 h-3.5 text-sky-400" />
              <span>فناوری</span>
              <span className="font-mono text-amber-300 tabular-nums">({availableStars}★)</span>
            </button>

            <div className="flex items-center gap-1 text-xs sm:text-sm short:text-xs font-mono font-semibold text-amber-300 tabular-nums">
              <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-amber-400 text-amber-400" />
              <span>{totalStars}/120</span>
            </div>

            <button
              onClick={onClose}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 short:px-2.5 short:py-1 rounded-xl bg-white/5 hover:bg-white/12 border border-white/12 text-slate-200 hover:text-white text-xs short:text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <X className="w-4 h-4 short:w-3.5 short:h-3.5" />
              <span>بازگشت</span>
            </button>
          </div>
        </div>

        {/* 4 Illustrated Theater Chapter Selector Tabs (Single Row on Landscape Mobile!) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 short:grid-cols-4 gap-2 sm:gap-3 short:gap-1.5 shrink-0">
          {CAMPAIGN_CHAPTERS.map((chap) => {
            const Icon = CHAPTER_ICONS[chap.chapter];
            const art = THEATER_ARTWORK[chap.biome];
            const active = activeChapter === chap.chapter;
            const chapStages = CAMPAIGN_STAGES.filter((s) => s.chapter === chap.chapter);
            const chapStars = chapStages.reduce(
              (sum, s) => sum + (profile.starsByStage[s.stageNumber] ?? 0),
              0
            );
            const clearedCount = chapStages.filter(
              (s) => (profile.starsByStage[s.stageNumber] ?? 0) > 0
            ).length;
            const chapterUnlocked = profile.highestUnlocked >= chap.stageRange[0];

            return (
              <button
                key={chap.chapter}
                onClick={() => handleSelectChapter(chap.chapter)}
                className={`relative overflow-hidden rounded-xl border text-right transition-all cursor-pointer p-2.5 sm:p-3 short:p-1.5 ${
                  active
                    ? 'border-amber-400/70 bg-[#131d33] shadow-lg shadow-amber-500/10'
                    : 'border-white/10 bg-[#0b1220] hover:border-white/25 opacity-85 hover:opacity-100'
                }`}
              >
                {/* Subtle miniature theater background artwork */}
                {!imgFailed[chap.biome] && (
                  <img
                    src={art.image}
                    alt=""
                    aria-hidden="true"
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed((prev) => ({ ...prev, [chap.biome]: true }))}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity ${
                      active ? 'opacity-28' : 'opacity-14'
                    }`}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-l from-[#0b1220]/95 via-[#0b1220]/75 to-[#0b1220]/45" />

                <div className="relative z-10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 short:w-6 short:h-6 rounded-lg flex items-center justify-center shrink-0 border ${
                        active
                          ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                          : 'bg-white/5 border-white/10 text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4 short:w-3.5 short:h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm short:text-[11px] font-bold text-white truncate">
                        {chap.titleFa}
                      </div>
                      <div className="text-[11px] short:hidden text-slate-400 truncate mt-0.5 font-mono tabular-nums">
                        مراحل {chap.stageRange[0]}–{chap.stageRange[1]} · {clearedCount}/10
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-xs short:text-[11px] font-mono text-amber-300 shrink-0 tabular-nums">
                    {chapterUnlocked ? (
                      <>
                        <Star className="w-3.5 h-3.5 short:w-3 short:h-3 fill-amber-400 text-amber-400" />
                        <span>{chapStars}/30</span>
                      </>
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Main Tactical Workspace: Side-by-Side Illustrated Map + Mission Dossier (Even on Landscape Mobile!) */}
        <div className="grid grid-cols-1 short:grid-cols-[1fr_248px] md:grid-cols-[1fr_290px] lg:grid-cols-[1fr_360px] gap-4 short:gap-2 flex-1 min-h-0">
          {/* Interactive Illustrated Tactical Operations Map */}
          <div className="relative rounded-2xl short:rounded-xl border border-white/12 overflow-hidden bg-[#0a101d] min-h-[340px] sm:min-h-[430px] short:min-h-0 flex flex-col justify-between">
            {/* Full-bleed Theater Artwork Backdrop */}
            <div className={`absolute inset-0 bg-gradient-to-br ${theaterArt.fallbackGradient}`}>
              {!imgFailed[chapterMeta.biome] && (
                <img
                  src={theaterArt.image}
                  alt={theaterArt.altFa}
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setImgFailed((prev) => ({ ...prev, [chapterMeta.biome]: true }))
                  }
                  className="w-full h-full object-cover object-center opacity-80"
                />
              )}
              {/* Tactical Vignette & Subtle Topographic Grid Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#070b14]/90 via-[#070b14]/30 to-[#070b14]/70" />
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.18) 1px, transparent 1px)',
                  backgroundSize: '48px 48px',
                }}
              />
            </div>

            {/* Map Top Header Overlay */}
            <div className="relative z-10 px-4 py-3 short:px-3 short:py-1.5 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-b from-[#070b14]/85 to-transparent">
              <div className="flex items-center gap-2 text-xs short:text-[11px]">
                <span className="font-bold text-white">{chapterMeta.titleFa}</span>
                <span className="text-slate-500" aria-hidden="true">·</span>
                <span className={`${theaterArt.accentText} font-medium`}>
                  {theaterArt.sectorLabelFa}
                </span>
              </div>

              <button
                onClick={() => {
                  onStartEndless(chapterMeta.biome);
                  onClose();
                }}
                className="px-3 py-1.5 short:px-2.5 short:py-1 rounded-lg bg-rose-500/18 hover:bg-rose-500/28 border border-rose-400/40 text-rose-100 text-xs short:text-[10px] font-semibold flex items-center gap-1.5 backdrop-blur-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                <InfinityIcon className="w-3.5 h-3.5 text-rose-300" />
                <span>بقای بی‌نهایت این اقلیم</span>
                {chapterEndlessRec.bestWave > 0 && (
                  <span className="font-mono text-amber-300 tabular-nums">
                    (موج {chapterEndlessRec.bestWave})
                  </span>
                )}
              </button>
            </div>

            {/* Interactive SVG Route + 10 Tactical Stage Nodes Layer */}
            <div className="relative z-10 flex-1 w-full min-h-[260px] sm:min-h-[340px] short:min-h-0">
              {/* SVG Tactical Route Lines & Subtle Radar Range Arcs */}
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full pointer-events-none"
              >
                {/* Decorative faint radar sweeps centered on theater command */}
                <circle
                  cx="52"
                  cy="50"
                  r="24"
                  fill="none"
                  stroke="rgba(148,163,184,0.14)"
                  strokeWidth="0.25"
                  strokeDasharray="1.2 1.2"
                />
                <circle
                  cx="52"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="rgba(148,163,184,0.10)"
                  strokeWidth="0.25"
                  strokeDasharray="1.6 1.6"
                />

                {chapterStages.slice(0, -1).map((stage, idx) => {
                  const [x1, y1] = theaterArt.routeCoords[idx] ?? [15 + idx * 8, 50];
                  const [x2, y2] = theaterArt.routeCoords[idx + 1] ?? [23 + idx * 8, 50];
                  const nextStage = chapterStages[idx + 1];
                  const isClearedLeg = (profile.starsByStage[stage.stageNumber] ?? 0) > 0;
                  const isActiveFrontier =
                    nextStage && nextStage.stageNumber === profile.highestUnlocked;
                  const isUnlockedLeg =
                    nextStage && nextStage.stageNumber <= profile.highestUnlocked;

                  // Smooth organic curve midpoint
                  const mx = (x1 + x2) / 2;
                  const my = (y1 + y2) / 2 + (idx % 2 === 0 ? -4.5 : 4.5);
                  const d = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;

                  return (
                    <g key={stage.stageNumber}>
                      {/* Subtle dark casing for high contrast over bright terrain */}
                      <path
                        d={d}
                        fill="none"
                        stroke="rgba(7,11,20,0.75)"
                        strokeWidth={isClearedLeg || isActiveFrontier ? '1.25' : '0.85'}
                        strokeLinecap="round"
                      />
                      <path
                        d={d}
                        fill="none"
                        stroke={
                          isActiveFrontier
                            ? '#fbbf24'
                            : isClearedLeg
                              ? '#34d399'
                              : isUnlockedLeg
                                ? '#38bdf8'
                                : 'rgba(148,163,184,0.34)'
                        }
                        strokeWidth={isClearedLeg || isActiveFrontier ? '0.68' : '0.45'}
                        strokeDasharray={isActiveFrontier ? '2.2 1.4' : isUnlockedLeg ? 'none' : '1.4 1.6'}
                        strokeLinecap="round"
                        className={isActiveFrontier ? 'animate-tactical-dash' : undefined}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* 10 Positioned Stage Command Nodes */}
              {chapterStages.map((stage, idx) => {
                const [px, py] = theaterArt.routeCoords[idx] ?? [15 + idx * 8, 50];
                const unlocked = stage.stageNumber <= profile.highestUnlocked;
                const stars = profile.starsByStage[stage.stageNumber] ?? 0;
                const isCompleted = stars > 0;
                const isSelected = previewStageNum === stage.stageNumber;
                const isFrontier = stage.stageNumber === profile.highestUnlocked;
                const isBoss = Boolean(stage.isBossStage);
                const isMidBoss = Boolean(stage.isMidBossStage);

                return (
                  <button
                    key={stage.stageNumber}
                    type="button"
                    onClick={() => setPreviewStageNum(stage.stageNumber)}
                    style={{ left: `${px}%`, top: `${py}%` }}
                    className={`group absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer focus-visible:outline-none transition-transform duration-150 ${
                      isSelected ? 'z-30 scale-110' : 'z-20 hover:scale-105'
                    }`}
                  >
                    {/* Target-Lock Corner Brackets for Selected Stage */}
                    <div className="relative flex items-center justify-center">
                      {isSelected && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute -inset-2 rounded-xl border border-amber-400/90 shadow-[0_0_18px_rgba(251,191,36,0.45)]"
                        />
                      )}

                      {/* Boss Outer Ring */}
                      {isBoss && unlocked && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute -inset-1.5 rounded-full border border-rose-400/55"
                        />
                      )}

                      {/* Main Node Emblem */}
                      <div
                        className={`relative flex items-center justify-center font-mono font-bold tabular-nums border-2 shadow-xl transition-colors ${
                          isBoss
                            ? 'w-12 h-12 short:w-9 short:h-9 rounded-2xl short:rounded-xl text-sm short:text-xs'
                            : isMidBoss
                              ? 'w-11 h-11 short:w-8 short:h-8 rounded-xl short:rounded-lg text-sm short:text-xs'
                              : 'w-10 h-10 short:w-8 short:h-8 rounded-xl short:rounded-lg text-xs short:text-[11px]'
                        } ${
                          !unlocked
                            ? 'bg-[#090e1a]/92 border-slate-700/80 text-slate-500'
                            : isSelected
                              ? 'bg-amber-500 border-amber-200 text-slate-950'
                              : isBoss
                                ? 'bg-rose-950/95 border-rose-400 text-rose-200'
                                : isMidBoss
                                  ? 'bg-amber-950/95 border-amber-400 text-amber-200'
                                  : isCompleted
                                    ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200'
                                    : isFrontier
                                      ? 'bg-sky-950/95 border-sky-300 text-sky-100'
                                      : 'bg-[#101a2e]/95 border-slate-500 text-slate-100'
                        }`}
                      >
                        {!unlocked ? (
                          <Lock className="w-3.5 h-3.5 short:w-3 short:h-3" />
                        ) : isBoss || isMidBoss ? (
                          <Crown className="w-4 h-4 short:w-3.5 short:h-3.5" />
                        ) : isCompleted ? (
                          <Check className="w-4 h-4 short:w-3.5 short:h-3.5" />
                        ) : (
                          stage.stageNumber
                        )}

                        {/* Night Raid Crescent Marker on Upper Corner */}
                        {stage.isNightStage && unlocked && (
                          <span
                            title="عملیات شبانه"
                            className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-[#0a1224] border border-sky-400/70 flex items-center justify-center"
                          >
                            <Moon className="w-2.5 h-2.5 text-sky-300" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Compact Legible Stage Caption & 3 Stars */}
                    <div className="mt-1 short:mt-0.5 px-1.5 py-0.5 short:px-1 rounded-md bg-[#070b14]/88 backdrop-blur-xs border border-white/10 flex flex-col items-center">
                      <span
                        className={`text-[10px] short:text-[8.5px] font-semibold leading-tight whitespace-nowrap max-w-[92px] short:max-w-[68px] truncate ${
                          isSelected
                            ? 'text-amber-300'
                            : unlocked
                              ? 'text-slate-100'
                              : 'text-slate-500'
                        }`}
                      >
                        {stage.stageNumber}. {stage.titleFa}
                      </span>
                      <div className="flex items-center gap-0.5 mt-0.5">
                        {[1, 2, 3].map((n) => (
                          <Star
                            key={n}
                            className={`w-2.5 h-2.5 short:w-2 short:h-2 ${
                              n <= stars ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Subtle Bottom Map Legend */}
            <div className="relative z-10 px-4 py-2 short:py-1 bg-gradient-to-t from-[#070b14]/92 to-transparent flex flex-wrap items-center justify-between gap-2 text-[11px] short:text-[10px] text-slate-400">
              <div className="flex flex-wrap items-center gap-3.5">
                <span className="inline-flex items-center gap-1 text-emerald-300">
                  <Check className="w-3 h-3" />
                  تکمیل‌شده
                </span>
                <span className="inline-flex items-center gap-1 text-rose-300">
                  <Crown className="w-3 h-3" />
                  باس / میانی‌باس
                </span>
                <span className="inline-flex items-center gap-1 text-sky-300">
                  <Moon className="w-3 h-3" />
                  عملیات شبانه
                </span>
              </div>
              <span className="font-mono text-slate-400 tabular-nums hidden sm:inline">
                مرحله فعلی جبهه: {Math.min(chapterMeta.stageRange[1], Math.max(chapterMeta.stageRange[0], profile.highestUnlocked))}
              </span>
            </div>
          </div>

          {/* Right/Side Detailed Tactical Mission Dossier (Internal Scroll + Pinned Launch CTA on Landscape Mobile!) */}
          <aside className="rounded-2xl short:rounded-xl border border-white/12 bg-[#0c1322] p-4 sm:p-5 short:p-2.5 flex flex-col justify-between gap-4 short:gap-2 min-h-0">
            <div className="space-y-4 short:space-y-2 flex-1 min-h-0 overflow-y-auto no-scrollbar">
              {/* Stage Header */}
              <div className="pb-3 short:pb-2 border-b border-white/10">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                  <span className="font-mono font-bold text-amber-300 tabular-nums">
                    مرحله {previewStage.stageNumber} از ۴۰
                  </span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3].map((n) => (
                      <Star
                        key={n}
                        className={`w-4 h-4 ${
                          n <= previewStars ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <h3 className="text-lg short:text-sm font-bold text-white mt-1.5">
                  {previewStage.titleFa}
                </h3>
                <p className="text-xs short:text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {previewStage.subtitleFa}
                </p>

                {/* Operation Conditions (Clean unboxed metadata with separators) */}
                {(previewStage.modifier !== 'none' || previewStage.isNightStage || previewStage.secondaryObjectives) && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium">
                    {previewStage.isNightStage && (
                      <span className="inline-flex items-center gap-1 text-sky-300">
                        <Moon className="w-3.5 h-3.5" />
                        عملیات شبانه با نورافکن
                      </span>
                    )}
                    {previewStage.modifier !== 'none' && (
                      <span className="inline-flex items-center gap-1 text-rose-300">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        {previewStage.modifierLabelFa}
                      </span>
                    )}
                    {previewStage.secondaryObjectives && (
                      <span
                        className={`inline-flex items-center gap-1 ${
                          previewStage.secondaryObjectives.failOnAllLost ? 'text-rose-300' : 'text-amber-300'
                        }`}
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        {previewStage.secondaryObjectives.labelFa}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Mission Quantitative Parameters */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-[#080e1a] border border-white/8 p-2.5 short:p-1.5">
                  <div className="text-[10px] text-slate-400">موج نبرد</div>
                  <div className="font-mono text-sm short:text-xs font-bold text-white tabular-nums mt-0.5">
                    {previewStage.waves.length}
                  </div>
                </div>
                <div className="rounded-xl bg-[#080e1a] border border-white/8 p-2.5 short:p-1.5">
                  <div className="text-[10px] text-slate-400">بودجه اولیه</div>
                  <div className="font-mono text-sm short:text-xs font-bold text-amber-300 tabular-nums mt-0.5 flex items-center justify-center gap-0.5">
                    <Coins className="w-3 h-3" />${previewStage.startingCash}
                  </div>
                </div>
                <div className="rounded-xl bg-[#080e1a] border border-white/8 p-2.5 short:p-1.5">
                  <div className="text-[10px] text-slate-400">کل اهداف</div>
                  <div className="font-mono text-sm short:text-xs font-bold text-sky-300 tabular-nums mt-0.5">
                    {totalStageEnemies}
                  </div>
                </div>
              </div>

              {/* Threat Intensity Bars */}
              <div className="space-y-2 text-[11px]">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Flame className="w-3 h-3 text-amber-400" />
                      مقاومت زره دشمن
                    </span>
                    <span className="font-mono text-slate-200 tabular-nums">
                      ×{previewStage.hpMultiplier.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all duration-200"
                      style={{ width: `${Math.max(12, hpPct)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Gauge className="w-3 h-3 text-sky-400" />
                      سرعت یورش هوایی
                    </span>
                    <span className="font-mono text-slate-200 tabular-nums">
                      ×{previewStage.speedMultiplier.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-sky-400 transition-all duration-200"
                      style={{ width: `${Math.max(15, speedPct)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Enemy Threat Intelligence Roster */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>تهدیدهای شناسایی‌شده</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    {enemyRoster.length} کلاس هواگرد
                  </span>
                </div>

                <div className="space-y-1.5 max-h-[155px] short:max-h-[96px] overflow-y-auto pl-1">
                  {enemyRoster.map(({ unit, totalCount }) => (
                    <div
                      key={unit.id}
                      className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-lg bg-[#080e1a] border border-white/6 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {unit.isBoss ? (
                          <Crown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        ) : unit.jammerRadius ? (
                          <Radio className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                        ) : unit.isStealth ? (
                          <EyeOff className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        ) : (
                          <Crosshair className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-100 truncate">
                            {unit.persianName}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {getUnitTraitFa(unit)}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-200 tabular-nums shrink-0">
                        ×{totalCount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Dominant Launch Action (Always Visible at Bottom of Dossier!) */}
            <div className="pt-2 short:pt-1.5 border-t border-white/10 space-y-2 shrink-0">
              <button
                disabled={!isPreviewUnlocked}
                onClick={() => {
                  onSelectStage(previewStage.stageNumber);
                  onClose();
                }}
                className={`w-full py-3 short:py-2 px-4 rounded-xl font-bold text-sm short:text-xs flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                  isPreviewUnlocked
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/15 active:scale-[0.98]'
                    : 'bg-white/5 text-slate-500 border border-white/8 cursor-not-allowed'
                }`}
              >
                {isPreviewUnlocked ? (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>آغاز مأموریت مرحله {previewStage.stageNumber}</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>قفل است · ابتدا مرحله {profile.highestUnlocked} را تکمیل کنید</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-slate-500 text-center short:hidden">
                {previewStage.secondaryObjectives
                  ? 'برای کسب ۳ ستاره، سلامت پایگاه بالای ۹۰٪ و تمامی بانکرها و مخزن سوخت را سالم نگه دارید'
                  : 'برای کسب ۳ ستاره، سلامت پایگاه را بالای ۹۰٪ حفظ کنید'}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
