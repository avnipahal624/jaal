import { useJaal } from "@/state/JaalProvider";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Evidence-extraction + detection activity over the last 7 days, built
 * strictly from events that occurred in this session. Renders an explicit
 * empty state when no events exist.
 */
export function ActivityTrend({ days = 7 }: { days?: number }) {
  const { state } = useJaal();
  // Fixed once per mount so the bucket grid does not jump on re-render.
  const [now] = useState(() => Date.now());
  const startOfDay = (ts: number) => {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const buckets: { label: string; evidence: number; tactics: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = startOfDay(now) - i * 86_400_000;
    buckets.push({
      label: new Date(dayStart).toLocaleDateString([], { weekday: "short" }),
      evidence: 0,
      tactics: 0,
    });
  }

  for (const rt of Object.values(state.sessions)) {
    for (const act of rt.activities) {
      const dayStart = startOfDay(act.timestamp);
      const idx = buckets.findIndex(
        (b, i) => dayStart === startOfDay(now) - (days - 1 - i) * 86_400_000,
      );
      if (idx < 0) continue;
      if (act.kind === "identifier_extracted" || act.kind === "hash_generated")
        buckets[idx]!.evidence += 1;
      if (act.kind === "tactic_detected" || act.kind === "stage_advanced")
        buckets[idx]!.tactics += 1;
    }
  }

  const hasData = buckets.some((b) => b.evidence + b.tactics > 0);

  if (!hasData) {
    return (
      <div className="flex h-44 flex-col items-center justify-center gap-2 text-center">
        <p className="text-xs text-jmuted">No activity events yet.</p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-jmuted/60">
          Charts populate from live simulation events
        </p>
      </div>
    );
  }

  return (
    <div className="h-44 w-full pr-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="rgba(23,68,82,0.6)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#7899A9", fontSize: 10, fontFamily: "JetBrains Mono" }}
            axisLine={{ stroke: "rgba(23,68,82,0.8)" }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#7899A9", fontSize: 10, fontFamily: "JetBrains Mono" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(57,214,232,0.06)" }}
            contentStyle={{
              background: "#0A1C28",
              border: "1px solid #174452",
              borderRadius: 0,
              fontSize: 11,
              fontFamily: "JetBrains Mono",
              color: "#DCEBF0",
            }}
            labelStyle={{ color: "#39D6E8" }}
          />
          <Bar dataKey="evidence" name="evidence events" fill="#39D6E8" />
          <Bar dataKey="tactics" name="tactic events" fill="#FFAA45" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
