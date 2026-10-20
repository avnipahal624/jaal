import { InvestigationCard } from "@/components/dashboard/InvestigationCard";
import {
  InvestigationFilters,
  type InvestigationFilter,
} from "@/components/dashboard/InvestigationFilters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip, Panel } from "@/components/ui/panel";
import { useJaal } from "@/state/JaalProvider";
import { pluralize } from "@/utils/formatters";
import { motion } from "framer-motion";
import { FolderKanban, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

export default function InvestigationsPage() {
  const { state, setCaseStatus } = useJaal();
  const [filter, setFilter] = useState<InvestigationFilter>("active");
  const [query, setQuery] = useState("");

  const counts = useMemo(
    () => ({
      active: state.investigations.filter((i) => i.status === "active").length,
      completed: state.investigations.filter((i) => i.status === "completed").length,
      archived: state.investigations.filter((i) => i.status === "archived").length,
      all: state.investigations.length,
    }),
    [state.investigations],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.investigations
      .filter((i) => filter === "all" || i.status === filter)
      .filter(
        (i) =>
          !q ||
          i.id.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q),
      )
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }, [state.investigations, filter, query]);

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <p className="jaal-label">Case registry</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-jtext sm:text-3xl">
            Investigations
          </h1>
          <p className="mt-1 text-sm text-jmuted">
            Every case in this session — open one to resume its live workspace.
          </p>
        </div>
        <Button
          asChild
          className="cursor-pointer gap-2 self-start bg-jcyan font-semibold text-background hover:bg-jcyan/85"
        >
          <Link to="/investigations/new">
            <Plus className="size-4" /> New investigation
          </Link>
        </Button>
      </motion.header>

      <Panel
        right={
          <div className="relative w-full max-w-56">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-jmuted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search case ID, title…"
              className="h-8 border-jborder/70 bg-jsurface pl-8 font-mono text-xs text-jtext placeholder:text-jmuted/50 focus-visible:border-jcyan/70 focus-visible:ring-jcyan/40"
            />
          </div>
        }
        bodyClassName="p-3"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <InvestigationFilters
            value={filter}
            onChange={setFilter}
            counts={counts}
          />
          <Chip tone="border-jborder/70 bg-jsurface text-jmuted">
            {pluralize(filtered.length, "case")} shown
          </Chip>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <FolderKanban className="size-7 text-jmuted/50" />
            <p className="text-sm text-jmuted">
              {query ? "No cases match your search." : "Nothing in this filter yet."}
            </p>
            <Button
              asChild
              variant="outline"
              className="cursor-pointer gap-2 border-jcyan/40 text-jcyan hover:bg-jcyan/10 hover:text-jcyan"
            >
              <Link to="/investigations/new">
                <Plus className="size-4" /> Create investigation
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((inv) => (
              <div key={inv.id} className="flex flex-col gap-2">
                <InvestigationCard
                  investigation={inv}
                  evidenceCount={state.sessions[inv.id]?.evidence.length ?? 0}
                  stageId={
                    state.sessions[inv.id]?.stages.find((s) => s.status === "active")
                      ?.id ?? inv.currentStage
                  }
                />
                <div className="flex items-center gap-1.5">
                  {(["active", "completed", "archived"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={inv.status === s}
                      onClick={() => setCaseStatus(inv.id, s)}
                      className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-colors ${
                        inv.status === s
                          ? "cursor-not-allowed border-jborder/40 text-jmuted/40"
                          : "border-jborder/70 text-jmuted hover:border-jcyan/50 hover:text-jcyan"
                      }`}
                    >
                      set {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
