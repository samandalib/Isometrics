import { useEffect, useMemo, useRef, useState } from "react";
import { Ctrl, PanelShell, Toggle } from "@/components/AttrPanel";
import {
  buildCube2InteractiveHtml,
  cube2ConfigToJson,
} from "@/lib/diagram-export";

/** Isometric projection */
function iso(u: number, v: number, z: number): [number, number] {
  return [0.866 * (u - v), 0.5 * (u + v) - z];
}

type Pt = [number, number];

/** Rounded polygon path */
function roundPoly(pts: Pt[], r: number) {
  const n = pts.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n] as Pt;
    const cur = pts[i] as Pt;
    const next = pts[(i + 1) % n] as Pt;
    const v1: Pt = [prev[0] - cur[0], prev[1] - cur[1]];
    const v2: Pt = [next[0] - cur[0], next[1] - cur[1]];
    const l1 = Math.hypot(v1[0], v1[1]) || 1;
    const l2 = Math.hypot(v2[0], v2[1]) || 1;
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const p1: Pt = [cur[0] + (v1[0] / l1) * rr, cur[1] + (v1[1] / l1) * rr];
    const p2: Pt = [cur[0] + (v2[0] / l2) * rr, cur[1] + (v2[1] / l2) * rr];
    d +=
      i === 0
        ? `M ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`
        : ` L ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`;
    d += ` Q ${cur[0].toFixed(2)} ${cur[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d + " Z";
}

export const CUBE2_MAX = 9;

const SLOTS: { u: number; v: number }[] = [
  { u: 0, v: 0 },
  { u: 0, v: 1 },
  { u: 0.95, v: -0.25 },
  { u: 1.5, v: 0.5 },
  { u: 1, v: 1.05 },
  { u: -0.15, v: -0.9 },
  { u: 1.85, v: -0.15 },
  { u: 0.45, v: 1.7 },
  { u: 1.95, v: 1.2 },
];

const DEFAULT_HEIGHTS = [95, 88, 48, 72, 70, 62, 80, 55, 76];

export type Cube2Config = {
  count: number;
  heights: number[];
  size: number;
  radius: number;
  outerStroke: number;
  innerStroke: number;
  jump: number;
  showDots: boolean;
  dotCount: number;
  dotSize: number;
  dotSpacing: number;
  pulse: number;
};

type CubeDef = { id: string; u: number; v: number; h: number };

export function cubesFromConfig(cfg: Cube2Config): CubeDef[] {
  const n = Math.max(1, Math.min(CUBE2_MAX, Math.round(cfg.count)));
  const used = SLOTS.slice(0, n);
  const midU = used.reduce((s, c) => s + c.u, 0) / n + 0.5;
  const midV = used.reduce((s, c) => s + c.v, 0) / n + 0.5;
  return used.map((slot, i) => ({
    id: `c${i}`,
    u: slot.u - midU,
    v: slot.v - midV,
    h: cfg.heights[i] ?? DEFAULT_HEIGHTS[i] ?? 64,
  }));
}

const DEFAULTS: Cube2Config = {
  count: 5,
  heights: [...DEFAULT_HEIGHTS],
  size: 60,
  radius: 12,
  outerStroke: 2.2,
  innerStroke: 0.9,
  jump: 26,
  showDots: true,
  dotCount: 4,
  dotSize: 0.85,
  dotSpacing: 2.6,
  pulse: 1.9,
};

function ribbonPath(side: number, r: number) {
  const s = side;
  const pts: Pt[] = [
    [s * r * 0.04, -r * 0.92],
    [s * r * 1.32, r * 0.06],
    [s * r * 1.4, r * 1.82],
    [s * r * 0.94, r * 1.36],
    [s * r * 0.48, r * 1.82],
    [s * r * 0.18, r * 0.18],
  ];
  return `M ${pts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" L ")} Z`;
}

function Medal({
  x,
  y,
  r,
  stroke,
}: {
  x: number;
  y: number;
  r: number;
  stroke: number;
}) {
  const one = [
    `M ${(-r * 0.22).toFixed(2)} ${(-r * 0.18).toFixed(2)}`,
    `L ${(r * 0.08).toFixed(2)} ${(-r * 0.42).toFixed(2)}`,
    `L ${(r * 0.08).toFixed(2)} ${(r * 0.34).toFixed(2)}`,
  ].join(" ");
  const base = `M ${(-r * 0.22).toFixed(2)} ${(r * 0.34).toFixed(2)} L ${(r * 0.28).toFixed(2)} ${(r * 0.34).toFixed(2)}`;
  return (
    <g
      transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinejoin="round"
      strokeLinecap="round"
      pointerEvents="none"
    >
      <path d={ribbonPath(-1, r)} className="fill-background" stroke="none" />
      <path d={ribbonPath(1, r)} className="fill-background" stroke="none" />
      <path d={ribbonPath(-1, r)} />
      <path d={ribbonPath(1, r)} />
      <circle cx={0} cy={0} r={r} className="fill-background" stroke="none" />
      <circle cx={0} cy={0} r={r} />
      <path d={one} />
      <path d={base} />
    </g>
  );
}

function DotLight({
  x,
  y,
  seed,
  cfg,
}: {
  x: number;
  y: number;
  seed: number;
  cfg: Cube2Config;
}) {
  const dots: React.ReactNode[] = [];
  const n = cfg.dotCount;
  const mid = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const p = iso((i - mid) * cfg.dotSpacing, (j - mid) * cfg.dotSpacing, 0);
      const delay = ((i * n + j + seed * 3) % 12) * 0.16;
      dots.push(
        <circle
          key={`${i}-${j}`}
          cx={x + p[0]}
          cy={y + p[1]}
          r={cfg.dotSize}
          className="fill-foreground"
          style={{
            animation: `cube2-dot ${cfg.pulse}s ease-in-out ${delay}s infinite`,
          }}
        />,
      );
    }
  }
  return <g>{dots}</g>;
}

export function CubeCluster2() {
  const [cfg, setCfg] = useState<Cube2Config>(DEFAULTS);
  const [hover, setHover] = useState<string | null>(null);
  const [lift, setLift] = useState<Record<string, number>>({});
  const cubes = useMemo(() => cubesFromConfig(cfg), [cfg]);
  const raf = useRef<number>(0);
  const hoverRef = useRef<string | null>(null);
  hoverRef.current = hover;
  const jumpRef = useRef(cfg.jump);
  jumpRef.current = cfg.jump;
  const cubesRef = useRef(cubes);
  cubesRef.current = cubes;

  useEffect(() => {
    if (hover && !cubes.some((c) => c.id === hover)) setHover(null);
  }, [cubes, hover]);

  useEffect(() => {
    const tick = () => {
      setLift((prev) => {
        let changed = false;
        const next: Record<string, number> = { ...prev };
        for (const c of cubesRef.current) {
          const target = hoverRef.current === c.id ? jumpRef.current : 0;
          const cur = prev[c.id] ?? 0;
          const val = cur + (target - cur) * 0.16;
          if (Math.abs(val - cur) > 0.01) {
            next[c.id] = val;
            changed = true;
          } else if (cur !== target) {
            next[c.id] = target;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const ordered = [...cubes].sort((a, b) => a.u + a.v - (b.u + b.v));
  const S = cfg.size;
  const tallest = cubes.reduce((best, c) => {
    const h = c.h + (lift[c.id] ?? 0);
    const bh = best.h + (lift[best.id] ?? 0);
    return h > bh ? c : best;
  });
  const medalR = Math.max(14, S * 0.28);
  const medalAt = iso(
    (tallest.u + 0.5) * S,
    (tallest.v + 0.5) * S,
    tallest.h + (lift[tallest.id] ?? 0) + medalR * 2.2 + 12,
  );
  const set =
    <K extends keyof Cube2Config>(k: K) =>
    (v: number) =>
      setCfg((c) => ({ ...c, [k]: v }));

  const setCount = (n: number) => {
    setCfg((c) => {
      const heights = [...c.heights];
      while (heights.length < n) {
        heights.push(DEFAULT_HEIGHTS[heights.length] ?? 64);
      }
      return { ...c, count: n, heights };
    });
  };

  const setHeight = (i: number) => (v: number) => {
    setCfg((c) => {
      const heights = [...c.heights];
      heights[i] = v;
      return { ...c, heights };
    });
  };

  const exportHandlers = useMemo(
    () => ({
      filename: "cube-cluster-2.html",
      getJson: () => cube2ConfigToJson(cfg),
      getHtml: () => buildCube2InteractiveHtml(cfg, cubes),
    }),
    [cfg, cubes],
  );

  return (
    <div className="grid w-full gap-10 lg:grid-cols-[1fr_260px]">
      <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-card/30">
        <style>{`@keyframes cube2-dot{0%,100%{opacity:.12}50%{opacity:.95}}`}</style>
        <svg
          viewBox="-220 -290 440 520"
          className="h-[520px] w-full text-foreground"
          onPointerLeave={() => setHover(null)}
        >
          {ordered.map((c, idx) => {
            const z = lift[c.id] ?? 0;
            const u0 = c.u * S;
            const v0 = c.v * S;
            const top = c.h + z;
            const tA = iso(u0, v0, top);
            const tB = iso(u0 + S, v0, top);
            const tC = iso(u0 + S, v0 + S, top);
            const tD = iso(u0, v0 + S, top);
            const bB = iso(u0 + S, v0, z);
            const bC = iso(u0 + S, v0 + S, z);
            const bD = iso(u0, v0 + S, z);

            const silhouette: Pt[] = [tA, tB, bB, bC, bD, tD];
            const center = iso(u0 + S / 2, v0 + S / 2, top);

            return (
              <g
                key={c.id}
                onPointerEnter={() => setHover(c.id)}
                className="cursor-pointer"
              >
                <path
                  d={roundPoly(silhouette, cfg.radius)}
                  className="fill-background"
                  stroke="none"
                />
                <path
                  d={roundPoly([tA, tB, tC, tD], cfg.radius)}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity={0.45}
                  strokeWidth={cfg.innerStroke}
                  strokeLinejoin="round"
                />
                <path
                  d={`M ${tC[0].toFixed(2)} ${tC[1].toFixed(2)} L ${bC[0].toFixed(2)} ${bC[1].toFixed(2)}`}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity={0.45}
                  strokeWidth={cfg.innerStroke}
                />
                <path
                  d={roundPoly(silhouette, cfg.radius)}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity={hover === c.id ? 0.95 : 0.7}
                  strokeWidth={cfg.outerStroke}
                  strokeLinejoin="round"
                />
                {cfg.showDots !== false ? (
                  <DotLight x={center[0]} y={center[1]} seed={idx} cfg={cfg} />
                ) : null}
              </g>
            );
          })}
          <Medal
            x={medalAt[0]}
            y={medalAt[1]}
            r={medalR}
            stroke={Math.max(1.15, cfg.innerStroke * 1.55)}
          />
        </svg>
      </div>

      <PanelShell onReset={() => setCfg(DEFAULTS)} export={exportHandlers}>
        <Ctrl
          label="Cubes"
          value={cfg.count}
          min={1}
          max={CUBE2_MAX}
          step={1}
          onChange={setCount}
        />
        {Array.from({ length: cfg.count }, (_, i) => (
          <Ctrl
            key={i}
            label={`Height ${i + 1}`}
            value={cfg.heights[i] ?? DEFAULT_HEIGHTS[i] ?? 64}
            min={16}
            max={140}
            step={1}
            onChange={setHeight(i)}
          />
        ))}
        <Ctrl
          label="Cube size"
          value={cfg.size}
          min={30}
          max={90}
          step={1}
          onChange={set("size")}
        />
        <Ctrl
          label="Corner radius"
          value={cfg.radius}
          min={0}
          max={26}
          step={0.5}
          onChange={set("radius")}
        />
        <Ctrl
          label="Outer weight"
          value={cfg.outerStroke}
          min={0.5}
          max={6}
          step={0.1}
          onChange={set("outerStroke")}
        />
        <Ctrl
          label="Inner weight"
          value={cfg.innerStroke}
          min={0.2}
          max={3}
          step={0.1}
          onChange={set("innerStroke")}
        />
        <Ctrl
          label="Hover jump"
          value={cfg.jump}
          min={0}
          max={70}
          step={1}
          onChange={set("jump")}
        />
        <Toggle
          label="Dot grid"
          on={cfg.showDots !== false}
          onChange={(v) => setCfg((c) => ({ ...c, showDots: v }))}
        />
        <Ctrl
          label="Dot grid size"
          value={cfg.dotCount}
          min={2}
          max={8}
          step={1}
          onChange={set("dotCount")}
        />
        <Ctrl
          label="Dot size"
          value={cfg.dotSize}
          min={0.3}
          max={2.5}
          step={0.05}
          onChange={set("dotSize")}
        />
        <Ctrl
          label="Dot spacing"
          value={cfg.dotSpacing}
          min={1.2}
          max={6}
          step={0.1}
          onChange={set("dotSpacing")}
        />
        <Ctrl
          label="Pulse speed"
          value={cfg.pulse}
          min={0.4}
          max={5}
          step={0.1}
          onChange={set("pulse")}
        />
      </PanelShell>
    </div>
  );
}
