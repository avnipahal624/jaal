import { ActivityFeed, useAllActivities } from "@/components/dashboard/ActivityFeed";
import { ActivityTrend } from "@/components/dashboard/ActivityTrend";
import {
  InvestigationCard,
} from "@/components/dashboard/InvestigationCard";
import {
  InvestigationFilters,
  type InvestigationFilter,
} from "@/components/dashboard/InvestigationFilters";
import { StatTile } from "@/components/dashboard/StatTile";
import { Button } from "@/components/ui/button";
import { Chip, Panel } from "@/components/ui/panel";
import { useJaal } from "@/state/JaalProvider";
import { formatDateTime, pluralize } from "@/utils/formatters";
import { motion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  FileText,
  Fingerprint,
  FolderKanban,
  Plus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

export default function DashboardPage() {
  const { state } = useJaal();
  const activities = useAllActivities();
  const [filter, setFilter] = useState<InvestigationFilter>("active");
  const [headerTime] = useState(() => Date.now());

  const stats = useMemo(() => {
    const active = state.investigations.filter((i) => i.status === "active");
    const completed = state.investigations.filter((i) => i.status === "completed");
    const evidence = Object.values(state.sessions).reduce(
      (sum, rt) => sum + rt.evidence.length,
      0,
    );
    const hashed = Object.values(state.sessions).reduce(
      (sum, rt) => sum + rt.evidence.filter((e) => e.hash).length,
      0,
    );
    return {
      active: active.length,
      completed: completed.length,
      evidence,
      hashed,
      reports: state.reports.length,
      counts: {
        active: active.length,
        completed: completed.length,
        archived: state.investigations.filter((i) => i.status === "archived").length,
        all: state.investigations.length,
      },
    };
  }, [state.investigations, state.sessions, state.reports]);

  const filtered = useMemo(
    () =>
      state.investigations
        .filter((i) => filter === "all" || i.status === filter)
        .sort((a, b) => b.lastActivityAt - a.lastActivityAt),
    [state.investigations, filter],
  );

  const runningCases = Object.values(state.sessions).filter(
    (rt) => rt.status === "running",
  );

  return (
    <div className="jaal-scanlines mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <p className="jaal-label">Command dashboard · {formatDateTime(headerTime)}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-jtext sm:text-3xl">
            Investigation overview
          </h1>
          <p className="mt-1 max-w-xl text-sm text-jmuted">
            Live status across every synthetic investigation in this session.
            Simulation mode — identifiers are demo values only.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            className="cursor-pointer gap-2 bg-jcyan font-semibold text-background hover:bg-jcyan/85"
          >
            <Link to="/investigations/new">
              <Plus className="size-4" /> New investigation
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="cursor-pointer gap-2 border-jborder/70 bg-jsurface text-jmuted hover:border-jcyan/50 hover:text-jcyan"
          >
            <Link to="/evidence">
              <Fingerprint className="size-4" /> Evidence locker
            </Link>
          </Button>
        </div>
      </motion.header>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Active investigations"
          value={stats.active}
          hint={`${runningCases.length} simulation${runningCases.length === 1 ? "" : "s"} running`}
          icon={<Activity className="size-4" />}
          tone="text-jcyan"
          bar="bg-jcyan"
        />
        <StatTile
          label="Completed"
          value={stats.completed}
          hint="Scripts exhausted & closed"
          icon={<CheckCircle2 className="size-4" />}
          tone="text-jgreen"
          bar="bg-jgreen"
        />
        <StatTile
          label="Evidence items"
          value={stats.evidence}
          hint={`${stats.hashed} hashed · SHA-256`}
          icon={<Fingerprint className="size-4" />}
          tone="text-jteal"
          bar="bg-jteal"
        />
        <StatTile
          label="Reports generated"
          value={stats.reports}
          hint="JSON / printable exports"
          icon={<FileText className="size-4" />}
          tone="text-jamber"
          bar="bg-jamber"
        />
      </div>

      {/* Asymmetric middle row: chart wider than feed */}
      <div className="mb-4 grid gap-3 lg:grid-cols-5">
        <Panel
          label={
            <div>
              <p className="jaal-label">Evidence extraction activity</p>
              <p className="mt-0.5 text-[11px] text-jmuted">
                Real events from this session · last 7 days
              </p>
            </div>
          }
          right={
            <div className="hidden items-center gap-3 font-mono text-[9px] uppercase tracking-widest text-jmuted sm:flex">
              <span className="flex items-center gap-1">
                <span className="size-2 bg-jcyan" /> evidence
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 bg-jamber" /> tactics
              </span>
            </div>
          }
          className="lg:col-span-3"
          bodyClassName="px-2 pt-3 pb-2"
        >
          <ActivityTrend />
        </Panel>

        <Panel
          label={
            <div>
              <p className="jaal-label">Investigation activity</p>
              <p className="mt-0.5 text-[11px] text-jmuted">
                Timestamps with case references
              </p>
            </div>
          }
          className="lg:col-span-2"
          bodyClassName="overflow-y-auto max-h-64"
        >
          <ActivityFeed entries={activities} limit={14} />
        </Panel>
      </div>

      {/* Investigation cards */}
      <Panel
        label={
          <div className="flex flex-wrap items-center gap-3">
            <p className="jaal-label">Investigations</p>
            <Chip tone="border-jborder/70 bg-jsurface text-jmuted">
              {pluralize(filtered.length, "case")}
            </Chip>
          </div>
        }
        right={
          <InvestigationFilters
            value={filter}
            onChange={setFilter}
            counts={stats.counts}
          />
        }
        bodyClassName="p-3"
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <FolderKanban className="size-6 text-jmuted/60" />
            <p className="text-sm text-jmuted">No {filter} investigations.</p>
            <Button
              asChild
              variant="outline"
              className="cursor-pointer gap-2 border-jcyan/40 text-jcyan hover:bg-jcyan/10 hover:text-jcyan"
            >
              <Link to="/investigations/new">
                <Plus className="size-4" /> Start one now
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((inv) => (
              <InvestigationCard
                key={inv.id}
                investigation={inv}
                evidenceCount={state.sessions[inv.id]?.evidence.length ?? 0}
                stageId={
                  state.sessions[inv.id]?.stages.find((s) => s.status === "active")
                    ?.id ?? inv.currentStage
                }
              />
            ))}
          </div>
        )}
      </Panel>

      {/* Running case strip */}
      {runningCases.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border border-jcyan/30 bg-jcyan/5 px-3 py-2">
          <span className="size-1.5 bg-jcyan jaal-pulse" />
          <span className="jaal-label !text-jcyan">Live simulations</span>
          {runningCases.map((rt) => (
            <Link
              key={rt.caseId}
              to={`/investigations/${rt.caseId}`}
              className="border border-jcyan/40 bg-jsurface px-2 py-0.5 font-mono text-[10px] text-jcyan transition-colors hover:bg-jcyan/15"
            >
              {rt.caseId} · {rt.status}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
