import { useEffect, useRef, useState } from "react";
import { Ctrl, PanelShell } from "@/components/AttrPanel";

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

type CubeDef = { id: string; u: number; v: number; h: number };

const CUBES: CubeDef[] = [
  { id: "back", u: 0, v: 0, h: 95 },
  { id: "left", u: 0, v: 1, h: 88 },
  { id: "right", u: 0.95, v: -0.25, h: 48 },
  { id: "rightLow", u: 1.5, v: 0.5, h: 72 },
  { id: "front", u: 1, v: 1.05, h: 70 },
];

type CubeConfig = {
  size: number;
  radius: number;
  outerStroke: number;
  innerStroke: number;
  jump: number;
  dotCount: number;
  dotSize: number;
  dotSpacing: number;
  pulse: number;
};

const DEFAULTS: CubeConfig = {
  size: 60,
  radius: 12,
  outerStroke: 2.2,
  innerStroke: 0.9,
  jump: 26,
  dotCount: 4,
  dotSize: 0.85,
  dotSpacing: 2.6,
  pulse: 1.9,
};

function DotLight({
  x,
  y,
  seed,
  cfg,
}: {
  x: number;
  y: number;
  seed: number;
  cfg: CubeConfig;
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
            animation: `cube-dot ${cfg.pulse}s ease-in-out ${delay}s infinite`,
          }}
        />,
      );
    }
  }
  return <g>{dots}</g>;
}

export function CubeCluster() {
  const [cfg, setCfg] = useState<CubeConfig>(DEFAULTS);
  const [hover, setHover] = useState<string | null>(null);
  const [lift, setLift] = useState<Record<string, number>>(() =>
    Object.fromEntries(CUBES.map((c) => [c.id, 0])),
  );
  const raf = useRef<number>(0);
  const hoverRef = useRef<string | null>(null);
  hoverRef.current = hover;
  const jumpRef = useRef(cfg.jump);
  jumpRef.current = cfg.jump;

  useEffect(() => {
    const tick = () => {
      setLift((prev) => {
        let changed = false;
        const next: Record<string, number> = { ...prev };
        for (const c of CUBES) {
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

  const ordered = [...CUBES].sort((a, b) => a.u + a.v - (b.u + b.v));
  const S = cfg.size;
  const set =
    <K extends keyof CubeConfig>(k: K) =>
    (v: number) =>
      setCfg((c) => ({ ...c, [k]: v }));

  return (
    <div className="grid w-full gap-10 lg:grid-cols-[1fr_260px]">
      <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-card/30">
        <style>{`@keyframes cube-dot{0%,100%{opacity:.12}50%{opacity:.95}}`}</style>
        <svg
          viewBox="-160 -180 320 340"
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
                <DotLight x={center[0]} y={center[1]} seed={idx} cfg={cfg} />
              </g>
            );
          })}
        </svg>
      </div>

      <PanelShell onReset={() => setCfg(DEFAULTS)}>
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
        <Ctrl
          label="Dot grid"
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
