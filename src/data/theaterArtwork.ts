import { MapBiome } from '../types/game';
import heroAirDefenseImg from '../assets/images/hero_air_defense_1795134097533.jpg';
import theaterAlpineImg from '../assets/images/theater_alpine_map_1795134096328.jpg';
import theaterCoastalImg from '../assets/images/theater_coastal_map_1795134096102.jpg';
import theaterDesertImg from '../assets/images/theater_desert_map_1795134096735.jpg';
import theaterArcticImg from '../assets/images/theater_arctic_map_1795199817847.jpg';

export const HERO_KEY_ART = heroAirDefenseImg;

export interface TheaterArtMeta {
  image: string;
  altFa: string;
  fallbackGradient: string;
  accentText: string;
  accentBorder: string;
  accentBar: string;
  sectorLabelFa: string;
  routeCoords: [number, number][]; // 10 stage [x%, y%] positions tailored to the theater artwork
}

export const THEATER_ARTWORK: Record<MapBiome, TheaterArtMeta> = {
  alpine: {
    image: theaterAlpineImg,
    altFa: 'نقشه تاکتیکی پایگاه کوهستانی سپر کوهستان',
    fallbackGradient: 'from-slate-900 via-emerald-950/70 to-slate-950',
    accentText: 'text-emerald-300',
    accentBorder: 'border-emerald-400/50',
    accentBar: 'bg-emerald-400',
    sectorLabelFa: 'بخش شمالی · ارتفاع ۲۸۵۰ متر',
    routeCoords: [
      [14, 74],
      [26, 60],
      [20, 42],
      [34, 30],
      [48, 44], // Stage 5 Mid-Boss
      [38, 67],
      [56, 74],
      [71, 61],
      [82, 43],
      [62, 26], // Stage 10 Chapter Boss
    ],
  },
  coastal: {
    image: theaterCoastalImg,
    altFa: 'نقشه تاکتیکی دژ ساحلی و اسکله ناوگان',
    fallbackGradient: 'from-slate-950 via-sky-950/70 to-slate-900',
    accentText: 'text-sky-300',
    accentBorder: 'border-sky-400/50',
    accentBar: 'bg-sky-400',
    sectorLabelFa: 'بخش خلیج · خط دفاع دریایی',
    routeCoords: [
      [17, 73],
      [32, 80],
      [48, 70],
      [37, 52],
      [25, 38], // Stage 15 Mid-Boss
      [44, 35],
      [60, 52],
      [76, 62],
      [83, 40],
      [71, 22], // Stage 20 Chapter Boss
    ],
  },
  desert: {
    image: theaterDesertImg,
    altFa: 'نقشه تاکتیکی پایگاه صحرایی طوفان کویر',
    fallbackGradient: 'from-stone-950 via-amber-950/60 to-slate-950',
    accentText: 'text-amber-300',
    accentBorder: 'border-amber-400/50',
    accentBar: 'bg-amber-400',
    sectorLabelFa: 'بخش فلات جنوبی · باند صحرایی',
    routeCoords: [
      [18, 76],
      [33, 66],
      [27, 47],
      [43, 36],
      [51, 56], // Stage 25 Mid-Boss
      [63, 72],
      [79, 64],
      [72, 44],
      [58, 28],
      [81, 25], // Stage 30 Chapter Boss
    ],
  },
  arctic: {
    image: theaterArcticImg,
    altFa: 'نقشه تاکتیکی دژ قطبی و یخبندان زیر شفق قطبی',
    fallbackGradient: 'from-slate-950 via-cyan-950/70 to-indigo-950',
    accentText: 'text-cyan-300',
    accentBorder: 'border-cyan-400/50',
    accentBar: 'bg-cyan-400',
    sectorLabelFa: 'بخش مدار قطبی · دمای -۳۸ درجه',
    routeCoords: [
      [66, 78],
      [50, 72],
      [30, 68],
      [22, 49],
      [42, 54], // Stage 35 Mid-Boss (Snow Airstrip)
      [60, 52],
      [77, 46],
      [64, 32],
      [45, 29],
      [32, 26], // Stage 40 Final Boss (Polar Radar Ridge)
    ],
  },
};
