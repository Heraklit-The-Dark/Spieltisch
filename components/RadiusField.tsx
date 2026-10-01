"use client";

import { useState } from "react";

export function RadiusField({ initial }: { initial: number }) {
  const [v, setV] = useState(initial);
  return (
    <label className="block">
      <span className="font-bold">Umkreis um Frankfurt</span>
      <span className="flex items-center gap-3 mt-1">
        <input
          type="range"
          name="radius_km"
          min={5}
          max={100}
          step={5}
          value={v}
          onChange={(e) => setV(Number(e.target.value))}
          className="flex-1 accent-[var(--felt)]"
        />
        <output className="w-16 text-right tabular-nums">{v} km</output>
      </span>
      <span className="text-sm text-muted">Events mit unbekanntem Ort werden immer gemeldet.</span>
    </label>
  );
}
