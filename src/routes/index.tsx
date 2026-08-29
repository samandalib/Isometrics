import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { IsoStack } from "@/components/IsoStack";
import { DiagramGallery } from "@/components/DiagramGallery";
import { CubeCluster } from "@/components/CubeCluster";
import { StackedTower } from "@/components/StackedTower";
import { RippleRings } from "@/components/RippleRings";
import { BurrPuzzle } from "@/components/BurrPuzzle";
import { RetroComputer } from "@/components/RetroComputer";
import { CoinStacks } from "@/components/CoinStacks";

const DIAGRAMS: Record<string, React.ComponentType> = {
  "plate-array": IsoStack,
  "cube-cluster": CubeCluster,
  "stacked-tower": StackedTower,
  "ripple-rings": RippleRings,
  "burr-puzzle": BurrPuzzle,
  "retro-computer": RetroComputer,
  "coin-stacks": CoinStacks,
};

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

function Index() {
  const [selected, setSelected] = useState("plate-array");
  const Diagram = DIAGRAMS[selected] ?? IsoStack;

  return (
    <main className="min-h-screen bg-background px-6 py-14">
      <div className="mx-auto flex max-w-5xl flex-col items-center">
        <div className="w-full">
          <Diagram />
        </div>

        <DiagramGallery selectedId={selected} onSelect={setSelected} />
      </div>
    </main>
  );
}
