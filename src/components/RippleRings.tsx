import { useEffect, useMemo, useRef, useState } from "react";
import { Ctrl, PanelShell } from "@/components/AttrPanel";
import {
  buildRippleInteractiveHtml,
  rippleConfigToJson,
} from "@/lib/diagram-export";

/** Isometric projection */
function iso(u: number, v: number, z: number): [number, number] {
  return [0.866 * (u - v), 0.5 * (u + v) - z];
}

type Pt = [number, number];

export type RippleConfig = {
  rings: number;
  radius: number;
  innerRadius: number;
  depth: number;
  stroke: number;
  meridians: number;
  flowCount: number;
  flowSpeed: number;
  twist: number;
  fade: number;
};

const DEFAULTS: RippleConfig = {
  rings: 6,
  radius: 92,
  innerRadius: 10,
  depth: 78,
  stroke: 0.9,
  meridians: 8,
  flowCount: 5,
  flowSpeed: 0.22,
  twist: 0.85,
  fade: 0.45,
};

function closePath(pts: Pt[]) {
  if (pts.length === 0) return "";
  return `M ${pts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" L ")} Z`;
}

/** Catmull–Rom spline through points, emitted as cubic Béziers. */
function smoothPath(pts: Pt[]) {
  if (pts.length < 2) return "";
  const p = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))]!;
  let d = `M ${p(0)[0].toFixed(2)} ${p(0)[1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = p(i - 1);
    const p1 = p(i);
    const p2 = p(i + 1);
    const p3 = p(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

function polyLen(pts: Pt[]) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    L += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return L;
}

/** t: 0 at the rim, 1 at the throat */
function profile(t: number, morph: number, cfg: RippleConfig) {
  const tf = Math.pow(Math.max(0, Math.min(1, t)), 0.82);
  const rOut = Math.max(cfg.radius, cfg.innerRadius + 1);
  const rIn = Math.min(cfg.innerRadius, rOut - 1);
  const rIdle = rOut - t * (rOut - rIn);
  const rFunnel = rIn + (rOut - rIn) * (1 - tf);
  const r = rIdle + (rFunnel - rIdle) * morph;
  const zIdle = 8 + t * 14;
  const zFunnel = cfg.depth * (1 - Math.pow(t, 0.72));
  const z = zIdle + (zFunnel - zIdle) * morph;
  return { r, z };
}

function at(
  t: number,
  angle: number,
  morph: number,
  cfg: RippleConfig,
): Pt {
  const { r, z } = profile(t, morph, cfg);
  return iso(Math.cos(angle) * r, Math.sin(angle) * r, z);
}

export function RippleRings() {
  const [cfg, setCfg] = useState<RippleConfig>(DEFAULTS);
  const [anim, setAnim] = useState({ morph: 0.12, phase: 0 });
  const pointer = useRef({ active: false });
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = Date.now();
      const target = pointer.current.active
        ? 1
        : 0.1 + 0.08 * Math.sin(now / 2600);
      setAnim((prev) => {
        const morph = prev.morph + (target - prev.morph) * 0.13;
        const phase = (now / 1000) * cfgRef.current.flowSpeed;
        if (
          Math.abs(morph - prev.morph) < 0.002 &&
          pointer.current.active === false &&
          Math.abs(morph - target) < 0.01
        ) {
          return { morph: target, phase };
        }
        return { morph, phase };
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const { rings, meridians, flows, offset } = useMemo(() => {
    const { morph, phase } = anim;
    const n = Math.max(3, Math.round(cfg.rings));
    const segs = 56;
    const ringList: { d: string; i: number }[] = [];

    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0;
      const pts: Pt[] = [];
      for (let k = 0; k < segs; k++) {
        pts.push(at(t, (k / segs) * Math.PI * 2, morph, cfg));
      }
      ringList.push({ d: closePath(pts), i });
    }

    const mCount = Math.max(0, Math.round(cfg.meridians));
    const meridianList: string[] = [];
    for (let m = 0; m < mCount; m++) {
      const ang = (m / mCount) * Math.PI * 2;
      const pts: Pt[] = [];
      for (let i = 0; i <= 24; i++) pts.push(at(i / 24, ang, morph, cfg));
      meridianList.push(smoothPath(pts));
    }

    const fCount = Math.max(0, Math.round(cfg.flowCount));
    const flowList: { d: string; len: number }[] = [];
    for (let f = 0; f < fCount; f++) {
      const base = ((f + 0.18) / Math.max(1, fCount)) * Math.PI * 2;
      const pts: Pt[] = [];
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const ease = t * t * (3 - 2 * t);
        const ang = base + cfg.twist * ease * Math.PI * 2;
        pts.push(at(t, ang, morph, cfg));
      }
      flowList.push({ d: smoothPath(pts), len: Math.max(1, polyLen(pts)) });
    }

    const rim = profile(0, morph, cfg);
    const throat = profile(1, morph, cfg);
    const yMin = -throat.z - 0.71 * rim.r;
    const yMax = -rim.z + 0.71 * rim.r;
    const ox = 0;
    const oy = -(yMin + yMax) / 2;

    return {
      rings: ringList,
      meridians: meridianList,
      flows: flowList,
      offset: [ox, oy] as const,
    };
  }, [cfg, anim]);

  const set =
    <K extends keyof RippleConfig>(k: K) =>
    (v: number) =>
      setCfg((c) => ({ ...c, [k]: v }));

  const exportHandlers = useMemo(
    () => ({
      filename: "ripple-rings.html",
      getJson: () => rippleConfigToJson(cfg),
      getHtml: () => buildRippleInteractiveHtml(cfg),
    }),
    [cfg],
  );

  return (
    <div className="grid w-full gap-10 lg:grid-cols-[1fr_260px]">
      <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-card/30">
        <svg
          viewBox="-140 -130 280 260"
          className="h-[520px] w-full touch-none select-none text-foreground"
          onPointerEnter={() => {
            pointer.current.active = true;
          }}
          onPointerMove={() => {
            pointer.current.active = true;
          }}
          onPointerLeave={() => {
            pointer.current.active = false;
          }}
        >
          <g
            transform={`translate(${offset[0].toFixed(2)} ${offset[1].toFixed(2)})`}
          >
            {meridians.map((d, i) => (
              <path
                key={`m-${i}`}
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth={cfg.stroke * 0.55}
                strokeOpacity={0.22 + anim.morph * 0.18}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}

            {rings.map(({ d, i }) => {
              const t = cfg.rings > 1 ? i / (cfg.rings - 1) : 0;
              const op = 0.35 + (1 - t) * cfg.fade;
              return (
                <path
                  key={`r-${i}`}
                  d={d}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={
                    i === 0 ? cfg.stroke * 1.35 : cfg.stroke * (1 - t * 0.25)
                  }
                  strokeOpacity={op}
                  strokeLinejoin="round"
                />
              );
            })}

            {flows.map(({ d, len }, i) => {
              const comet = len * 0.2;
              const gap = len * 0.8;
              const offset =
                -((((anim.phase * 0.35 + i / Math.max(1, flows.length)) % 1) +
                  1) %
                  1) * len;
              const op = 0.35 + anim.morph * 0.5;
              return (
                <g key={`f-${i}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={cfg.stroke * 0.4}
                    strokeOpacity={0.08 + anim.morph * 0.08}
                    strokeLinejoin="round"
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={cfg.stroke * 1.05}
                    strokeOpacity={op}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={`${comet.toFixed(1)} ${gap.toFixed(1)}`}
                    strokeDashoffset={offset.toFixed(1)}
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={cfg.stroke * 1.6}
                    strokeOpacity={op * 0.85}
                    strokeLinecap="round"
                    strokeDasharray={`${(len * 0.045).toFixed(1)} ${(len * 0.955).toFixed(1)}`}
                    strokeDashoffset={offset.toFixed(1)}
                  />
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <PanelShell onReset={() => setCfg(DEFAULTS)} export={exportHandlers}>
        <Ctrl
          label="Rings"
          value={cfg.rings}
          min={3}
          max={12}
          step={1}
          onChange={set("rings")}
        />
        <Ctrl
          label="Outer radius"
          value={cfg.radius}
          min={40}
          max={140}
          step={1}
          onChange={set("radius")}
        />
        <Ctrl
          label="Inner radius"
          value={cfg.innerRadius}
          min={2}
          max={40}
          step={1}
          onChange={set("innerRadius")}
        />
        <Ctrl
          label="Funnel depth"
          value={cfg.depth}
          min={20}
          max={140}
          step={1}
          onChange={set("depth")}
        />
        <Ctrl
          label="Line weight"
          value={cfg.stroke}
          min={0.3}
          max={3}
          step={0.1}
          onChange={set("stroke")}
        />
        <Ctrl
          label="Meridians"
          value={cfg.meridians}
          min={0}
          max={16}
          step={1}
          onChange={set("meridians")}
        />
        <Ctrl
          label="Flow curves"
          value={cfg.flowCount}
          min={0}
          max={12}
          step={1}
          onChange={set("flowCount")}
        />
        <Ctrl
          label="Flow speed"
          value={cfg.flowSpeed}
          min={0.05}
          max={1.2}
          step={0.05}
          onChange={set("flowSpeed")}
        />
        <Ctrl
          label="Spiral twist"
          value={cfg.twist}
          min={0}
          max={2}
          step={0.05}
          onChange={set("twist")}
        />
        <Ctrl
          label="Rim emphasis"
          value={cfg.fade}
          min={0}
          max={0.8}
          step={0.01}
          onChange={set("fade")}
        />
      </PanelShell>
    </div>
  );
}
