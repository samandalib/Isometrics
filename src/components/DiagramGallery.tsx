import { ArrowUpRight, Check, Lock } from "lucide-react";
import { RepoviveLogoIso } from "@/components/RepoviveLogoIso";

type Item = {
  id: string;
  index: string;
  title: string;
  blurb: string;
  status: "live" | "soon";
  thumb: React.ReactNode;
};

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 0.9,
  strokeLinejoin: "round" as const,
};

function iso(u: number, v: number, z: number) {
  return [0.866 * (u + v), 0.5 * (u - v) - z] as const;
}

function PlateThumb() {
  const n = 9;
  const len = 70;
  return (
    <svg viewBox="-70 -60 150 110" className="h-full w-full text-foreground/70">
      <g {...stroke}>
        {Array.from({ length: n }, (_, i) => {
          const v = i * 8;
          const h = 4 + 26 * Math.exp(-Math.pow((i - 4) / 2, 2));
          const p = [
            iso(0, v, h),
            iso(len, v, h),
            iso(len, v + 5, h),
            iso(0, v + 5, h),
          ];
          const f = [
            iso(len, v, h),
            iso(len, v + 5, h),
            iso(len, v + 5, 0),
            iso(len, v, 0),
          ];
          const toPath = (pts: readonly (readonly [number, number])[]) =>
            `M ${pts.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" L ")} Z`;
          return (
            <g key={i}>
              <path d={toPath(f)} />
              <path d={toPath(p)} />
            </g>
          );
        }).reverse()}
      </g>
    </svg>
  );
}

function CubeThumb() {
  const cubes = [
    { u: 0, v: 0, h: 30 },
    { u: 0, v: 1, h: 27 },
    { u: 1, v: 0, h: 13 },
    { u: 1.5, v: 0.5, h: 24 },
    { u: 1, v: 1.05, h: 22 },
  ];
  const s = 19;
  const P = (u: number, v: number, z: number) =>
    [0.866 * (u - v), 0.5 * (u + v) - z] as const;
  return (
    <svg viewBox="-45 -52 92 95" className="h-full w-full text-foreground/70">
      {[...cubes]
        .sort((a, b) => a.u + a.v - (b.u + b.v))
        .map((c, i) => {
          const u0 = c.u * s;
          const v0 = c.v * s;
          const pts = [
            P(u0, v0, c.h),
            P(u0 + s, v0, c.h),
            P(u0 + s, v0, 0),
            P(u0 + s, v0 + s, 0),
            P(u0, v0 + s, 0),
            P(u0, v0 + s, c.h),
          ];
          const top = [
            P(u0, v0, c.h),
            P(u0 + s, v0, c.h),
            P(u0 + s, v0 + s, c.h),
            P(u0, v0 + s, c.h),
          ];
          const d = (a: readonly (readonly [number, number])[]) =>
            `M ${a.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" L ")} Z`;
          return (
            <g key={i}>
              <path d={d(pts)} className="fill-background" />
              <path
                d={d(top)}
                fill="none"
                stroke="currentColor"
                strokeWidth={0.7}
                strokeLinejoin="round"
              />
              <path
                d={d(pts)}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinejoin="round"
              />
            </g>
          );
        })}
    </svg>
  );
}

function TowerThumb() {
  const layers = 5;
  const s = 34;
  const step = 7;
  const lift = 10;
  const P = (u: number, v: number, z: number) =>
    [0.866 * (u - v), 0.5 * (u + v) - z] as const;
  const slab = (z0: number) => {
    const z1 = z0 + 4;
    const pts = [
      P(0, 0, z1),
      P(s, 0, z1),
      P(s, 0, z0),
      P(s, s, z0),
      P(0, s, z0),
      P(0, s, z1),
    ];
    const top = [P(0, 0, z1), P(s, 0, z1), P(s, s, z1), P(0, s, z1)];
    const d = (a: readonly (readonly [number, number])[]) =>
      `M ${a.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" L ")} Z`;
    return { pts, top, d, z0, z1 };
  };
  const stack = Array.from({ length: layers }, (_, i) => {
    const base = i * step;
    return slab(i === layers - 1 ? base + lift : base);
  });
  const top = stack[layers - 1]!;
  const below = stack[layers - 2]!;
  return (
    <svg viewBox="-45 -58 92 100" className="h-full w-full text-foreground/70">
      {[
        [0, 0],
        [s, 0],
        [s, s],
      ].map(([u, v], i) => {
        const from = P(u, v, below.z1);
        const to = P(u, v, top.z0);
        return (
          <line
            key={`g-${i}`}
            x1={from[0]}
            y1={from[1]}
            x2={to[0]}
            y2={to[1]}
            stroke="currentColor"
            strokeWidth={0.6}
            strokeOpacity={0.35}
            strokeDasharray="2 3"
          />
        );
      })}
      {stack.map((sl, i) => (
        <g key={i}>
          <path d={sl.d(sl.pts)} className="fill-background" />
          <path
            d={sl.d(sl.top)}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.6}
            strokeLinejoin="round"
          />
          <path
            d={sl.d(sl.pts)}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        </g>
      ))}
      <RepoviveLogoIso
        iso={P}
        S={s}
        z1={top.z1}
        scale={0.42}
        stroke={0.6}
      />
    </svg>
  );
}

function RingThumb() {
  const P = (u: number, v: number, z: number) =>
    [0.866 * (u - v), 0.5 * (u + v) - z] as const;
  const n = 5;
  const pathOf = (pts: readonly (readonly [number, number])[]) =>
    `M ${pts.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" L ")}`;
  return (
    <svg viewBox="-55 -48 110 96" className="h-full w-full text-foreground/70">
      {Array.from({ length: 4 }, (_, m) => {
        const a = (m / 4) * Math.PI * 2;
        const pts = Array.from({ length: n }, (_, i) => {
          const t = i / (n - 1);
          const r = 34 - t * 24;
          const z = 28 * (1 - t);
          return P(Math.cos(a) * r, Math.sin(a) * r, z);
        });
        return (
          <path
            key={`m-${m}`}
            d={pathOf(pts)}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.55}
            strokeOpacity={0.35}
          />
        );
      })}
      {Array.from({ length: n }, (_, i) => {
        const t = i / (n - 1);
        const r = 34 - t * 24;
        const z = 28 * (1 - t);
        const pts = Array.from({ length: 28 }, (_, k) => {
          const a = (k / 28) * Math.PI * 2;
          return P(Math.cos(a) * r, Math.sin(a) * r, z);
        });
        return (
          <path
            key={i}
            d={`${pathOf(pts)} Z`}
            fill="none"
            stroke="currentColor"
            strokeWidth={i === 0 ? 1.3 : 0.7}
            strokeOpacity={0.85 - t * 0.25}
          />
        );
      })}
    </svg>
  );
}

function BurrThumb() {
  const P = (u: number, v: number, z: number) =>
    [0.866 * (u - v), 0.5 * (u + v) - z] as const;
  const s = 10;
  const h = 24;
  const boxes = [
    { u0: -h, u1: h, v0: -s, v1: 0, z0: -s, z1: 0 },
    { u0: -h, u1: h, v0: 0, v1: s, z0: 0, z1: s },
    { u0: -s, u1: 0, v0: -h, v1: h, z0: 0, z1: s },
    { u0: 0, u1: s, v0: -h, v1: h, z0: -s, z1: 0 },
    { u0: 0, u1: s, v0: -s, v1: 0, z0: -h, z1: h },
    { u0: -s, u1: 0, v0: 0, v1: s, z0: -h, z1: h },
  ];
  const hex = (b: (typeof boxes)[number]) => {
    const tA = P(b.u0, b.v0, b.z1);
    const tB = P(b.u1, b.v0, b.z1);
    const bB = P(b.u1, b.v0, b.z0);
    const bC = P(b.u1, b.v1, b.z0);
    const bD = P(b.u0, b.v1, b.z0);
    const tD = P(b.u0, b.v1, b.z1);
    const pts = [tA, tB, bB, bC, bD, tD];
    return `M ${pts.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" L ")} Z`;
  };
  const depth = (b: (typeof boxes)[number]) =>
    (b.u0 + b.u1) / 2 + (b.v0 + b.v1) / 2;
  return (
    <svg viewBox="-48 -50 96 96" className="h-full w-full text-foreground/70">
      {[...boxes]
        .sort((a, b) => depth(a) - depth(b))
        .map((b, i) => (
          <g key={i}>
            <path d={hex(b)} className="fill-background" />
            <path
              d={hex(b)}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.35}
              strokeLinejoin="round"
            />
          </g>
        ))}
    </svg>
  );
}

function ComputerThumb() {
  const P = (u: number, v: number, z: number) =>
    [0.866 * (u - v), 0.5 * (u + v) - z] as const;
  const hex = (
    u0: number,
    v0: number,
    z0: number,
    u1: number,
    v1: number,
    z1: number,
  ) => {
    const pts = [
      P(u0, v0, z1),
      P(u1, v0, z1),
      P(u1, v0, z0),
      P(u1, v1, z0),
      P(u0, v1, z0),
      P(u0, v1, z1),
    ];
    return `M ${pts.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" L ")} Z`;
  };
  return (
    <svg viewBox="-42 -48 92 92" className="h-full w-full text-foreground/70">
      <g fill="none" stroke="currentColor" strokeLinejoin="round">
        <path d={hex(-18, -8, 0, 18, 12, 8)} className="fill-background" strokeWidth={1.2} />
        <path d={hex(-10, -6, 8, 10, 8, 28)} className="fill-background" strokeWidth={1.2} />
        <path d={hex(-14, 14, 0, 12, 24, 3)} className="fill-background" strokeWidth={1.1} />
        <path d={hex(16, 14, 0, 24, 22, 4)} className="fill-background" strokeWidth={1.1} />
      </g>
    </svg>
  );
}

function CoinThumb() {
  const P = (u: number, v: number, z: number) =>
    [0.866 * (u - v), 0.5 * (u + v) - z] as const;
  const ring = (cx: number, cy: number, r: number, z: number) => {
    const pts = Array.from({ length: 20 }, (_, i) => {
      const a = (i / 20) * Math.PI * 2;
      return P(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z);
    });
    return `M ${pts.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" L ")} Z`;
  };
  const stacks = [
    { u: -16, v: -12, n: 4 },
    { u: 18, v: 4, n: 3 },
    { u: -10, v: 18, n: 2 },
  ];
  return (
    <svg viewBox="-42 -48 88 90" className="h-full w-full text-foreground/70">
      {[...stacks]
        .sort((a, b) => a.u + a.v - (b.u + b.v))
        .flatMap((s) =>
          Array.from({ length: s.n }, (_, i) => ({ ...s, i })),
        )
        .map((s, k) => (
          <path
            key={k}
            d={ring(s.u, s.v, 11, s.i * 5)}
            fill="var(--background)"
            stroke="currentColor"
            strokeWidth={1.15}
          />
        ))}
    </svg>
  );
}

const ITEMS: Item[] = [
  {
    id: "plate-array",
    index: "01",
    title: "Plate array",
    blurb:
      "Stacked slats that morph between flat, ridge, wave and fan on hover.",
    status: "live",
    thumb: <PlateThumb />,
  },
  {
    id: "cube-cluster",
    index: "02",
    title: "Cube cluster",
    blurb: "Rounded blocks with pulsing dot lights that jump when hovered.",
    status: "live",
    thumb: <CubeThumb />,
  },
  {
    id: "stacked-tower",
    index: "03",
    title: "Stacked tower",
    blurb:
      "Equal slabs in a vertical stack — scrub up and down to lift the top layer.",
    status: "live",
    thumb: <TowerThumb />,
  },
  {
    id: "ripple-rings",
    index: "04",
    title: "Ripple rings",
    blurb:
      "Concentric contours that drop into a funnel on hover, with curves drifting down the walls.",
    status: "live",
    thumb: <RingThumb />,
  },
  {
    id: "burr-puzzle",
    index: "05",
    title: "Burr puzzle",
    blurb:
      "Six beams locked on three axes — hover a piece to slide it out of the weave.",
    status: "live",
    thumb: <BurrThumb />,
  },
  {
    id: "retro-computer",
    index: "06",
    title: "Retro computer",
    blurb:
      "CRT, case, keyboard and mouse — hover a piece to lift it off the desk.",
    status: "live",
    thumb: <ComputerThumb />,
  },
  {
    id: "coin-stacks",
    index: "07",
    title: "Coin stacks",
    blurb:
      "Rimmed discs marked with a V — hover a pile to separate the coins, or float them in the air.",
    status: "live",
    thumb: <CoinThumb />,
  },
];

export function DiagramGallery({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="mt-24 w-full border-t border-border pt-14">
      <header className="flex items-end justify-between gap-6">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.4em] text-muted-foreground">
            Gallery
          </p>
          <h2 className="mt-3 text-2xl font-light tracking-tight text-foreground">
            Diagram collection
          </h2>
        </div>
        <p className="max-w-xs text-right text-xs leading-relaxed text-muted-foreground">
          Pick a figure to load it into the stage above. The rest are still
          being drawn.
        </p>
      </header>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((item) => {
          const live = item.status === "live";
          const selected = live && item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              disabled={!live}
              onClick={() => live && onSelect(item.id)}
              className={`group relative overflow-hidden rounded-xl border bg-card/40 p-5 text-left transition-colors ${
                selected
                  ? "border-foreground/60 bg-foreground/[0.06]"
                  : live
                    ? "border-border hover:border-foreground/40"
                    : "cursor-not-allowed border-border opacity-70"
              }`}
            >
              <div className="flex items-start justify-between">
                <span className="font-mono text-[0.65rem] tracking-[0.2em] text-muted-foreground">
                  {item.index}
                </span>
                {!live ? (
                  <Lock className="size-3.5 text-muted-foreground/60" />
                ) : selected ? (
                  <Check className="size-3.5 text-foreground" />
                ) : (
                  <ArrowUpRight className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
                )}
              </div>

              <div className="mt-2 h-28 w-full">{item.thumb}</div>

              <h3 className="mt-4 text-sm text-foreground">{item.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {item.blurb}
              </p>

              <p className="mt-4 text-[0.6rem] uppercase tracking-[0.25em] text-muted-foreground/70">
                {selected ? "Selected" : live ? "Interactive" : "In progress"}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
