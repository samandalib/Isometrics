# Making Isometric Line Diagrams in This Style

A method, not a recipe for one figure. Follow it to turn an idea or a screenshot into a new
interactive diagram that belongs to the same family.

---

## 1. The visual language

Everything in this style obeys the same rules. Break one and the figure stops matching.

- **True isometric, no perspective.** One fixed projection for the whole app; no camera, no 3D
  engine. Vertical stays vertical, depth is a pure 2D shear.
- **Line-first.** The figure is defined by strokes. Fills exist only to occlude what's behind and
  to give faces a barely-there separation (opacity ~0.35 over near-black).
- **Near-monochrome.** A near-black background, an off-white foreground, and three face shades a
  few percent apart in lightness. Color is not a variable in this style; light is.
- **Hierarchy through weight, not hue.** Outer silhouette heavy, interior seams thin, distant or
  low geometry dimmer.
- **Rounded corners as a signature.** Every polygon corner is cut and joined with a quadratic
  curve. Sharp corners look like a wireframe; rounded corners look like an object.
- **Diagram furniture.** A "Fig. 0X — Name" eyebrow, a light-weight title, one sentence of
  instruction. It should read like a technical plate, not a hero section.

## 2. Reading a reference screenshot

When a screenshot arrives, extract these before writing code:

1. **Primitive** — what single solid repeats? (slat, cube, ring, tile, shell)
2. **Layout rule** — how are copies placed? (1D array along one axis, 2D grid, radial, stacked in z)
3. **Varying quantity** — what differs between copies? Almost always height, sometimes scale,
   rotation, or count.
4. **Projection sign** — do the depth rows run down-right or down-left? Choose
   `[0.866*(u+v), 0.5*(u-v) - z]` or `[0.866*(u-v), 0.5*(u+v) - z]` accordingly.
5. **Stroke ladder** — count the distinct line weights (usually two: silhouette and interior).
6. **Ornament** — dot grids, tick marks, glows sitting on faces.
7. **Implied interaction** — if you were given several frames of the same figure, those frames are
   the states; the interaction is whatever interpolates between them.

Turn each of 3, 5, 6 into an attribute later.

## 3. Design approach

- **One idea per figure.** A diagram demonstrates a single behavior (a crest travels, a block
  lifts, rings pulse). Resist adding a second.
- **Motion at rest.** A figure that is completely still until hovered looks broken. Give it a slow
  ambient drift and let the pointer take over.
- **Legibility over realism.** No shading gradients, no shadows, no lighting model. Depth is
  communicated by overlap, weight, and opacity.
- **Everything a number.** If you find yourself typing a literal into the render, ask whether it
  should be a slider instead.

## 4. Programming strategy

Build in this order; each step renders something you can look at.

1. **Projection.** A pure function `(u, v, z) => [x, y]`. Nothing else knows about 3D.
2. **Geometry from config.** A `useMemo` that turns a typed config object plus the animated values
   into arrays of 2D points per face. No React, no DOM, no side effects.
3. **Rounded polygon helper.** For each vertex, walk back `min(r, len/2)` along both edges and emit
   `L p1 Q vertex p2`. Reuse it for every face so radii stay consistent.
4. **Paint order.** Sort solids back-to-front by depth key (`u + v`, or reverse the array for a 1D
   stack). Draw per solid: opaque `fill-background` silhouette (occluder) → face fills →
   thin interior strokes → heavy outer contour → ornaments.
5. **Auto-centering.** Compute the figure's extents from the config and translate the group, so
   changing `count` or `size` never pushes the figure off-canvas.
6. **Animation.** One `requestAnimationFrame` loop per diagram, driving a numeric array/record
   through `value += (target - value) * k`, `k ≈ 0.12–0.16`.
7. **Interaction.** Pointer handlers write to a `useRef`, never to state. The loop reads the ref.
8. **Attributes.** Wrap the config in sliders last, once the shape is right.

### Rules that prevent the usual bugs

- Live config and pointer data must be read from refs inside the RAF loop; a closure over state
  freezes at the values captured when the effect ran.
- Keep the "did anything move" epsilon tiny (`0.002`). A large epsilon makes low-amplitude presets
  look frozen, because React stops re-rendering.
- Still commit state while idle, or the ambient drift dies.
- Derive geometry from config in `useMemo` keyed on `[cfg, animatedValues]` — never mutate arrays
  in place and re-render.
- Use `touch-none select-none` on the SVG; otherwise dragging scrolls the page on mobile.
- Under `noUncheckedIndexedAccess`, every indexed read needs a fallback (`pts[i] ?? …`) or a cast.
- Never hardcode Tailwind color utilities. Strokes use `currentColor` / `stroke-foreground`,
  fills use `var(--face-*)`.

## 5. Animation patterns

| Pattern | Use for | Implementation |
| --- | --- | --- |
| Lerp-to-target | height morphs, hover lifts | RAF loop, `v += (t - v) * 0.14` |
| Profile function | a shape driven by one or two scalars | `f(i, n, center, amp) → height` |
| Ambient sine | idle life when the pointer is away | `center = n/2 + sin(now/2600) * n/4.5` |
| Staggered CSS pulse | dot lights, blinking markers | `@keyframes` + per-element `animation-delay` |
| Preset switch | discrete named states from reference frames | swap the profile function; the lerp handles the transition for free |

A profile function is the heart of most figures. Keep its output in world units and always add a
small floor value (e.g. `6`) so nothing collapses to zero thickness.

## 6. Interaction vocabulary

Pick one, at most two.

- **Positional field** — cursor X selects a location along the array, cursor Y an intensity.
  Clamp both, and expand the X range slightly past the ends (`x*(n+3) - 1.5`) so the crest can
  leave the figure.
- **Per-element hover** — `onPointerEnter` per solid sets a hovered id; that solid lerps up and
  brightens its contour. Always clear on the container's `onPointerLeave`.
- **Preset pills** — a row of uppercase, wide-tracked rounded buttons for named states. The active
  pill gets `border-foreground/60 bg-foreground/10`.
- **Scrub** — vertical pointer movement drives a single parameter, for stacked or layered figures.

Interaction should be discoverable within a second of arriving, and the one-sentence blurb under
the title should say exactly what to do.

## 7. Choosing modifiable attributes

Every diagram exposes 6–10 sliders. A good set covers four groups:

1. **Line** — outer weight, inner weight, corner radius.
2. **Count & spacing** — how many primitives, pitch between them.
3. **Primitive dimensions** — width, depth, size, max height.
4. **Tone & motion** — face fill opacity, depth fade, hover jump, pulse speed.

Guidelines:

- Choose ranges where *both* ends still look intentional — the min and max are part of the design.
- Steps: `0.1` for weights, `0.5` for radii/pitch, `1` for counts, `0.01` for opacities.
- Show the live numeric value in monospace next to the label; people copy these numbers.
- Provide `Reset` back to a `DEFAULTS` constant, and make `DEFAULTS` the state initializer.
- An attribute that changes the figure's footprint must feed the auto-centering math.
- Never expose an attribute that can produce an empty or degenerate figure.

## 8. Adding a diagram to the app

1. Draw a thumbnail first: a tiny static SVG using the same projection at ~0.9 stroke. It forces
   you to settle the composition before the interactive version exists.
2. Add the roster entry to the gallery with `status: "soon"` and the thumbnail.
3. Build the component: config type + `DEFAULTS` → geometry → render → RAF → pointer → panel,
   returning `grid w-full gap-10 lg:grid-cols-[1fr_260px]` with `PanelShell` on the right.
4. Flip the roster entry to `"live"` and register the id in the route's `META` record with its
   `Fig. 0X` label, title, and instruction sentence.
5. If the figure is worth exporting, add a vanilla-JS port of its projection, profile, and loop to
   the export builder — the export must stay dependency-free and theme-matched.

## 9. Quality bar before calling it done

- Idle: the figure moves on its own, slowly, without jitter.
- Hover: response is immediate and eases; nothing snaps.
- Every slider at both extremes: still centered, still legible, no clipping, no NaN paths.
- Overlaps are always resolved correctly — no far solid drawn over a near one.
- Reset returns exactly to the first-load appearance.
- Zero console errors, and the build/typecheck is clean.
