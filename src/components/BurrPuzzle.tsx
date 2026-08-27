import { useEffect, useMemo, useRef, useState } from "react";
import { Ctrl, PanelShell } from "@/components/AttrPanel";
import {
  buildBurrInteractiveHtml,
  burrConfigToJson,
} from "@/lib/diagram-export";

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

export type BurrConfig = {
  thickness: number;
  length: number;
  radius: number;
  outerStroke: number;
  innerStroke: number;
  explode: number;
  fill: number;
};

const DEFAULTS: BurrConfig = {
  thickness: 22,
  length: 108,
  radius: 4,
  outerStroke: 1.7,
  innerStroke: 0.7,
  explode: 38,
  fill: 0.32,
};

const STICK_IDS = ["u0", "u1", "v0", "v1", "z0", "z1"] as const;
type StickId = (typeof STICK_IDS)[number];

function stickBoxes(s: number, L: number, pull: Record<string, number>) {
  const h = L / 2;
  const e = (id: StickId) => pull[id] ?? 0;
  return [
    {
      id: "u0" as const,
      u0: -h - e("u0"),
      u1: h - e("u0"),
      v0: -s,
      v1: 0,
      z0: -s,
      z1: 0,
    },
    {
      id: "u1" as const,
      u0: -h + e("u1"),
      u1: h + e("u1"),
      v0: 0,
      v1: s,
      z0: 0,
      z1: s,
    },
    {
      id: "v0" as const,
      u0: -s,
      u1: 0,
      v0: -h - e("v0"),
      v1: h - e("v0"),
      z0: 0,
      z1: s,
    },
    {
      id: "v1" as const,
      u0: 0,
      u1: s,
      v0: -h + e("v1"),
      v1: h + e("v1"),
      z0: -s,
      z1: 0,
    },
    {
      id: "z0" as const,
      u0: 0,
      u1: s,
      v0: -s,
      v1: 0,
      z0: -h - e("z0"),
      z1: h - e("z0"),
    },
    {
      id: "z1" as const,
      u0: -s,
      u1: 0,
      v0: 0,
      v1: s,
      z0: -h + e("z1"),
      z1: h + e("z1"),
    },
  ];
}

function boxFaces(
  u0: number,
  v0: number,
  z0: number,
  u1: number,
  v1: number,
  z1: number,
) {
  const tA = iso(u0, v0, z1);
  const tB = iso(u1, v0, z1);
  const tC = iso(u1, v1, z1);
  const tD = iso(u0, v1, z1);
  const bB = iso(u1, v0, z0);
  const bC = iso(u1, v1, z0);
  const bD = iso(u0, v1, z0);
  return {
    silhouette: [tA, tB, bB, bC, bD, tD] as Pt[],
    top: [tA, tB, tC, tD] as Pt[],
    front: [tB, tC, bC, bB] as Pt[],
    side: [tD, tC, bC, bD] as Pt[],
  };
}

/** Painter order from the assembled pose so hover-slide never restacks. */
function restOrder(s: number, L: number) {
  const map = new Map<string, number>();
  for (const b of stickBoxes(s, L, {})) {
    map.set(
      b.id,
      (b.u0 + b.u1) / 2 + (b.v0 + b.v1) / 2 - (b.z0 + b.z1) * 0.12,
    );
  }
  return map;
}

export function BurrPuzzle() {
  const [cfg, setCfg] = useState<BurrConfig>(DEFAULTS);
  const [hover, setHover] = useState<string | null>(null);
  const [pull, setPull] = useState<Record<string, number>>(() =>
    Object.fromEntries(STICK_IDS.map((id) => [id, 0])),
  );
  const hoverRef = useRef<string | null>(null);
  hoverRef.current = hover;
  const explodeRef = useRef(cfg.explode);
  explodeRef.current = cfg.explode;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = Date.now();
      const ambient = explodeRef.current * (0.04 + 0.03 * Math.sin(now / 2400));
      setPull((prev) => {
        let changed = false;
        const next: Record<string, number> = { ...prev };
        for (const id of STICK_IDS) {
          const target =
            hoverRef.current === id ? explodeRef.current : ambient;
          const cur = prev[id] ?? 0;
          const val = cur + (target - cur) * 0.14;
          const out = Math.abs(val - target) < 0.02 ? target : val;
          if (Math.abs(out - cur) > 0.002) {
            next[id] = out;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const solids = useMemo(() => {
    const order = restOrder(cfg.thickness, cfg.length);
    const boxes = stickBoxes(cfg.thickness, cfg.length, pull);
    return boxes
      .map((b) => ({
        ...b,
        ...boxFaces(b.u0, b.v0, b.z0, b.u1, b.v1, b.z1),
        depth: order.get(b.id) ?? 0,
      }))
      .sort((a, b) => a.depth - b.depth);
  }, [cfg.thickness, cfg.length, pull]);

  const set =
    <K extends keyof BurrConfig>(k: K) =>
    (v: number) =>
      setCfg((c) => ({ ...c, [k]: v }));

  const exportHandlers = useMemo(
    () => ({
      filename: "burr-puzzle.html",
      getJson: () => burrConfigToJson(cfg),
      getHtml: () => buildBurrInteractiveHtml(cfg),
    }),
    [cfg],
  );

  return (
    <div className="grid w-full gap-10 lg:grid-cols-[1fr_260px]">
      <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-card/30">
        <svg
          viewBox="-160 -170 320 330"
          className="h-[520px] w-full touch-none select-none text-foreground"
          onPointerLeave={() => setHover(null)}
        >
          {solids.map((b) => {
            const active = hover === b.id;
            return (
              <g
                key={b.id}
                onPointerEnter={() => setHover(b.id)}
                className="cursor-pointer"
              >
                <path
                  d={roundPoly(b.silhouette, cfg.radius)}
                  className="fill-background"
                  stroke="none"
                />
                <path
                  d={roundPoly(b.side, cfg.radius)}
                  className="fill-[var(--face-a)]"
                  fillOpacity={cfg.fill}
                />
                <path
                  d={roundPoly(b.front, cfg.radius)}
                  className="fill-[var(--face-b)]"
                  fillOpacity={cfg.fill}
                />
                <path
                  d={roundPoly(b.top, cfg.radius)}
                  className="fill-[var(--face-c)]"
                  fillOpacity={cfg.fill}
                />
                <g
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={cfg.innerStroke}
                  strokeLinejoin="round"
                  strokeOpacity={0.4}
                >
                  <path d={roundPoly(b.side, cfg.radius)} />
                  <path d={roundPoly(b.front, cfg.radius)} />
                  <path d={roundPoly(b.top, cfg.radius)} />
                </g>
                <path
                  d={roundPoly(b.silhouette, cfg.radius)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={cfg.outerStroke}
                  strokeLinejoin="round"
                  strokeOpacity={active ? 0.96 : 0.72}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <PanelShell onReset={() => setCfg(DEFAULTS)} export={exportHandlers}>
        <Ctrl
          label="Thickness"
          value={cfg.thickness}
          min={10}
          max={40}
          step={1}
          onChange={set("thickness")}
        />
        <Ctrl
          label="Length"
          value={cfg.length}
          min={50}
          max={160}
          step={1}
          onChange={set("length")}
        />
        <Ctrl
          label="Corner radius"
          value={cfg.radius}
          min={0}
          max={12}
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
          label="Hover slide"
          value={cfg.explode}
          min={0}
          max={80}
          step={1}
          onChange={set("explode")}
        />
        <Ctrl
          label="Face fill"
          value={cfg.fill}
          min={0}
          max={0.7}
          step={0.01}
          onChange={set("fill")}
        />
      </PanelShell>
    </div>
  );
}
