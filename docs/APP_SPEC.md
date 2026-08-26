# Isometric Studio — Build Specification

A complete, reproducible description of this app: an interactive gallery of isometric SVG line
diagrams with a live attribute panel and self-contained HTML export.

---

## 1. Stack

| Concern | Choice |
| --- | --- |
| Framework | React 19 + TanStack Start v1 (file-based routing via `@tanstack/react-router`) |
| Build | Vite 8, `@tailwindcss/vite` |
| Styling | Tailwind CSS v4, tokens declared in `src/styles.css` (`@theme inline` + `:root`) |
| Icons | `lucide-react` (never emojis/unicode glyphs) |
| Rendering | Hand-written inline SVG. **No** three.js, D3, canvas, or animation library |
| Animation | `requestAnimationFrame` + linear interpolation in React state; CSS `@keyframes` for pulses |
| State | Local `useState` / `useRef`. No global store, no backend, no database |

No extra dependencies are required beyond the default Lovable TanStack template.

### File map

```text
src/
  routes/index.tsx        single route: stage + gallery, holds `selected` diagram id
  components/
    AttrPanel.tsx          shared `Ctrl` slider + `PanelShell` sidebar wrapper
    IsoStack.tsx            Fig. 01 "Plate array" diagram + its attributes + export
    CubeCluster.tsx         Fig. 02 "Cube cluster" diagram + its attributes
    DiagramGallery.tsx      selectable cards with miniature SVG thumbnails
  lib/iso-export.ts        config JSON + self-contained interactive HTML generator
  styles.css                dark theme tokens, incl. --face-a/b/c isometric face shades
```

---

## 2. Theme tokens

All colors are oklch semantic tokens; components never hardcode color utilities.

```css
--background: oklch(0.14 0.004 260);
--foreground: oklch(0.96 0.002 260);
--card: oklch(0.17 0.004 260);
--face-a: oklch(0.16 0.004 260); /* side face */
--face-b: oklch(0.15 0.004 260); /* front face */
--face-c: oklch(0.185 0.004 260); /* top face */
```

Diagram strokes use `stroke-foreground` / `currentColor`; face fills use
`fill-[var(--face-a|b|c)]` with a configurable `fill-opacity`.

---

## 3. Page layout

`src/routes/index.tsx` is the only content route.

- **State**: `const [selected, setSelected] = useState("plate-array")`.
- **Stage (top)**: a `META` record maps the selected id to `{ fig, title, blurb }` rendered as
  the page header (`Fig. 01 — Plate Array`, uppercase 0.4em tracking, light 3xl H1, muted blurb),
  followed by the selected diagram component. Exactly one diagram is mounted at a time.
- **Gallery (bottom)**: `<DiagramGallery selectedId={selected} onSelect={setSelected} />`.
- `head()` supplies title, description, `og:*`, `twitter:card`.

Container: `main.min-h-screen.bg-background.px-6.py-14` > `div.mx-auto.max-w-5xl.flex.flex-col.items-center`.

---

## 4. Canvas specification

Every diagram follows the same canvas contract.

- Root layout: `grid w-full gap-10 lg:grid-cols-[1fr_260px]` — canvas left, attribute panel right.
- The canvas is an inline `<svg>` with a fixed `viewBox`; sizing is fluid (`w-full`, fixed height
  or intrinsic aspect). `touch-none select-none` so pointer drags do not scroll the page.
- Projection helpers (pure functions, no deps):
  - Plate array: `proj(u,v,z) = [0.866*(u+v), 0.5*(u-v) - z]`
  - Cube cluster: `iso(u,v,z) = [0.866*(u-v), 0.5*(u+v) - z]`
- Painter's algorithm: geometry is sorted back-to-front (`sort by u+v`, or `.reverse()` on the
  slat list) and drawn in that order. Solid `fill-background` bodies act as occluders.
- Face order per solid: side → front → top, then a stroke-only group over the same paths.
- Rounded corners are produced by `roundedPath` / `roundPoly`: for each polygon vertex, cut back
  `min(r, edgeLen/2)` along both adjacent edges and join with a quadratic `Q` through the vertex.
- Auto-centering: the plate array computes its own bounding span from the config
  (`spanV = (count-1)*pitch + thickness`) and translates the group so the figure stays centered
  when attributes change.

### Animation loop contract

```ts
useEffect(() => {
  let raf = 0;
  const tick = () => {
    // read live config/pointer from refs (never from closure state)
    // target = profile(...); value += (target - value) * 0.12..0.16
    setValues(next);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}, [mode]);
```

Rules that keep it alive: the movement epsilon must be small (`0.002`), and state must still be
committed while idle so the ambient drift keeps rendering.

### Interactions

- **Plate array**: `onPointerMove` on the SVG maps cursor X → crest index
  (`x * (count+3) - 1.5`, clamped) and cursor Y → amplitude (`clamp(1.25 - y, 0.15, 1)`).
  `onPointerLeave` sets `active: false`, which resumes an ambient sine sweep
  (`center = n/2 + sin(Date.now()/2600) * n/4.5`, amp `0.55`).
  Four profile presets selected by pill buttons: `flat`, `ridge`, `wave`, `fan`.
- **Cube cluster**: `onPointerEnter` per cube sets the hovered id; the hovered cube lerps up by
  `jump` units; the outer contour opacity goes `0.7 → 0.95`. Top faces carry an N×N dot grid,
  each dot animated with `@keyframes cube-dot{0%,100%{opacity:.12}50%{opacity:.95}}` and a
  staggered delay `((i*n + j + seed*3) % 12) * 0.16s`.

---

## 5. Attributes specification

`src/components/AttrPanel.tsx` exports two primitives reused by every diagram:

- `PanelShell({ onReset, children })` — bordered card, header `ATTRIBUTES` (0.3em tracking,
  0.65rem, muted) with a `RESET` text button on the right, `space-y-4` body.
- `Ctrl({ label, value, min, max, step, onChange })` — label + monospace live value on one
  baseline row, native `<input type="range">` styled `h-1 rounded-full bg-border accent-foreground`.

Each diagram owns a typed config object and a `DEFAULTS` constant; `Reset` restores `DEFAULTS`.
Setter helper: `const set = <K extends keyof Cfg>(k: K) => (v: number) => setCfg(c => ({...c, [k]: v}))`.

### Plate array (`IsoConfig`)

| Attribute | Key | Range | Step | Default |
| --- | --- | --- | --- | --- |
| Line weight | `stroke` | 0.2–4 | 0.1 | 0.9 |
| Corner radius | `radius` | 0–20 | 0.5 | 3 |
| Plates | `count` | 3–40 | 1 | 18 |
| Spacing | `pitch` | 6–40 | 0.5 | 14 |
| Plate depth | `thickness` | 2–30 | 0.5 | 9.5 |
| Plate width | `length` | 60–340 | 2 | 190 |
| Max height | `maxHeight` | 40–320 | 2 | 185 |
| Face fill | `fill` | 0–1 | 0.01 | 0.35 |
| Depth fade | `dim` | 0–0.9 | 0.01 | 0.45 |

Depth fade maps a slat's normalized lift to opacity: `1 - dim + lift*dim`, and stroke opacity
`0.4 + lift*0.6`, so raised plates read brighter.

Height profiles (`i` = index, `n` = count, `c` = crest, `a` = amplitude, `H` = maxHeight):

```text
flat  : 6 + H*0.22*a * exp(-((i-c)/2.2)^2)
ridge : 6 + H*a * exp(-((i-c)/(n/5.3))^2)
wave  : 6 + H*a * (0.5 + 0.5*sin(t*2.2π - c*0.35))
fan   : 6 + H*a * (1-t)^1.6  where t = i/(n-1)
```

### Cube cluster (`CubeConfig`)

| Attribute | Key | Range | Step | Default |
| --- | --- | --- | --- | --- |
| Cube size | `size` | 30–90 | 1 | 60 |
| Corner radius | `radius` | 0–26 | 0.5 | 12 |
| Outer weight | `outerStroke` | 0.5–6 | 0.1 | 2.2 |
| Inner weight | `innerStroke` | 0.2–3 | 0.1 | 0.9 |
| Hover jump | `jump` | 0–70 | 1 | 26 |
| Dot grid | `dotCount` | 2–8 | 1 | 4 |
| Dot size | `dotSize` | 0.3–2.5 | 0.05 | 0.85 |
| Dot spacing | `dotSpacing` | 1.2–6 | 0.1 | 2.6 |
| Pulse speed | `pulse` (s) | 0.4–5 | 0.1 | 1.9 |

Cube layout (grid units, multiplied by `size`): `back (0,0,h95)`, `left (0,1,h88)`,
`right (0.95,-0.25,h48)`, `rightLow (1.5,0.5,h72)`, `front (1,1.05,h70)`.

---

## 6. Export specification (`src/lib/iso-export.ts`)

Two outputs, both client-side only:

1. `configToJson(cfg, mode)` → pretty-printed `{ mode, ...cfg }`, written to the clipboard by the
   **Copy config JSON** button (icon swaps `Copy` → `Check` for 1600 ms).
2. `buildInteractiveHtml(cfg, mode)` → a single self-contained HTML document, delivered by
   `downloadFile(name, mime, content)` (Blob + object URL + synthetic `<a download>` click).

The HTML export must be dependency-free and visually identical to the app:

- `readTheme()` reads the computed values of `--background`, `--foreground`, `--face-a/b/c` from
  `document.documentElement` and inlines them, so the export matches the live theme.
- The document embeds a vanilla-JS reimplementation of `proj`, `roundedPath`, `profile`, the RAF
  loop, and the pointer handlers, plus the serialized config and mode.
- Layout: `body{display:grid;place-items:center}`, `svg{width:min(100%,960px);touch-action:none}`.
- Result opens standalone in any browser or embeds in an `<iframe>`; no network requests.

Panel footer copy: "The HTML file is self-contained — open it directly or embed it in an iframe."

---

## 7. Gallery specification (`DiagramGallery.tsx`)

- Section header: `GALLERY` eyebrow, "Diagram collection" H2, right-aligned muted helper text.
- Grid: `grid gap-5 sm:grid-cols-2 lg:grid-cols-4`.
- Each item is `{ id, index, title, blurb, status: "live" | "soon", thumb }`, where `thumb` is a
  miniature inline SVG drawn with the same projection math at ~0.9 stroke width
  (`PlateThumb`, `CubeThumb`, `TowerThumb`, `RingThumb`).
- Cards are `<button type="button">`; `live` cards call `onSelect(id)`, `soon` cards are
  `disabled` + `opacity-70` + `cursor-not-allowed`.
- Card states:
  - selected → `border-foreground/60 bg-foreground/[0.06]`, `Check` icon, footer "Selected"
  - live → `border-border hover:border-foreground/40`, `ArrowUpRight` icon, footer "Interactive"
  - soon → `Lock` icon, footer "In progress"
- Card body order: index (mono, 0.2em tracking) + icon row → 28-unit-tall thumbnail → title →
  blurb → uppercase footer status.

Current roster: `01 plate-array` (live), `02 cube-cluster` (live), `03 stacked-tower` (soon),
`04 ripple-rings` (soon).

---

## 8. Reproduction checklist

1. Start from a TanStack Start + Tailwind v4 template; add nothing but `lucide-react`.
2. Replace the theme tokens in `src/styles.css` with the near-black oklch values above and add
   `--face-a/b/c`.
3. Create `AttrPanel.tsx` (`Ctrl`, `PanelShell`).
4. Create each diagram component: projection helper → rounded-polygon helper → geometry from a
   typed config → painter-ordered render → RAF interpolation → pointer handlers → attribute panel.
5. Create `iso-export.ts` and wire the Export section into the plate array panel.
6. Create `DiagramGallery.tsx` with one thumbnail per roster entry.
7. Wire `src/routes/index.tsx`: `selected` state, `META` header record, single mounted diagram,
   gallery as the selector.
