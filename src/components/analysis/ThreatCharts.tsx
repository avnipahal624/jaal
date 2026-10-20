import type {
  DetectedTactic,
  KillChainStage,
} from "@/types/investigation";
import type { ConversationMessage } from "@/types/message";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS_TICK = {
  fill: "#7899A9",
  fontSize: 9,
  fontFamily: "JetBrains Mono",
} as const;

const TOOLTIP_STYLE = {
  background: "#0A1C28",
  border: "1px solid #174452",
  borderRadius: 0,
  fontSize: 11,
  fontFamily: "JetBrains Mono",
  color: "#DCEBF0",
} as const;

const STAGE_COLORS: Record<string, string> = {
  contact: "#1B8F91",
  authority: "#39D6E8",
  fear: "#FFAA45",
  payment: "#FFAA45",
  exploit: "#F15B64",
  pending: "#174452",
};

function Empty({ label }: { label: string }) {
  return (
    <div className="flex h-32 flex-col items-center justify-center gap-1 text-center">
      <p className="text-[11px] text-jmuted">{label}</p>
      <p className="font-mono text-[9px] uppercase tracking-widest text-jmuted/60">
        awaiting real simulation events
      </p>
    </div>
  );
}

/**
 * Three compact charts, all driven by actual events in this session:
 * 1. scam-stage progression (detected stage count over time)
 * 2. detected tactics over time (rolling count)
 * 3. evidence extraction activity per stage
 */
export function ThreatCharts({
  stages,
  tactics,
  messages,
}: {
  stages: KillChainStage[];
  tactics: DetectedTactic[];
  messages: ConversationMessage[];
}) {
  const tacticSeries = useMemo(() => {
    if (tactics.length === 0) return { points: [] as { t: number; count: number; label: string }[] };
    const sorted = [...tactics].sort((a, b) => a.timestamp - b.timestamp);
    const points = sorted.map((t, i) => ({
      t: i + 1,
      count: i + 1,
      label: new Date(t.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));
    return { points };
  }, [tactics]);

  const stageProgression = useMemo(
    () =>
      stages
        .filter((s) => s.detectedAt !== null)
        .map((s) => ({
          label: `0${s.number} ${s.label.split(" ")[0]}`,
          detected: 1,
          color: STAGE_COLORS[s.id] ?? "#39D6E8",
        })),
    [stages],
  );

  const evidenceByStage = useMemo(() => {
    const counts = stages.map((s) => {
      const ids = new Set(s.messageIds);
      const count = messages.filter(
        (m) => m.author === "scammer" && ids.has(m.id),
      ).length;
      return {
        label: `0${s.number}`,
        messages: count,
        color: STAGE_COLORS[s.id] ?? "#39D6E8",
      };
    });
    return counts;
  }, [stages, messages]);

  const hasTactics = tacticSeries.points.length > 0;
  const hasStages = stageProgression.length > 0;

  return (
    <div className="space-y-3">
      {/* Detected tactics over time */}
      <div>
        <p className="jaal-label mb-1">Tactic detections (rolling)</p>
        {hasTactics ? (
          <div className="h-24 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={tacticSeries.points}
                margin={{ top: 4, right: 6, left: -22, bottom: 0 }}
              >
                <CartesianGrid stroke="rgba(23,68,82,0.5)" vertical={false} />
                <XAxis dataKey="t" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: "#39D6E8" }}
                  formatter={(v: number, _n, item) => {
                    const p = item?.payload as { label?: string } | undefined;
                    return [`${v} tactics`, p?.label ?? ""];
                  }}
                />
                <Line
                  type="stepAfter"
                  dataKey="count"
                  stroke="#FFAA45"
                  strokeWidth={1.6}
                  dot={{ r: 2, fill: "#FFAA45", strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty label="No tactics detected yet" />
        )}
      </div>

      {/* Stage progression */}
      <div>
        <p className="jaal-label mb-1">Kill-chain progression</p>
        {hasStages ? (
          <div className="h-24 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stageProgression}
                margin={{ top: 4, right: 6, left: -22, bottom: 0 }}
              >
                <CartesianGrid stroke="rgba(23,68,82,0.5)" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
                <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(57,214,232,0.05)" }}
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: "#39D6E8" }}
                />
                <Bar dataKey="detected" name="stage detected">
                  {stageProgression.map((s) => (
                    <Cell key={s.label} fill={s.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty label="No kill-chain stage detected yet" />
        )}
      </div>

      {/* Evidence extraction activity per stage */}
      <div>
        <p className="jaal-label mb-1">Evidence extraction activity</p>
        <div className="h-24 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={evidenceByStage}
              margin={{ top: 4, right: 6, left: -22, bottom: 0 }}
            >
              <CartesianGrid stroke="rgba(23,68,82,0.5)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "rgba(57,214,232,0.05)" }}
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "#39D6E8" }}
              />
              <Bar dataKey="messages" name="scammer messages" fill="#39D6E8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="font-mono text-[8px] uppercase leading-relaxed tracking-widest text-jmuted/50">
        Charts render only from events recorded in this session — no synthetic
        filler series.
      </p>
    </div>
  );
}
