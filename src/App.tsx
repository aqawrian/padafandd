/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, useState, useCallback, useMemo, useEffect } from 'react';
import { Viewport3D } from './components/Viewport3D';
import { MainMenuPage } from './components/MainMenuPage';
import { CampaignRoadmap } from './components/CampaignRoadmap';
import { TechLabModal } from './components/TechLabModal';
import { UnitDatabase } from './components/UnitDatabase';
import { DefenseTower, EnemyUnit, GameMode, MapBiome, SaveProfileV2, TechId } from './types/game';
import { BIOME_CONFIGS } from './utils/mapBuilder';
import { CAMPAIGN_STAGES } from './data/campaignStages';
import {
  DEFAULT_TECH_LEVELS,
  TECH_DOCTRINES,
  computeSpentStars,
  computeTechModifiers,
  computeTotalEarnedStars,
  createEndlessStageConfig,
  evaluateAchievements,
  loadSaveProfileV2,
  saveProfileV2,
} from './data/techAndSave';
import { soundManager } from './utils/audio';
import {
  ArrowRight,
  Box,
  Cpu,
  Database,
  Home,
  Infinity as InfinityIcon,
  Map as MapIcon,
  Mountain,
  Shield,
  Smartphone,
  Snowflake,
  Star,
  Sun,
  Waves,
  X,
  Maximize2,
} from 'lucide-react';

type ActiveView = 'home' | 'viewport' | 'units';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ViewportErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: Readonly<ErrorBoundaryProps>;
  declare setState: (next: Partial<ErrorBoundaryState>) => void;
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="w-full h-full bg-[#090d16] flex flex-col items-center justify-center p-6 text-center gap-4"
        >
          <Shield className="w-10 h-10 text-amber-400" />
          <h2 className="text-lg font-bold text-white">خطای موقت در موتور گرافیکی</h2>
          <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
            پیشرفت شما در مراحل و آزمایشگاه فناوری ذخیره شده است. برای ادامه نبرد روی دکمه زیر کلیک کنید.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
          >
            بارگذاری مجدد میدان نبرد
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [currentView, setCurrentView] = useState<ActiveView>('home');
  const [selectedUnit, setSelectedUnit] = useState<DefenseTower | EnemyUnit | null>(null);
  const [profile, setProfile] = useState<SaveProfileV2>(() => loadSaveProfileV2());
  const [gameMode, setGameMode] = useState<GameMode>('campaign');
  const [currentStageNumber, setCurrentStageNumber] = useState<number>(() => {
    const saved = loadSaveProfileV2();
    return Math.min(40, Math.max(1, saved.highestUnlocked));
  });
  const [biome, setBiome] = useState<MapBiome>(() => {
    const saved = loadSaveProfileV2();
    const stg = CAMPAIGN_STAGES[Math.min(39, Math.max(0, saved.highestUnlocked - 1))] ?? CAMPAIGN_STAGES[0];
    return stg.biome;
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [roadmapChapter, setRoadmapChapter] = useState<1 | 2 | 3 | 4 | undefined>(undefined);
  const [techLabOpen, setTechLabOpen] = useState(false);
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  const [portraitDismissed, setPortraitDismissed] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const portraitPhone = w < 768 && h > w;
      setIsMobilePortrait(portraitPhone);
      if (!portraitPhone) {
        setPortraitDismissed(false);
      }
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const handleRequestLandscapeFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      const orient = screen.orientation as unknown as { lock?: (mode: string) => Promise<void> };
      if (orient && typeof orient.lock === 'function') {
        await orient.lock('landscape').catch(() => {});
      }
    } catch {
      // Orientation lock or fullscreen unavailable on this browser
    }
  };

  const totalStars = useMemo(() => computeTotalEarnedStars(profile.starsByStage), [profile.starsByStage]);
  const spentStars = useMemo(() => computeSpentStars(profile.techLevels), [profile.techLevels]);
  const availableStars = Math.max(0, totalStars - spentStars);
  const techModifiers = useMemo(() => computeTechModifiers(profile.techLevels), [profile.techLevels]);

  const activeStageConfig = useMemo(() => {
    if (gameMode === 'endless') {
      return createEndlessStageConfig(biome);
    }
    return CAMPAIGN_STAGES[currentStageNumber - 1] ?? CAMPAIGN_STAGES[0];
  }, [gameMode, biome, currentStageNumber]);

  const endlessBestWave = profile.endlessRecords[biome]?.bestWave ?? 0;

  const commitProfile = useCallback((updater: (prev: SaveProfileV2) => SaveProfileV2) => {
    setProfile((prev) => {
      const updated = updater(prev);
      const withAchievements: SaveProfileV2 = {
        ...updated,
        achievements: evaluateAchievements(updated),
      };
      saveProfileV2(withAchievements);
      return withAchievements;
    });
  }, []);

  const navigateTo = (view: ActiveView) => {
    setCurrentView(view);
    setMenuOpen(false);
  };

  const handleOpenRoadmap = useCallback((chapter?: 1 | 2 | 3 | 4) => {
    setRoadmapChapter(chapter);
    setRoadmapOpen(true);
  }, []);

  const handleContinueCampaign = useCallback(() => {
    soundManager.unlock();
    const targetStage = CAMPAIGN_STAGES[Math.min(39, Math.max(0, currentStageNumber - 1))] ?? CAMPAIGN_STAGES[0];
    setGameMode('campaign');
    setCurrentStageNumber(targetStage.stageNumber);
    setBiome(targetStage.biome);
    setCurrentView('viewport');
  }, [currentStageNumber]);

  const handleSelectStage = useCallback((stageNum: number) => {
    soundManager.unlock();
    const target = CAMPAIGN_STAGES[stageNum - 1];
    if (!target) return;
    setGameMode('campaign');
    setCurrentStageNumber(target.stageNumber);
    setBiome(target.biome);
    setCurrentView('viewport');
  }, []);

  const handleStartEndless = useCallback((targetBiome: MapBiome) => {
    soundManager.unlock();
    setGameMode('endless');
    setBiome(targetBiome);
    setCurrentView('viewport');
    setMenuOpen(false);
    setRoadmapOpen(false);
  }, []);

  const handleStageComplete = useCallback(
    (stageNumber: number, stars: number) => {
      commitProfile((prev) => {
        const prevStars = prev.starsByStage[stageNumber] ?? 0;
        return {
          ...prev,
          highestUnlocked: Math.min(40, Math.max(prev.highestUnlocked, stageNumber + 1)),
          starsByStage: {
            ...prev.starsByStage,
            [stageNumber]: Math.max(prevStars, stars),
          },
        };
      });
    },
    [commitProfile]
  );

  const handleRecordKill = useCallback(
    (isBoss: boolean) => {
      commitProfile((prev) => ({
        ...prev,
        stats: {
          ...prev.stats,
          totalKills: prev.stats.totalKills + 1,
          bossesKilled: prev.stats.bossesKilled + (isBoss ? 1 : 0),
        },
      }));
    },
    [commitProfile]
  );

  const handleRecordCapScramble = useCallback(() => {
    commitProfile((prev) => ({
      ...prev,
      stats: {
        ...prev.stats,
        capScrambles: prev.stats.capScrambles + 1,
      },
    }));
  }, [commitProfile]);

  const handleEndlessRecordUpdate = useCallback(
    (targetBiome: MapBiome, wave: number, score: number) => {
      commitProfile((prev) => {
        const cur = prev.endlessRecords[targetBiome] ?? { bestWave: 0, bestScore: 0 };
        if (wave <= cur.bestWave && score <= cur.bestScore) return prev;
        return {
          ...prev,
          endlessRecords: {
            ...prev.endlessRecords,
            [targetBiome]: {
              bestWave: Math.max(cur.bestWave, wave),
              bestScore: Math.max(cur.bestScore, score),
            },
          },
        };
      });
    },
    [commitProfile]
  );

  const handleUpgradeTech = useCallback(
    (techId: TechId) => {
      const doc = TECH_DOCTRINES.find((d) => d.id === techId);
      if (!doc) return;
      commitProfile((prev) => {
        const curLevel = prev.techLevels[techId] ?? 0;
        if (curLevel >= 3) return prev;
        const cost = doc.costs[curLevel];
        const earned = computeTotalEarnedStars(prev.starsByStage);
        const spent = computeSpentStars(prev.techLevels);
        if (earned - spent < cost) return prev;
        soundManager.playTechUnlock();
        return {
          ...prev,
          techLevels: {
            ...prev.techLevels,
            [techId]: curLevel + 1,
          },
        };
      });
    },
    [commitProfile]
  );

  const handleResetTech = useCallback(() => {
    soundManager.playBuild();
    commitProfile((prev) => ({
      ...prev,
      techLevels: { ...DEFAULT_TECH_LEVELS },
    }));
  }, [commitProfile]);

  const handleNextStage = useCallback(() => {
    if (currentStageNumber < CAMPAIGN_STAGES.length) {
      handleSelectStage(currentStageNumber + 1);
    }
  }, [currentStageNumber, handleSelectStage]);

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden bg-[#090d16] text-slate-100">
      {/* Main Landing Page OR Full-Screen 3D Game Viewport OR Secondary Reference Views */}
      {currentView === 'home' ? (
        <MainMenuPage
          profile={profile}
          currentStageNumber={currentStageNumber}
          activeBiome={biome}
          onContinueCampaign={handleContinueCampaign}
          onOpenRoadmap={handleOpenRoadmap}
          onStartEndless={handleStartEndless}
          onOpenTechLab={() => setTechLabOpen(true)}
          onOpenUnits={() => setCurrentView('units')}
        />
      ) : currentView === 'viewport' ? (
        <ViewportErrorBoundary>
          <Viewport3D
            gameMode={gameMode}
            stageConfig={activeStageConfig}
            techModifiers={techModifiers}
            availableStars={availableStars}
            endlessBestWave={endlessBestWave}
            onSelectUnit={setSelectedUnit}
            selectedUnitId={selectedUnit?.id}
            onOpenMenu={() => setMenuOpen(true)}
            onOpenRoadmap={() => handleOpenRoadmap()}
            onOpenTechLab={() => setTechLabOpen(true)}
            onStageComplete={handleStageComplete}
            onRecordKill={handleRecordKill}
            onRecordCapScramble={handleRecordCapScramble}
            onEndlessRecordUpdate={handleEndlessRecordUpdate}
            onNextStage={handleNextStage}
            hasNextStage={gameMode === 'campaign' && currentStageNumber < CAMPAIGN_STAGES.length}
            biome={biome}
            onChangeBiome={setBiome}
          />
        </ViewportErrorBoundary>
      ) : (
        <div className="flex flex-col w-full h-full">
          <header
            dir="rtl"
            className="flex items-center justify-between gap-3 sm:gap-6 safe-x-padding sm:px-5 py-2.5 short:py-1.5 bg-[#0c1220] border-b border-white/10 shrink-0"
          >
            <button
              onClick={() => setCurrentView('home')}
              className="flex items-center gap-2 whitespace-nowrap shrink-0 hover:opacity-85 transition-opacity cursor-pointer"
            >
              <Shield className="w-5 h-5 short:w-4 short:h-4 text-amber-400" />
              <span className="text-sm short:text-xs font-bold text-white hidden sm:inline">پدافند هوایی</span>
            </button>

            <nav className="flex items-center gap-4 sm:gap-6 text-xs short:text-[11px] font-medium text-slate-400 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setCurrentView('home')}
                className="py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer hover:text-slate-200"
              >
                صفحه اصلی
              </button>
              <button
                onClick={() => setCurrentView('units')}
                className="py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer text-white border-b-2 border-amber-400"
              >
                واحدها و تجهیزات
              </button>
              <button
                onClick={() => setTechLabOpen(true)}
                className="py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer hover:text-slate-200"
              >
                آزمایشگاه فناوری
              </button>
            </nav>

            <button
              onClick={() => setCurrentView('viewport')}
              className="px-3 py-1.5 short:px-2.5 short:py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs short:text-[11px] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>بازگشت به نبرد</span>
            </button>
          </header>

          <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <UnitDatabase
              onSelectUnit={(unit) => {
                setSelectedUnit(unit);
                setCurrentView('viewport');
              }}
            />
          </main>
        </div>
      )}

      {/* 30-Stage 3-Chapter Illustrated Tactical Campaign Roadmap & Endless Mode Overlay */}
      {roadmapOpen && (
        <CampaignRoadmap
          currentStageNumber={currentStageNumber}
          initialChapter={roadmapChapter}
          profile={profile}
          onSelectStage={handleSelectStage}
          onStartEndless={handleStartEndless}
          onOpenTechLab={() => {
            setRoadmapOpen(false);
            setTechLabOpen(true);
          }}
          onClose={() => setRoadmapOpen(false)}
        />
      )}

      {/* Star-Powered Command Tech Lab & Achievements Overlay */}
      {techLabOpen && (
        <TechLabModal
          profile={profile}
          onUpgradeTech={handleUpgradeTech}
          onResetTech={handleResetTech}
          onClose={() => setTechLabOpen(false)}
        />
      )}

      {/* Slide-Over Navigation & Map Drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="بستن منو"
            onClick={() => setMenuOpen(false)}
            className="flex-1 bg-black/60 cursor-default"
          />

          <aside
            dir="rtl"
            className="w-72 short:w-[348px] max-w-[88vw] h-full bg-[#0c1220] border-r border-white/10 shadow-2xl flex flex-col justify-between safe-drawer-padding overflow-y-auto"
          >
            <div>
              <div className="flex items-center justify-between pb-4 short:pb-2 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <Shield className="w-5 h-5 short:w-4 short:h-4 text-amber-400" />
                  <span className="font-bold text-sm short:text-xs text-white">پدافند هوایی</span>
                </div>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="p-2 short:p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  aria-label="بستن منو"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation Links (2-Column Zero-Scroll Grid on Landscape Mobile!) */}
              <div className="mt-4 short:mt-2.5 space-y-1.5 short:space-y-0 short:grid short:grid-cols-2 short:gap-1.5">
                <button
                  onClick={() => navigateTo('home')}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 short:px-2.5 short:py-2 rounded-xl short:rounded-lg text-xs short:text-[11px] font-semibold text-slate-200 hover:bg-white/8 transition-colors cursor-pointer"
                >
                  <Home className="w-4 h-4 short:w-3.5 short:h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">صفحه اصلی</span>
                </button>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    handleOpenRoadmap();
                  }}
                  className="w-full flex items-center justify-between gap-1 px-3 py-2.5 short:px-2.5 short:py-2 rounded-xl short:rounded-lg text-xs short:text-[11px] font-semibold bg-amber-500/12 text-amber-300 hover:bg-amber-500/20 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <MapIcon className="w-4 h-4 short:w-3.5 short:h-3.5 shrink-0" />
                    <span className="truncate">مراحل</span>
                  </span>
                  <span className="flex items-center gap-0.5 font-mono text-[10px] tabular-nums shrink-0">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    {totalStars}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setTechLabOpen(true);
                  }}
                  className="w-full flex items-center justify-between gap-1 px-3 py-2.5 short:px-2.5 short:py-2 rounded-xl short:rounded-lg text-xs short:text-[11px] font-semibold bg-sky-500/12 text-sky-300 hover:bg-sky-500/20 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Cpu className="w-4 h-4 short:w-3.5 short:h-3.5 shrink-0" />
                    <span className="truncate">فناوری</span>
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-amber-300 shrink-0">
                    ★{availableStars}
                  </span>
                </button>

                <button
                  onClick={() => handleStartEndless(biome)}
                  className="w-full flex items-center justify-between gap-1 px-3 py-2.5 short:px-2.5 short:py-2 rounded-xl short:rounded-lg text-xs short:text-[11px] font-semibold bg-orange-500/12 text-orange-300 hover:bg-orange-500/20 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <InfinityIcon className="w-4 h-4 short:w-3.5 short:h-3.5 shrink-0" />
                    <span className="truncate">بقا</span>
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-orange-200/80 shrink-0">
                    {endlessBestWave}
                  </span>
                </button>

                <button
                  onClick={() => navigateTo('viewport')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 short:px-2.5 short:py-2 rounded-xl short:rounded-lg text-xs short:text-[11px] font-medium transition-colors cursor-pointer ${
                    currentView === 'viewport'
                      ? 'bg-white/10 text-white'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Box className="w-4 h-4 short:w-3.5 short:h-3.5 shrink-0" />
                  <span className="truncate">نبرد سه‌بعدی</span>
                </button>

                <button
                  onClick={() => navigateTo('units')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 short:px-2.5 short:py-2 rounded-xl short:rounded-lg text-xs short:text-[11px] font-medium transition-colors cursor-pointer ${
                    currentView === 'units'
                      ? 'bg-white/10 text-white'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Database className="w-4 h-4 short:w-3.5 short:h-3.5 shrink-0" />
                  <span className="truncate">تجهیزات</span>
                </button>
              </div>

              {/* Quick Map Biome Switcher (2x2 Grid on Landscape Mobile!) */}
              <div className="mt-4 short:mt-2.5 pt-3.5 short:pt-2 border-t border-white/10">
                <span className="text-[11px] short:text-[10px] font-medium text-slate-400 block mb-2 short:mb-1.5 px-1">
                  تغییر ظاهر نقشه
                </span>
                <div className="space-y-1 short:space-y-0 short:grid short:grid-cols-2 short:gap-1.5">
                  {(
                    [
                      { id: 'alpine' as MapBiome, Icon: Mountain },
                      { id: 'coastal' as MapBiome, Icon: Waves },
                      { id: 'desert' as MapBiome, Icon: Sun },
                      { id: 'arctic' as MapBiome, Icon: Snowflake },
                    ]
                  ).map(({ id, Icon }) => {
                    const cfg = BIOME_CONFIGS[id];
                    const active = biome === id;
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          setBiome(id);
                          navigateTo('viewport');
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 short:px-2.5 short:py-1.5 rounded-xl short:rounded-lg text-xs short:text-[11px] transition-colors cursor-pointer ${
                          active
                            ? 'bg-white/10 text-white font-semibold border border-amber-400/35'
                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <Icon className="w-4 h-4 short:w-3.5 short:h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">{cfg.labelFa}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 short:pt-2 mt-3 short:mt-2 border-t border-white/10 text-[11px] short:text-[10px] text-slate-500 leading-relaxed">
              کنترل لمسی: ۱ انگشت چرخش · ۲ انگشت زوم · لمس کوتاه استقرار برجک
            </div>
          </aside>
        </div>
      )}

      {/* Mobile Portrait -> Landscape Rotation Prompt (active only inside 3D Battlefield) */}
      {currentView === 'viewport' && isMobilePortrait && !portraitDismissed && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[70] bg-[#070b14]/96 flex flex-col items-center justify-center p-6 text-center gap-5"
        >
          <div className="w-20 h-20 rounded-2xl bg-amber-500/12 border border-amber-400/35 flex items-center justify-center shadow-2xl">
            <Smartphone className="w-10 h-10 text-amber-400 animate-phone-rotate" />
          </div>

          <div className="space-y-2 max-w-xs">
            <h2 className="text-lg font-bold text-white">گوشی را به حالت افقی بچرخانید</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              میدان نبرد سه‌بعدی، رادار تاکتیکی و نوار ساخت سامانه‌های پدافند هوایی برای نمایش افقی (Landscape) طراحی شده‌اند.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 w-full max-w-xs">
            <button
              onClick={handleRequestLandscapeFullscreen}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
              <span>تمام‌صفحه و قفل حالت افقی</span>
            </button>

            <button
              onClick={() => setPortraitDismissed(true)}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            >
              ادامه در حالت عمودی
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
