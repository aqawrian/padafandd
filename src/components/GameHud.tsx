import React, { useState, useEffect } from 'react';
import {
  DefenseTower,
  ActiveTower,
  MapBiome,
  StageConfig,
  GameMode,
  TargetingPriority,
  RadarSnapshot,
  BaseFacilityStatus,
  DefeatReason,
} from '../types/game';
import { DEFENSE_TOWERS, TOWER_TIER_META } from '../data/gameData';
import { BIOME_CONFIGS } from '../utils/mapBuilder';
import { TacticalRadar } from './TacticalRadar';
import {
  Shield,
  Coins,
  Play,
  Pause,
  FastForward,
  Volume2,
  VolumeX,
  Music,
  Crosshair,
  Radio,
  Zap,
  ArrowUpCircle,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Layers,
  Mountain,
  Waves,
  Sun,
  Menu,
  ChevronDown,
  ChevronUp,
  Eye,
  X,
  Target,
  Flame,
  Map as MapIcon,
  Star,
  Wrench,
  ChevronLeft,
  Cpu,
  Infinity as InfinityIcon,
  Maximize2,
  Minimize2,
  Plane,
  Moon,
  Snowflake,
  ZoomIn,
  ZoomOut,
  Compass,
  ShieldAlert,
  Fuel,
} from 'lucide-react';

export interface KillCallout {
  id: string;
  x: number;
  y: number;
  text: string;
  isBoss: boolean;
}

interface GameHudProps {
  gameMode: GameMode;
  stageConfig: StageConfig;
  baseHp: number;
  maxBaseHp: number;
  cash: number;
  currentWave: number;
  totalWaves: number;
  waveState: 'idle' | 'spawning' | 'in_progress' | 'wave_cleared' | 'victory' | 'defeat';
  enemiesRemaining: number;
  wavePreviewSummary: string;
  endlessScore: number;
  endlessBestWave: number;
  availableStars: number;
  biome: MapBiome;
  onChangeBiome: (biome: MapBiome) => void;
  selectedTowerToBuild: DefenseTower | null;
  onSelectTowerToBuild: (tower: DefenseTower | null) => void;
  selectedPlacedTower: ActiveTower | null;
  onUpgradeTower: (instanceId: string) => void;
  onSellTower: (instanceId: string) => void;
  onChangeTowerPriority: (instanceId: string, priority: TargetingPriority) => void;
  onCloseInspect: () => void;
  onStartNextWave: () => void;
  gameSpeed: number;
  onSetGameSpeed: (speed: number) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  musicEnabled: boolean;
  onToggleMusic: () => void;
  onResetGame: () => void;
  onNextStage: () => void;
  onOpenRoadmap: () => void;
  onOpenTechLab: () => void;
  earnedStars: number;
  hasNextStage: boolean;
  cameraMode: 'isometric' | 'topdown';
  onSetCameraView: (mode: 'isometric' | 'topdown') => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetCamera: () => void;
  showRangeRings: boolean;
  onToggleRangeRings: () => void;
  onOpenMenu: () => void;
  empCooldownLeft: number;
  empMaxCooldown: number;
  onTriggerEmp: () => void;
  repairCooldownLeft: number;
  repairMaxCooldown: number;
  onTriggerRepair: () => void;
  capCooldownLeft: number;
  capMaxCooldown: number;
  capActiveLeft: number;
  onTriggerCap: () => void;
  isNightRaid: boolean;
  facilities: BaseFacilityStatus[];
  defeatReason: DefeatReason;
  tacticalAlert: string | null;
  radarSnapshotRef: React.MutableRefObject<RadarSnapshot>;
  killCallouts: KillCallout[];
}

const TOWER_SHORT_NAMES: Record<string, string> = {
  ciws_light: 'فالانکس',
  radar_uplink: 'رادار',
  avenger_stinger: 'استینگر',
  pantsir_point: 'پانتسیر',
  iron_dome_pod: 'گنبد نقطه‌ای',
  system_358: 'سامانه ۳۵۸',
  patriot_battery: 'پاتریوت',
  s400_thaad: 'اس-۴۰۰',
};

const PRIORITY_OPTIONS: { id: TargetingPriority; label: string }[] = [
  { id: 'closest', label: 'نزدیک‌ترین' },
  { id: 'strongest', label: 'قوی‌ترین' },
  { id: 'fastest', label: 'سریع‌ترین' },
  { id: 'boss_first', label: 'ضدباس' },
];

const BIOME_LIST: { id: MapBiome; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'alpine', label: BIOME_CONFIGS.alpine.labelFa, Icon: Mountain },
  { id: 'coastal', label: BIOME_CONFIGS.coastal.labelFa, Icon: Waves },
  { id: 'desert', label: BIOME_CONFIGS.desert.labelFa, Icon: Sun },
  { id: 'arctic', label: BIOME_CONFIGS.arctic.labelFa, Icon: Snowflake },
];

function TowerGlyph({ shape, className }: { shape: DefenseTower['shape']; className?: string }) {
  switch (shape) {
    case 'gatling_box':
      return <Crosshair className={className} />;
    case 's400_launcher':
      return <Shield className={className} />;
    case 'radar_dish':
      return <Radio className={className} />;
    case 'silo_vertical':
    case 'iron_dome_pod':
      return <Flame className={className} />;
    default:
      return <Target className={className} />;
  }
}

export const GameHud: React.FC<GameHudProps> = ({
  gameMode,
  stageConfig,
  baseHp,
  maxBaseHp,
  cash,
  currentWave,
  totalWaves,
  waveState,
  enemiesRemaining,
  wavePreviewSummary,
  endlessScore,
  endlessBestWave,
  availableStars,
  biome,
  onChangeBiome,
  selectedTowerToBuild,
  onSelectTowerToBuild,
  selectedPlacedTower,
  onUpgradeTower,
  onSellTower,
  onChangeTowerPriority,
  onCloseInspect,
  onStartNextWave,
  gameSpeed,
  onSetGameSpeed,
  soundEnabled,
  onToggleSound,
  musicEnabled,
  onToggleMusic,
  onResetGame,
  onNextStage,
  onOpenRoadmap,
  onOpenTechLab,
  earnedStars,
  hasNextStage,
  cameraMode,
  onSetCameraView,
  onZoomIn,
  onZoomOut,
  onResetCamera,
  showRangeRings,
  onToggleRangeRings,
  onOpenMenu,
  empCooldownLeft,
  empMaxCooldown,
  onTriggerEmp,
  repairCooldownLeft,
  repairMaxCooldown,
  onTriggerRepair,
  capCooldownLeft,
  capMaxCooldown,
  capActiveLeft,
  onTriggerCap,
  isNightRaid,
  facilities,
  defeatReason,
  tacticalAlert,
  radarSnapshotRef,
  killCallouts,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [hoveredTower, setHoveredTower] = useState<DefenseTower | null>(null);
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFs);
    return () => document.removeEventListener('fullscreenchange', syncFs);
  }, []);

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
        const orient = screen.orientation as unknown as { lock?: (mode: string) => Promise<void> };
        if (orient && typeof orient.lock === 'function') {
          await orient.lock('landscape').catch(() => {});
        }
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen or orientation lock not supported in embedded/iOS Safari context
    }
  };

  // Keyboard shortcuts: Esc cancel, H toggle dock, Q EMP, E Repair, F Scramble CAP
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSelectTowerToBuild(null);
        onCloseInspect();
      } else if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'q' || e.key === 'Q') {
        onTriggerEmp();
      } else if (e.key === 'e' || e.key === 'E') {
        onTriggerRepair();
      } else if (e.key === 'f' || e.key === 'F') {
        onTriggerCap();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    onSelectTowerToBuild,
    onCloseInspect,
    onTriggerEmp,
    onTriggerRepair,
    onTriggerCap,
  ]);

  const hpPercent = Math.max(0, Math.min(100, (baseHp / Math.max(1, maxBaseHp)) * 100));
  const hpBarColor =
    hpPercent > 60 ? 'bg-emerald-400' : hpPercent > 28 ? 'bg-amber-400' : 'bg-rose-500';

  const upgradeCost = selectedPlacedTower
    ? Math.round(selectedPlacedTower.tower.buildCost * (0.62 + selectedPlacedTower.level * 0.45))
    : 0;
  const sellRefund = selectedPlacedTower
    ? Math.round(selectedPlacedTower.tower.buildCost * 0.65 * (1 + (selectedPlacedTower.level - 1) * 0.5))
    : 0;
  const canUpgrade = selectedPlacedTower ? cash >= upgradeCost && selectedPlacedTower.level < 3 : false;

  const isWaveActive = waveState === 'spawning' || waveState === 'in_progress';
  const canLaunchWave =
    (waveState === 'idle' || waveState === 'wave_cleared') &&
    (gameMode === 'endless' || currentWave <= totalWaves);
  const empReady = empCooldownLeft <= 0.05;
  const repairReady = repairCooldownLeft <= 0.05;
  const capActive = capActiveLeft > 0.05;
  const capReady = capCooldownLeft <= 0.05 && !capActive;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between safe-hud-padding select-none overflow-hidden z-20">
      {/* Floating Kill-Bounty Callouts (Lightweight & Capped) */}
      {killCallouts.map((c) => (
        <div
          key={c.id}
          className={`fixed pointer-events-none font-mono font-bold tabular-nums drop-shadow-md transition-opacity ${
            c.isBoss ? 'text-sm short:text-xs text-amber-300' : 'text-[11px] short:text-[10px] text-emerald-300'
          }`}
          style={{
            left: `${c.x}px`,
            top: `${c.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {c.text}
        </div>
      ))}

      {/* Live Tactical Radar + Right-Edge One-Thumb Camera Controls (Landscape Mobile) */}
      <div className="absolute bottom-4 right-4 short:bottom-auto short:top-[max(3.15rem,calc(env(safe-area-inset-top)+2.75rem))] short:right-[max(0.55rem,env(safe-area-inset-right))] z-10 pointer-events-none flex flex-col items-end gap-1.5">
        <TacticalRadar snapshotRef={radarSnapshotRef} />

        {/* Landscape Mobile Quick Camera Zoom & Recenter Controls (Right Thumb Zone) */}
        <div className="hidden short:flex pointer-events-auto flex-col items-center gap-1 p-1 rounded-xl bg-[#0a0f1c]/88 border border-white/10 shadow-xl text-slate-200">
          <button
            type="button"
            onClick={onZoomIn}
            title="بزرگ‌نمایی دوربین"
            aria-label="بزرگ‌نمایی"
            className="w-8 h-8 rounded-lg hover:bg-white/10 active:bg-white/15 active:scale-95 flex items-center justify-center transition-all cursor-pointer"
          >
            <ZoomIn className="w-4 h-4 text-sky-300" />
          </button>
          <button
            type="button"
            onClick={onZoomOut}
            title="کوچک‌نمایی دوربین"
            aria-label="کوچک‌نمایی"
            className="w-8 h-8 rounded-lg hover:bg-white/10 active:bg-white/15 active:scale-95 flex items-center justify-center transition-all cursor-pointer"
          >
            <ZoomOut className="w-4 h-4 text-slate-300" />
          </button>
          <button
            type="button"
            onClick={onResetCamera}
            title="بازگردانی زاویه دوربین"
            aria-label="بازگردانی دوربین"
            className="w-8 h-8 rounded-lg hover:bg-white/10 active:bg-white/15 active:scale-95 flex items-center justify-center transition-all cursor-pointer border-t border-white/10 pt-0.5"
          >
            <Compass className="w-3.5 h-3.5 text-amber-300" />
          </button>
        </div>
      </div>

      {/* Landscape Mobile Left-Thumb Pinned Commander Tactical Skills (Always Visible — Never Scrolled Off-Screen!) */}
      <div
        dir="rtl"
        className="hidden short:flex absolute left-[max(0.55rem,env(safe-area-inset-left))] top-1/2 -translate-y-1/2 z-10 pointer-events-auto flex-col gap-1.5 p-1 rounded-xl bg-[#0a0f1c]/88 border border-white/10 shadow-2xl"
      >
        {/* EMP (Left Thumb) */}
        <button
          disabled={!empReady}
          onClick={onTriggerEmp}
          title="پالس EMP"
          className={`relative overflow-hidden w-12 h-11 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 cursor-pointer ${
            empReady
              ? 'bg-sky-500/18 border-sky-400/45 text-sky-200'
              : 'bg-white/[0.02] border-white/5 text-slate-500 cursor-not-allowed'
          }`}
        >
          {!empReady && (
            <div
              className="absolute inset-x-0 bottom-0 bg-sky-500/20 pointer-events-none"
              style={{ height: `${Math.max(0, (1 - empCooldownLeft / Math.max(1, empMaxCooldown)) * 100)}%` }}
            />
          )}
          <Zap className="w-3.5 h-3.5 text-sky-400 relative z-10" />
          <span className="font-mono text-[9px] font-bold text-white tabular-nums relative z-10 leading-none">
            {empReady ? 'EMP' : `${Math.ceil(empCooldownLeft)}s`}
          </span>
        </button>

        {/* Repair (Left Thumb) */}
        <button
          disabled={!repairReady}
          onClick={onTriggerRepair}
          title="ترمیم و سپر پایگاه"
          className={`relative overflow-hidden w-12 h-11 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 cursor-pointer ${
            repairReady
              ? 'bg-emerald-500/18 border-emerald-400/45 text-emerald-200'
              : 'bg-white/[0.02] border-white/5 text-slate-500 cursor-not-allowed'
          }`}
        >
          {!repairReady && (
            <div
              className="absolute inset-x-0 bottom-0 bg-emerald-500/20 pointer-events-none"
              style={{ height: `${Math.max(0, (1 - repairCooldownLeft / Math.max(1, repairMaxCooldown)) * 100)}%` }}
            />
          )}
          <Wrench className="w-3.5 h-3.5 text-emerald-400 relative z-10" />
          <span className="font-mono text-[9px] font-bold text-white tabular-nums relative z-10 leading-none">
            {repairReady ? 'ترمیم' : `${Math.ceil(repairCooldownLeft)}s`}
          </span>
        </button>

        {/* CAP Fighters (Left Thumb) */}
        <button
          disabled={!capReady}
          onClick={onTriggerCap}
          title="اسکادران جنگنده خودی (۱۲ ثانیه گشت)"
          className={`relative overflow-hidden w-12 h-11 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 cursor-pointer ${
            capActive
              ? 'bg-cyan-500/28 border-cyan-400/80 text-cyan-100'
              : capReady
                ? 'bg-cyan-500/18 border-cyan-400/45 text-cyan-200'
                : 'bg-white/[0.02] border-white/5 text-slate-500 cursor-not-allowed'
          }`}
        >
          {capActive ? (
            <div
              className="absolute inset-x-0 bottom-0 bg-cyan-400/25 pointer-events-none"
              style={{ height: `${Math.max(0, Math.min(100, (capActiveLeft / 12) * 100))}%` }}
            />
          ) : !capReady ? (
            <div
              className="absolute inset-x-0 bottom-0 bg-cyan-500/20 pointer-events-none"
              style={{ height: `${Math.max(0, (1 - capCooldownLeft / Math.max(1, capMaxCooldown)) * 100)}%` }}
            />
          ) : null}
          <Plane className="w-3.5 h-3.5 text-cyan-300 relative z-10" />
          <span className="font-mono text-[9px] font-bold text-white tabular-nums relative z-10 leading-none">
            {capActive ? `${Math.ceil(capActiveLeft)}s` : capReady ? 'جنگنده' : `${Math.ceil(capCooldownLeft)}s`}
          </span>
        </button>
      </div>

      {/* 1. TOP FLOATING CORNERS — Collision-Free Single-Row on Landscape Mobile */}
      <div className="flex items-start justify-between gap-2 sm:gap-3 short:gap-1.5 min-w-0">
        {/* Top-Left: Stage / Endless Mode, Tech Lab, Base HP, Funds, Wave & Launch CTA */}
        <div
          dir="rtl"
          className="pointer-events-auto flex items-center gap-2 sm:gap-3 short:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 short:px-2 short:py-1 rounded-xl bg-[#0a0f1c]/90 border border-white/10 shadow-xl overflow-x-auto no-scrollbar min-w-0 max-w-[66vw] sm:max-w-[70vw] short:max-w-none short:flex-1"
        >
          {/* Roadmap / Mode Button */}
          <button
            id="btn-open-roadmap"
            onClick={onOpenRoadmap}
            title="نقشه ۴۰ مرحله و حالت بقای بی‌نهایت"
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 short:px-1.5 short:py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs short:text-[11px] font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {gameMode === 'endless' ? (
              <>
                <InfinityIcon className="w-3.5 h-3.5 short:w-3 short:h-3 text-rose-400" />
                <span>بقا</span>
              </>
            ) : (
              <>
                <MapIcon className="w-3.5 h-3.5 short:w-3 short:h-3 text-amber-400" />
                <span className="tabular-nums">م{stageConfig.stageNumber}/40</span>
              </>
            )}
          </button>

          {/* Tech Lab Quick Button */}
          <button
            id="btn-open-techlab"
            onClick={onOpenTechLab}
            title="آزمایشگاه فناوری (خرج کردن ستاره‌ها)"
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 short:px-1.5 short:py-0.5 rounded-lg text-xs short:text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              availableStars > 0
                ? 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/35'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 short:w-3 short:h-3 text-sky-400" />
            <span className="hidden sm:inline short:hidden">فناوری</span>
            {availableStars > 0 && (
              <span className="font-mono text-amber-300 tabular-nums">{availableStars}★</span>
            )}
          </button>

          <span className="w-px h-4 short:h-3 bg-white/10 shrink-0" aria-hidden="true" />

          {/* Base Integrity */}
          <div className="flex items-center gap-1.5 shrink-0" title="سلامت پایگاه">
            <Shield className="w-4 h-4 short:w-3.5 short:h-3.5 text-emerald-400 shrink-0" />
            <div className="flex items-center gap-1.5">
              <div className="w-12 sm:w-20 short:w-10 h-2 short:h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${hpBarColor}`}
                  style={{ width: `${hpPercent}%` }}
                />
              </div>
              <span className="font-mono text-xs short:text-[11px] font-semibold text-slate-100 tabular-nums">
                {baseHp}
              </span>
            </div>
          </div>

          <span className="w-px h-4 short:h-3 bg-white/10 shrink-0" aria-hidden="true" />

          {/* Defense Funds */}
          <div className="flex items-center gap-1 shrink-0" title="بودجه دفاعی">
            <Coins className="w-4 h-4 short:w-3.5 short:h-3.5 text-amber-400 shrink-0" />
            <span className="font-mono text-sm short:text-xs font-bold text-amber-300 tabular-nums">
              ${cash}
            </span>
          </div>

          <span className="w-px h-4 short:h-3 bg-white/10 shrink-0" aria-hidden="true" />

          {/* Wave Counter & Endless Score */}
          <div className="flex items-center gap-1.5 text-xs short:text-[11px] text-slate-300 whitespace-nowrap shrink-0">
            <span className="font-medium">
              موج{' '}
              <span className="font-mono font-semibold text-white tabular-nums">
                {gameMode === 'endless' ? currentWave : `${Math.min(currentWave, totalWaves)}/${totalWaves}`}
              </span>
            </span>
            {gameMode === 'endless' && (
              <>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="font-mono text-amber-300 tabular-nums">{endlessScore}</span>
              </>
            )}
            {isWaveActive && (
              <span className="flex items-center gap-1 text-rose-400 font-mono font-semibold tabular-nums">
                <Crosshair className="w-3.5 h-3.5 short:w-3 short:h-3" />
                {enemiesRemaining}
              </span>
            )}
          </div>

          {/* Launch Wave CTA */}
          {canLaunchWave && (
            <button
              id="btn-start-wave"
              onClick={onStartNextWave}
              className="mr-0.5 px-3 sm:px-3.5 py-1.5 short:px-3 short:py-1.5 short:min-h-[30px] rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs short:text-[11px] flex items-center gap-1 transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 short:w-3 short:h-3 fill-current" />
              <span>شروع موج</span>
            </button>
          )}
        </div>

        {/* Top-Right: 3-Biome Switcher (desktop), Compact Controls, Fullscreen & Drawer Menu */}
        <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
          <div
            dir="rtl"
            className="hidden lg:flex short:hidden items-center gap-1 p-1 rounded-xl bg-[#0a0f1c]/88 border border-white/10 shadow-xl"
          >
            {BIOME_LIST.map(({ id, label, Icon }) => {
              const active = biome === id;
              return (
                <button
                  key={id}
                  onClick={() => onChangeBiome(id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1 p-1 short:p-0.5 rounded-xl bg-[#0a0f1c]/90 border border-white/10 shadow-xl text-slate-300">
            <button
              onClick={() => onSetGameSpeed(gameSpeed === 0 ? 1 : 0)}
              title={gameSpeed === 0 ? 'ادامه' : 'توقف'}
              className={`p-2 short:p-1.5 short:min-w-[32px] short:min-h-[32px] flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                gameSpeed === 0 ? 'bg-amber-500/20 text-amber-300' : 'hover:bg-white/5 hover:text-white'
              }`}
            >
              {gameSpeed === 0 ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => onSetGameSpeed(gameSpeed === 2 ? 1 : 2)}
              title="سرعت ۱ یا ۲ برابر"
              className={`px-2 py-1.5 short:px-2 short:min-h-[32px] rounded-lg font-mono text-xs short:text-[11px] font-semibold flex items-center justify-center gap-0.5 transition-colors tabular-nums cursor-pointer ${
                gameSpeed === 2 ? 'bg-sky-500/20 text-sky-300' : 'hover:bg-white/5 hover:text-white'
              }`}
            >
              <FastForward className="w-3.5 h-3.5 short:w-3 short:h-3" />
              <span>{gameSpeed === 2 ? '2x' : '1x'}</span>
            </button>

            <button
              onClick={() => onSetCameraView(cameraMode === 'isometric' ? 'topdown' : 'isometric')}
              title={cameraMode === 'isometric' ? 'نمای بالا' : 'نمای ایزومتریک'}
              className={`p-2 short:p-1.5 short:min-w-[32px] short:min-h-[32px] flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                cameraMode === 'topdown' ? 'bg-sky-500/20 text-sky-300' : 'hover:bg-white/5 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onToggleRangeRings}
              title="نمایش محدوده برد"
              className={`p-2 short:p-1.5 short:min-w-[32px] short:min-h-[32px] flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                showRangeRings ? 'bg-amber-500/20 text-amber-300' : 'hover:bg-white/5 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onToggleMusic}
              title={musicEnabled ? 'قطع موسیقی متن' : 'وصل موسیقی متن'}
              className={`hidden sm:flex short:hidden p-2 rounded-lg transition-colors cursor-pointer ${
                musicEnabled ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onToggleSound}
              title={soundEnabled ? 'قطع افکت صوتی' : 'وصل افکت صوتی'}
              className={`p-2 short:p-1.5 short:min-w-[32px] short:min-h-[32px] flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                soundEnabled ? 'text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleToggleFullscreen}
              title={isFullscreen ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه افقی'}
              className={`p-2 short:p-1.5 short:min-w-[32px] short:min-h-[32px] flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                isFullscreen ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            <span className="w-px h-4 short:h-3 bg-white/10 mx-0.5" aria-hidden="true" />

            <button
              id="btn-open-menu"
              onClick={onOpenMenu}
              title="منو"
              className="p-2 short:p-1.5 short:min-w-[32px] short:min-h-[32px] flex items-center justify-center rounded-lg text-slate-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              <Menu className="w-4 h-4 short:w-3.5 short:h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Quiet 1-line Incoming Wave Threat Preview / Night Ops Status / Secondary Facilities & Tactical Alerts */}
      <div className="mx-auto mt-1.5 short:mt-1 pointer-events-none max-w-[84vw] flex flex-col items-center gap-1">
        {((canLaunchWave && wavePreviewSummary) || isNightRaid) && (
          <div
            dir="rtl"
            className="px-3 py-1 short:px-2.5 short:py-0.5 rounded-lg bg-[#0a0f1c]/82 border border-white/10 text-[11px] short:text-[10px] text-slate-300 flex flex-wrap items-center justify-center gap-1.5"
          >
            {isNightRaid && (
              <span className="inline-flex items-center gap-1 text-indigo-300 font-semibold whitespace-nowrap">
                <Moon className="w-3 h-3 text-sky-300 shrink-0" />
                <span>عملیات شبانه</span>
              </span>
            )}
            {isNightRaid && canLaunchWave && wavePreviewSummary && (
              <span className="text-slate-600" aria-hidden="true">·</span>
            )}
            {canLaunchWave && wavePreviewSummary && (
              <>
                <span className="font-semibold text-amber-300">موج پیش‌رو:</span>
                <span className="truncate max-w-[52vw]">{wavePreviewSummary}</span>
                {gameMode === 'campaign' && stageConfig.modifier !== 'none' && (
                  <>
                    <span className="text-slate-600" aria-hidden="true">·</span>
                    <span className="text-rose-300">{stageConfig.modifierLabelFa}</span>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Secondary Base Facilities Integrity Strip (Bunkers + Fuel Depot) */}
        {facilities.length > 0 && (
          <div
            dir="rtl"
            className="px-2.5 py-1 short:px-2 short:py-0.5 rounded-lg bg-[#0a0f1c]/86 border border-white/10 text-[10px] short:text-[9px] text-slate-300 flex items-center gap-2.5 short:gap-1.5 shadow-lg"
          >
            <span
              className={`font-semibold whitespace-nowrap flex items-center gap-1 ${
                stageConfig.secondaryObjectives?.failOnAllLost ? 'text-rose-300' : 'text-amber-300'
              }`}
            >
              <ShieldAlert className="w-3 h-3 shrink-0" />
              <span className="hidden sm:inline short:hidden">
                {stageConfig.secondaryObjectives?.failOnAllLost ? 'تأسیسات حیاتی:' : 'تأسیسات جانبی:'}
              </span>
            </span>

            {facilities.map((fac, idx) => {
              const destroyed = !fac.alive;
              const pct = destroyed ? 0 : Math.max(0, Math.min(100, (fac.hp / Math.max(1, fac.maxHp)) * 100));
              const barCls =
                destroyed
                  ? 'bg-slate-700'
                  : pct > 60
                    ? 'bg-emerald-400'
                    : pct > 30
                      ? 'bg-amber-400'
                      : 'bg-rose-500';
              return (
                <React.Fragment key={fac.id}>
                  {idx > 0 && <span className="w-px h-3 bg-white/10 shrink-0" aria-hidden="true" />}
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    {fac.kind === 'fuel_depot' ? (
                      <Fuel className={`w-3 h-3 shrink-0 ${destroyed ? 'text-slate-600' : 'text-amber-400'}`} />
                    ) : (
                      <Shield className={`w-3 h-3 shrink-0 ${destroyed ? 'text-slate-600' : 'text-emerald-400'}`} />
                    )}
                    <span className={destroyed ? 'text-slate-500 line-through' : 'text-slate-200 font-medium'}>
                      {fac.titleFa}
                    </span>
                    {destroyed ? (
                      <span className="text-rose-400 font-semibold">نابود</span>
                    ) : (
                      <div className="w-10 short:w-7 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-200 ${barCls}`} style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Transient Tactical Alert Toast (Tower / Facility Destroyed, B-2 + 4 Escorts Arrival) */}
        {tacticalAlert && (
          <div
            dir="rtl"
            className="px-3 py-1 short:px-2.5 short:py-0.5 rounded-lg bg-[#160b10]/92 border border-rose-400/45 text-[11px] short:text-[10px] font-semibold text-rose-100 shadow-xl flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5 short:w-3 short:h-3 text-amber-400 shrink-0" />
            <span>{tacticalAlert}</span>
          </div>
        )}
      </div>

      {/* 2. BOTTOM ROW: FULL-WIDTH CENTER COLLAPSIBLE DOCK (Respects Side Thumb Controls on Short Landscape) */}
      <div className="relative mt-auto flex items-end justify-center short:px-14">
        <div className="flex flex-col items-center gap-1.5 short:gap-1 max-w-full">
          {/* Tower Placement Guide Strip */}
          {selectedTowerToBuild && (
            <div
              dir="rtl"
              className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-1.5 short:px-2.5 short:py-1 rounded-xl bg-[#0a0f1c]/94 border border-amber-400/45 shadow-xl text-xs short:text-[11px]"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: selectedTowerToBuild.color }}
              />
              <span className="text-slate-100 font-medium whitespace-nowrap">
                محل <strong className="text-amber-300">{TOWER_SHORT_NAMES[selectedTowerToBuild.id] ?? selectedTowerToBuild.name}</strong> را لمس کنید
              </span>
              <button
                onClick={() => onSelectTowerToBuild(null)}
                className="px-2.5 py-1 short:py-0.5 rounded-md bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white transition-colors cursor-pointer"
              >
                لغو
              </button>
            </div>
          )}

          {/* Contextual Selected Placed Tower Bar + Targeting Priority Selector */}
          {selectedPlacedTower && !selectedTowerToBuild && (
            <div
              dir="rtl"
              className="pointer-events-auto flex items-center gap-2 sm:gap-2.5 short:gap-1.5 px-3 py-1.5 short:px-2.5 short:py-1 rounded-xl bg-[#0a0f1c]/95 border border-white/15 shadow-2xl text-xs short:text-[11px] overflow-x-auto no-scrollbar max-w-[96vw] short:max-w-[calc(100vw-8.5rem)]"
            >
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: selectedPlacedTower.tower.color }}
                />
                <span className="font-semibold text-white whitespace-nowrap">
                  {TOWER_SHORT_NAMES[selectedPlacedTower.tower.id] ?? selectedPlacedTower.tower.name}
                </span>
                <span className="text-slate-400 font-mono tabular-nums whitespace-nowrap">
                  سطح {selectedPlacedTower.level}
                </span>

                {/* Tower Structural Integrity (Non-Repairable — Rebuild From Scratch if Destroyed) */}
                <span className="text-slate-600" aria-hidden="true">·</span>
                <div
                  className="flex items-center gap-1 whitespace-nowrap"
                  title="استحکام سازه‌ای برجک (غیرقابل تعمیر؛ در صورت نابودی باید از صفر ساخته شود)"
                >
                  <div className="w-10 short:w-8 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${
                        selectedPlacedTower.hp / Math.max(1, selectedPlacedTower.maxHp) > 0.55
                          ? 'bg-emerald-400'
                          : selectedPlacedTower.hp / Math.max(1, selectedPlacedTower.maxHp) > 0.28
                            ? 'bg-amber-400'
                            : 'bg-rose-500'
                      }`}
                      style={{
                        width: `${Math.max(0, Math.min(100, (selectedPlacedTower.hp / Math.max(1, selectedPlacedTower.maxHp)) * 100))}%`,
                      }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-slate-300 tabular-nums">
                    {Math.ceil(selectedPlacedTower.hp)}/{selectedPlacedTower.maxHp}
                  </span>
                </div>

                {selectedPlacedTower.tower.strategicTargetOnly && (
                  <>
                    <span className="text-slate-600 hidden md:inline" aria-hidden="true">·</span>
                    <span className="text-rose-300 text-[10px] font-medium whitespace-nowrap hidden md:inline">
                      قفل انحصاری: باس/جت/بالستیک
                    </span>
                  </>
                )}

                {selectedPlacedTower.tower.shape === 'radar_dish' ? (
                  <>
                    <span className="text-slate-600" aria-hidden="true">·</span>
                    <span className="text-amber-300 font-mono tabular-nums whitespace-nowrap flex items-center gap-1">
                      <Radio className="w-3 h-3" />
                      <span>شعاع {selectedPlacedTower.level === 3 ? 39 : selectedPlacedTower.level === 2 ? 31 : 24}م</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-slate-600 hidden sm:inline" aria-hidden="true">·</span>
                    <span className="text-slate-400 font-mono tabular-nums whitespace-nowrap hidden sm:inline">
                      {selectedPlacedTower.killCount} شکار
                    </span>
                    <span className="text-slate-600" aria-hidden="true">·</span>
                    <span
                      className={`whitespace-nowrap flex items-center gap-1 ${
                        selectedPlacedTower.radarBoosted ? 'text-amber-300 font-medium' : 'text-slate-500'
                      }`}
                    >
                      <Radio className="w-3 h-3 shrink-0" />
                      <span>{selectedPlacedTower.radarBoosted ? 'رادار +۳۵٪' : 'بی‌رادار'}</span>
                    </span>
                  </>
                )}
              </div>

              {selectedPlacedTower.tower.shape !== 'radar_dish' && (
                <>
                  <span className="w-px h-4 bg-white/10 shrink-0" aria-hidden="true" />
                  <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/5 shrink-0">
                    {PRIORITY_OPTIONS.map((opt) => {
                      const active = selectedPlacedTower.targetingPriority === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => onChangeTowerPriority(selectedPlacedTower.instanceId, opt.id)}
                          className={`px-1.5 sm:px-2 py-1 short:py-0.5 rounded-md text-[10px] sm:text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                            active
                              ? 'bg-amber-500/25 text-amber-200'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <span className="w-px h-4 bg-white/10 shrink-0" aria-hidden="true" />

              <button
                disabled={!canUpgrade}
                onClick={() => onUpgradeTower(selectedPlacedTower.instanceId)}
                className={`px-2.5 sm:px-3 py-1.5 short:py-1 rounded-lg font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  canUpgrade
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold'
                    : 'bg-white/5 text-slate-500 cursor-not-allowed'
                }`}
              >
                <ArrowUpCircle className="w-3.5 h-3.5" />
                <span className="tabular-nums">
                  {selectedPlacedTower.level >= 3 ? 'حداکثر' : `ارتقا $${upgradeCost}`}
                </span>
              </button>

              <button
                onClick={() => onSellTower(selectedPlacedTower.instanceId)}
                className="px-2 sm:px-2.5 py-1.5 short:py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
                title="فروش برجک"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>+${sellRefund}</span>
              </button>

              <button
                onClick={onCloseInspect}
                className="p-1 text-slate-400 hover:text-white transition-colors shrink-0 cursor-pointer"
                aria-label="بستن"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Whisper-thin hover caption (desktop only; hidden on short touch viewports) */}
          {!dockCollapsed &&
            (hoveredTower || hoveredSkill) &&
            !selectedTowerToBuild &&
            !selectedPlacedTower && (
              <div
                dir="rtl"
                className="hidden sm:flex short:hidden pointer-events-none px-3 py-1 rounded-lg bg-[#0a0f1c]/82 border border-white/10 text-[11px] text-slate-300 items-center gap-2"
              >
                {hoveredTower ? (
                  <>
                    <span className={`font-semibold ${TOWER_TIER_META[hoveredTower.tier].badgeClass}`}>
                      {TOWER_TIER_META[hoveredTower.tier].shortLabelFa}
                    </span>
                    <span className="text-slate-500" aria-hidden="true">·</span>
                    <span className="font-semibold text-white">{hoveredTower.persianName}</span>
                    <span className="text-slate-500" aria-hidden="true">·</span>
                    <span>{hoveredTower.type}</span>
                  </>
                ) : (
                  <span>{hoveredSkill}</span>
                )}
              </div>
            )}

          {/* Collapsible Bottom Dock: 8 Real-World Tiered Towers + 3 Commander Tactical Skills */}
          <div className="pointer-events-auto flex flex-col items-center max-w-full">
            <button
              onClick={() => setDockCollapsed((prev) => !prev)}
              title={dockCollapsed ? 'نمایش نوار ساخت (H)' : 'مخفی کردن نوار ساخت (H)'}
              className="px-3.5 py-0.5 rounded-t-lg bg-[#0a0f1c]/88 border border-b-0 border-white/10 text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-[11px] short:text-[10px] cursor-pointer"
            >
              {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>{dockCollapsed ? 'سامانه‌ها' : ''}</span>
            </button>

            {!dockCollapsed && (
              <div
                dir="rtl"
                className="flex items-center gap-1 short:gap-0.5 p-1.5 short:p-1 rounded-2xl short:rounded-xl bg-[#0a0f1c]/90 border border-white/10 shadow-2xl overflow-x-auto no-scrollbar max-w-full"
              >
                {DEFENSE_TOWERS.map((tower, idx) => {
                  const isSelected = selectedTowerToBuild?.id === tower.id;
                  const canAfford = cash >= tower.buildCost;
                  const shortName = TOWER_SHORT_NAMES[tower.id] ?? tower.name;
                  const tierMeta = TOWER_TIER_META[tower.tier];
                  const prevTower = idx > 0 ? DEFENSE_TOWERS[idx - 1] : null;
                  const isTierBoundary = prevTower !== null && prevTower.tier !== tower.tier;

                  return (
                    <React.Fragment key={tower.id}>
                      {isTierBoundary && (
                        <div className="flex flex-col items-center justify-center px-1 short:px-0.5 shrink-0" aria-hidden="true">
                          <span className={`w-px h-7 short:h-5 ${tierMeta.dividerClass}`} />
                        </div>
                      )}
                      <button
                        id={`btn-build-${tower.id}`}
                        disabled={!canAfford}
                        onMouseEnter={() => setHoveredTower(tower)}
                        onMouseLeave={() => setHoveredTower((cur) => (cur?.id === tower.id ? null : cur))}
                        onClick={() => onSelectTowerToBuild(isSelected ? null : tower)}
                        className={`relative flex items-center gap-2 short:gap-1.5 px-2.5 py-2 short:px-2 short:py-1.5 rounded-xl short:rounded-lg border transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-400/70 text-white'
                            : canAfford
                            ? 'bg-white/[0.03] hover:bg-white/[0.08] border-transparent hover:border-white/10 text-slate-200'
                            : 'bg-transparent border-transparent text-slate-600 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div
                          className="relative w-7 h-7 short:w-6 short:h-6 rounded-lg short:rounded-md flex items-center justify-center shrink-0 border border-white/10"
                          style={{ backgroundColor: `${tower.color}38`, color: '#f8fafc' }}
                        >
                          <TowerGlyph shape={tower.shape} className="w-3.5 h-3.5 short:w-3 short:h-3" />
                          <span
                            className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${tierMeta.dotClass}`}
                            aria-hidden="true"
                          />
                        </div>

                        <div className="flex flex-col items-start text-right leading-tight">
                          <div className="flex items-center gap-1">
                            <span className="text-xs short:text-[11px] font-semibold text-white">{shortName}</span>
                            <span className={`hidden sm:inline short:hidden text-[9px] font-semibold ${tierMeta.badgeClass}`}>
                              {tierMeta.shortLabelFa}
                            </span>
                          </div>
                          <span
                            className={`font-mono text-[11px] short:text-[10px] font-semibold tabular-nums ${
                              canAfford ? 'text-amber-300' : 'text-slate-500'
                            }`}
                          >
                            ${tower.buildCost}
                          </span>
                        </div>
                      </button>
                    </React.Fragment>
                  );
                })}

                <span className="short:hidden w-px h-8 bg-white/10 mx-1 shrink-0" aria-hidden="true" />

                {/* Skill 1: EMP (Q) — Desktop/Tall Bottom Dock (Pinned on Left Edge in Landscape Mobile!) */}
                <button
                  id="btn-skill-emp"
                  disabled={!empReady}
                  onMouseEnter={() => setHoveredSkill('پالس EMP (کلید Q) · کند کردن ۶۵٪ همه دشمنان به مدت ۵ ثانیه')}
                  onMouseLeave={() => setHoveredSkill(null)}
                  onClick={onTriggerEmp}
                  className={`short:hidden relative overflow-hidden flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer ${
                    empReady
                      ? 'bg-sky-500/15 hover:bg-sky-500/25 border-sky-400/40 text-sky-200'
                      : 'bg-white/[0.02] border-white/5 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {!empReady && (
                    <div
                      className="absolute inset-y-0 right-0 bg-sky-500/15 pointer-events-none"
                      style={{ width: `${Math.max(0, (1 - empCooldownLeft / Math.max(1, empMaxCooldown)) * 100)}%` }}
                    />
                  )}
                  <Zap className="w-4 h-4 text-sky-400 relative z-10 shrink-0" />
                  <div className="flex flex-col items-start text-right leading-tight relative z-10">
                    <span className="text-xs font-semibold text-white">EMP</span>
                    <span className="font-mono text-[10px] text-sky-300 tabular-nums">
                      {empReady ? 'آماده' : `${Math.ceil(empCooldownLeft)}s`}
                    </span>
                  </div>
                </button>

                {/* Skill 2: Repair & Shield (E) — Desktop/Tall Bottom Dock */}
                <button
                  id="btn-skill-repair"
                  disabled={!repairReady}
                  onMouseEnter={() => setHoveredSkill('ترمیم و سپر انرژی (کلید E) · +۲۰۰ جان پایگاه و +۳۵٪ سرعت آتش')}
                  onMouseLeave={() => setHoveredSkill(null)}
                  onClick={onTriggerRepair}
                  className={`short:hidden relative overflow-hidden flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer ${
                    repairReady
                      ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-400/40 text-emerald-200'
                      : 'bg-white/[0.02] border-white/5 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {!repairReady && (
                    <div
                      className="absolute inset-y-0 right-0 bg-emerald-500/15 pointer-events-none"
                      style={{ width: `${Math.max(0, (1 - repairCooldownLeft / Math.max(1, repairMaxCooldown)) * 100)}%` }}
                    />
                  )}
                  <Wrench className="w-4 h-4 text-emerald-400 relative z-10 shrink-0" />
                  <div className="flex flex-col items-start text-right leading-tight relative z-10">
                    <span className="text-xs font-semibold text-white">ترمیم</span>
                    <span className="font-mono text-[10px] text-emerald-300 tabular-nums">
                      {repairReady ? 'آماده' : `${Math.ceil(repairCooldownLeft)}s`}
                    </span>
                  </div>
                </button>

                {/* Skill 3: Scramble CAP Allied Fighter Squadron (F) — Desktop/Tall Bottom Dock */}
                <button
                  id="btn-skill-cap"
                  disabled={!capReady}
                  onMouseEnter={() =>
                    setHoveredSkill('اسکادران جنگنده خودی (کلید F) · اعزام ۲ جنگنده رهگیر برای ۱۲ ثانیه گشت و داگ‌فایت (شارژ ۳۶ ثانیه)')
                  }
                  onMouseLeave={() => setHoveredSkill(null)}
                  onClick={onTriggerCap}
                  className={`short:hidden relative overflow-hidden flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer ${
                    capActive
                      ? 'bg-cyan-500/25 border-cyan-400/75 text-cyan-100'
                      : capReady
                      ? 'bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-400/40 text-cyan-200'
                      : 'bg-white/[0.02] border-white/5 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {capActive ? (
                    <div
                      className="absolute inset-y-0 right-0 bg-cyan-400/20 pointer-events-none"
                      style={{ width: `${Math.max(0, Math.min(100, (capActiveLeft / 12) * 100))}%` }}
                    />
                  ) : !capReady ? (
                    <div
                      className="absolute inset-y-0 right-0 bg-cyan-500/15 pointer-events-none"
                      style={{
                        width: `${Math.max(0, (1 - capCooldownLeft / Math.max(1, capMaxCooldown)) * 100)}%`,
                      }}
                    />
                  ) : null}
                  <Plane className="w-4 h-4 text-cyan-300 relative z-10 shrink-0" />
                  <div className="flex flex-col items-start text-right leading-tight relative z-10">
                    <span className="text-xs font-semibold text-white">جنگنده</span>
                    <span className="font-mono text-[10px] text-cyan-300 tabular-nums">
                      {capActive ? `گشت ${Math.ceil(capActiveLeft)}s` : capReady ? 'آماده' : `${Math.ceil(capCooldownLeft)}s`}
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. VICTORY OVERLAY MODAL (2-Column Compact Layout on Short Landscape Mobile) */}
      {waveState === 'victory' && (
        <div className="absolute inset-0 bg-[#050811]/86 flex items-center justify-center safe-modal-padding z-50 pointer-events-auto">
          <div
            dir="rtl"
            className="bg-[#0d1424] border border-emerald-500/35 p-5 sm:p-6 short:p-3.5 rounded-2xl max-w-sm short:max-w-xl w-full max-h-[92dvh] overflow-y-auto shadow-2xl text-center short:grid short:grid-cols-2 short:items-center short:gap-4"
          >
            <div>
              <div className="flex items-center justify-center gap-2 mb-3 short:mb-2">
                {[1, 2, 3].map((s) => (
                  <Star
                    key={s}
                    className={`w-8 h-8 short:w-6 short:h-6 ${
                      s <= earnedStars ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                    }`}
                  />
                ))}
              </div>
              <h2 className="text-xl short:text-base font-bold text-white">
                مرحله {stageConfig.stageNumber} تکمیل شد
              </h2>
              <p className="text-xs text-emerald-300 mt-1">{stageConfig.titleFa}</p>

              <div className="flex items-center justify-center gap-5 my-4 short:my-2.5 py-3 short:py-2 border-y border-white/10 text-xs">
                <div>
                  <span className="text-slate-400 block">سلامت پایگاه</span>
                  <span className="font-mono text-base short:text-sm font-bold text-emerald-400 tabular-nums">{baseHp}</span>
                </div>
                <span className="w-px h-7 bg-white/10" aria-hidden="true" />
                <div>
                  <span className="text-slate-400 block">بودجه باقی‌مانده</span>
                  <span className="font-mono text-base short:text-sm font-bold text-amber-300 tabular-nums">${cash}</span>
                </div>
                {facilities.length > 0 && (
                  <>
                    <span className="w-px h-7 bg-white/10" aria-hidden="true" />
                    <div>
                      <span className="text-slate-400 block">تأسیسات سالم</span>
                      <span className="font-mono text-base short:text-sm font-bold text-sky-300 tabular-nums">
                        {facilities.filter((f) => f.alive).length}/{facilities.length}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {hasNextStage && (
                <button
                  onClick={onNextStage}
                  className="w-full py-2.5 short:py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm short:text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>مرحله بعد (مرحله {stageConfig.stageNumber + 1})</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={onOpenTechLab}
                className="w-full py-2 short:py-1.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-sky-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Cpu className="w-3.5 h-3.5 text-sky-400" />
                <span>آزمایشگاه فناوری ({availableStars}★ آزاد)</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onOpenRoadmap}
                  className="py-2 short:py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <MapIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>نقشه مراحل</span>
                </button>
                <button
                  onClick={onResetGame}
                  className="py-2 short:py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>تکرار مرحله</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. DEFEAT OVERLAY MODAL (2-Column Compact Layout on Short Landscape Mobile) */}
      {waveState === 'defeat' && (
        <div className="absolute inset-0 bg-[#050811]/86 flex items-center justify-center safe-modal-padding z-50 pointer-events-auto">
          <div
            dir="rtl"
            className="bg-[#0d1424] border border-rose-500/35 p-5 sm:p-6 short:p-3.5 rounded-2xl max-w-sm short:max-w-xl w-full max-h-[92dvh] overflow-y-auto shadow-2xl text-center short:grid short:grid-cols-2 short:items-center short:gap-4"
          >
            <div>
              <div className="w-14 h-14 short:w-10 short:h-10 bg-rose-500/15 border border-rose-500/30 rounded-2xl mx-auto flex items-center justify-center text-rose-400 mb-3 short:mb-2">
                <AlertTriangle className="w-7 h-7 short:w-5 short:h-5" />
              </div>
              <h2 className="text-xl short:text-base font-bold text-rose-400">
                {gameMode === 'endless'
                  ? 'پایان نبرد بقای بی‌نهایت'
                  : defeatReason === 'facilities_lost'
                    ? 'تأسیسات حیاتی نابود شد'
                    : 'پایگاه سقوط کرد'}
              </h2>
              <p className="text-xs short:text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                {gameMode === 'endless'
                  ? `تا موج ${currentWave} مقاومت کردید. رکورد شما به‌صورت خودکار ذخیره شد.`
                  : defeatReason === 'facilities_lost'
                    ? `تمامی بانکرهای مهمات و مخزن سوخت پایگاه در موج ${currentWave} از مرحله ${stageConfig.stageNumber} نابود شدند. در این مأموریت حفاظت از تأسیسات الزامی است.`
                    : `در موج ${currentWave} از مرحله ${stageConfig.stageNumber} خط پدافندی شکسته شد. از آزمایشگاه فناوری، اولویت هدف‌گیری و اسکادران جنگنده کمک بگیرید.`}
              </p>

              {gameMode === 'endless' && (
                <div className="flex items-center justify-center gap-6 my-3.5 short:my-2 py-2.5 short:py-1.5 border-y border-white/10 text-xs">
                  <div>
                    <span className="text-slate-400 block">امتیاز نبرد</span>
                    <span className="font-mono text-base short:text-sm font-bold text-amber-300 tabular-nums">{endlessScore}</span>
                  </div>
                  <span className="w-px h-7 bg-white/10" aria-hidden="true" />
                  <div>
                    <span className="text-slate-400 block">رکورد موج این اقلیم</span>
                    <span className="font-mono text-base short:text-sm font-bold text-emerald-400 tabular-nums">
                      موج {Math.max(endlessBestWave, currentWave)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 mt-4 short:mt-0">
              <button
                onClick={onResetGame}
                className="w-full py-2.5 short:py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm short:text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{gameMode === 'endless' ? 'شروع مجدد بقا' : `تلاش مجدد مرحله ${stageConfig.stageNumber}`}</span>
              </button>
              <button
                onClick={onOpenTechLab}
                className="w-full py-2 short:py-1.5 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-sky-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Cpu className="w-3.5 h-3.5 text-sky-400" />
                <span>آزمایشگاه فناوری ({availableStars}★ آزاد)</span>
              </button>
              <button
                onClick={onOpenRoadmap}
                className="w-full py-2 short:py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <MapIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>بازگشت به نقشه مراحل</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
