import { useEffect, useMemo, useRef, useState } from "react";
import { Ctrl, PanelShell, Toggle } from "@/components/AttrPanel";
import {
  buildCoinInteractiveHtml,
  coinConfigToJson,
} from "@/lib/diagram-export";

function iso(u: number, v: number, z: number): [number, number] {
  return [0.866 * (u - v), 0.5 * (u + v) - z];
}

type Pt = [number, number];

function closePath(pts: Pt[]) {
  if (pts.length === 0) return "";
  return `M ${pts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" L ")} Z`;
}

export type CoinConfig = {
  radius: number;
  thickness: number;
  rim: number;
  vScale: number;
  outerStroke: number;
  innerStroke: number;
  gap: number;
  fill: number;
  backCount: number;
  rightCount: number;
  frontCount: number;
  floating: boolean;
};

const DEFAULTS: CoinConfig = {
  radius: 22,
  thickness: 7,
  rim: 3.2,
  vScale: 0.72,
  outerStroke: 1.55,
  innerStroke: 0.75,
  gap: 14,
  fill: 0.32,
  backCount: 5,
  rightCount: 4,
  frontCount: 2,
  floating: false,
};

const STACKS = [
  { id: "back", u: -26, v: -20 },
  { id: "right", u: 30, v: 6 },
  { id: "front", u: -16, v: 30 },
] as const;

const WALL_A0 = -Math.PI / 4;
const WALL_A1 = (3 * Math.PI) / 4;

function ellipse(cx: number, cy: number, r: number, z: number, segs = 48): Pt[] {
  return Array.from({ length: segs }, (_, i) => {
    const a = (i / segs) * Math.PI * 2;
    return iso(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z);
  });
}

function ellipseArc(
  cx: number,
  cy: number,
  r: number,
  z: number,
  a0: number,
  a1: number,
  segs: number,
): Pt[] {
  return Array.from({ length: segs + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / segs;
    return iso(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z);
  });
}

/** Visible cylindrical wall between two isometric discs. */
function wallPath(cx: number, cy: number, r: number, z0: number, z1: number) {
  const bot = ellipseArc(cx, cy, r, z0, WALL_A0, WALL_A1, 22);
  const top = ellipseArc(cx, cy, r, z1, WALL_A0, WALL_A1, 22);
  return closePath([...bot, ...top.reverse()]);
}

/** Outer silhouette of a vertical pile: bottom front, sides, top back. */
function stackOutline(cx: number, cy: number, r: number, zBot: number, zTop: number) {
  const bot = ellipseArc(cx, cy, r, zBot, WALL_A0, WALL_A1, 24);
  const topBack = ellipseArc(cx, cy, r, zTop, WALL_A1, WALL_A0 + Math.PI * 2, 24);
  return closePath([...bot, ...topBack]);
}

/** V lying on the coin's top plane, rotated in that plane. */
function vMark(
  cx: number,
  cy: number,
  z: number,
  scale: number,
  rot: number,
) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const at = (lx: number, ly: number): Pt => {
    const rx = lx * c - ly * s;
    const ry = lx * s + ly * c;
    return iso(cx + rx + ry, cy - rx + ry, z);
  };
  const k = scale;
  const left = at(-0.38 * k, -0.4 * k);
  const mid = at(0, 0.46 * k);
  const right = at(0.38 * k, -0.4 * k);
  return `M ${left[0].toFixed(2)} ${left[1].toFixed(2)} L ${mid[0].toFixed(2)} ${mid[1].toFixed(2)} L ${right[0].toFixed(2)} ${right[1].toFixed(2)}`;
}

/** Stable per-coin spin so marks don't all face the same way. */
function coinSpin(stackId: string, i: number) {
  const seed = stackId === "back" ? 0.35 : stackId === "right" ? 2.05 : 3.9;
  return seed + i * 1.17;
}

function stackCount(cfg: CoinConfig, id: string) {
  if (id === "back") return Math.max(1, Math.round(cfg.backCount));
  if (id === "right") return Math.max(1, Math.round(cfg.rightCount));
  return Math.max(1, Math.round(cfg.frontCount));
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function floatHome(stackId: string, i: number, st: { u: number; v: number }) {
  const s = coinSpin(stackId, i);
  return {
    u: st.u + Math.cos(s * 2.3) * 34,
    v: st.v + Math.sin(s * 1.71) * 30,
    z: 10 + ((s * 7) % 1) * 38,
  };
}

function floatPose(
  stackId: string,
  i: number,
  st: { u: number; v: number },
  t: number,
) {
  const s = coinSpin(stackId, i);
  const home = floatHome(stackId, i, st);
  return {
    u: home.u + Math.sin(t * 0.0011 + s) * 7,
    v: home.v + Math.cos(t * 0.00083 + s * 1.4) * 6,
    z: home.z + Math.sin(t * 0.0014 + s * 0.7) * 5.5,
    rot: s + t * 0.00022 + Math.sin(t * 0.0007 + s) * 0.35,
  };
}

type CoinDraw = {
  key: string;
  stack: string;
  depth: number;
  u: number;
  v: number;
  z0: number;
  z1: number;
  wall: string;
  top: string;
  rim: string;
  vee: string;
  outline: string;
};

function CoinGlyph({
  coin,
  fill,
  inner,
  outer,
  active,
  showOuter,
}: {
  coin: CoinDraw;
  fill: number;
  inner: number;
  outer: number;
  active: boolean;
  showOuter: boolean;
}) {
  return (
    <g>
      <path d={coin.wall} className="fill-background" stroke="none" />
      <path d={coin.wall} className="fill-[var(--face-a)]" fillOpacity={fill} />
      <path
        d={coin.wall}
        fill="none"
        stroke="currentColor"
        strokeWidth={inner}
        strokeOpacity={0.4}
        strokeLinejoin="round"
      />
      <path d={coin.top} className="fill-background" stroke="none" />
      <path d={coin.top} className="fill-[var(--face-c)]" fillOpacity={fill} />
      <path
        d={coin.top}
        fill="none"
        stroke="currentColor"
        strokeWidth={inner}
        strokeOpacity={0.5}
        strokeLinejoin="round"
      />
      <path
        d={coin.rim}
        fill="none"
        stroke="currentColor"
        strokeWidth={inner}
        strokeOpacity={0.45}
      />
      <path
        d={coin.vee}
        fill="none"
        stroke="currentColor"
        strokeWidth={inner * 2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={active ? 0.95 : 0.7}
      />
      {showOuter ? (
        <path
          d={coin.outline}
          fill="none"
          stroke="currentColor"
          strokeWidth={outer}
          strokeOpacity={active ? 0.95 : 0.8}
          strokeLinejoin="round"
        />
      ) : null}
    </g>
  );
}

export function CoinStacks() {
  const [cfg, setCfg] = useState<CoinConfig>(DEFAULTS);
  const [hover, setHover] = useState<string | null>(null);
  const [spread, setSpread] = useState<Record<string, number>>(() =>
    Object.fromEntries(STACKS.map((s) => [s.id, 0])),
  );
  const [air, setAir] = useState(0);
  const [now, setNow] = useState(0);
  const hoverRef = useRef<string | null>(null);
  hoverRef.current = hover;
  const gapRef = useRef(cfg.gap);
  gapRef.current = cfg.gap;
  const floatRef = useRef(cfg.floating);
  floatRef.current = cfg.floating;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      const ambient = 1.2 + 0.8 * Math.sin(t / 2400);
      const airTarget = floatRef.current ? 1 : 0;
      setAir((prev) => {
        const next = prev + (airTarget - prev) * 0.08;
        return Math.abs(next - airTarget) < 0.004 ? airTarget : next;
      });
      setSpread((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const s of STACKS) {
          const target =
            hoverRef.current === s.id ? gapRef.current : ambient;
          const cur = prev[s.id] ?? 0;
          const val = cur + (target - cur) * 0.14;
          const out = Math.abs(val - target) < 0.02 ? target : val;
          if (Math.abs(out - cur) > 0.002) {
            next[s.id] = out;
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

  const coins = useMemo(() => {
    const list: CoinDraw[] = [];
    for (const st of STACKS) {
      const n = stackCount(cfg, st.id);
      const pitch = cfg.thickness + (spread[st.id] ?? 0);
      for (let i = 0; i < n; i++) {
        const stackedZ0 = i * pitch;
        const airPose = floatPose(st.id, i, st, now);
        const u = mix(st.u, airPose.u, air);
        const v = mix(st.v, airPose.v, air);
        const z0 = mix(stackedZ0, airPose.z, air);
        const z1 = z0 + cfg.thickness;
        const rot = mix(coinSpin(st.id, i), airPose.rot, air);
        const innerR = Math.max(4, cfg.radius - cfg.rim);
        list.push({
          key: `${st.id}-${i}`,
          stack: st.id,
          depth: u + v + 0.2 * z0,
          u,
          v,
          z0,
          z1,
          wall: wallPath(u, v, cfg.radius, z0, z1),
          top: closePath(ellipse(u, v, cfg.radius, z1)),
          rim: closePath(ellipse(u, v, innerR, z1)),
          vee: vMark(u, v, z1, cfg.radius * cfg.vScale, rot),
          outline: stackOutline(u, v, cfg.radius, z0, z1),
        });
      }
    }
    list.sort((a, b) => a.depth - b.depth);
    return list;
  }, [cfg, spread, air, now]);

  const piles = useMemo(() => {
    return STACKS.map((st) => {
      const group = coins.filter((c) => c.stack === st.id);
      const zBot = Math.min(...group.map((c) => c.z0));
      const zTop = Math.max(...group.map((c) => c.z1));
      return {
        id: st.id,
        depth: st.u + st.v,
        outline: stackOutline(st.u, st.v, cfg.radius, zBot, zTop),
        coins: group,
      };
    }).sort((a, b) => a.depth - b.depth);
  }, [coins, cfg.radius]);

  const offset = useMemo(() => {
    const r = cfg.radius;
    const yMin = -0.71 * r - (Math.max(cfg.backCount, cfg.rightCount) * (cfg.thickness + cfg.gap) + 8);
    const yMax = 0.71 * r + 36;
    return [0, -(yMin + yMax) / 2 - 8] as const;
  }, [cfg]);

  const set =
    <K extends keyof CoinConfig>(k: K) =>
    (v: number) =>
      setCfg((c) => ({ ...c, [k]: v }));

  const exportHandlers = useMemo(
    () => ({
      filename: "coin-stacks.html",
      getJson: () => coinConfigToJson(cfg),
      getHtml: () => buildCoinInteractiveHtml(cfg),
    }),
    [cfg],
  );

  return (
    <div className="grid w-full gap-10 lg:grid-cols-[1fr_260px]">
      <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-card/30">
        <svg
          viewBox="-150 -170 300 330"
          className="h-[520px] w-full touch-none select-none text-foreground"
          onPointerLeave={() => setHover(null)}
        >
          <g
            transform={`translate(${offset[0].toFixed(2)} ${offset[1].toFixed(2)})`}
          >
            {air < 0.5
              ? piles.map((pile) => {
                  const active = hover === pile.id;
                  return (
                    <g
                      key={pile.id}
                      onPointerEnter={() => setHover(pile.id)}
                      className="cursor-pointer"
                    >
                      {pile.coins.map((c) => (
                        <CoinGlyph
                          key={c.key}
                          coin={c}
                          fill={cfg.fill}
                          inner={cfg.innerStroke}
                          outer={cfg.outerStroke}
                          active={active}
                          showOuter={false}
                        />
                      ))}
                      <path
                        d={pile.coins.reduce((a, b) => (a.z1 >= b.z1 ? a : b)).top}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={cfg.outerStroke}
                        strokeOpacity={active ? 0.95 : 0.8}
                        strokeLinejoin="round"
                      />
                      <path
                        d={pile.outline}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={cfg.outerStroke}
                        strokeOpacity={active ? 0.95 : 0.8}
                        strokeLinejoin="round"
                      />
                    </g>
                  );
                })
              : coins.map((c) => {
                  const active = hover === c.stack;
                  return (
                    <g
                      key={c.key}
                      onPointerEnter={() => setHover(c.stack)}
                      className="cursor-pointer"
                    >
                      <CoinGlyph
                        coin={c}
                        fill={cfg.fill}
                        inner={cfg.innerStroke}
                        outer={cfg.outerStroke}
                        active={active}
                        showOuter
                      />
                    </g>
                  );
                })}
          </g>
        </svg>
      </div>

      <PanelShell onReset={() => setCfg(DEFAULTS)} export={exportHandlers}>
        <Toggle
          label="Float in air"
          on={cfg.floating}
          onChange={(v) => setCfg((c) => ({ ...c, floating: v }))}
        />
        <Ctrl
          label="Coin radius"
          value={cfg.radius}
          min={12}
          max={36}
          step={1}
          onChange={set("radius")}
        />
        <Ctrl
          label="Thickness"
          value={cfg.thickness}
          min={3}
          max={16}
          step={0.5}
          onChange={set("thickness")}
        />
        <Ctrl
          label="Rim inset"
          value={cfg.rim}
          min={1}
          max={8}
          step={0.1}
          onChange={set("rim")}
        />
        <Ctrl
          label="V scale"
          value={cfg.vScale}
          min={0.3}
          max={1.1}
          step={0.05}
          onChange={set("vScale")}
        />
        <Ctrl
          label="Back stack"
          value={cfg.backCount}
          min={1}
          max={8}
          step={1}
          onChange={set("backCount")}
        />
        <Ctrl
          label="Right stack"
          value={cfg.rightCount}
          min={1}
          max={8}
          step={1}
          onChange={set("rightCount")}
        />
        <Ctrl
          label="Front stack"
          value={cfg.frontCount}
          min={1}
          max={8}
          step={1}
          onChange={set("frontCount")}
        />
        <Ctrl
          label="Outer weight"
          value={cfg.outerStroke}
          min={0.5}
          max={3.5}
          step={0.1}
          onChange={set("outerStroke")}
        />
        <Ctrl
          label="Inner weight"
          value={cfg.innerStroke}
          min={0.2}
          max={2}
          step={0.1}
          onChange={set("innerStroke")}
        />
        <Ctrl
          label="Hover gap"
          value={cfg.gap}
          min={2}
          max={36}
          step={1}
          onChange={set("gap")}
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
