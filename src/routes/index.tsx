import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { IsoStack } from "@/components/IsoStack";
import { DiagramGallery } from "@/components/DiagramGallery";
import { CubeCluster } from "@/components/CubeCluster";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Isometric Studio — Interactive Line Diagrams" },
      {
        name: "description",
        content:
          "A studio of interactive isometric wireframe diagrams: select a figure, tune its attributes and export it.",
      },
      {
        property: "og:title",
        content: "Isometric Studio — Interactive Line Diagrams",
      },
      {
        property: "og:description",
        content:
          "Select an isometric figure, tune its attributes live and export it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const META: Record<string, { fig: string; title: string; blurb: string }> = {
  "plate-array": {
    fig: "Fig. 01 — Plate Array",
    title: "Interactive isometric diagram",
    blurb:
      "Move the cursor across the array. Horizontal position sets the crest, vertical position sets amplitude.",
  },
  "cube-cluster": {
    fig: "Fig. 02 — Cube Cluster",
    title: "Hover a cube to lift it",
    blurb:
      "Each block carries a pulsing dot array on its top face and a heavy outer contour.",
  },
};

function Index() {
  const [selected, setSelected] = useState("plate-array");
  const meta = META[selected] ?? META["plate-array"]!;

  return (
    <main className="min-h-screen bg-background px-6 py-14">
      <div className="mx-auto flex max-w-5xl flex-col items-center">
        <header className="text-center">
          <p className="text-[0.65rem] uppercase tracking-[0.4em] text-muted-foreground">
            {meta.fig}
          </p>
          <h1 className="mt-4 text-3xl font-light tracking-tight text-foreground sm:text-4xl">
            {meta.title}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            {meta.blurb}
          </p>
        </header>

        <div className="mt-6 w-full">
          {selected === "cube-cluster" ? <CubeCluster /> : <IsoStack />}
        </div>

        <DiagramGallery selectedId={selected} onSelect={setSelected} />
      </div>
    </main>
  );
}
