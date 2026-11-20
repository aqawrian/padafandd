import React from 'react';
import { SaveProfileV2, TechId } from '../types/game';
import {
  ACHIEVEMENTS,
  TECH_DOCTRINES,
  computeSpentStars,
  computeTotalEarnedStars,
} from '../data/techAndSave';
import {
  Award,
  Coins,
  Crosshair,
  Flame,
  Radio,
  RotateCcw,
  Shield,
  Star,
  X,
  Zap,
} from 'lucide-react';

interface TechLabModalProps {
  profile: SaveProfileV2;
  onUpgradeTech: (techId: TechId) => void;
  onResetTech: () => void;
  onClose: () => void;
}

const TECH_ICONS: Record<TechId, React.FC<{ className?: string }>> = {
  firepower: Crosshair,
  radar_net: Radio,
  war_economy: Coins,
  bunker_armor: Shield,
  rapid_command: Zap,
  blast_warheads: Flame,
};

const ACCENT_STYLES: Record<string, { iconBg: string; bar: string; border: string }> = {
  rose: { iconBg: 'bg-rose-500/15 text-rose-300', bar: 'bg-rose-400', border: 'border-rose-400/35' },
  sky: { iconBg: 'bg-sky-500/15 text-sky-300', bar: 'bg-sky-400', border: 'border-sky-400/35' },
  amber: { iconBg: 'bg-amber-500/15 text-amber-300', bar: 'bg-amber-400', border: 'border-amber-400/35' },
  emerald: { iconBg: 'bg-emerald-500/15 text-emerald-300', bar: 'bg-emerald-400', border: 'border-emerald-400/35' },
  violet: { iconBg: 'bg-violet-500/15 text-violet-300', bar: 'bg-violet-400', border: 'border-violet-400/35' },
  orange: { iconBg: 'bg-orange-500/15 text-orange-300', bar: 'bg-orange-400', border: 'border-orange-400/35' },
};

export const TechLabModal: React.FC<TechLabModalProps> = ({
  profile,
  onUpgradeTech,
  onResetTech,
  onClose,
}) => {
  const totalEarned = computeTotalEarnedStars(profile.starsByStage);
  const spentStars = computeSpentStars(profile.techLevels);
  const availableStars = Math.max(0, totalEarned - spentStars);

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-[#070b14]/96 flex flex-col justify-between safe-modal-padding overflow-y-auto"
    >
      {/* Top Bar */}
      <div className="max-w-5xl w-full mx-auto flex flex-wrap items-center justify-between gap-2.5 sm:gap-4 pb-3 short:pb-2 border-b border-white/10">
        <div>
          <h2 className="text-base sm:text-xl short:text-sm font-bold text-white tracking-tight">
            آزمایشگاه فناوری و دکترین فرماندهی
          </h2>
          <p className="text-xs short:hidden text-slate-400 mt-0.5">
            ستاره‌های کسب‌شده از ۴۰ مرحله را برای تقویت دائمی تمام برجک‌ها و پایگاه سرمایه‌گذاری کنید
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 short:px-2 short:py-1 rounded-xl bg-[#0e1526] border border-amber-400/30 text-xs short:text-[11px] font-mono tabular-nums">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="text-amber-300 font-bold">{availableStars}</span>
            <span className="text-slate-500">/ {totalEarned} آزاد</span>
          </div>

          {spentStars > 0 && (
            <button
              onClick={onResetTech}
              title="بازگردانی تمام ستاره‌های خرج‌شده بدون جریمه"
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 short:px-2 short:py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs short:text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>بازگردانی</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="px-3 py-1.5 sm:px-3.5 sm:py-2 short:px-2.5 short:py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white text-xs short:text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <X className="w-4 h-4 short:w-3.5 short:h-3.5" />
            <span>بستن</span>
          </button>
        </div>
      </div>

      {/* 6 Permanent Tech Doctrine Cards */}
      <div className="max-w-5xl w-full mx-auto my-auto py-4 short:py-2.5 space-y-5 short:space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 short:grid-cols-3 gap-3 short:gap-2">
          {TECH_DOCTRINES.map((doc) => {
            const Icon = TECH_ICONS[doc.id];
            const style = ACCENT_STYLES[doc.accent];
            const level = profile.techLevels[doc.id] ?? 0;
            const isMax = level >= 3;
            const nextCost = isMax ? 0 : doc.costs[level];
            const canBuy = !isMax && availableStars >= nextCost;

            return (
              <div
                key={doc.id}
                className={`flex flex-col justify-between p-4 short:p-2.5 rounded-2xl short:rounded-xl bg-[#0d1424] border transition-colors ${
                  level > 0 ? style.border : 'border-white/10'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 short:gap-2">
                      <div className={`w-10 h-10 short:w-8 short:h-8 rounded-xl short:rounded-lg flex items-center justify-center shrink-0 ${style.iconBg}`}>
                        <Icon className="w-5 h-5 short:w-4 short:h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm short:text-xs font-bold text-white truncate">{doc.titleFa}</h3>
                        <span className="text-[11px] short:text-[10px] font-mono text-slate-400 tabular-nums">
                          سطح {level} از ۳
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs short:text-[10px] text-slate-400 leading-relaxed mt-2.5 short:mt-1.5 line-clamp-2">
                    {doc.subtitleFa}
                  </p>

                  {/* 3-Level Progress Bars */}
                  <div className="grid grid-cols-3 gap-1.5 mt-3.5 short:mt-2">
                    {[0, 1, 2].map((idx) => {
                      const active = idx < level;
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div className={`h-full rounded-full ${active ? style.bar : 'w-0'}`} />
                          </div>
                          <span
                            className={`block text-[10px] font-mono tabular-nums truncate ${
                              active ? 'text-slate-200 font-semibold' : 'text-slate-500'
                            }`}
                          >
                            {doc.levelLabels[idx]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  disabled={!canBuy}
                  onClick={() => onUpgradeTech(doc.id)}
                  className={`mt-3.5 short:mt-2 w-full py-2.5 short:py-1.5 rounded-xl short:rounded-lg text-xs short:text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    isMax
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 cursor-default'
                      : canBuy
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : 'bg-white/5 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isMax ? (
                    <span>تکمیل‌شده</span>
                  ) : (
                    <>
                      <span>ارتقا به سطح {level + 1}</span>
                      <span className="flex items-center gap-1 font-mono tabular-nums">
                        <Star className="w-3.5 h-3.5 short:w-3 short:h-3 fill-current" />
                        {nextCost}
                      </span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Career Stats & Achievement Medals */}
        <div className="p-4 sm:p-5 short:p-3 rounded-2xl short:rounded-xl bg-[#0c1322] border border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs sm:text-sm font-bold text-white">نشان‌های افتخار و آمار فرماندهی</h3>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs short:text-[11px] text-slate-400 font-mono tabular-nums">
              <span>کل شکارها: <strong className="text-slate-100">{profile.stats.totalKills}</strong></span>
              <span aria-hidden="true">·</span>
              <span>باس‌ها: <strong className="text-rose-300">{profile.stats.bossesKilled}</strong></span>
              <span aria-hidden="true">·</span>
              <span>اعزام جنگنده: <strong className="text-sky-300">{profile.stats.capScrambles}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 short:grid-cols-6 gap-2 mt-3 short:mt-2">
            {ACHIEVEMENTS.map((ach) => {
              const unlocked = profile.achievements.includes(ach.id);
              return (
                <div
                  key={ach.id}
                  className={`p-2 rounded-xl border text-right ${
                    unlocked
                      ? 'bg-amber-500/10 border-amber-400/35 text-white'
                      : 'bg-white/[0.02] border-white/5 text-slate-500 opacity-65'
                  }`}
                >
                  <div className="text-xs short:text-[11px] font-semibold truncate">{ach.titleFa}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-snug line-clamp-2">{ach.descFa}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-5xl w-full mx-auto pt-2 text-[11px] short:hidden text-slate-500 text-center">
        تمام ارتقاها بلافاصله روی مرحله بعدی، مراحل فعلی و حالت بقای بی‌نهایت اعمال می‌شوند و به‌صورت خودکار ذخیره می‌گردند.
      </div>
    </div>
  );
};
