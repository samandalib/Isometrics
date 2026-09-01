import { useEffect, useMemo, useRef, useState } from "react";
import { Ctrl, PanelShell } from "@/components/AttrPanel";
import {
  buildTrophyInteractiveHtml,
  trophyConfigToJson,
} from "@/lib/diagram-export";

function iso(u: number, v: number, z: number): [number, number] {
  return [0.866 * (u - v), 0.5 * (u + v) - z];
}

type Pt = [number, number];
type Ring = { r: number; z: number };

const WALL_A0 = -Math.PI / 4;
const WALL_A1 = (3 * Math.PI) / 4;

function closePath(pts: Pt[]) {
  if (pts.length === 0) return "";
  return `M ${pts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" L ")} Z`;
}

function openPath(pts: Pt[]) {
  if (pts.length === 0) return "";
  return `M ${pts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" L ")}`;
}

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

export type TrophyConfig = {
  podiumH: number;
  trophyScale: number;
  medalScale: number;
  radius: number;
  outerStroke: number;
  innerStroke: number;
  lift: number;
  fill: number;
};

const DEFAULTS: TrophyConfig = {
  podiumH: 30,
  trophyScale: 1,
  medalScale: 1,
  radius: 2.2,
  outerStroke: 2,
  innerStroke: 0.75,
  lift: 16,
  fill: 0.22,
};

const PARTS = ["podium", "trophy", "medal", "pencil", "sharpener"] as const;

function atAngle(cx: number, cy: number, r: number, z: number, a: number): Pt {
  return iso(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z);
}

function ellipse(cx: number, cy: number, r: number, z: number, segs = 36): Pt[] {
  return Array.from({ length: segs }, (_, i) =>
    atAngle(cx, cy, r, z, (i / segs) * Math.PI * 2),
  );
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
  return Array.from({ length: segs + 1 }, (_, i) =>
    atAngle(cx, cy, r, z, a0 + ((a1 - a0) * i) / segs),
  );
}

function cylOutline(cx: number, cy: number, r: number, z0: number, z1: number) {
  return closePath([
    ...ellipseArc(cx, cy, r, z0, WALL_A0, WALL_A1, 16),
    ...ellipseArc(cx, cy, r, z1, WALL_A1, WALL_A0 + Math.PI * 2, 16),
  ]);
}

function cylWall(cx: number, cy: number, r: number, z0: number, z1: number) {
  return closePath([
    ...ellipseArc(cx, cy, r, z1, WALL_A0, WALL_A1, 14),
    ...ellipseArc(cx, cy, r, z0, WALL_A1, WALL_A0, 14).slice(1),
  ]);
}

function lathePts(cx: number, cy: number, rings: Ring[]): Pt[] {
  const first = rings[0];
  const last = rings[rings.length - 1];
  if (!first || !last) return [];
  return [
    ...ellipseArc(cx, cy, first.r, first.z, WALL_A0, WALL_A1, 16),
    ...rings.slice(1).map((q) => atAngle(cx, cy, q.r, q.z, WALL_A1)),
    ...ellipseArc(cx, cy, last.r, last.z, WALL_A1, WALL_A0 + Math.PI * 2, 16),
    ...[...rings].slice(1).reverse().map((q) => atAngle(cx, cy, q.r, q.z, WALL_A0)),
  ];
}

function convexHull(pts: Pt[]): Pt[] {
  if (pts.length < 3) return pts;
  const sorted = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const p of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2] as Pt, lower[lower.length - 1] as Pt, p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i] as Pt;
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2] as Pt, upper[upper.length - 1] as Pt, p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
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
    right: [tB, tC, bC, bB] as Pt[],
    front: [tD, tC, bC, bD] as Pt[],
  };
}

function starPts(cx: number, cy: number, r: number, z: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(iso(cx + Math.cos(a) * (i % 2 === 0 ? r : r * 0.38), cy + Math.sin(a) * (i % 2 === 0 ? r : r * 0.38), z));
  }
  return pts;
}

function discUZ(u: number, v: number, z: number, r: number, segs = 22): Pt[] {
  return Array.from({ length: segs }, (_, i) => {
    const a = (i / segs) * Math.PI * 2;
    return iso(u + Math.cos(a) * r, v, z + Math.sin(a) * r);
  });
}

function wallHole(
  cx: number,
  cy: number,
  r: number,
  z: number,
  a: number,
  hr: number,
): Pt[] {
  const du = Math.cos(a);
  const dv = Math.sin(a);
  return Array.from({ length: 18 }, (_, i) => {
    const t = (i / 18) * Math.PI * 2;
    return iso(
      cx + du * r + -dv * hr * Math.cos(t),
      cy + dv * r + du * hr * Math.cos(t),
      z + hr * Math.sin(t),
    );
  });
}

function layout(cfg: TrophyConfig, lift: Record<string, number>) {
  const s = cfg.trophyScale;
  const ms = cfg.medalScale;
  const stepW = 26;
  const stepD = 32;
  const sideH = 13;
  const midH = cfg.podiumH;
  const zp = lift.podium ?? 0;
  const zt = lift.trophy ?? 0;
  const zm = lift.medal ?? 0;
  const zpen = lift.pencil ?? 0;
  const zsh = lift.sharpener ?? 0;

  const left = boxFaces(-stepW * 1.55, -stepD / 2, zp, -stepW * 0.5, stepD / 2, zp + sideH);
  const mid = boxFaces(-stepW * 0.5, -stepD / 2, zp, stepW * 0.5, stepD / 2, zp + midH);
  const right = boxFaces(stepW * 0.5, -stepD / 2, zp, stepW * 1.55, stepD / 2, zp + sideH);

  const tz = zp + midH + zt;
  const rings: Ring[] = [
    { r: 9.4 * s, z: tz + 0.8 },
    { r: 9.4 * s, z: tz + 5 },
    { r: 4.8 * s, z: tz + 7 },
    { r: 3.1 * s, z: tz + 16.5 },
    { r: 5.6 * s, z: tz + 19.5 },
    { r: 15.8 * s, z: tz + 33.5 },
  ];
  const rim = rings[rings.length - 1] ?? { r: 15.8 * s, z: tz + 33.5 };

  const mu = 62;
  const mv = -6;
  const mz1 = 46 + zm;
  const mz0 = mz1 - 5.6 * ms;
  const mr = 12 * ms;
  const rw = 4.6 * ms;
  const ribbonTop = mz1 + 26 * ms;
  const ribbon: Pt[] = [
    iso(mu - rw, mv, ribbonTop),
    iso(mu + rw, mv, ribbonTop),
    iso(mu + rw, mv, mz1 + 6),
    iso(mu, mv, mz0 + 0.6),
    iso(mu - rw, mv, mz1 + 6),
  ];

  const pr = 3.3;
  const pu = -8;
  const pv0 = stepD / 2 + 12;
  const pv1 = pv0 + 46;
  const pz = zpen + pr;
  const backCap = discUZ(pu, pv0, pz, pr);
  const frontCap = discUZ(pu, pv1, pz, pr);
  const band0 = discUZ(pu, pv0 + 7, pz, pr * 1.02);
  const band1 = discUZ(pu, pv0 + 10.5, pz, pr * 1.02);
  const tipPt = iso(pu, pv1 + 11, pz);
  const pencilWall = closePath([
    iso(pu, pv0, pz + pr),
    iso(pu, pv1, pz + pr),
    iso(pu + pr, pv1, pz),
    iso(pu + pr, pv0, pz),
  ]);
  const pencilInkTip = closePath([
    iso(pu - pr * 0.15, pv1, pz + pr * 0.2),
    tipPt,
    iso(pu + pr, pv1, pz),
    iso(pu, pv1, pz - pr),
  ]);
  const pencilBand = closePath([...band0, ...[...band1].reverse()]);

  const su = 18;
  const sv = stepD / 2 + 40;
  const sr = 8.4;
  const sz0 = zsh;
  const sz1 = zsh + 7.2;

  const vFront = stepD / 2;
  const zc = zp + midH * 0.48;
  const badge = ellipse(0, vFront, 6.2, zc, 22).map((p, i, arr) => {
    const a = (i / (arr.length || 22)) * Math.PI * 2;
    return iso(Math.cos(a) * 6.2, vFront, zc + Math.sin(a) * 6.2);
  });
  const oneStem: Pt[] = [
    iso(-2.4, vFront, zc + 2.6),
    iso(0.55, vFront, zc + 4),
    iso(0.55, vFront, zc - 3.8),
  ];
  const oneBase: Pt[] = [iso(-2.3, vFront, zc - 3.8), iso(2.6, vFront, zc - 3.8)];

  return {
    left,
    mid,
    right,
    cupSil: closePath(lathePts(0, 0, rings)),
    rim: closePath(ellipse(0, 0, rim.r, rim.z)),
    medalTop: closePath(ellipse(mu, mv, mr, mz1)),
    medalWall: cylWall(mu, mv, mr, mz0, mz1),
    medalSil: cylOutline(mu, mv, mr, mz0, mz1),
    star: closePath(starPts(mu, mv, mr * 0.58, mz1 + 0.15)),
    starRing: closePath(ellipse(mu, mv, mr * 0.72, mz1 + 0.1)),
    ribbon: closePath(ribbon),
    pencilWall,
    pencilBack: closePath(backCap),
    pencilFront: closePath(frontCap),
    pencilTip: pencilInkTip,
    pencilBand,
    pencilSil: closePath(
      convexHull([...backCap, ...frontCap, tipPt]),
    ),
    sharpTop: closePath(ellipse(su, sv, sr, sz1)),
    sharpWall: cylWall(su, sv, sr, sz0, sz1),
    sharpSil: cylOutline(su, sv, sr, sz0, sz1),
    screw: closePath(ellipse(su - 2.2, sv - 2, 1.6, sz1 + 0.1, 12)),
    slit: openPath([iso(su - 3.6, sv + 2.2, sz1), iso(su + 4.8, sv + 2.2, sz1)]),
    sharpInk: closePath([
      iso(su + 1.2, sv + 0.6, sz1),
      iso(su + 4.4, sv + 0.6, sz1),
      iso(su + 4.4, sv + 3.4, sz1),
      iso(su + 1.2, sv + 3.4, sz1),
    ]),
    hole: closePath(wallHole(su, sv, sr, (sz0 + sz1) / 2, WALL_A0, 2.6)),
    badge: closePath(badge),
    oneStem: openPath(oneStem),
    oneBase: openPath(oneBase),
  };
}

export function Trophy() {
  const [cfg, setCfg] = useState<TrophyConfig>(DEFAULTS);
  const [hover, setHover] = useState<string | null>(null);
  const [lift, setLift] = useState<Record<string, number>>(() =>
    Object.fromEntries(PARTS.map((id) => [id, 0])),
  );
  const hoverRef = useRef<string | null>(null);
  hoverRef.current = hover;
  const liftAmt = useRef(cfg.lift);
  liftAmt.current = cfg.lift;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = Date.now();
      setLift((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const id of PARTS) {
          const extra =
            id === "medal" ? 2.4 * Math.sin(t / 1700) : id === "trophy" ? 1.1 * Math.sin(t / 2300) : 0;
          const target = (hoverRef.current === id ? liftAmt.current : 0) + extra;
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

  const geo = useMemo(() => layout(cfg, lift), [cfg, lift]);

  const offset = useMemo(
    () => [6, (cfg.podiumH + 50 * cfg.trophyScale) * 0.16] as const,
    [cfg],
  );

  const set =
    <K extends keyof TrophyConfig>(k: K) =>
    (v: number) =>
      setCfg((c) => ({ ...c, [k]: v }));

  const exportHandlers = useMemo(
    () => ({
      filename: "awards.html",
      getJson: () => trophyConfigToJson(cfg),
      getHtml: () => buildTrophyInteractiveHtml(cfg),
    }),
    [cfg],
  );

  const r = cfg.radius;
  const fill = cfg.fill;
  const inner = cfg.innerStroke;

  const box = (faces: ReturnType<typeof boxFaces>, key: string) => (
    <g key={key}>
      <path d={roundPoly(faces.silhouette, r)} className="fill-background" stroke="none" />
      <g fill="none" stroke="currentColor" strokeWidth={inner} strokeLinejoin="round" strokeOpacity={0.55}>
        <path d={roundPoly(faces.silhouette, r)} />
        <path d={roundPoly(faces.right, r)} />
        <path d={roundPoly(faces.front, r)} />
        <path d={roundPoly(faces.top, r)} />
      </g>
    </g>
  );

  return (
    <div className="grid w-full gap-10 lg:grid-cols-[1fr_260px]">
      <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-card/30">
        <svg
          viewBox="-200 -200 420 400"
          className="h-[560px] w-full touch-none select-none text-foreground"
          onPointerLeave={() => setHover(null)}
        >
          <g transform={`translate(${offset[0].toFixed(2)} ${offset[1].toFixed(2)})`}>
            <g onPointerEnter={() => setHover("medal")} className="cursor-pointer">
              <path d={geo.ribbon} className="fill-background" stroke="none" />
              <path d={geo.ribbon} className="fill-[var(--face-c)]" fillOpacity={fill} />
              <path d={geo.medalSil} className="fill-background" stroke="none" />
              <path d={geo.medalWall} className="fill-[var(--face-a)]" fillOpacity={fill} />
              <path d={geo.medalTop} className="fill-[var(--face-c)]" fillOpacity={fill} />
              <path d={geo.starRing} fill="none" stroke="currentColor" strokeWidth={inner} strokeOpacity={0.55} />
              <path d={geo.star} fill="currentColor" fillOpacity={0.94} stroke="none" />
              <path d={geo.ribbon} fill="none" stroke="currentColor" strokeWidth={inner} strokeLinejoin="round" strokeOpacity={0.55} />
              <path
                d={geo.medalSil}
                fill="none"
                stroke="currentColor"
                strokeWidth={inner}
                strokeLinejoin="round"
                strokeOpacity={hover === "medal" ? 0.8 : 0.55}
              />
            </g>

            <g onPointerEnter={() => setHover("podium")} className="cursor-pointer">
              {box(geo.left, "L")}
              {box(geo.right, "R")}
              {box(geo.mid, "M")}
              <path d={geo.badge} fill="none" stroke="currentColor" strokeWidth={inner} strokeOpacity={0.72} />
              <path d={geo.oneStem} fill="none" stroke="currentColor" strokeWidth={inner * 1.55} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.9} />
              <path d={geo.oneBase} fill="none" stroke="currentColor" strokeWidth={inner * 1.55} strokeLinecap="round" strokeOpacity={0.9} />
            </g>

            <g onPointerEnter={() => setHover("trophy")} className="cursor-pointer">
              <path d={geo.cupSil} className="fill-background" stroke="none" />
              <path d={geo.rim} fill="none" stroke="currentColor" strokeWidth={inner} strokeOpacity={0.5} />
              <path
                d={geo.cupSil}
                fill="none"
                stroke="currentColor"
                strokeWidth={inner}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeOpacity={hover === "trophy" ? 0.8 : 0.55}
              />
            </g>

            <g onPointerEnter={() => setHover("pencil")} className="cursor-pointer">
              <path d={geo.pencilSil} className="fill-background" stroke="none" />
              <path d={geo.pencilWall} className="fill-[var(--face-a)]" fillOpacity={fill} />
              <path d={geo.pencilBack} className="fill-[var(--face-c)]" fillOpacity={fill} />
              <path d={geo.pencilFront} className="fill-[var(--face-b)]" fillOpacity={fill} />
              <path d={geo.pencilBand} fill="currentColor" fillOpacity={0.92} stroke="none" />
              <path d={geo.pencilTip} fill="currentColor" fillOpacity={0.94} stroke="none" />
              <path
                d={geo.pencilSil}
                fill="none"
                stroke="currentColor"
                strokeWidth={inner}
                strokeLinejoin="round"
                strokeOpacity={hover === "pencil" ? 0.8 : 0.55}
              />
            </g>

            <g onPointerEnter={() => setHover("sharpener")} className="cursor-pointer">
              <path d={geo.sharpSil} className="fill-background" stroke="none" />
              <path d={geo.sharpWall} className="fill-[var(--face-a)]" fillOpacity={fill} />
              <path d={geo.sharpTop} className="fill-[var(--face-c)]" fillOpacity={fill} />
              <path d={geo.sharpInk} fill="currentColor" fillOpacity={0.92} stroke="none" />
              <path d={geo.screw} fill="none" stroke="currentColor" strokeWidth={inner} strokeOpacity={0.7} />
              <path d={geo.slit} fill="none" stroke="currentColor" strokeWidth={inner} strokeLinecap="round" strokeOpacity={0.7} />
              <path d={geo.hole} className="fill-background" stroke="currentColor" strokeWidth={inner} strokeOpacity={0.75} />
              <path
                d={geo.sharpSil}
                fill="none"
                stroke="currentColor"
                strokeWidth={inner}
                strokeLinejoin="round"
                strokeOpacity={hover === "sharpener" ? 0.8 : 0.55}
              />
            </g>
          </g>
        </svg>
      </div>

      <PanelShell onReset={() => setCfg(DEFAULTS)} export={exportHandlers}>
        <Ctrl label="Podium height" value={cfg.podiumH} min={18} max={42} step={1} onChange={set("podiumH")} />
        <Ctrl label="Trophy scale" value={cfg.trophyScale} min={0.7} max={1.35} step={0.05} onChange={set("trophyScale")} />
        <Ctrl label="Medal scale" value={cfg.medalScale} min={0.7} max={1.4} step={0.05} onChange={set("medalScale")} />
        <Ctrl label="Corner radius" value={cfg.radius} min={0.4} max={4.5} step={0.1} onChange={set("radius")} />
        <Ctrl label="Line weight" value={cfg.innerStroke} min={0.25} max={1.8} step={0.1} onChange={set("innerStroke")} />
        <Ctrl label="Hover lift" value={cfg.lift} min={6} max={32} step={1} onChange={set("lift")} />
        <Ctrl label="Face fill" value={cfg.fill} min={0} max={0.6} step={0.01} onChange={set("fill")} />
      </PanelShell>
    </div>
  );
}
