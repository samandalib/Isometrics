import { useEffect, useMemo, useRef, useState } from "react";
import { Ctrl, PanelShell } from "@/components/AttrPanel";
import {
  buildTowerInteractiveHtml,
  towerConfigToJson,
} from "@/lib/diagram-export";
import { RepoviveLogoIso } from "@/components/RepoviveLogoIso";

/** Isometric projection — depth runs down-right */
function iso(u: number, v: number, z: number): [number, number] {
  return [0.866 * (u - v), 0.5 * (u + v) - z];
}

type Pt = [number, number];

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

type TowerConfig = {
  layers: number;
  size: number;
  thickness: number;
  pitch: number;
  radius: number;
  outerStroke: number;
  innerStroke: number;
  lift: number;
  guideStroke: number;
  iconScale: number;
};

const DEFAULTS: TowerConfig = {
  layers: 6,
  size: 72,
  thickness: 5,
  pitch: 2,
  radius: 4,
  outerStroke: 1.8,
  innerStroke: 0.75,
  lift: 38,
  guideStroke: 0.7,
  iconScale: 1,
};

function slabGeometry(S: number, z0: number, z1: number) {
  const tA = iso(0, 0, z1);
  const tB = iso(S, 0, z1);
  const tC = iso(S, S, z1);
  const tD = iso(0, S, z1);
  const bB = iso(S, 0, z0);
  const bC = iso(S, S, z0);
  const bD = iso(0, S, z0);
  const silhouette: Pt[] = [tA, tB, bB, bC, bD, tD];
  const top: Pt[] = [tA, tB, tC, tD];
  return { silhouette, top, tA, tB, tC, tD, bB, bC, bD, z0, z1 };
}

export function StackedTower() {
  const [cfg, setCfg] = useState<TowerConfig>(DEFAULTS);
  const [topLift, setTopLift] = useState(DEFAULTS.lift * 0.55);
  const pointer = useRef({ y: 0.45, active: false });
  const liftRef = useRef(cfg.lift);
  liftRef.current = cfg.lift;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const max = liftRef.current;
      const target = pointer.current.active
        ? max * (1 - pointer.current.y)
        : max * (0.42 + 0.08 * Math.sin(Date.now() / 2800));
      setTopLift((cur) => {
        const next = cur + (target - cur) * 0.14;
        return Math.abs(next - cur) > 0.02 ? next : target;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onMove = (e: React.PointerEvent) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    pointer.current = {
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
      active: true,
    };
  };

  const { slabs, guides, topZ, offset } = useMemo(() => {
    const { layers, size, thickness, pitch } = cfg;
    const step = thickness + pitch;
    const stack: ReturnType<typeof slabGeometry>[] = [];

    for (let i = 0; i < layers; i++) {
      const base = i * step;
      const z0 = i === layers - 1 ? base + topLift : base;
      const z1 = z0 + thickness;
      stack.push(slabGeometry(size, z0, z1));
    }

    const top = stack[layers - 1]!;
    const below = stack[layers - 2];
    const guidePts: { from: Pt; to: Pt }[] = [];
    if (below) {
      const corners: Pt[] = [
        [0, 0],
        [size, 0],
        [size, size],
        [0, size],
      ].map(([u, v]) => [u, v] as Pt);
      for (const [u, v] of corners) {
        guidePts.push({
          from: iso(u, v, below.z1),
          to: iso(u, v, top.z0),
        });
      }
    }

    const topSlab = stack[layers - 1]!;
    const span = (layers - 1) * step + thickness + cfg.lift;
    const xMin = -0.866 * size;
    const xMax = 0.866 * size;
    const yMin = -span;
    const yMax = 0.5 * size;
    const ox = -(xMin + xMax) / 2;
    const oy = -(yMin + yMax) / 2 - 8;

    return {
      slabs: stack,
      guides: guidePts,
      topZ: topSlab.z1,
      offset: [ox, oy] as const,
    };
  }, [cfg, topLift]);

  const set =
    <K extends keyof TowerConfig>(k: K) =>
    (v: number) =>
      setCfg((c) => ({ ...c, [k]: v }));

  const exportHandlers = useMemo(
    () => ({
      filename: "stacked-tower.html",
      getJson: () => towerConfigToJson(cfg),
      getHtml: () => buildTowerInteractiveHtml(cfg),
    }),
    [cfg],
  );

  return (
    <div className="grid w-full gap-10 lg:grid-cols-[1fr_260px]">
      <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-card/30">
        <svg
          viewBox="-120 -160 240 300"
          className="h-[520px] w-full touch-none select-none text-foreground"
          onPointerMove={onMove}
          onPointerLeave={() => (pointer.current.active = false)}
        >
          <g
            transform={`translate(${offset[0].toFixed(2)} ${offset[1].toFixed(2)})`}
          >
            {guides.map(({ from, to }, i) => (
              <line
                key={`g-${i}`}
                x1={from[0]}
                y1={from[1]}
                x2={to[0]}
                y2={to[1]}
                stroke="currentColor"
                strokeWidth={cfg.guideStroke}
                strokeOpacity={0.35}
                strokeDasharray="3 4"
              />
            ))}

            {slabs.map(({ silhouette, top, tC, bC }, i) => {
              const isTop = i === slabs.length - 1;
              return (
                <g key={i}>
                  <path
                    d={roundPoly(silhouette, cfg.radius)}
                    className="fill-background"
                    stroke="none"
                  />
                  <path
                    d={roundPoly(top, cfg.radius)}
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity={isTop ? 0.55 : 0.4}
                    strokeWidth={cfg.innerStroke}
                    strokeLinejoin="round"
                  />
                  <path
                    d={`M ${tC[0].toFixed(2)} ${tC[1].toFixed(2)} L ${bC[0].toFixed(2)} ${bC[1].toFixed(2)}`}
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity={0.4}
                    strokeWidth={cfg.innerStroke}
                  />
                  <path
                    d={roundPoly(silhouette, cfg.radius)}
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity={isTop ? 0.95 : 0.72}
                    strokeWidth={cfg.outerStroke}
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}

            <RepoviveLogoIso
              iso={iso}
              S={cfg.size}
              z1={topZ}
              scale={cfg.iconScale}
              stroke={cfg.innerStroke}
            />
          </g>
        </svg>
      </div>

      <PanelShell onReset={() => setCfg(DEFAULTS)} export={exportHandlers}>
        <Ctrl
          label="Layers"
          value={cfg.layers}
          min={3}
          max={10}
          step={1}
          onChange={set("layers")}
        />
        <Ctrl
          label="Slab size"
          value={cfg.size}
          min={40}
          max={110}
          step={1}
          onChange={set("size")}
        />
        <Ctrl
          label="Slab thickness"
          value={cfg.thickness}
          min={2}
          max={14}
          step={0.5}
          onChange={set("thickness")}
        />
        <Ctrl
          label="Stack pitch"
          value={cfg.pitch}
          min={0}
          max={12}
          step={0.5}
          onChange={set("pitch")}
        />
        <Ctrl
          label="Corner radius"
          value={cfg.radius}
          min={0}
          max={14}
          step={0.5}
          onChange={set("radius")}
        />
        <Ctrl
          label="Outer weight"
          value={cfg.outerStroke}
          min={0.5}
          max={4}
          step={0.1}
          onChange={set("outerStroke")}
        />
        <Ctrl
          label="Inner weight"
          value={cfg.innerStroke}
          min={0.2}
          max={2.5}
          step={0.1}
          onChange={set("innerStroke")}
        />
        <Ctrl
          label="Max lift"
          value={cfg.lift}
          min={10}
          max={80}
          step={1}
          onChange={set("lift")}
        />
        <Ctrl
          label="Guide weight"
          value={cfg.guideStroke}
          min={0.3}
          max={2}
          step={0.1}
          onChange={set("guideStroke")}
        />
        <Ctrl
          label="Logo scale"
          value={cfg.iconScale}
          min={0.4}
          max={2}
          step={0.05}
          onChange={set("iconScale")}
        />
      </PanelShell>
    </div>
  );
}
