import type { IsoConfig } from "@/components/IsoStack";

export type IsoMode = "flat" | "ridge" | "wave" | "fan";

export function configToJson(cfg: IsoConfig, mode: IsoMode) {
  return JSON.stringify({ mode, ...cfg }, null, 2);
}

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

export function buildInteractiveHtml(cfg: IsoConfig, mode: IsoMode) {
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
