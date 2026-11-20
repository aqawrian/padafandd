import React, { useEffect, useRef, useState } from 'react';
import { RadarSnapshot } from '../types/game';
import { Radio } from 'lucide-react';

interface TacticalRadarProps {
  snapshotRef: React.MutableRefObject<RadarSnapshot>;
}

const RADAR_SIZE = 112;
const WORLD_RADIUS = 74;

/**
 * Lightweight 15 FPS Direct-Canvas Tactical Air-Defense Radar.
 * Reads directly from a mutable ref so zero React re-renders occur during heavy combat!
 */
export const TacticalRadar: React.FC<TacticalRadarProps> = ({ snapshotRef }) => {
  const [collapsed, setCollapsed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (collapsed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let sweepAngle = 0;

    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const snap = snapshotRef.current;
      const cx = RADAR_SIZE / 2;
      const cy = RADAR_SIZE / 2;
      const r = RADAR_SIZE / 2 - 4;

      sweepAngle = (sweepAngle + 0.14) % (Math.PI * 2);

      // Clear circular radar scope
      ctx.clearRect(0, 0, RADAR_SIZE, RADAR_SIZE);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();

      // Deep tactical slate background
      ctx.fillStyle = 'rgba(7, 13, 24, 0.92)';
      ctx.fillRect(0, 0, RADAR_SIZE, RADAR_SIZE);

      // Range rings + crosshair axes
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
      ctx.lineWidth = 1;
      for (const frac of [0.35, 0.68, 0.98]) {
        ctx.beginPath();
        ctx.arc(cx, cy, r * frac, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - r, cy);
      ctx.lineTo(cx + r, cy);
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx, cy + r);
      ctx.stroke();

      // Regional Radar Uplink Coverage Bubbles (IADS Overlapping Zones)
      const zones = snap.radarZones;
      if (zones && zones.length > 0) {
        for (let i = 0; i < zones.length; i++) {
          const z = zones[i];
          const zx = cx + (z.x / WORLD_RADIUS) * r;
          const zz = cy + (z.z / WORLD_RADIUS) * r;
          const zr = (z.radius / WORLD_RADIUS) * r;
          ctx.fillStyle = 'rgba(245, 158, 11, 0.11)';
          ctx.beginPath();
          ctx.arc(zx, zz, zr, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.46)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Rotating radar sweep wedge
      const grad = ctx.createConicGradient(sweepAngle, cx, cy);
      grad.addColorStop(0.0, 'rgba(56, 189, 248, 0.28)');
      grad.addColorStop(0.14, 'rgba(56, 189, 248, 0.0)');
      grad.addColorStop(1.0, 'rgba(56, 189, 248, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, sweepAngle, sweepAngle + 0.8);
      ctx.closePath();
      ctx.fill();

      // Incoming wave sector markers (perimeter threat arcs when idle)
      if (!snap.waveActive && snap.incomingSectors.length > 0) {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
        ctx.lineWidth = 3;
        for (let i = 0; i < snap.incomingSectors.length; i++) {
          const ang = snap.incomingSectors[i];
          ctx.beginPath();
          ctx.arc(cx, cy, r - 2, ang - 0.25, ang + 0.25);
          ctx.stroke();
        }
      }

      // HQ Bunker center beacon
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();

      // Live Towers, Radar Uplinks, Aircraft & Incoming Ordnance Blips
      const blips = snap.blips;
      for (let i = 0; i < blips.length; i++) {
        const b = blips[i];
        const px = cx + (b.x / WORLD_RADIUS) * r;
        const pz = cy + (b.z / WORLD_RADIUS) * r;

        if (b.kind === 'tower') {
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(px - 1.6, pz - 1.6, 3.2, 3.2);
        } else if (b.kind === 'radar_tower') {
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(px - 2.1, pz - 2.1, 4.2, 4.2);
        } else if (b.kind === 'facility') {
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(px - 2.4, pz - 2.4, 4.8, 4.8);
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 1.1;
          ctx.strokeRect(px - 2.4, pz - 2.4, 4.8, 4.8);
        } else if (b.kind === 'ally_fighter') {
          ctx.fillStyle = '#22d3ee';
          ctx.beginPath();
          ctx.moveTo(px, pz - 3.6);
          ctx.lineTo(px + 3.0, pz);
          ctx.lineTo(px, pz + 3.6);
          ctx.lineTo(px - 3.0, pz);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#ecfeff';
          ctx.lineWidth = 0.9;
          ctx.stroke();
        } else if (b.kind === 'boss') {
          ctx.fillStyle = '#f43f5e';
          ctx.beginPath();
          ctx.arc(px, pz, 4.0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fda4af';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (b.kind === 'jammer') {
          ctx.fillStyle = '#c084fc';
          ctx.beginPath();
          ctx.arc(px, pz, 2.7, 0, Math.PI * 2);
          ctx.fill();
        } else if (b.kind === 'stealth') {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.78)';
          ctx.beginPath();
          ctx.arc(px, pz, 2.0, 0, Math.PI * 2);
          ctx.fill();
        } else if (b.kind === 'ordnance') {
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(px, pz, 1.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 0.9;
          ctx.stroke();
        } else {
          ctx.fillStyle = '#fb923c';
          ctx.beginPath();
          ctx.arc(px, pz, 2.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();

      // Outer crisp rim
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }, 66); // ~15 FPS throttled

    return () => window.clearInterval(timer);
  }, [collapsed, snapshotRef]);

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-1">
      {!collapsed ? (
        <div className="relative rounded-full shadow-2xl">
          <canvas
            ref={canvasRef}
            width={RADAR_SIZE}
            height={RADAR_SIZE}
            className="block rounded-full w-[76px] h-[76px] md:w-[112px] md:h-[112px] short:w-[64px] short:h-[64px]"
          />
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            title="جمع کردن رادار"
            aria-label="جمع کردن رادار"
            className="absolute -top-1.5 -right-1.5 w-7 h-7 short:w-6 short:h-6 rounded-full bg-[#0a0f1c] border border-white/15 text-sky-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5 short:w-3 short:h-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="نمایش رادار تاکتیکی"
          className="px-2.5 py-1.5 short:px-2.5 short:py-1.5 min-h-[34px] rounded-xl bg-[#0a0f1c]/90 border border-white/12 text-sky-300 hover:text-white text-[11px] short:text-[10px] font-semibold flex items-center gap-1.5 shadow-xl transition-colors cursor-pointer"
        >
          <Radio className="w-3.5 h-3.5 short:w-3 short:h-3" />
          <span>رادار</span>
        </button>
      )}
    </div>
  );
};
