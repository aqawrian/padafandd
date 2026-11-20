import React, { useEffect, useState } from 'react';
import { DEFENSE_TOWERS, ENEMY_UNITS, TOWER_TIER_META } from '../data/gameData';
import { DefenseTower, EnemyUnit, TowerTier } from '../types/game';
import { renderUnitThumbnailsBatch } from '../utils/unitThumbnailStudio';
import {
  Crosshair,
  Crown,
  EyeOff,
  Flame,
  Gauge,
  Plane,
  Radio,
  Shield,
  Target,
  Zap,
} from 'lucide-react';

interface UnitDatabaseProps {
  onSelectUnit: (unit: DefenseTower | EnemyUnit) => void;
}

const TIER_ORDER: TowerTier[] = [1, 2, 3, 4];

function getTowerRoleFa(tower: DefenseTower): string {
  switch (tower.id) {
    case 'ciws_light':
      return 'توپ رگباری ۲۰م‌م بالستیک · پیش‌بینی مسیر هدف (بدون ردیابی خودکار)';
    case 'radar_uplink':
      return 'کشف رادارگریز +۳۵٪ برد و دقت برجک‌های اطراف';
    case 'avenger_stinger':
      return 'موشک حرارتی قفل تک‌هدف · مقابله سریع در برد کوتاه';
    case 'pantsir_point':
      return 'رگبار بالستیک توپ دوقلو ۳۰م‌م + موشک دوره‌ای · چندمنظوره';
    case 'iron_dome_pod':
      return 'شلیک سه‌گانه راکت قفل تک‌هدف · خودتخریبی هوایی و ضدبمب';
    case 'system_358':
      return 'موشک پرسه‌زن دوربرد · شکارچی پهپاد سنگین و جنگال';
    case 'patriot_battery':
      return 'آتشبار دوربرد سنگین · شکار بمب‌افکن و موشک کروز';
    case 's400_thaad':
      return 'پرتاب عمودی سنگین و کند · قفل انحصاری روی باس، جت ارتفاع‌بالا و بالستیک';
    default:
      return tower.type;
  }
}

function getEnemyRoleFa(enemy: EnemyUnit): string {
  if (enemy.shape === 'enemy_fighter') {
    return 'جنگنده ارتفاع‌بالا · بمباران برجک‌ها و تأسیسات + داگ‌فایت';
  }
  if (enemy.isBoss && enemy.escortCount) {
    return `بمب‌افکن رادارگریز B-2 · ورود با ${enemy.escortCount} جنگنده اسکورت`;
  }
  if (enemy.isBoss) {
    return 'بمب‌افکن راهبردی سنگین · منور حرارتی و بمباران پیاپی';
  }
  if (enemy.jammerRadius) {
    return 'اخلال‌گر الکترونیکی · کاهش برد و نرخ آتش برجک‌ها';
  }
  if (enemy.isStealth) {
    return 'رادارگریز پنهان‌کار · نیازمند پوشش برج رادار';
  }
  if (enemy.shape === 'ballistic_missile') {
    return 'موشک بالستیک پرسرعت · قوس پروازی بلند و تخریب بالا';
  }
  if (enemy.shape === 'cruise_missile') {
    return 'موشک کروز ارتفاع پست · سرعت بالا در مسیر هم‌سطح';
  }
  if (enemy.doctrine === 'fighter_bomber' || enemy.doctrine === 'command_orbit') {
    return 'بمب‌افکن سنگین · رهاسازی بمب و موشک از ارتفاع امن';
  }
  if (enemy.doctrine === 'strike_fighter') {
    return 'جنگنده بمب‌افکن · عبورهای متناوب و شلیک موشک هدایت‌شونده';
  }
  if (enemy.flaresCount) {
    return 'تهاجمی پیشرفته · مجهز به منور حرارتی ضدموشک';
  }
  return 'پهپاد تهاجمی · حمله به برجک‌های پدافندی و پایگاه مرکزی';
}

function UnitFallbackSilhouette({
  isEnemy,
  color,
  shape,
}: {
  isEnemy: boolean;
  color: string;
  shape: string;
}) {
  if (isEnemy) {
    return (
      <svg viewBox="0 0 160 100" className="w-28 h-20 opacity-90" aria-hidden="true">
        <defs>
          <linearGradient id={`grad-${shape}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <polygon
          points="80,14 140,66 96,62 92,84 80,76 68,84 64,62 20,66"
          fill={`url(#grad-${shape})`}
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="2"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 160 100" className="w-28 h-20 opacity-90" aria-hidden="true">
      <ellipse cx="80" cy="78" rx="44" ry="12" fill="rgba(15,23,42,0.85)" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
      <rect x="58" y="42" width="44" height="34" rx="6" fill={color} stroke="rgba(255,255,255,0.28)" strokeWidth="2" />
      <rect x="74" y="16" width="12" height="32" rx="3" fill="#cbd5e1" />
    </svg>
  );
}

export const UnitDatabase: React.FC<UnitDatabaseProps> = ({ onSelectUnit }) => {
  const [activeTab, setActiveTab] = useState<'towers' | 'enemies'>('towers');
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const generated = renderUnitThumbnailsBatch(DEFENSE_TOWERS, ENEMY_UNITS);
      setThumbnails(generated);
    }, 30);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div dir="rtl" className="flex-1 overflow-y-auto bg-[#070b14] text-slate-100">
      <div className="max-w-7xl mx-auto safe-x-padding sm:px-6 lg:px-8 py-6 sm:py-8 short:py-3 space-y-6 short:space-y-3">
        {/* Clean Header + Segment Switcher */}
        <div className="flex flex-col sm:flex-row short:flex-row sm:items-end short:items-center justify-between gap-4 short:gap-2 pb-5 short:pb-2.5 border-b border-white/10">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl short:text-sm font-bold text-white tracking-tight truncate">
              دایرةالمعارف تجهیزات و واحدهای هوایی
            </h1>
            <p className="text-xs sm:text-sm short:hidden text-slate-400 mt-1">
              رده‌بندی هوشمند و مشخصات رزمی {DEFENSE_TOWERS.length} سامانه پدافندی واقعی و {ENEMY_UNITS.length} کلاس هواگرد و موشک دشمن
            </p>
          </div>

          <div className="inline-flex items-center p-1 short:p-0.5 rounded-xl bg-[#0d1424] border border-white/10 self-start sm:self-auto shrink-0">
            <button
              onClick={() => setActiveTab('towers')}
              className={`px-4 py-2 short:px-3 short:py-1.5 rounded-lg text-xs sm:text-sm short:text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'towers'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4 short:w-3.5 short:h-3.5" />
              <span>سامانه‌های پدافندی ({DEFENSE_TOWERS.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('enemies')}
              className={`px-4 py-2 short:px-3 short:py-1.5 rounded-lg text-xs sm:text-sm short:text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'enemies'
                  ? 'bg-rose-500 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Plane className="w-4 h-4 short:w-3.5 short:h-3.5" />
              <span>تهدیدات هوایی ({ENEMY_UNITS.length})</span>
            </button>
          </div>
        </div>

        {/* Defense Towers Tiered Showcase Sections */}
        {activeTab === 'towers' ? (
          <div className="space-y-8 short:space-y-4">
            {TIER_ORDER.map((tierNum) => {
              const tierMeta = TOWER_TIER_META[tierNum];
              const tierTowers = DEFENSE_TOWERS.filter((t) => t.tier === tierNum);
              if (tierTowers.length === 0) return null;

              return (
                <section key={tierNum} className="space-y-3.5 short:space-y-2">
                  {/* Tier Section Header + Subtle Horizontal Divider */}
                  <div className="flex items-center gap-3 short:gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${tierMeta.dotClass}`} aria-hidden="true" />
                    <h2 className={`text-sm sm:text-base short:text-xs font-bold tracking-tight whitespace-nowrap ${tierMeta.badgeClass}`}>
                      {tierMeta.titleFa}
                    </h2>
                    <span className={`flex-1 h-px ${tierMeta.dividerClass}`} aria-hidden="true" />
                    <span className="text-[11px] short:text-[10px] font-mono text-slate-400 tabular-nums whitespace-nowrap">
                      {tierTowers.length} سامانه
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 short:grid-cols-3 lg:grid-cols-3 gap-5 short:gap-3">
                    {tierTowers.map((tower) => {
                      const thumb = thumbnails[`tower:${tower.id}`];
                      const isRadar = tower.shape === 'radar_dish';

                      return (
                        <article
                          key={tower.id}
                          onClick={() => onSelectUnit(tower)}
                          className="group rounded-2xl short:rounded-xl border border-white/10 hover:border-amber-400/45 bg-[#0c1322] overflow-hidden transition-all cursor-pointer flex flex-col"
                        >
                          {/* 3D Studio Render Stage */}
                          <div className="relative aspect-[16/10] short:aspect-[16/9] w-full bg-[radial-gradient(ellipse_at_center,_rgba(30,45,74,0.68)_0%,_rgba(8,13,24,0.98)_76%)] border-b border-white/8 flex items-center justify-center overflow-hidden">
                            <div
                              className="absolute inset-0 opacity-20 pointer-events-none"
                              style={{
                                backgroundImage:
                                  'radial-gradient(circle at 50% 60%, ' + tower.color + ' 0%, transparent 62%)',
                              }}
                            />
                            {thumb ? (
                              <img
                                src={thumb}
                                alt={tower.persianName}
                                className="relative z-10 w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <UnitFallbackSilhouette isEnemy={false} color={tower.color} shape={tower.shape} />
                            )}

                            {/* Clean corner metadata */}
                            <div className="absolute top-3 right-3 left-3 z-20 flex items-center justify-between text-[11px] font-medium">
                              <span className={`${tierMeta.badgeClass} drop-shadow`}>
                                {tower.tierLabelFa} · زره {tower.maxHp}
                              </span>
                              <span className="font-mono font-bold text-amber-300 tabular-nums drop-shadow">
                                ${tower.buildCost}
                              </span>
                            </div>
                          </div>

                          {/* Card Details */}
                          <div className="p-4 short:p-2.5 flex-1 flex flex-col justify-between gap-3.5 short:gap-2">
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="text-base short:text-xs font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                                  {tower.persianName}
                                </h3>
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: tower.color }}
                                />
                              </div>
                              <p className="text-xs short:text-[10px] text-sky-300/90 mt-1 short:mt-0.5 font-medium truncate">
                                {getTowerRoleFa(tower)}
                              </p>
                              <p className="text-xs short:text-[10px] text-slate-400 mt-1.5 short:mt-1 leading-relaxed short:line-clamp-2">
                                {tower.description}
                              </p>
                            </div>

                            {/* Tabular Spec Row */}
                            <div className="pt-3 short:pt-2 border-t border-white/8 grid grid-cols-3 gap-2 short:gap-1 text-center">
                              <div className="rounded-lg bg-[#080e1a] py-2 px-1">
                                <span className="text-[10px] text-slate-400 block">
                                  {isRadar ? 'تقویت برد' : 'آسیب'}
                                </span>
                                <span className="font-mono text-xs font-bold text-white tabular-nums mt-0.5 block">
                                  {isRadar
                                    ? '+۳۵٪'
                                    : tower.id === 'iron_dome_pod'
                                      ? `۳×${tower.damagePerShot}`
                                      : tower.damagePerShot}
                                </span>
                              </div>
                              <div className="rounded-lg bg-[#080e1a] py-2 px-1">
                                <span className="text-[10px] text-slate-400 block">
                                  {isRadar ? 'شعاع کشف' : 'نرخ شلیک'}
                                </span>
                                <span className="font-mono text-xs font-bold text-sky-300 tabular-nums mt-0.5 block">
                                  {isRadar ? '۲۴ تا ۳۹م' : `${tower.fireRate}/ث`}
                                </span>
                              </div>
                              <div className="rounded-lg bg-[#080e1a] py-2 px-1">
                                <span className="text-[10px] text-slate-400 block">برد مؤثر</span>
                                <span className="font-mono text-xs font-bold text-emerald-300 tabular-nums mt-0.5 block">
                                  {tower.range}م
                                </span>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          /* Enemy Airborne Units Visual Showcase Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 short:grid-cols-3 lg:grid-cols-3 gap-5 short:gap-3">
            {ENEMY_UNITS.map((enemy) => {
              const thumb = thumbnails[`enemy:${enemy.id}`];
              const isNewJet = enemy.id === 'crimson_raptor';

              return (
                <article
                  key={enemy.id}
                  onClick={() => onSelectUnit(enemy)}
                  className="group rounded-2xl short:rounded-xl border border-white/10 hover:border-rose-400/45 bg-[#0c1322] overflow-hidden transition-all cursor-pointer flex flex-col"
                >
                  {/* 3D Studio Render Stage */}
                  <div className="relative aspect-[16/10] short:aspect-[16/9] w-full bg-[radial-gradient(ellipse_at_center,_rgba(56,22,36,0.52)_0%,_rgba(8,13,24,0.98)_76%)] border-b border-white/8 flex items-center justify-center overflow-hidden">
                    <div
                      className="absolute inset-0 opacity-22 pointer-events-none"
                      style={{
                        backgroundImage:
                          'radial-gradient(circle at 50% 55%, ' + enemy.color + ' 0%, transparent 62%)',
                      }}
                    />
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={enemy.persianName}
                        className="relative z-10 w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <UnitFallbackSilhouette isEnemy color={enemy.color} shape={enemy.shape} />
                    )}

                    <div className="absolute top-3 right-3 left-3 z-20 flex items-center justify-between text-[11px] font-medium">
                      <span className="inline-flex items-center gap-1 text-slate-200/95 drop-shadow">
                        {enemy.isBoss ? (
                          <Crown className="w-3.5 h-3.5 text-rose-400" />
                        ) : enemy.jammerRadius ? (
                          <Radio className="w-3.5 h-3.5 text-violet-400" />
                        ) : enemy.isStealth ? (
                          <EyeOff className="w-3.5 h-3.5 text-sky-400" />
                        ) : enemy.shape === 'enemy_fighter' ? (
                          <Plane className="w-3.5 h-3.5 text-rose-400" />
                        ) : enemy.shape === 'ballistic_missile' || enemy.shape === 'cruise_missile' ? (
                          <Flame className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <Crosshair className="w-3.5 h-3.5 text-amber-300" />
                        )}
                        <span>{isNewJet ? 'جنگنده جدید' : enemy.type}</span>
                      </span>
                      <span className="font-mono font-bold text-emerald-300 tabular-nums drop-shadow">
                        +${enemy.killReward}
                      </span>
                    </div>
                  </div>

                  {/* Card Details */}
                  <div className="p-4 short:p-2.5 flex-1 flex flex-col justify-between gap-3.5 short:gap-2">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-base short:text-xs font-bold text-white group-hover:text-rose-300 transition-colors truncate">
                          {enemy.persianName}
                        </h2>
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: enemy.color }}
                        />
                      </div>
                      <p className="text-xs short:text-[10px] text-rose-300/90 mt-1 short:mt-0.5 font-medium truncate">
                        {getEnemyRoleFa(enemy)}
                      </p>
                      <p className="text-xs short:text-[10px] text-slate-400 mt-1.5 short:mt-1 leading-relaxed short:line-clamp-2">
                        {enemy.description}
                      </p>
                    </div>

                    {/* Tabular Spec Row */}
                    <div className="pt-3 short:pt-2 border-t border-white/8 grid grid-cols-3 gap-2 short:gap-1 text-center">
                      <div className="rounded-lg bg-[#080e1a] py-2 px-1">
                        <span className="text-[10px] text-slate-400 block">استحکام (HP)</span>
                        <span className="font-mono text-xs font-bold text-rose-300 tabular-nums mt-0.5 block">
                          {enemy.hp}
                        </span>
                      </div>
                      <div className="rounded-lg bg-[#080e1a] py-2 px-1">
                        <span className="text-[10px] text-slate-400 block">سرعت پرواز</span>
                        <span className="font-mono text-xs font-bold text-sky-300 tabular-nums mt-0.5 flex items-center justify-center gap-0.5">
                          <Gauge className="w-3 h-3" />
                          {enemy.speed}
                        </span>
                      </div>
                      <div className="rounded-lg bg-[#080e1a] py-2 px-1">
                        <span className="text-[10px] text-slate-400 block">ویژگی</span>
                        <span className="text-[11px] font-semibold text-amber-300 mt-0.5 flex items-center justify-center gap-0.5">
                          {enemy.flaresCount ? (
                            <>
                              <Zap className="w-3 h-3" />
                              {enemy.flaresCount} منور
                            </>
                          ) : enemy.isStealth ? (
                            'رادارگریز'
                          ) : enemy.jammerRadius ? (
                            'اخلال‌گر'
                          ) : (
                            <>
                              <Target className="w-3 h-3" />
                              عادی
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
