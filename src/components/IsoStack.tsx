import { useEffect, useMemo, useRef, useState } from "react";
import { Ctrl, PanelShell } from "@/components/AttrPanel";
import {
  buildIsoInteractiveHtml,
  isoConfigToJson,
} from "@/lib/diagram-export";

type Mode = "flat" | "ridge" | "wave" | "fan";

const MODES: { id: Mode; label: string }[] = [
  { id: "flat", label: "Flat" },
  { id: "ridge", label: "Ridge" },
  { id: "wave", label: "Wave" },
  { id: "fan", label: "Fan" },
];

export type IsoConfig = {
  count: number;
  pitch: number;
  thickness: number;
  length: number;
  maxHeight: number;
  stroke: number;
  radius: number;
  fill: number;
  dim: number;
};

const DEFAULTS: IsoConfig = {
  count: 18,
  pitch: 14,
  thickness: 9.5,
  length: 190,
  maxHeight: 185,
  stroke: 0.9,
  radius: 3,
  fill: 0.35,
  dim: 0.45,
};

type P = readonly [number, number];

/** isometric projection */
function proj(u: number, v: number, z: number): P {
  return [0.866 * (u + v), 0.5 * (u - v) - z];
}

/** rounded-corner path through a closed polygon */
function roundedPath(pts: P[], r: number) {
  if (r <= 0.01)
    return `M ${pts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" L ")} Z`;
  const n = pts.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]!;
    const cur = pts[i]!;
    const next = pts[(i + 1) % n]!;
    const cut = (a: P, b: P) => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const t = Math.min(r, len / 2) / len;
      return [a[0] + dx * t, a[1] + dy * t] as P;
    };
    const from = cut(cur, prev);
    const to = cut(cur, next);
    d +=
      i === 0
        ? `M ${from[0].toFixed(2)} ${from[1].toFixed(2)}`
        : ` L ${from[0].toFixed(2)} ${from[1].toFixed(2)}`;
    d += ` Q ${cur[0].toFixed(2)} ${cur[1].toFixed(2)} ${to[0].toFixed(2)} ${to[1].toFixed(2)}`;
  }
  return d + " Z";
}

function profile(
  mode: Mode,
  i: number,
  n: number,
  center: number,
  amp: number,
  maxH: number,
) {
  const t = n > 1 ? i / (n - 1) : 0;
  switch (mode) {
    case "flat":
      return 6 + maxH * 0.22 * amp * Math.exp(-Math.pow((i - center) / 2.2, 2));
    case "ridge": {
      const d = (i - center) / (n / 5.3);
      return 6 + maxH * amp * Math.exp(-d * d);
    }
    case "wave":
      return (
        6 +
        maxH * amp * (0.5 + 0.5 * Math.sin(t * Math.PI * 2.2 - center * 0.35))
      );
    case "fan":
      return 6 + maxH * amp * Math.pow(1 - t, 1.6);
  }
}

export function IsoStack() {
  const [mode, setMode] = useState<Mode>("flat");
  const [cfg, setCfg] = useState<IsoConfig>(DEFAULTS);

  const [heights, setHeights] = useState<number[]>(() =>
    Array(DEFAULTS.count).fill(8),
  );
  const state = useRef<number[]>(Array(DEFAULTS.count).fill(8));
  const pointer = useRef({ center: cfg.count / 2, amp: 0.75, active: false });
  const svgRef = useRef<SVGSVGElement>(null);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const c = cfgRef.current;
      const n = c.count;
      if (state.current.length !== n) {
        state.current = Array.from(
          { length: n },
          (_, i) => state.current[i] ?? 8,
        );
      }
      const { center, amp, active } = pointer.current;
      const eff = active ? amp : 0.55;
      const ctr = active
        ? center
        : n / 2 + Math.sin(Date.now() / 2600) * (n / 4.5);

      let moved = false;
      const next = state.current.map((h, i) => {
        const target = profile(mode, i, n, ctr, eff, c.maxHeight);
        const nh = h + (target - h) * 0.12;
        if (Math.abs(nh - h) > 0.002) moved = true;
        return nh;
      });
      state.current = next;
      if (moved || !active) setHeights(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  const onMove = (e: React.PointerEvent) => {
    const el = svgRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const n = cfg.count;
    pointer.current = {
      center: Math.max(-2, Math.min(n + 1, x * (n + 3) - 1.5)),
      amp: Math.max(0.15, Math.min(1, 1.25 - y)),
      active: true,
    };
  };

  const { slats, offset } = useMemo(() => {
    const { count, pitch, thickness, length, maxHeight } = cfg;
    const spanV = (count - 1) * pitch + thickness;
    const w = 0.866 * (length + spanV);
    const yMin = -0.5 * spanV - maxHeight;
    const yMax = 0.5 * length;
    const ox = 440 - w / 2;
    const oy = 280 - (yMin + yMax) / 2;

    const list = Array.from({ length: count }, (_, i) => {
      const v0 = i * pitch;
      const v1 = v0 + thickness;
      const h = heights[i] ?? 8;
      const top: P[] = [
        proj(0, v0, h),
        proj(length, v0, h),
        proj(length, v1, h),
        proj(0, v1, h),
      ];
      const front: P[] = [
        proj(length, v0, h),
        proj(length, v1, h),
        proj(length, v1, 0),
        proj(length, v0, 0),
      ];
      const side: P[] = [
        proj(0, v0, h),
        proj(length, v0, h),
        proj(length, v0, 0),
        proj(0, v0, 0),
      ];
      return { i, h, top, front, side };
    }).reverse();

    return { slats: list, offset: [ox, oy] as const };
  }, [cfg, heights]);

  const set =
    <K extends keyof IsoConfig>(k: K) =>
    (v: number) =>
      setCfg((c) => ({ ...c, [k]: v }));

  const exportHandlers = useMemo(
    () => ({
      filename: "plate-array.html",
      getJson: () => isoConfigToJson(cfg, mode),
      getHtml: () => buildIsoInteractiveHtml(cfg, mode),
    }),
    [cfg, mode],
  );

  return (
    <div className="grid w-full gap-10 lg:grid-cols-[1fr_260px]">
      <div>
        <svg
          ref={svgRef}
          viewBox="0 0 880 560"
          className="w-full touch-none select-none"
          onPointerMove={onMove}
          onPointerLeave={() =>
            (pointer.current = { ...pointer.current, active: false })
          }
        >
          <g
            transform={`translate(${offset[0].toFixed(2)} ${offset[1].toFixed(2)})`}
          >
            {slats.map(({ i, h, top, front, side }) => {
              const lift = Math.min(1, (h - 6) / cfg.maxHeight);
              const r = cfg.radius;
              return (
                <g key={i} style={{ opacity: 1 - cfg.dim + lift * cfg.dim }}>
                  <path
                    d={roundedPath(side, r)}
                    className="fill-[var(--face-a)]"
                    fillOpacity={cfg.fill}
                  />
                  <path
                    d={roundedPath(front, r)}
                    className="fill-[var(--face-b)]"
                    fillOpacity={cfg.fill}
                  />
                  <path
                    d={roundedPath(top, r)}
                    className="fill-[var(--face-c)]"
                    fillOpacity={cfg.fill}
                  />
                  <g
                    className="fill-none stroke-foreground"
                    strokeWidth={cfg.stroke}
                    strokeLinejoin="round"
                    style={{ opacity: 0.4 + lift * 0.6 }}
                  >
                    <path d={roundedPath(side, r)} />
                    <path d={roundedPath(front, r)} />
                    <path d={roundedPath(top, r)} />
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.18em] transition-colors ${
                mode === m.id
                  ? "border-foreground/60 bg-foreground/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <PanelShell onReset={() => setCfg(DEFAULTS)} export={exportHandlers}>
        <Ctrl
          label="Line weight"
          value={cfg.stroke}
          min={0.2}
          max={4}
          step={0.1}
          onChange={set("stroke")}
        />
        <Ctrl
          label="Corner radius"
          value={cfg.radius}
          min={0}
          max={20}
          step={0.5}
          onChange={set("radius")}
        />
        <Ctrl
          label="Plates"
          value={cfg.count}
          min={3}
          max={40}
          step={1}
          onChange={set("count")}
        />
        <Ctrl
          label="Spacing"
          value={cfg.pitch}
          min={6}
          max={40}
          step={0.5}
          onChange={set("pitch")}
        />
        <Ctrl
          label="Plate depth"
          value={cfg.thickness}
          min={2}
          max={30}
          step={0.5}
          onChange={set("thickness")}
        />
        <Ctrl
          label="Plate width"
          value={cfg.length}
          min={60}
          max={340}
          step={2}
          onChange={set("length")}
        />
        <Ctrl
          label="Max height"
          value={cfg.maxHeight}
          min={40}
          max={320}
          step={2}
          onChange={set("maxHeight")}
        />
        <Ctrl
          label="Face fill"
          value={cfg.fill}
          min={0}
          max={1}
          step={0.01}
          onChange={set("fill")}
        />
        <Ctrl
          label="Depth fade"
          value={cfg.dim}
          min={0}
          max={0.9}
          step={0.01}
          onChange={set("dim")}
        />
      </PanelShell>
    </div>
  );
}
