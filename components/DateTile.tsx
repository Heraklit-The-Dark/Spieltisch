import { cityColor } from "@/lib/colors";

/** Das Datum als Spielplättchen in der Spielerfarbe der Stadt. */
export function DateTile({
  startsAt,
  city,
  size = "md",
  cancelled = false,
  animate = false,
}: {
  startsAt: string;
  city: string | null;
  size?: "md" | "lg";
  cancelled?: boolean;
  animate?: boolean;
}) {
  const d = new Date(startsAt);
  const tz = { timeZone: "Europe/Berlin" } as const;
  const weekday = new Intl.DateTimeFormat("de-DE", { ...tz, weekday: "short" }).format(d).replace(".", "");
  const day = new Intl.DateTimeFormat("de-DE", { ...tz, day: "numeric" }).format(d);
  const month = new Intl.DateTimeFormat("de-DE", { ...tz, month: "short" }).format(d).replace(".", "");
  const color = cancelled ? { bg: "#8A8F8B", fg: "#FFFFFF" } : cityColor(city);
  const dims = size === "lg" ? "w-20 h-20 rounded-2xl" : "w-14 h-14 rounded-xl";

  return (
    <div
      className={`tile ${dims} ${animate ? "tile-drop" : ""} shrink-0 flex flex-col items-center justify-center leading-none select-none`}
      style={{ background: color.bg, color: color.fg }}
      aria-label={`${weekday}, ${day}. ${month}`}
    >
      <span className={size === "lg" ? "text-sm" : "text-[11px]"}>{weekday}</span>
      <span className={`font-display font-extrabold ${size === "lg" ? "text-4xl" : "text-2xl"} ${cancelled ? "line-through" : ""}`}>
        {day}
      </span>
      <span className={size === "lg" ? "text-xs" : "text-[10px]"}>{month}</span>
    </div>
  );
}
