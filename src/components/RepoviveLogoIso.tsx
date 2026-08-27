import {
  isometricDecalMatrix,
  REPOVIVE_LOGO_DATA_URI,
  type IsoFn,
} from "@/lib/repovive-logo-iso";

export function RepoviveLogoIso({
  iso,
  S,
  z1,
  scale,
}: {
  iso: IsoFn;
  S: number;
  z1: number;
  scale: number;
  stroke?: number;
}) {
  const { matrix } = isometricDecalMatrix(iso, S, z1, scale);
  return (
    <image
      href={REPOVIVE_LOGO_DATA_URI}
      width={1}
      height={1}
      preserveAspectRatio="none"
      transform={matrix}
    />
  );
}
