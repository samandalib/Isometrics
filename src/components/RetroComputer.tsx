import { useEffect, useMemo, useRef, useState } from "react";
import { Ctrl, PanelShell } from "@/components/AttrPanel";
import {
  buildComputerInteractiveHtml,
  computerConfigToJson,
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

export type ComputerConfig = {
  caseW: number;
  caseD: number;
  caseH: number;
  monScale: number;
  radius: number;
  outerStroke: number;
  innerStroke: number;
  lift: number;
  fill: number;
  keys: number;
};

const DEFAULTS: ComputerConfig = {
  caseW: 118,
  caseD: 76,
  caseH: 24,
  monScale: 1,
  radius: 3.5,
  outerStroke: 1.55,
  innerStroke: 0.7,
  lift: 20,
  fill: 0.3,
  keys: 10,
};

const PARTS = ["case", "monitor", "keyboard", "mouse"] as const;
type PartId = (typeof PARTS)[number];

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
    right: [tB, tC, bC, bB] as Pt[],
    front: [tD, tC, bC, bD] as Pt[],
  };
}

function layout(cfg: ComputerConfig, lift: Record<string, number>) {
  const W = cfg.caseW;
  const D = cfg.caseD;
  const H = cfg.caseH;
  const ms = cfg.monScale;
  const monW = W * 0.64 * ms;
  const monD = D * 0.58 * ms;
  const monH = 56 * ms;
  const pedH = 6 * ms;
  const kbdW = W * 0.82;
  const kbdD = 30;
  const kbdH = 6;
  const mW = 16;
  const mD = 24;
  const mH = 8;

  const zCase = lift.case ?? 0;
  const zMon = (lift.monitor ?? 0) + zCase;
  const zKbd = lift.keyboard ?? 0;
  const zMouse = lift.mouse ?? 0;

  const monU0 = (W - monW) / 2;
  const monV0 = D * 0.08;
  const kbdU0 = (W - kbdW) / 2;
  const kbdV0 = D + 10;
  const mouseU0 = W + 10;
  const mouseV0 = D + 12;

  return {
    case: { u0: 0, v0: 0, z0: zCase, u1: W, v1: D, z1: zCase + H },
    pedestal: {
      u0: monU0 + monW * 0.18,
      v0: monV0 + monD * 0.2,
      z0: zCase + H,
      u1: monU0 + monW * 0.82,
      v1: monV0 + monD * 0.8,
      z1: zCase + H + pedH,
    },
    monitor: {
      u0: monU0,
      v0: monV0,
      z0: zMon + H + pedH,
      u1: monU0 + monW,
      v1: monV0 + monD,
      z1: zMon + H + pedH + monH,
    },
    keyboard: {
      u0: kbdU0,
      v0: kbdV0,
      z0: zKbd,
      u1: kbdU0 + kbdW,
      v1: kbdV0 + kbdD,
      z1: zKbd + kbdH,
    },
    mouse: {
      u0: mouseU0,
      v0: mouseV0,
      z0: zMouse,
      u1: mouseU0 + mW,
      v1: mouseV0 + mD,
      z1: zMouse + mH,
    },
    W,
    D,
    H,
    kbdU0,
    kbdW,
    kbdV0,
    kbdD,
    mouseU0,
    mW,
    mouseV0,
    mD,
  };
}

function Solid({
  box,
  r,
  outer,
  inner,
  fill,
  active,
  children,
  onEnter,
}: {
  box: { u0: number; v0: number; z0: number; u1: number; v1: number; z1: number };
  r: number;
  outer: number;
  inner: number;
  fill: number;
  active: boolean;
  children?: React.ReactNode;
  onEnter: () => void;
}) {
  const f = boxFaces(box.u0, box.v0, box.z0, box.u1, box.v1, box.z1);
  return (
    <g onPointerEnter={onEnter} className="cursor-pointer">
      <path
        d={roundPoly(f.silhouette, r)}
        className="fill-background"
        stroke="none"
      />
      <path
        d={roundPoly(f.right, r)}
        className="fill-[var(--face-a)]"
        fillOpacity={fill}
      />
      <path
        d={roundPoly(f.front, r)}
        className="fill-[var(--face-b)]"
        fillOpacity={fill}
      />
      <path
        d={roundPoly(f.top, r)}
        className="fill-[var(--face-c)]"
        fillOpacity={fill}
      />
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={inner}
        strokeLinejoin="round"
        strokeOpacity={0.4}
      >
        <path d={roundPoly(f.right, r)} />
        <path d={roundPoly(f.front, r)} />
        <path d={roundPoly(f.top, r)} />
      </g>
      {children}
      <path
        d={roundPoly(f.silhouette, r)}
        fill="none"
        stroke="currentColor"
        strokeWidth={outer}
        strokeLinejoin="round"
        strokeOpacity={active ? 0.96 : 0.72}
      />
    </g>
  );
}

export function RetroComputer() {
  const [cfg, setCfg] = useState<ComputerConfig>(DEFAULTS);
  const [hover, setHover] = useState<string | null>(null);
  const [lift, setLift] = useState<Record<string, number>>(() =>
    Object.fromEntries(PARTS.map((id) => [id, 0])),
  );
  const [cursorOn, setCursorOn] = useState(true);
  const hoverRef = useRef<string | null>(null);
  hoverRef.current = hover;
  const liftAmt = useRef(cfg.lift);
  liftAmt.current = cfg.lift;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = Date.now();
      setCursorOn(Math.sin(now / 280) > 0);
      const ambient = 1.6 * Math.sin(now / 2200);
      setLift((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const id of PARTS) {
          const extra = hoverRef.current === id ? liftAmt.current : 0;
          const target = extra + (id === "monitor" ? Math.max(0, ambient) : 0);
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

  const L = useMemo(() => layout(cfg, lift), [cfg, lift]);

  const ornaments = useMemo(() => {
    const m = L.monitor;
    const insetU = (m.u1 - m.u0) * 0.12;
    const insetZ = (m.z1 - m.z0) * 0.14;
    const screen: Pt[] = [
      iso(m.u0 + insetU, m.v1, m.z1 - insetZ),
      iso(m.u1 - insetU, m.v1, m.z1 - insetZ),
      iso(m.u1 - insetU, m.v1, m.z0 + insetZ),
      iso(m.u0 + insetU, m.v1, m.z0 + insetZ),
    ];
    const curW = (m.u1 - m.u0) * 0.08;
    const curZ = (m.z1 - m.z0) * 0.035;
    const cu = m.u0 + insetU + curW * 0.4;
    const cz = m.z1 - insetZ - curZ * 2.2;
    const cursor: Pt[] = [
      iso(cu, m.v1 + 0.4, cz),
      iso(cu + curW, m.v1 + 0.4, cz),
      iso(cu + curW, m.v1 + 0.4, cz - curZ),
      iso(cu, m.v1 + 0.4, cz - curZ),
    ];

    const c = L.case;
    const slotU0 = c.u0 + (c.u1 - c.u0) * 0.08;
    const slotU1 = slotU0 + (c.u1 - c.u0) * 0.28;
    const slotZ = c.z0 + (c.z1 - c.z0) * 0.55;
    const slotH = 1.6;
    const floppy: Pt[] = [
      iso(slotU0, c.v1, slotZ + slotH),
      iso(slotU1, c.v1, slotZ + slotH),
      iso(slotU1, c.v1, slotZ),
      iso(slotU0, c.v1, slotZ),
    ];
    const led = iso(slotU1 + 6, c.v1 + 0.5, slotZ + 0.4);

    const vents: [Pt, Pt][] = [];
    const vCount = 7;
    for (let i = 0; i < vCount; i++) {
      const t = 0.18 + (i / (vCount - 1)) * 0.5;
      const vv = c.v0 + (c.v1 - c.v0) * t;
      vents.push([
        iso(c.u1, vv, c.z0 + 4),
        iso(c.u1, vv, c.z1 - 4),
      ]);
    }

    const k = L.keyboard;
    const cols = Math.max(4, Math.round(cfg.keys));
    const rows = 4;
    const padU = (k.u1 - k.u0) * 0.06;
    const padV = (k.v1 - k.v0) * 0.12;
    const keyList: Pt[][] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const ku0 =
          k.u0 + padU + ((k.u1 - k.u0 - padU * 2) * col) / cols + 0.6;
        const ku1 =
          k.u0 + padU + ((k.u1 - k.u0 - padU * 2) * (col + 1)) / cols - 0.6;
        const kv0 =
          k.v0 + padV + ((k.v1 - k.v0 - padV * 2) * row) / rows + 0.5;
        const kv1 =
          k.v0 + padV + ((k.v1 - k.v0 - padV * 2) * (row + 1)) / rows - 0.5;
        keyList.push([
          iso(ku0, kv0, k.z1),
          iso(ku1, kv0, k.z1),
          iso(ku1, kv1, k.z1),
          iso(ku0, kv1, k.z1),
        ]);
      }
    }

    const mouseBtns: Pt[][] = [];
    const mb = L.mouse;
    for (let i = 0; i < 3; i++) {
      const u0 = mb.u0 + 1.5 + ((mb.u1 - mb.u0 - 3) * i) / 3;
      const u1 = mb.u0 + 1.5 + ((mb.u1 - mb.u0 - 3) * (i + 1)) / 3 - 0.4;
      mouseBtns.push([
        iso(u0, mb.v0 + 1.2, mb.z1),
        iso(u1, mb.v0 + 1.2, mb.z1),
        iso(u1, mb.v0 + (mb.v1 - mb.v0) * 0.42, mb.z1),
        iso(u0, mb.v0 + (mb.v1 - mb.v0) * 0.42, mb.z1),
      ]);
    }

    const kbdCable = {
      a: iso(k.u0 + (k.u1 - k.u0) * 0.35, k.v0, k.z1),
      b: iso(c.u0 + (c.u1 - c.u0) * 0.32, c.v1, c.z0 + (c.z1 - c.z0) * 0.35),
    };
    const mouseCable = {
      a: iso(mb.u0 + (mb.u1 - mb.u0) * 0.5, mb.v0, mb.z1 * 0.7 + mb.z0 * 0.3),
      b: iso(c.u1 - 8, c.v1, c.z0 + (c.z1 - c.z0) * 0.4),
    };

    return {
      screen,
      cursor,
      floppy,
      led,
      vents,
      keyList,
      mouseBtns,
      kbdCable,
      mouseCable,
    };
  }, [L, cfg.keys]);

  const offset = useMemo(() => {
    const pts = [
      iso(0, 0, 0),
      iso(L.W, L.D + 40, 0),
      iso(L.W + 30, L.D + 40, cfg.caseH + 80 * cfg.monScale),
    ];
    const ys = pts.map((p) => p[1]);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    return [-(iso(L.W / 2, L.D / 2, 0)[0]), -(yMin + yMax) / 2] as const;
  }, [L.W, L.D, cfg.caseH, cfg.monScale]);

  const set =
    <K extends keyof ComputerConfig>(k: K) =>
    (v: number) =>
      setCfg((c) => ({ ...c, [k]: v }));

  const exportHandlers = useMemo(
    () => ({
      filename: "retro-computer.html",
      getJson: () => computerConfigToJson(cfg),
      getHtml: () => buildComputerInteractiveHtml(cfg),
    }),
    [cfg],
  );

  const r = cfg.radius;
  const cable = (
    a: Pt,
    b: Pt,
    pull: number,
  ) => {
    const mx = (a[0] + b[0]) / 2 + pull;
    const my = (a[1] + b[1]) / 2 + 10;
    return `M ${a[0].toFixed(2)} ${a[1].toFixed(2)} Q ${mx.toFixed(2)} ${my.toFixed(2)} ${b[0].toFixed(2)} ${b[1].toFixed(2)}`;
  };

  return (
    <div className="grid w-full gap-10 lg:grid-cols-[1fr_260px]">
      <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-card/30">
        <svg
          viewBox="-180 -170 360 330"
          className="h-[520px] w-full touch-none select-none text-foreground"
          onPointerLeave={() => setHover(null)}
        >
          <g
            transform={`translate(${offset[0].toFixed(2)} ${offset[1].toFixed(2)})`}
          >
            <path
              d={cable(ornaments.kbdCable.a, ornaments.kbdCable.b, -12)}
              fill="none"
              stroke="currentColor"
              strokeWidth={cfg.innerStroke}
              strokeOpacity={0.35}
            />
            <path
              d={cable(ornaments.mouseCable.a, ornaments.mouseCable.b, 18)}
              fill="none"
              stroke="currentColor"
              strokeWidth={cfg.innerStroke}
              strokeOpacity={0.35}
            />

            <Solid
              box={L.case}
              r={r}
              outer={cfg.outerStroke}
              inner={cfg.innerStroke}
              fill={cfg.fill}
              active={hover === "case"}
              onEnter={() => setHover("case")}
            >
              <path
                d={roundPoly(ornaments.floppy, Math.min(r, 1.2))}
                fill="none"
                stroke="currentColor"
                strokeWidth={cfg.innerStroke}
                strokeOpacity={0.55}
              />
              <circle
                cx={ornaments.led[0]}
                cy={ornaments.led[1]}
                r={1.4}
                className="fill-foreground"
                opacity={cursorOn ? 0.9 : 0.2}
              />
              {ornaments.vents.map(([a, b], i) => (
                <line
                  key={`v-${i}`}
                  x1={a[0]}
                  y1={a[1]}
                  x2={b[0]}
                  y2={b[1]}
                  stroke="currentColor"
                  strokeWidth={cfg.innerStroke}
                  strokeOpacity={0.35}
                />
              ))}
            </Solid>

            <Solid
              box={L.pedestal}
              r={Math.min(r, 2)}
              outer={cfg.outerStroke * 0.85}
              inner={cfg.innerStroke}
              fill={cfg.fill}
              active={hover === "monitor"}
              onEnter={() => setHover("monitor")}
            />

            <Solid
              box={L.monitor}
              r={r}
              outer={cfg.outerStroke}
              inner={cfg.innerStroke}
              fill={cfg.fill}
              active={hover === "monitor"}
              onEnter={() => setHover("monitor")}
            >
              <path
                d={roundPoly(ornaments.screen, r * 0.6)}
                className="fill-background"
                stroke="currentColor"
                strokeWidth={cfg.innerStroke}
                strokeOpacity={0.55}
              />
              {cursorOn ? (
                <path
                  d={roundPoly(ornaments.cursor, 0.4)}
                  className="fill-foreground"
                  opacity={0.85}
                />
              ) : null}
            </Solid>

            <Solid
              box={L.keyboard}
              r={Math.min(r, 2.2)}
              outer={cfg.outerStroke}
              inner={cfg.innerStroke}
              fill={cfg.fill}
              active={hover === "keyboard"}
              onEnter={() => setHover("keyboard")}
            >
              {ornaments.keyList.map((pts, i) => (
                <path
                  key={`k-${i}`}
                  d={roundPoly(pts, 0.6)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={cfg.innerStroke * 0.75}
                  strokeOpacity={0.45}
                />
              ))}
            </Solid>

            <Solid
              box={L.mouse}
              r={Math.min(r, 2)}
              outer={cfg.outerStroke}
              inner={cfg.innerStroke}
              fill={cfg.fill}
              active={hover === "mouse"}
              onEnter={() => setHover("mouse")}
            >
              {ornaments.mouseBtns.map((pts, i) => (
                <path
                  key={`mb-${i}`}
                  d={roundPoly(pts, 0.5)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={cfg.innerStroke}
                  strokeOpacity={0.5}
                />
              ))}
            </Solid>
          </g>
        </svg>
      </div>

      <PanelShell onReset={() => setCfg(DEFAULTS)} export={exportHandlers}>
        <Ctrl
          label="Case width"
          value={cfg.caseW}
          min={70}
          max={160}
          step={1}
          onChange={set("caseW")}
        />
        <Ctrl
          label="Case depth"
          value={cfg.caseD}
          min={40}
          max={110}
          step={1}
          onChange={set("caseD")}
        />
        <Ctrl
          label="Case height"
          value={cfg.caseH}
          min={12}
          max={40}
          step={1}
          onChange={set("caseH")}
        />
        <Ctrl
          label="Monitor scale"
          value={cfg.monScale}
          min={0.6}
          max={1.4}
          step={0.05}
          onChange={set("monScale")}
        />
        <Ctrl
          label="Key columns"
          value={cfg.keys}
          min={6}
          max={14}
          step={1}
          onChange={set("keys")}
        />
        <Ctrl
          label="Corner radius"
          value={cfg.radius}
          min={0}
          max={10}
          step={0.5}
          onChange={set("radius")}
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
          label="Hover lift"
          value={cfg.lift}
          min={0}
          max={50}
          step={1}
          onChange={set("lift")}
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
