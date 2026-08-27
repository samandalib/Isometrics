export type IsoFn = (u: number, v: number, z: number) => [number, number];

export const REPOVIVE_LOGO_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADYAAAA4CAYAAAC2TwutAAABxUlEQVR4AeyZC5KCMBBEFy+2erKFk+HN3G5KFDBJJTKTDDpWpuQTMv3SgQrkdNv/63+Ef5A0IvaU8SSsyUxzXwU2oNsvudF1nfhQRO4iDff6+HuWkGNXiM2OZ1NyWyX5WTeUOQQWqne4Yw52NMvcMXfMSA/4UDRiRLaMJo5hdntG9AhOdh+RrTqjYlUwgBDmBl0j4g9xXgQ25UoVsAUQYeTUJ1pSByMU8lcDQq6pqIK1giKZGlgGFF9NBszO58JXJWrKj0RNFTBA8aEQG34zTA8ijXe5CVcFDC3zqYe/l0IoNZhlNnEwuBUTftF0aAnFbXEwNBoagoS64ly1IgoGt3hvbcVPnxm2B7X3RcEgNuQWn344VbdIg72ox31VdQjOArTBmkARThosdI8xT/WQBqsOEEvoYLGesXrcHbPqTEyXOxbrGavH3TGrzsR0HcCxmPT0cQdL94+9s+6YPU/SikQdw0vltoh+K0yjrM+Kgq2bbrvnYG37vzy7O1beZ22vcMfa9n959q9yjCv6RVHen+kruAZQEmjtF7EqIcf4/Z3rW7mh8ZF0t4YQ2Ir8qDsfDcaJ6tuBWW9sBXOP2Vx6elsTEg//AAAA///mZkvaAAAABklEQVQDANasU13hcwrxAAAAAElFTkSuQmCC";

/**
 * Affine matrix that maps a 1×1 image onto the isometric top face.
 * Logo +x follows the slab's u-edge, +y follows the v-edge — the same
 * mapping a circle in (u, v) uses to become an isometric ellipse.
 */
export function isometricDecalMatrix(
  iso: IsoFn,
  S: number,
  z1: number,
  scale: number,
) {
  const half = 16 * scale;
  const origin = iso(S / 2 - half, S / 2 - half, z1);
  const x = iso(S / 2 + half, S / 2 - half, z1);
  const y = iso(S / 2 - half, S / 2 + half, z1);
  const a = x[0] - origin[0];
  const b = x[1] - origin[1];
  const c = y[0] - origin[0];
  const d = y[1] - origin[1];
  const e = origin[0];
  const f = origin[1];
  return {
    a,
    b,
    c,
    d,
    e,
    f,
    matrix: `matrix(${a.toFixed(4)} ${b.toFixed(4)} ${c.toFixed(4)} ${d.toFixed(4)} ${e.toFixed(4)} ${f.toFixed(4)})`,
  };
}

export function appendRepoviveLogo(
  parent: Element,
  iso: IsoFn,
  S: number,
  z1: number,
  scale: number,
  _stroke: number,
  _fg: string,
  _bg: string,
  NS: string,
) {
  const { matrix } = isometricDecalMatrix(iso, S, z1, scale);
  const img = document.createElementNS(NS, "image");
  img.setAttribute("href", REPOVIVE_LOGO_DATA_URI);
  img.setAttribute("width", "1");
  img.setAttribute("height", "1");
  img.setAttribute("preserveAspectRatio", "none");
  img.setAttribute("transform", matrix);
  parent.appendChild(img);
}

export function repoviveLogoGeometryScript() {
  return `
    var LOGO_URI = ${JSON.stringify(REPOVIVE_LOGO_DATA_URI)};

    function isometricDecalMatrix(iso, S, z1, scale) {
      var half = 16 * scale;
      var origin = iso(S / 2 - half, S / 2 - half, z1);
      var x = iso(S / 2 + half, S / 2 - half, z1);
      var y = iso(S / 2 - half, S / 2 + half, z1);
      var a = x[0] - origin[0], b = x[1] - origin[1];
      var c = y[0] - origin[0], d = y[1] - origin[1];
      return "matrix(" + a.toFixed(4) + " " + b.toFixed(4) + " " + c.toFixed(4) + " " + d.toFixed(4) + " " + origin[0].toFixed(4) + " " + origin[1].toFixed(4) + ")";
    }

    function addRepoviveLogo(parent, S, z1, scale) {
      var img = document.createElementNS(NS, "image");
      img.setAttribute("href", LOGO_URI);
      img.setAttribute("width", "1");
      img.setAttribute("height", "1");
      img.setAttribute("preserveAspectRatio", "none");
      img.setAttribute("transform", isometricDecalMatrix(iso, S, z1, scale));
      parent.appendChild(img);
    }
  `;
}
