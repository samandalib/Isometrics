import { ArrowUpRight, Check, Lock } from "lucide-react";

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
  return (
    <svg viewBox="-70 -70 150 130" className="h-full w-full text-foreground/40">
      <g {...stroke}>
        {Array.from({ length: 8 }, (_, i) => {
          const z = i * 9;
          const s = 44 - i * 3;
          const p = [iso(0, 0, z), iso(s, 0, z), iso(s, s, z), iso(0, s, z)];
          return (
            <path
              key={i}
              d={`M ${p.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" L ")} Z`}
            />
          );
        })}
      </g>
    </svg>
  );
}

function RingThumb() {
  return (
    <svg viewBox="-70 -60 150 110" className="h-full w-full text-foreground/40">
      <g {...stroke}>
        {Array.from({ length: 5 }, (_, r) => {
          const rad = 12 + r * 9;
          const pts = Array.from({ length: 24 }, (_, k) => {
            const a = (k / 24) * Math.PI * 2;
            return iso(Math.cos(a) * rad, Math.sin(a) * rad, r * 5);
          });
          return (
            <path
              key={r}
              d={`M ${pts.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" L ")} Z`}
            />
          );
        })}
      </g>
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
    blurb: "Tapered layers that separate and rotate as you scrub vertically.",
    status: "soon",
    thumb: <TowerThumb />,
  },
  {
    id: "ripple-rings",
    index: "04",
    title: "Ripple rings",
    blurb: "Concentric contours that pulse outward from the pointer.",
    status: "soon",
    thumb: <RingThumb />,
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

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
