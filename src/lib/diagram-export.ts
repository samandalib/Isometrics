import type { IsoConfig } from "@/components/IsoStack";
import type { RippleConfig } from "@/components/RippleRings";
import type { BurrConfig } from "@/components/BurrPuzzle";
import type { ComputerConfig } from "@/components/RetroComputer";
import { repoviveLogoGeometryScript } from "@/lib/repovive-logo-iso";

export type IsoMode = "flat" | "ridge" | "wave" | "fan";

export type CubeConfig = {
  size: number;
  radius: number;
  outerStroke: number;
  innerStroke: number;
  jump: number;
  dotCount: number;
  dotSize: number;
  dotSpacing: number;
  pulse: number;
};

export function downloadFile(name: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Reads the live theme colors so the export looks identical outside the app. */
function readTheme() {
  const s = getComputedStyle(document.documentElement);
  const get = (n: string, fb: string) => s.getPropertyValue(n).trim() || fb;
  return {
    bg: get("--background", "#0b0b0c"),
    fg: get("--foreground", "#f2f2f2"),
    a: get("--face-a", "#8b8b8b"),
    b: get("--face-b", "#5f5f5f"),
    c: get("--face-c", "#c9c9c9"),
  };
}

export function isoConfigToJson(cfg: IsoConfig, mode: IsoMode) {
  return JSON.stringify({ diagram: "plate-array", mode, ...cfg }, null, 2);
}

export function cubeConfigToJson(cfg: CubeConfig) {
  return JSON.stringify({ diagram: "cube-cluster", ...cfg }, null, 2);
}

export function buildIsoInteractiveHtml(cfg: IsoConfig, mode: IsoMode) {
  const theme = readTheme();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Isometric Plate Array</title>
  <style>
    :root { color-scheme: dark light; }
    html,body { margin:0; height:100%; background:${theme.bg}; }
    body { display:grid; place-items:center; }
    svg { width:min(100%, 960px); touch-action:none; user-select:none; }
  </style>
</head>
<body>
  <svg id="iso" viewBox="0 0 880 560"><g id="root"></g></svg>
  <script>
  (function () {
    var CFG = ${JSON.stringify(cfg)};
    var MODE = ${JSON.stringify(mode)};
    var T = ${JSON.stringify(theme)};
    var NS = "http://www.w3.org/2000/svg";

    var svg = document.getElementById("iso"), root = document.getElementById("root");
    var state = new Array(CFG.count).fill(8);
    var pointer = { center: CFG.count / 2, amp: 0.75, active: false };

    function proj(u, v, z) { return [0.866 * (u + v), 0.5 * (u - v) - z]; }

    function roundedPath(pts, r) {
      if (r <= 0.01) return "M " + pts.map(function (p) { return p[0].toFixed(2) + " " + p[1].toFixed(2); }).join(" L ") + " Z";
      var n = pts.length, d = "";
      for (var i = 0; i < n; i++) {
        var prev = pts[(i - 1 + n) % n], cur = pts[i], next = pts[(i + 1) % n];
        var cut = function (a, b) {
          var dx = b[0] - a[0], dy = b[1] - a[1];
          var len = Math.hypot(dx, dy) || 1, t = Math.min(r, len / 2) / len;
          return [a[0] + dx * t, a[1] + dy * t];
        };
        var from = cut(cur, prev), to = cut(cur, next);
        d += (i === 0 ? "M " : " L ") + from[0].toFixed(2) + " " + from[1].toFixed(2);
        d += " Q " + cur[0].toFixed(2) + " " + cur[1].toFixed(2) + " " + to[0].toFixed(2) + " " + to[1].toFixed(2);
      }
      return d + " Z";
    }

    function profile(i, n, center, amp, maxH) {
      var t = n > 1 ? i / (n - 1) : 0;
      if (MODE === "flat") return 6 + 4 * Math.exp(-Math.pow((i - center) / 2.2, 2));
      if (MODE === "ridge") { var d = (i - center) / (n / 5.3); return 6 + maxH * amp * Math.exp(-d * d); }
      if (MODE === "wave") return 6 + maxH * amp * (0.5 + 0.5 * Math.sin(t * Math.PI * 2.2 - center * 0.35));
      return 6 + maxH * amp * Math.pow(1 - t, 1.6);
    }

    function path(d, fill, opacity) {
      var p = document.createElementNS(NS, "path");
      p.setAttribute("d", d);
      p.setAttribute("fill", fill);
      p.setAttribute("fill-opacity", String(opacity));
      return p;
    }

    function render() {
      var n = CFG.count, spanV = (n - 1) * CFG.pitch + CFG.thickness;
      var w = 0.866 * (CFG.length + spanV);
      var yMin = -0.5 * spanV - CFG.maxHeight, yMax = 0.5 * CFG.length;
      root.setAttribute("transform", "translate(" + (440 - w / 2).toFixed(2) + " " + (280 - (yMin + yMax) / 2).toFixed(2) + ")");
      root.textContent = "";
      for (var i = n - 1; i >= 0; i--) {
        var v0 = i * CFG.pitch, v1 = v0 + CFG.thickness, h = state[i] || 8;
        var top = [proj(0, v0, h), proj(CFG.length, v0, h), proj(CFG.length, v1, h), proj(0, v1, h)];
        var front = [proj(CFG.length, v0, h), proj(CFG.length, v1, h), proj(CFG.length, v1, 0), proj(CFG.length, v0, 0)];
        var side = [proj(0, v0, h), proj(CFG.length, v0, h), proj(CFG.length, v0, 0), proj(0, v0, 0)];
        var lift = Math.min(1, (h - 6) / CFG.maxHeight);
        var g = document.createElementNS(NS, "g");
        g.setAttribute("opacity", String(1 - CFG.dim + lift * CFG.dim));
        g.appendChild(path(roundedPath(side, CFG.radius), T.a, CFG.fill));
        g.appendChild(path(roundedPath(front, CFG.radius), T.b, CFG.fill));
        g.appendChild(path(roundedPath(top, CFG.radius), T.c, CFG.fill));
        var lines = document.createElementNS(NS, "g");
        lines.setAttribute("fill", "none");
        lines.setAttribute("stroke", T.fg);
        lines.setAttribute("stroke-width", String(CFG.stroke));
        lines.setAttribute("stroke-linejoin", "round");
        lines.setAttribute("opacity", String(0.4 + lift * 0.6));
        [side, front, top].forEach(function (f) {
          var p = document.createElementNS(NS, "path");
          p.setAttribute("d", roundedPath(f, CFG.radius));
          lines.appendChild(p);
        });
        g.appendChild(lines);
        root.appendChild(g);
      }
    }

    function tick() {
      var n = CFG.count;
      var eff = pointer.active ? pointer.amp : 0.55;
      var ctr = pointer.active ? pointer.center : n / 2 + Math.sin(Date.now() / 2600) * (n / 4.5);
      for (var i = 0; i < n; i++) {
        var target = profile(i, n, ctr, eff, CFG.maxHeight);
        state[i] = state[i] + (target - state[i]) * 0.12;
      }
      render();
      requestAnimationFrame(tick);
    }

    svg.addEventListener("pointermove", function (e) {
      var r = svg.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height, n = CFG.count;
      pointer = {
        center: Math.max(-2, Math.min(n + 1, x * (n + 3) - 1.5)),
        amp: Math.max(0.15, Math.min(1, 1.25 - y)),
        active: true
      };
    });
    svg.addEventListener("pointerleave", function () { pointer.active = false; });

    requestAnimationFrame(tick);
  })();
  </script>
</body>
</html>
`;
}

export function buildCubeInteractiveHtml(cfg: CubeConfig) {
  const theme = readTheme();
  const cubes = [
    { id: "back", u: 0, v: 0, h: 95 },
    { id: "left", u: 0, v: 1, h: 88 },
    { id: "right", u: 0.95, v: -0.25, h: 48 },
    { id: "rightLow", u: 1.5, v: 0.5, h: 72 },
    { id: "front", u: 1, v: 1.05, h: 70 },
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Isometric Cube Cluster</title>
  <style>
    :root { color-scheme: dark light; }
    html,body { margin:0; height:100%; background:${theme.bg}; color:${theme.fg}; }
    body { display:grid; place-items:center; }
    svg { width:min(100%, 640px); height:min(100vh, 520px); touch-action:none; user-select:none; }
    @keyframes cube-dot { 0%,100% { opacity:.12 } 50% { opacity:.95 } }
  </style>
</head>
<body>
  <svg id="cluster" viewBox="-160 -180 320 340"><g id="root"></g></svg>
  <script>
  (function () {
    var CFG = ${JSON.stringify(cfg)};
    var CUBES = ${JSON.stringify(cubes)};
    var T = ${JSON.stringify(theme)};
    var NS = "http://www.w3.org/2000/svg";

    var svg = document.getElementById("cluster"), root = document.getElementById("root");
    var hover = null;
    var lift = {};
    CUBES.forEach(function (c) { lift[c.id] = 0; });

    function iso(u, v, z) { return [0.866 * (u - v), 0.5 * (u + v) - z]; }

    function roundPoly(pts, r) {
      var n = pts.length, d = "";
      for (var i = 0; i < n; i++) {
        var prev = pts[(i - 1 + n) % n], cur = pts[i], next = pts[(i + 1) % n];
        var v1 = [prev[0] - cur[0], prev[1] - cur[1]], v2 = [next[0] - cur[0], next[1] - cur[1]];
        var l1 = Math.hypot(v1[0], v1[1]) || 1, l2 = Math.hypot(v2[0], v2[1]) || 1;
        var rr = Math.min(r, l1 / 2, l2 / 2);
        var p1 = [cur[0] + (v1[0] / l1) * rr, cur[1] + (v1[1] / l1) * rr];
        var p2 = [cur[0] + (v2[0] / l2) * rr, cur[1] + (v2[1] / l2) * rr];
        d += (i === 0 ? "M " : " L ") + p1[0].toFixed(2) + " " + p1[1].toFixed(2);
        d += " Q " + cur[0].toFixed(2) + " " + cur[1].toFixed(2) + " " + p2[0].toFixed(2) + " " + p2[1].toFixed(2);
      }
      return d + " Z";
    }

    function addDots(g, cx, cy, seed) {
      var n = CFG.dotCount, mid = (n - 1) / 2;
      for (var i = 0; i < n; i++) {
        for (var j = 0; j < n; j++) {
          var p = iso((i - mid) * CFG.dotSpacing, (j - mid) * CFG.dotSpacing, 0);
          var dot = document.createElementNS(NS, "circle");
          dot.setAttribute("cx", String(cx + p[0]));
          dot.setAttribute("cy", String(cy + p[1]));
          dot.setAttribute("r", String(CFG.dotSize));
          dot.setAttribute("fill", T.fg);
          dot.style.animation = "cube-dot " + CFG.pulse + "s ease-in-out " + (((i * n + j + seed * 3) % 12) * 0.16) + "s infinite";
          g.appendChild(dot);
        }
      }
    }

    function render() {
      root.textContent = "";
      var S = CFG.size;
      var ordered = CUBES.slice().sort(function (a, b) { return a.u + a.v - (b.u + b.v); });
      ordered.forEach(function (c, idx) {
        var z = lift[c.id] || 0;
        var u0 = c.u * S, v0 = c.v * S, top = c.h + z;
        var tA = iso(u0, v0, top), tB = iso(u0 + S, v0, top);
        var tC = iso(u0 + S, v0 + S, top), tD = iso(u0, v0 + S, top);
        var bB = iso(u0 + S, v0, z), bC = iso(u0 + S, v0 + S, z), bD = iso(u0, v0 + S, z);
        var silhouette = [tA, tB, bB, bC, bD, tD];
        var center = iso(u0 + S / 2, v0 + S / 2, top);

        var g = document.createElementNS(NS, "g");
        g.style.cursor = "pointer";
        g.addEventListener("pointerenter", function () { hover = c.id; });
        g.addEventListener("pointerleave", function () { if (hover === c.id) hover = null; });

        var fill = document.createElementNS(NS, "path");
        fill.setAttribute("d", roundPoly(silhouette, CFG.radius));
        fill.setAttribute("fill", T.bg);
        fill.setAttribute("stroke", "none");
        g.appendChild(fill);

        var innerTop = document.createElementNS(NS, "path");
        innerTop.setAttribute("d", roundPoly([tA, tB, tC, tD], CFG.radius));
        innerTop.setAttribute("fill", "none");
        innerTop.setAttribute("stroke", T.fg);
        innerTop.setAttribute("stroke-opacity", "0.45");
        innerTop.setAttribute("stroke-width", String(CFG.innerStroke));
        innerTop.setAttribute("stroke-linejoin", "round");
        g.appendChild(innerTop);

        var edge = document.createElementNS(NS, "path");
        edge.setAttribute("d", "M " + tC[0].toFixed(2) + " " + tC[1].toFixed(2) + " L " + bC[0].toFixed(2) + " " + bC[1].toFixed(2));
        edge.setAttribute("fill", "none");
        edge.setAttribute("stroke", T.fg);
        edge.setAttribute("stroke-opacity", "0.45");
        edge.setAttribute("stroke-width", String(CFG.innerStroke));
        g.appendChild(edge);

        var outer = document.createElementNS(NS, "path");
        outer.setAttribute("d", roundPoly(silhouette, CFG.radius));
        outer.setAttribute("fill", "none");
        outer.setAttribute("stroke", T.fg);
        outer.setAttribute("stroke-opacity", hover === c.id ? "0.95" : "0.7");
        outer.setAttribute("stroke-width", String(CFG.outerStroke));
        outer.setAttribute("stroke-linejoin", "round");
        g.appendChild(outer);

        addDots(g, center[0], center[1], idx);
        root.appendChild(g);
      });
    }

    function tick() {
      var changed = false;
      CUBES.forEach(function (c) {
        var target = hover === c.id ? CFG.jump : 0;
        var cur = lift[c.id] || 0;
        var val = cur + (target - cur) * 0.16;
        if (Math.abs(val - cur) > 0.01 || cur !== target) {
          lift[c.id] = Math.abs(val - target) < 0.01 ? target : val;
          changed = true;
        }
      });
      if (changed) render();
      requestAnimationFrame(tick);
    }

    svg.addEventListener("pointerleave", function () { hover = null; });
    render();
    requestAnimationFrame(tick);
  })();
  </script>
</body>
</html>
`;
}

export type TowerConfig = {
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

export function towerConfigToJson(cfg: TowerConfig) {
  return JSON.stringify({ diagram: "stacked-tower", ...cfg }, null, 2);
}

export function buildTowerInteractiveHtml(cfg: TowerConfig) {
  const theme = readTheme();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Isometric Stacked Tower</title>
  <style>
    :root { color-scheme: dark light; }
    html,body { margin:0; height:100%; background:${theme.bg}; color:${theme.fg}; }
    body { display:grid; place-items:center; }
    svg { width:min(100%, 640px); height:min(100vh, 520px); touch-action:none; user-select:none; }
  </style>
</head>
<body>
  <svg id="tower" viewBox="-120 -160 240 300"><g id="root"></g></svg>
  <script>
  (function () {
    var CFG = ${JSON.stringify(cfg)};
    var T = ${JSON.stringify(theme)};
    var NS = "http://www.w3.org/2000/svg";

    var svg = document.getElementById("tower"), root = document.getElementById("root");
    var topLift = CFG.lift * 0.55;
    var pointer = { y: 0.45, active: false };

    function iso(u, v, z) { return [0.866 * (u - v), 0.5 * (u + v) - z]; }

    function roundPoly(pts, r) {
      var n = pts.length, d = "";
      for (var i = 0; i < n; i++) {
        var prev = pts[(i - 1 + n) % n], cur = pts[i], next = pts[(i + 1) % n];
        var v1 = [prev[0] - cur[0], prev[1] - cur[1]], v2 = [next[0] - cur[0], next[1] - cur[1]];
        var l1 = Math.hypot(v1[0], v1[1]) || 1, l2 = Math.hypot(v2[0], v2[1]) || 1;
        var rr = Math.min(r, l1 / 2, l2 / 2);
        var p1 = [cur[0] + (v1[0] / l1) * rr, cur[1] + (v1[1] / l1) * rr];
        var p2 = [cur[0] + (v2[0] / l2) * rr, cur[1] + (v2[1] / l2) * rr];
        d += (i === 0 ? "M " : " L ") + p1[0].toFixed(2) + " " + p1[1].toFixed(2);
        d += " Q " + cur[0].toFixed(2) + " " + cur[1].toFixed(2) + " " + p2[0].toFixed(2) + " " + p2[1].toFixed(2);
      }
      return d + " Z";
    }

    function slab(S, z0, z1) {
      var tA = iso(0, 0, z1), tB = iso(S, 0, z1), tC = iso(S, S, z1), tD = iso(0, S, z1);
      var bB = iso(S, 0, z0), bC = iso(S, S, z0), bD = iso(0, S, z0);
      return {
        silhouette: [tA, tB, bB, bC, bD, tD],
        top: [tA, tB, tC, tD],
        tC: tC, bC: bC, z0: z0, z1: z1
      };
    }

    ${repoviveLogoGeometryScript()}

    function render() {
      root.textContent = "";
      var S = CFG.size, step = CFG.thickness + CFG.pitch, layers = CFG.layers;
      var stack = [];
      for (var i = 0; i < layers; i++) {
        var base = i * step;
        var z0 = i === layers - 1 ? base + topLift : base;
        stack.push(slab(S, z0, z0 + CFG.thickness));
      }

      var span = (layers - 1) * step + CFG.thickness + CFG.lift;
      var ox = 0, oy = -(-span + 0.5 * S) / 2 - 8;
      root.setAttribute("transform", "translate(" + ox.toFixed(2) + " " + oy.toFixed(2) + ")");

      var top = stack[layers - 1], below = stack[layers - 2];
      if (below) {
        [[0,0],[S,0],[S,S],[0,S]].forEach(function (uv) {
          var from = iso(uv[0], uv[1], below.z1), to = iso(uv[0], uv[1], top.z0);
          var line = document.createElementNS(NS, "line");
          line.setAttribute("x1", String(from[0]));
          line.setAttribute("y1", String(from[1]));
          line.setAttribute("x2", String(to[0]));
          line.setAttribute("y2", String(to[1]));
          line.setAttribute("stroke", T.fg);
          line.setAttribute("stroke-width", String(CFG.guideStroke));
          line.setAttribute("stroke-opacity", "0.35");
          line.setAttribute("stroke-dasharray", "3 4");
          root.appendChild(line);
        });
      }

      stack.forEach(function (s, i) {
        var isTop = i === layers - 1;
        var g = document.createElementNS(NS, "g");
        var fill = document.createElementNS(NS, "path");
        fill.setAttribute("d", roundPoly(s.silhouette, CFG.radius));
        fill.setAttribute("fill", T.bg);
        fill.setAttribute("stroke", "none");
        g.appendChild(fill);
        var innerTop = document.createElementNS(NS, "path");
        innerTop.setAttribute("d", roundPoly(s.top, CFG.radius));
        innerTop.setAttribute("fill", "none");
        innerTop.setAttribute("stroke", T.fg);
        innerTop.setAttribute("stroke-opacity", isTop ? "0.55" : "0.4");
        innerTop.setAttribute("stroke-width", String(CFG.innerStroke));
        innerTop.setAttribute("stroke-linejoin", "round");
        g.appendChild(innerTop);
        var edge = document.createElementNS(NS, "path");
        edge.setAttribute("d", "M " + s.tC[0].toFixed(2) + " " + s.tC[1].toFixed(2) + " L " + s.bC[0].toFixed(2) + " " + s.bC[1].toFixed(2));
        edge.setAttribute("fill", "none");
        edge.setAttribute("stroke", T.fg);
        edge.setAttribute("stroke-opacity", "0.4");
        edge.setAttribute("stroke-width", String(CFG.innerStroke));
        g.appendChild(edge);
        var outer = document.createElementNS(NS, "path");
        outer.setAttribute("d", roundPoly(s.silhouette, CFG.radius));
        outer.setAttribute("fill", "none");
        outer.setAttribute("stroke", T.fg);
        outer.setAttribute("stroke-opacity", isTop ? "0.95" : "0.72");
        outer.setAttribute("stroke-width", String(CFG.outerStroke));
        outer.setAttribute("stroke-linejoin", "round");
        g.appendChild(outer);
        root.appendChild(g);
      });

      addRepoviveLogo(root, S, top.z1, CFG.iconScale);
    }

    function tick() {
      var target = pointer.active
        ? CFG.lift * (1 - pointer.y)
        : CFG.lift * (0.42 + 0.08 * Math.sin(Date.now() / 2800));
      topLift += (target - topLift) * 0.14;
      render();
      requestAnimationFrame(tick);
    }

    svg.addEventListener("pointermove", function (e) {
      var r = svg.getBoundingClientRect();
      pointer.y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      pointer.active = true;
    });
    svg.addEventListener("pointerleave", function () { pointer.active = false; });

    requestAnimationFrame(tick);
  })();
  </script>
</body>
</html>
`;
}

export function rippleConfigToJson(cfg: RippleConfig) {
  return JSON.stringify({ diagram: "ripple-rings", ...cfg }, null, 2);
}

export function buildRippleInteractiveHtml(cfg: RippleConfig) {
  const theme = readTheme();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Isometric Ripple Rings</title>
  <style>
    :root { color-scheme: dark light; }
    html,body { margin:0; height:100%; background:${theme.bg}; color:${theme.fg}; }
    body { display:grid; place-items:center; }
    svg { width:min(100%, 640px); height:min(100vh, 520px); touch-action:none; user-select:none; }
  </style>
</head>
<body>
  <svg id="ripple" viewBox="-140 -130 280 260"><g id="root"></g></svg>
  <script>
  (function () {
    var CFG = ${JSON.stringify(cfg)};
    var T = ${JSON.stringify(theme)};
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.getElementById("ripple"), root = document.getElementById("root");
    var morph = 0.12, pointer = { active: false };

    function iso(u, v, z) { return [0.866 * (u - v), 0.5 * (u + v) - z]; }

    function profile(t, m) {
      var tf = Math.pow(Math.max(0, Math.min(1, t)), 0.82);
      var rIdle = CFG.radius - t * (CFG.radius - CFG.innerRadius);
      var rFunnel = CFG.innerRadius + (CFG.radius - CFG.innerRadius) * (1 - tf);
      var r = rIdle + (rFunnel - rIdle) * m;
      var zIdle = 8 + t * 14;
      var zFunnel = CFG.depth * (1 - Math.pow(t, 0.72));
      return { r: r, z: zIdle + (zFunnel - zIdle) * m };
    }

    function at(t, angle, m) {
      var p = profile(t, m);
      return iso(Math.cos(angle) * p.r, Math.sin(angle) * p.r, p.z);
    }

    function closePath(pts) {
      return "M " + pts.map(function (p) { return p[0].toFixed(2) + " " + p[1].toFixed(2); }).join(" L ") + " Z";
    }

    function smoothPath(pts) {
      if (pts.length < 2) return "";
      function p(i) { return pts[Math.max(0, Math.min(pts.length - 1, i))]; }
      var d = "M " + p(0)[0].toFixed(2) + " " + p(0)[1].toFixed(2);
      for (var i = 0; i < pts.length - 1; i++) {
        var p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
        var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
        var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
        d += " C " + c1x.toFixed(2) + " " + c1y.toFixed(2) + " " + c2x.toFixed(2) + " " + c2y.toFixed(2) + " " + p2[0].toFixed(2) + " " + p2[1].toFixed(2);
      }
      return d;
    }

    function polyLen(pts) {
      var L = 0;
      for (var i = 1; i < pts.length; i++) {
        L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      }
      return Math.max(1, L);
    }

    function path(d, w, op) {
      var el = document.createElementNS(NS, "path");
      el.setAttribute("d", d);
      el.setAttribute("fill", "none");
      el.setAttribute("stroke", T.fg);
      el.setAttribute("stroke-width", String(w));
      el.setAttribute("stroke-opacity", String(op));
      el.setAttribute("stroke-linejoin", "round");
      el.setAttribute("stroke-linecap", "round");
      return el;
    }

    function render(phase) {
      root.textContent = "";
      var n = Math.max(3, Math.round(CFG.rings)), segs = 56;
      var rim = profile(0, morph), throat = profile(1, morph);
      var yMin = -throat.z - 0.71 * rim.r, yMax = -rim.z + 0.71 * rim.r;
      root.setAttribute("transform", "translate(0 " + (-(yMin + yMax) / 2).toFixed(2) + ")");

      var mCount = Math.max(0, Math.round(CFG.meridians));
      for (var m = 0; m < mCount; m++) {
        var ang = (m / mCount) * Math.PI * 2, pts = [];
        for (var i = 0; i <= 24; i++) pts.push(at(i / 24, ang, morph));
        root.appendChild(path(smoothPath(pts), CFG.stroke * 0.55, 0.22 + morph * 0.18));
      }

      for (var i = 0; i < n; i++) {
        var t = n > 1 ? i / (n - 1) : 0, ring = [];
        for (var k = 0; k < segs; k++) ring.push(at(t, (k / segs) * Math.PI * 2, morph));
        var w = i === 0 ? CFG.stroke * 1.35 : CFG.stroke * (1 - t * 0.25);
        root.appendChild(path(closePath(ring), w, 0.35 + (1 - t) * CFG.fade));
      }

      var fCount = Math.max(0, Math.round(CFG.flowCount));
      for (var f = 0; f < fCount; f++) {
        var base = ((f + 0.18) / Math.max(1, fCount)) * Math.PI * 2;
        var helix = [];
        for (var s = 0; s <= 40; s++) {
          var tt = s / 40, ease = tt * tt * (3 - 2 * tt);
          helix.push(at(tt, base + CFG.twist * ease * Math.PI * 2, morph));
        }
        var d = smoothPath(helix);
        var L = polyLen(helix);
        var comet = L * 0.2, gap = L * 0.8;
        var off = -((((phase * 0.35 + f / Math.max(1, fCount)) % 1) + 1) % 1) * L;
        var rail = path(d, CFG.stroke * 0.4, 0.08 + morph * 0.08);
        root.appendChild(rail);
        var thread = path(d, CFG.stroke * 1.05, 0.35 + morph * 0.5);
        thread.setAttribute("stroke-dasharray", comet.toFixed(1) + " " + gap.toFixed(1));
        thread.setAttribute("stroke-dashoffset", off.toFixed(1));
        root.appendChild(thread);
        var head = path(d, CFG.stroke * 1.6, (0.35 + morph * 0.5) * 0.85);
        head.setAttribute("stroke-dasharray", (L * 0.045).toFixed(1) + " " + (L * 0.955).toFixed(1));
        head.setAttribute("stroke-dashoffset", off.toFixed(1));
        root.appendChild(head);
      }
    }

    function tick() {
      var now = Date.now();
      var target = pointer.active ? 1 : 0.1 + 0.08 * Math.sin(now / 2600);
      morph += (target - morph) * 0.13;
      render((now / 1000) * CFG.flowSpeed);
      requestAnimationFrame(tick);
    }

    svg.addEventListener("pointerenter", function () { pointer.active = true; });
    svg.addEventListener("pointermove", function () { pointer.active = true; });
    svg.addEventListener("pointerleave", function () { pointer.active = false; });
    requestAnimationFrame(tick);
  })();
  </script>
</body>
</html>
`;
}

export function burrConfigToJson(cfg: BurrConfig) {
  return JSON.stringify({ diagram: "burr-puzzle", ...cfg }, null, 2);
}

export function buildBurrInteractiveHtml(cfg: BurrConfig) {
  const theme = readTheme();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Isometric Burr Puzzle</title>
  <style>
    :root { color-scheme: dark light; }
    html,body { margin:0; height:100%; background:${theme.bg}; color:${theme.fg}; }
    body { display:grid; place-items:center; }
    svg { width:min(100%, 640px); height:min(100vh, 520px); touch-action:none; user-select:none; }
  </style>
</head>
<body>
  <svg id="burr" viewBox="-160 -170 320 330"><g id="root"></g></svg>
  <script>
  (function () {
    var CFG = ${JSON.stringify(cfg)};
    var T = ${JSON.stringify(theme)};
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.getElementById("burr"), root = document.getElementById("root");
    var IDS = ["u0","u1","v0","v1","z0","z1"];
    var hover = null, pull = {};
    IDS.forEach(function (id) { pull[id] = 0; });

    function iso(u, v, z) { return [0.866 * (u - v), 0.5 * (u + v) - z]; }

    function roundPoly(pts, r) {
      var n = pts.length, d = "";
      for (var i = 0; i < n; i++) {
        var prev = pts[(i - 1 + n) % n], cur = pts[i], next = pts[(i + 1) % n];
        var v1 = [prev[0] - cur[0], prev[1] - cur[1]], v2 = [next[0] - cur[0], next[1] - cur[1]];
        var l1 = Math.hypot(v1[0], v1[1]) || 1, l2 = Math.hypot(v2[0], v2[1]) || 1;
        var rr = Math.min(r, l1 / 2, l2 / 2);
        var p1 = [cur[0] + (v1[0] / l1) * rr, cur[1] + (v1[1] / l1) * rr];
        var p2 = [cur[0] + (v2[0] / l2) * rr, cur[1] + (v2[1] / l2) * rr];
        d += (i === 0 ? "M " : " L ") + p1[0].toFixed(2) + " " + p1[1].toFixed(2);
        d += " Q " + cur[0].toFixed(2) + " " + cur[1].toFixed(2) + " " + p2[0].toFixed(2) + " " + p2[1].toFixed(2);
      }
      return d + " Z";
    }

    function sticks(s, L) {
      var h = L / 2, e = function (id) { return pull[id] || 0; };
      return [
        { id: "u0", u0: -h - e("u0"), u1: h - e("u0"), v0: -s, v1: 0, z0: -s, z1: 0 },
        { id: "u1", u0: -h + e("u1"), u1: h + e("u1"), v0: 0, v1: s, z0: 0, z1: s },
        { id: "v0", u0: -s, u1: 0, v0: -h - e("v0"), v1: h - e("v0"), z0: 0, z1: s },
        { id: "v1", u0: 0, u1: s, v0: -h + e("v1"), v1: h + e("v1"), z0: -s, z1: 0 },
        { id: "z0", u0: 0, u1: s, v0: -s, v1: 0, z0: -h - e("z0"), z1: h - e("z0") },
        { id: "z1", u0: -s, u1: 0, v0: 0, v1: s, z0: -h + e("z1"), z1: h + e("z1") }
      ];
    }

    function faces(b) {
      var tA = iso(b.u0, b.v0, b.z1), tB = iso(b.u1, b.v0, b.z1);
      var tC = iso(b.u1, b.v1, b.z1), tD = iso(b.u0, b.v1, b.z1);
      var bB = iso(b.u1, b.v0, b.z0), bC = iso(b.u1, b.v1, b.z0), bD = iso(b.u0, b.v1, b.z0);
      return {
        id: b.id,
        silhouette: [tA, tB, bB, bC, bD, tD],
        top: [tA, tB, tC, tD],
        front: [tB, tC, bC, bB],
        side: [tD, tC, bC, bD]
      };
    }

    var restPull = {};
    IDS.forEach(function (id) { restPull[id] = 0; });
    var ORDER = {};
    (function () {
      var saved = pull;
      pull = restPull;
      sticks(CFG.thickness, CFG.length).forEach(function (b) {
        ORDER[b.id] = (b.u0 + b.u1) / 2 + (b.v0 + b.v1) / 2 - (b.z0 + b.z1) * 0.12;
      });
      pull = saved;
    })();

    function elPath(d, fill, fo, stroke, so, sw) {
      var p = document.createElementNS(NS, "path");
      p.setAttribute("d", d);
      p.setAttribute("fill", fill);
      if (fo != null) p.setAttribute("fill-opacity", String(fo));
      p.setAttribute("stroke", stroke);
      if (so != null) p.setAttribute("stroke-opacity", String(so));
      if (sw != null) p.setAttribute("stroke-width", String(sw));
      p.setAttribute("stroke-linejoin", "round");
      return p;
    }

    function render() {
      root.textContent = "";
      var list = sticks(CFG.thickness, CFG.length).map(faces).sort(function (a, b) { return ORDER[a.id] - ORDER[b.id]; });
      list.forEach(function (b) {
        var g = document.createElementNS(NS, "g");
        g.style.cursor = "pointer";
        g.addEventListener("pointerenter", function () { hover = b.id; });
        g.addEventListener("pointerleave", function () { if (hover === b.id) hover = null; });
        var r = CFG.radius;
        g.appendChild(elPath(roundPoly(b.silhouette, r), T.bg, null, "none", null, null));
        g.appendChild(elPath(roundPoly(b.side, r), T.a, CFG.fill, "none", null, null));
        g.appendChild(elPath(roundPoly(b.front, r), T.b, CFG.fill, "none", null, null));
        g.appendChild(elPath(roundPoly(b.top, r), T.c, CFG.fill, "none", null, null));
        var inner = document.createElementNS(NS, "g");
        inner.setAttribute("fill", "none");
        inner.setAttribute("stroke", T.fg);
        inner.setAttribute("stroke-width", String(CFG.innerStroke));
        inner.setAttribute("stroke-opacity", "0.4");
        inner.setAttribute("stroke-linejoin", "round");
        [b.side, b.front, b.top].forEach(function (f) {
          var p = document.createElementNS(NS, "path");
          p.setAttribute("d", roundPoly(f, r));
          inner.appendChild(p);
        });
        g.appendChild(inner);
        g.appendChild(elPath(roundPoly(b.silhouette, r), "none", null, T.fg, hover === b.id ? 0.96 : 0.72, CFG.outerStroke));
        root.appendChild(g);
      });
    }

    function tick() {
      var ambient = CFG.explode * (0.04 + 0.03 * Math.sin(Date.now() / 2400));
      var changed = false;
      IDS.forEach(function (id) {
        var target = hover === id ? CFG.explode : ambient;
        var cur = pull[id] || 0;
        var val = cur + (target - cur) * 0.14;
        var out = Math.abs(val - target) < 0.02 ? target : val;
        if (Math.abs(out - cur) > 0.002) { pull[id] = out; changed = true; }
      });
      if (changed) render();
      requestAnimationFrame(tick);
    }

    svg.addEventListener("pointerleave", function () { hover = null; });
    render();
    requestAnimationFrame(tick);
  })();
  </script>
</body>
</html>
`;
}

export function computerConfigToJson(cfg: ComputerConfig) {
  return JSON.stringify({ diagram: "retro-computer", ...cfg }, null, 2);
}

export function buildComputerInteractiveHtml(cfg: ComputerConfig) {
  const theme = readTheme();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Isometric Retro Computer</title>
  <style>
    :root { color-scheme: dark light; }
    html,body { margin:0; height:100%; background:${theme.bg}; color:${theme.fg}; }
    body { display:grid; place-items:center; }
    svg { width:min(100%, 720px); height:min(100vh, 520px); touch-action:none; user-select:none; }
  </style>
</head>
<body>
  <svg id="pc" viewBox="-180 -170 360 330"><g id="root"></g></svg>
  <script>
  (function () {
    var CFG = ${JSON.stringify(cfg)};
    var T = ${JSON.stringify(theme)};
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.getElementById("pc"), root = document.getElementById("root");
    var PARTS = ["case","monitor","keyboard","mouse"];
    var hover = null, lift = {}, cursorOn = true;
    PARTS.forEach(function (id) { lift[id] = 0; });

    function iso(u, v, z) { return [0.866 * (u - v), 0.5 * (u + v) - z]; }
    function roundPoly(pts, r) {
      var n = pts.length, d = "";
      for (var i = 0; i < n; i++) {
        var prev = pts[(i - 1 + n) % n], cur = pts[i], next = pts[(i + 1) % n];
        var v1 = [prev[0] - cur[0], prev[1] - cur[1]], v2 = [next[0] - cur[0], next[1] - cur[1]];
        var l1 = Math.hypot(v1[0], v1[1]) || 1, l2 = Math.hypot(v2[0], v2[1]) || 1;
        var rr = Math.min(r, l1 / 2, l2 / 2);
        var p1 = [cur[0] + (v1[0] / l1) * rr, cur[1] + (v1[1] / l1) * rr];
        var p2 = [cur[0] + (v2[0] / l2) * rr, cur[1] + (v2[1] / l2) * rr];
        d += (i === 0 ? "M " : " L ") + p1[0].toFixed(2) + " " + p1[1].toFixed(2);
        d += " Q " + cur[0].toFixed(2) + " " + cur[1].toFixed(2) + " " + p2[0].toFixed(2) + " " + p2[1].toFixed(2);
      }
      return d + " Z";
    }
    function faces(b) {
      var tA = iso(b.u0, b.v0, b.z1), tB = iso(b.u1, b.v0, b.z1), tC = iso(b.u1, b.v1, b.z1), tD = iso(b.u0, b.v1, b.z1);
      var bB = iso(b.u1, b.v0, b.z0), bC = iso(b.u1, b.v1, b.z0), bD = iso(b.u0, b.v1, b.z0);
      return { silhouette: [tA,tB,bB,bC,bD,tD], top: [tA,tB,tC,tD], right: [tB,tC,bC,bB], front: [tD,tC,bC,bD] };
    }
    function layout() {
      var W = CFG.caseW, D = CFG.caseD, H = CFG.caseH, ms = CFG.monScale;
      var monW = W * 0.64 * ms, monD = D * 0.58 * ms, monH = 56 * ms, pedH = 6 * ms;
      var kbdW = W * 0.82, zCase = lift.case || 0, zMon = (lift.monitor || 0) + zCase;
      var zKbd = lift.keyboard || 0, zMouse = lift.mouse || 0;
      var monU0 = (W - monW) / 2, monV0 = D * 0.08;
      var kbdU0 = (W - kbdW) / 2, kbdV0 = D + 10;
      return {
        case: { u0:0,v0:0,z0:zCase,u1:W,v1:D,z1:zCase+H },
        pedestal: { u0:monU0+monW*0.18,v0:monV0+monD*0.2,z0:zCase+H,u1:monU0+monW*0.82,v1:monV0+monD*0.8,z1:zCase+H+pedH },
        monitor: { u0:monU0,v0:monV0,z0:zMon+H+pedH,u1:monU0+monW,v1:monV0+monD,z1:zMon+H+pedH+monH },
        keyboard: { u0:kbdU0,v0:kbdV0,z0:zKbd,u1:kbdU0+kbdW,v1:kbdV0+30,z1:zKbd+6 },
        mouse: { u0:W+10,v0:D+12,z0:zMouse,u1:W+26,v1:D+36,z1:zMouse+8 },
        W:W, D:D, H:H
      };
    }
    function el(d, fill, fo, stroke, so, sw) {
      var p = document.createElementNS(NS, "path");
      p.setAttribute("d", d);
      p.setAttribute("fill", fill);
      if (fo != null) p.setAttribute("fill-opacity", String(fo));
      p.setAttribute("stroke", stroke);
      if (so != null) p.setAttribute("stroke-opacity", String(so));
      if (sw != null) { p.setAttribute("stroke-width", String(sw)); p.setAttribute("stroke-linejoin", "round"); }
      return p;
    }
    function drawSolid(parent, box, r, outer, inner, fill, id) {
      var f = faces(box), g = document.createElementNS(NS, "g");
      g.style.cursor = "pointer";
      g.addEventListener("pointerenter", function () { hover = id; });
      g.appendChild(el(roundPoly(f.silhouette, r), T.bg, null, "none", null, null));
      g.appendChild(el(roundPoly(f.right, r), T.a, fill, "none", null, null));
      g.appendChild(el(roundPoly(f.front, r), T.b, fill, "none", null, null));
      g.appendChild(el(roundPoly(f.top, r), T.c, fill, "none", null, null));
      var inn = document.createElementNS(NS, "g");
      inn.setAttribute("fill", "none"); inn.setAttribute("stroke", T.fg);
      inn.setAttribute("stroke-width", String(inner)); inn.setAttribute("stroke-opacity", "0.4"); inn.setAttribute("stroke-linejoin", "round");
      [f.right, f.front, f.top].forEach(function (q) { var p = document.createElementNS(NS, "path"); p.setAttribute("d", roundPoly(q, r)); inn.appendChild(p); });
      g.appendChild(inn);
      parent.appendChild(g);
      return g;
    }
    function finishSolid(g, box, r, outer, id) {
      var f = faces(box);
      g.appendChild(el(roundPoly(f.silhouette, r), "none", null, T.fg, hover === id ? 0.96 : 0.72, outer));
    }
    function render() {
      root.textContent = "";
      var L = layout(), r = CFG.radius;
      var ox = -iso(L.W / 2, L.D / 2, 0)[0];
      root.setAttribute("transform", "translate(" + ox.toFixed(2) + " 10)");
      function cable(a, b, pull) {
        var mx = (a[0]+b[0])/2 + pull, my = (a[1]+b[1])/2 + 10;
        return "M "+a[0].toFixed(2)+" "+a[1].toFixed(2)+" Q "+mx.toFixed(2)+" "+my.toFixed(2)+" "+b[0].toFixed(2)+" "+b[1].toFixed(2);
      }
      var k = L.keyboard, c = L.case, m = L.monitor, mb = L.mouse;
      var ka = iso(k.u0+(k.u1-k.u0)*0.35, k.v0, k.z1), kb = iso(c.u0+(c.u1-c.u0)*0.32, c.v1, c.z0+(c.z1-c.z0)*0.35);
      var ma = iso(mb.u0+(mb.u1-mb.u0)*0.5, mb.v0, mb.z1*0.7+mb.z0*0.3), mbb = iso(c.u1-8, c.v1, c.z0+(c.z1-c.z0)*0.4);
      var cab = el(cable(ka, kb, -12), "none", null, T.fg, 0.35, CFG.innerStroke);
      root.appendChild(cab);
      root.appendChild(el(cable(ma, mbb, 18), "none", null, T.fg, 0.35, CFG.innerStroke));

      var gCase = drawSolid(root, L.case, r, CFG.outerStroke, CFG.innerStroke, CFG.fill, "case");
      var slotU0 = c.u0+(c.u1-c.u0)*0.08, slotU1 = slotU0+(c.u1-c.u0)*0.28, slotZ = c.z0+(c.z1-c.z0)*0.55;
      var floppy = [iso(slotU0,c.v1,slotZ+1.6), iso(slotU1,c.v1,slotZ+1.6), iso(slotU1,c.v1,slotZ), iso(slotU0,c.v1,slotZ)];
      gCase.appendChild(el(roundPoly(floppy, Math.min(r,1.2)), "none", null, T.fg, 0.55, CFG.innerStroke));
      var led = iso(slotU1+6, c.v1+0.5, slotZ+0.4);
      var ledEl = document.createElementNS(NS, "circle");
      ledEl.setAttribute("cx", String(led[0])); ledEl.setAttribute("cy", String(led[1])); ledEl.setAttribute("r", "1.4");
      ledEl.setAttribute("fill", T.fg); ledEl.setAttribute("opacity", cursorOn ? "0.9" : "0.2");
      gCase.appendChild(ledEl);
      for (var i = 0; i < 7; i++) {
        var t = 0.18 + (i/6)*0.5, vv = c.v0 + (c.v1-c.v0)*t;
        var a = iso(c.u1, vv, c.z0+4), b = iso(c.u1, vv, c.z1-4);
        var ln = document.createElementNS(NS, "line");
        ln.setAttribute("x1", a[0]); ln.setAttribute("y1", a[1]); ln.setAttribute("x2", b[0]); ln.setAttribute("y2", b[1]);
        ln.setAttribute("stroke", T.fg); ln.setAttribute("stroke-width", String(CFG.innerStroke)); ln.setAttribute("stroke-opacity", "0.35");
        gCase.appendChild(ln);
      }
      finishSolid(gCase, L.case, r, CFG.outerStroke, "case");

      var gPed = drawSolid(root, L.pedestal, Math.min(r,2), CFG.outerStroke*0.85, CFG.innerStroke, CFG.fill, "monitor");
      finishSolid(gPed, L.pedestal, Math.min(r,2), CFG.outerStroke*0.85, "monitor");

      var gMon = drawSolid(root, L.monitor, r, CFG.outerStroke, CFG.innerStroke, CFG.fill, "monitor");
      var insetU = (m.u1-m.u0)*0.12, insetZ = (m.z1-m.z0)*0.14;
      var screen = [iso(m.u0+insetU,m.v1,m.z1-insetZ), iso(m.u1-insetU,m.v1,m.z1-insetZ), iso(m.u1-insetU,m.v1,m.z0+insetZ), iso(m.u0+insetU,m.v1,m.z0+insetZ)];
      gMon.appendChild(el(roundPoly(screen, r*0.6), T.bg, null, T.fg, 0.55, CFG.innerStroke));
      if (cursorOn) {
        var curW = (m.u1-m.u0)*0.08, curZ = (m.z1-m.z0)*0.035, cu = m.u0+insetU+curW*0.4, cz = m.z1-insetZ-curZ*2.2;
        var cursor = [iso(cu,m.v1+0.4,cz), iso(cu+curW,m.v1+0.4,cz), iso(cu+curW,m.v1+0.4,cz-curZ), iso(cu,m.v1+0.4,cz-curZ)];
        gMon.appendChild(el(roundPoly(cursor, 0.4), T.fg, 0.85, "none", null, null));
      }
      finishSolid(gMon, L.monitor, r, CFG.outerStroke, "monitor");

      var gK = drawSolid(root, L.keyboard, Math.min(r,2.2), CFG.outerStroke, CFG.innerStroke, CFG.fill, "keyboard");
      var cols = Math.max(4, Math.round(CFG.keys)), rows = 4;
      var padU = (k.u1-k.u0)*0.06, padV = (k.v1-k.v0)*0.12;
      for (var row = 0; row < rows; row++) for (var col = 0; col < cols; col++) {
        var ku0 = k.u0+padU+((k.u1-k.u0-padU*2)*col)/cols+0.6;
        var ku1 = k.u0+padU+((k.u1-k.u0-padU*2)*(col+1))/cols-0.6;
        var kv0 = k.v0+padV+((k.v1-k.v0-padV*2)*row)/rows+0.5;
        var kv1 = k.v0+padV+((k.v1-k.v0-padV*2)*(row+1))/rows-0.5;
        var key = [iso(ku0,kv0,k.z1), iso(ku1,kv0,k.z1), iso(ku1,kv1,k.z1), iso(ku0,kv1,k.z1)];
        gK.appendChild(el(roundPoly(key, 0.6), "none", null, T.fg, 0.45, CFG.innerStroke*0.75));
      }
      finishSolid(gK, L.keyboard, Math.min(r,2.2), CFG.outerStroke, "keyboard");

      var gM = drawSolid(root, L.mouse, Math.min(r,2), CFG.outerStroke, CFG.innerStroke, CFG.fill, "mouse");
      for (var bi = 0; bi < 3; bi++) {
        var u0 = mb.u0+1.5+((mb.u1-mb.u0-3)*bi)/3;
        var u1 = mb.u0+1.5+((mb.u1-mb.u0-3)*(bi+1))/3-0.4;
        var btn = [iso(u0,mb.v0+1.2,mb.z1), iso(u1,mb.v0+1.2,mb.z1), iso(u1,mb.v0+(mb.v1-mb.v0)*0.42,mb.z1), iso(u0,mb.v0+(mb.v1-mb.v0)*0.42,mb.z1)];
        gM.appendChild(el(roundPoly(btn, 0.5), "none", null, T.fg, 0.5, CFG.innerStroke));
      }
      finishSolid(gM, L.mouse, Math.min(r,2), CFG.outerStroke, "mouse");
    }
    function tick() {
      var now = Date.now();
      cursorOn = Math.sin(now / 280) > 0;
      var ambient = 1.6 * Math.sin(now / 2200);
      PARTS.forEach(function (id) {
        var extra = hover === id ? CFG.lift : 0;
        var target = extra + (id === "monitor" ? Math.max(0, ambient) : 0);
        var cur = lift[id] || 0;
        lift[id] = cur + (target - cur) * 0.14;
      });
      render();
      requestAnimationFrame(tick);
    }
    svg.addEventListener("pointerleave", function () { hover = null; });
    requestAnimationFrame(tick);
  })();
  </script>
</body>
</html>
`;
}

/** @deprecated Use isoConfigToJson */
export function configToJson(cfg: IsoConfig, mode: IsoMode) {
  return isoConfigToJson(cfg, mode);
}

/** @deprecated Use buildIsoInteractiveHtml */
export function buildInteractiveHtml(cfg: IsoConfig, mode: IsoMode) {
  return buildIsoInteractiveHtml(cfg, mode);
}
