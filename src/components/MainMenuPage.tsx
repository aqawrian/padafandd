import React, { useState } from 'react';
import { MapBiome, SaveProfileV2 } from '../types/game';
import { CAMPAIGN_CHAPTERS, CAMPAIGN_STAGES } from '../data/campaignStages';
import { computeSpentStars, computeTotalEarnedStars } from '../data/techAndSave';
import { HERO_KEY_ART, THEATER_ARTWORK } from '../data/theaterArtwork';
import {
  ChevronLeft,
  Cpu,
  Crosshair,
  Database,
  Infinity as InfinityIcon,
  Lock,
  Map as MapIcon,
  Moon,
  Mountain,
  Play,
  Radar,
  Shield,
  Snowflake,
  Star,
  Sun,
  Waves,
} from 'lucide-react';

interface MainMenuPageProps {
  profile: SaveProfileV2;
  currentStageNumber: number;
  activeBiome: MapBiome;
  onContinueCampaign: () => void;
  onOpenRoadmap: (chapter?: 1 | 2 | 3 | 4) => void;
  onStartEndless: (biome: MapBiome) => void;
  onOpenTechLab: () => void;
  onOpenUnits: () => void;
}

const CHAPTER_ICONS: Record<1 | 2 | 3 | 4, React.FC<{ className?: string }>> = {
  1: Mountain,
  2: Waves,
  3: Sun,
  4: Snowflake,
};

export const MainMenuPage: React.FC<MainMenuPageProps> = ({
  profile,
  currentStageNumber,
  activeBiome,
  onContinueCampaign,
  onOpenRoadmap,
  onStartEndless,
  onOpenTechLab,
  onOpenUnits,
}) => {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [failedBiomes, setFailedBiomes] = useState<Record<string, boolean>>({});

  const totalStars = computeTotalEarnedStars(profile.starsByStage);
  const availableStars = Math.max(0, totalStars - computeSpentStars(profile.techLevels));
  const bestEndlessWave = Math.max(
    profile.endlessRecords.alpine?.bestWave ?? 0,
    profile.endlessRecords.coastal?.bestWave ?? 0,
    profile.endlessRecords.desert?.bestWave ?? 0,
    profile.endlessRecords.arctic?.bestWave ?? 0
  );

  const resumeStageNum = Math.min(40, Math.max(1, currentStageNumber));
  const resumeStage = CAMPAIGN_STAGES[resumeStageNum - 1] ?? CAMPAIGN_STAGES[0];
  const hasProgress = totalStars > 0 || profile.highestUnlocked > 1;

  return (
    <div
      dir="rtl"
      className="relative w-full h-full overflow-y-auto bg-[#070b14] text-slate-100 flex flex-col"
    >
      {/* Top Bar Contract: 3 clean zones (Brand — Nav Links — Primary CTA) */}
      <header className="sticky top-0 z-30 w-full bg-[#070b14]/88 backdrop-blur-md border-b border-white/10 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 short:h-11 flex items-center justify-between gap-6">
          {/* Zone 1: Single-line Brand Wordmark */}
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <Shield className="w-5 h-5 short:w-4 short:h-4 text-amber-400" />
            <span className="text-base short:text-sm font-bold tracking-tight text-white">
              پدافند هوایی
            </span>
          </div>

          {/* Zone 2: Clean single-line navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-slate-300">
            <button
              onClick={() => onOpenRoadmap()}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1"
            >
              نقشه مراحل
            </button>
            <button
              onClick={onOpenTechLab}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1"
            >
              آزمایشگاه فناوری
            </button>
            <button
              onClick={onOpenUnits}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1"
            >
              واحدها و تجهیزات
            </button>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              onClick={onContinueCampaign}
              className="px-4 py-2 short:px-3 short:py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{hasProgress ? `ادامه مرحله ${resumeStage.stageNumber}` : 'شروع عملیات'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Flow */}
      <main className="flex-1 flex flex-col">
        {/* Dominant Hero Section with Full-Bleed 16:9 Key Art */}
        <section className="relative w-full min-h-[380px] sm:min-h-[460px] lg:min-h-[540px] short:min-h-[260px] flex items-center overflow-hidden border-b border-white/10">
          {/* Background Key Art + Resilient Fallback */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a1324] via-[#0e192f] to-[#070b14]">
            {!heroImgFailed && (
              <img
                src={HERO_KEY_ART}
                alt="پایگاه پدافند هوایی سه‌بعدی در عملیات شبانه با موشک‌های رهگیر و نورافکن‌ها"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className="w-full h-full object-cover object-center opacity-90"
              />
            )}
            {/* Measured RTL directional + bottom contrast scrims for WCAG AA legibility */}
            <div className="absolute inset-0 bg-gradient-to-l from-[#070b14] via-[#070b14]/82 to-[#070b14]/25" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-transparent to-[#070b14]/45" />
          </div>

          <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 short:py-4">
            <div className="max-w-xl short:max-w-lg space-y-5 short:space-y-3">
              {/* Quiet unboxed kicker metadata (zero pills) */}
              <div className="flex flex-wrap items-center gap-2 text-xs short:text-[11px] text-amber-300/95 font-medium">
                <span>عملیات دفاع هوایی سه‌بعدی</span>
                <span className="text-slate-500" aria-hidden="true">·</span>
                <span className="text-slate-300">۴۰ مرحله در ۴ اقلیم</span>
                {resumeStage.isNightStage && (
                  <>
                    <span className="text-slate-500" aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-sky-300">
                      <Moon className="w-3 h-3" />
                      عملیات شبانه
                    </span>
                  </>
                )}
              </div>

              <h1
                className="text-3xl sm:text-5xl short:text-2xl font-bold text-white leading-tight tracking-tight"
                style={{ textWrap: 'balance' }}
              >
                آسمان پایگاه را زیر سپر آتش نگه دارید
              </h1>

              <p className="text-sm sm:text-base short:text-xs text-slate-300 leading-relaxed max-w-lg">
                شبکه راداری چندلایه برپا کنید، سامانه‌های موشکی و لیزری را هوشمندانه بچینید و با پشتیبانی اسکادران جنگنده خودی در برابر یورش پهپادها، موشک‌های کروز و باس‌های هوایی ایستادگی کنید.
              </p>

              {/* Action Hierarchy: 1 Dominant Primary CTA + 2 Calm Secondary Actions */}
              <div className="flex flex-wrap items-center gap-3 short:gap-2 pt-1">
                <button
                  onClick={onContinueCampaign}
                  className="px-6 py-3 short:px-4 short:py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm short:text-xs flex items-center gap-2 shadow-lg shadow-amber-500/15 transition-all active:scale-[0.98] whitespace-nowrap cursor-pointer"
                >
                  <Play className="w-4 h-4 short:w-3.5 short:h-3.5 fill-current" />
                  <span>
                    {hasProgress
                      ? `ادامه مرحله ${resumeStage.stageNumber}: ${resumeStage.titleFa}`
                      : `آغاز مرحله ۱: ${resumeStage.titleFa}`}
                  </span>
                </button>

                <button
                  onClick={() => onOpenRoadmap()}
                  className="px-4 py-3 short:px-3.5 short:py-2 rounded-xl bg-white/8 hover:bg-white/14 border border-white/15 text-white font-semibold text-xs sm:text-sm short:text-xs flex items-center gap-2 backdrop-blur-sm transition-colors whitespace-nowrap cursor-pointer"
                >
                  <MapIcon className="w-4 h-4 short:w-3.5 short:h-3.5 text-amber-300" />
                  <span>نقشه عملیات</span>
                </button>

                <button
                  onClick={() => onStartEndless(activeBiome)}
                  className="px-4 py-3 short:px-3.5 short:py-2 rounded-xl bg-white/5 hover:bg-white/12 border border-white/12 text-slate-200 hover:text-white font-medium text-xs sm:text-sm short:text-xs flex items-center gap-2 backdrop-blur-sm transition-colors whitespace-nowrap cursor-pointer"
                >
                  <InfinityIcon className="w-4 h-4 short:w-3.5 short:h-3.5 text-rose-400" />
                  <span>بقای بی‌نهایت</span>
                </button>
              </div>

              {/* Real Commander Career Metrics (Unboxed, Tabular Numerals, Hairline Separators) */}
              <div className="pt-4 short:pt-2 border-t border-white/10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs short:text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-slate-400">ستاره‌ها:</span>
                  <span className="font-mono font-bold text-white tabular-nums">{totalStars}/120</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Radar className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-slate-400">مرحله باز:</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {profile.highestUnlocked}/40
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-400">شکار هوایی:</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {profile.stats.totalKills}
                  </span>
                </div>
                {bestEndlessWave > 0 && (
                  <div className="flex items-center gap-1.5">
                    <InfinityIcon className="w-3.5 h-3.5 text-rose-400" />
                    <span className="text-slate-400">رکورد بقا:</span>
                    <span className="font-mono font-bold text-white tabular-nums">
                      موج {bestEndlessWave}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 3 Visual Operation Theaters + Quick Command Links */}
        <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9 short:py-4 space-y-6 short:space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl short:text-sm font-bold text-white">
                جبهه‌های عملیات داستانی
              </h2>
              <p className="text-xs short:text-[11px] text-slate-400 mt-1 short:mt-0.5">
                هر جبهه را انتخاب کنید تا نقشه تاکتیکی مراحل، فهرست تهدیدها و جزئیات مأموریت نمایش داده شود
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs short:text-[11px]">
              <button
                onClick={onOpenTechLab}
                className="flex items-center gap-1.5 text-sky-300 hover:text-sky-200 font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>آزمایشگاه فناوری</span>
                <span className="font-mono text-amber-300 tabular-nums">({availableStars}★)</span>
              </button>
              <span className="text-slate-700" aria-hidden="true">|</span>
              <button
                onClick={onOpenUnits}
                className="flex items-center gap-1.5 text-slate-300 hover:text-white font-medium transition-colors whitespace-nowrap cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                <span>دایرةالمعارف واحدها</span>
              </button>
            </div>
          </div>

          {/* 4 Bespoke Illustrated Theater Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 short:gap-3">
            {CAMPAIGN_CHAPTERS.map((chap) => {
              const Icon = CHAPTER_ICONS[chap.chapter];
              const art = THEATER_ARTWORK[chap.biome];
              const chapStages = CAMPAIGN_STAGES.filter((s) => s.chapter === chap.chapter);
              const chapStars = chapStages.reduce(
                (sum, s) => sum + (profile.starsByStage[s.stageNumber] ?? 0),
                0
              );
              const clearedCount = chapStages.filter(
                (s) => (profile.starsByStage[s.stageNumber] ?? 0) > 0
              ).length;
              const unlocked = profile.highestUnlocked >= chap.stageRange[0];
              const progressPct = Math.round((clearedCount / chapStages.length) * 100);

              return (
                <button
                  key={chap.chapter}
                  onClick={() => onOpenRoadmap(chap.chapter)}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 hover:border-white/25 bg-[#0c1322] text-right transition-all duration-200 cursor-pointer flex flex-col"
                >
                  {/* 16:9 Theater Illustration with Measured Scrim */}
                  <div
                    className={`relative aspect-[16/9] short:aspect-[21/9] w-full overflow-hidden bg-gradient-to-br ${art.fallbackGradient}`}
                  >
                    {!failedBiomes[chap.biome] && (
                      <img
                        src={art.image}
                        alt={art.altFa}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedBiomes((prev) => ({ ...prev, [chap.biome]: true }))
                        }
                        className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                          unlocked ? 'opacity-90' : 'opacity-45 grayscale-[35%]'
                        }`}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0c1322] via-[#0c1322]/35 to-transparent" />

                    {/* Top corner clean unboxed sector indicator */}
                    <div className="absolute top-3 right-3 left-3 flex items-center justify-between text-[11px] font-medium">
                      <span className="inline-flex items-center gap-1.5 text-white/90 drop-shadow">
                        <Icon className={`w-3.5 h-3.5 ${art.accentText}`} />
                        <span>{art.sectorLabelFa}</span>
                      </span>
                      <span className="font-mono tabular-nums text-amber-300 flex items-center gap-1 drop-shadow">
                        {unlocked ? (
                          <>
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            {chapStars}/30
                          </>
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-slate-300" />
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 short:p-2.5 flex-1 flex flex-col justify-between gap-3 short:gap-1.5">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm short:text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                          {chap.titleFa}
                        </h3>
                        <ChevronLeft className="w-4 h-4 text-slate-500 group-hover:text-amber-300 group-hover:-translate-x-0.5 transition-all shrink-0" />
                      </div>
                      <p className="text-xs short:text-[11px] text-slate-400 mt-1 line-clamp-1">
                        {chap.subtitleFa}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                        <span>
                          مراحل {chap.stageRange[0]} تا {chap.stageRange[1]}
                        </span>
                        <span className="text-slate-300">
                          {clearedCount}/{chapStages.length} تکمیل‌شده
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-white/8 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${art.accentBar}`}
                          style={{ width: `${Math.max(unlocked ? 6 : 0, progressPct)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
};
