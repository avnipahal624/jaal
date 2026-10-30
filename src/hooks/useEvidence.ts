import { useCallback, useMemo, useState } from "react";
import { evidenceMatchesFilter } from "@/services/evidenceService";
import { useJaal } from "@/state/JaalProvider";
import type { EvidenceFilter } from "@/types/evidence";

/** Evidence collection + search/filter + integrity actions for one case. */
export function useEvidence(caseId: string | undefined) {
  const { state, generateHash, verifyEvidence, setEvidenceContent, setEvidenceNotes } =
    useJaal();
  const [filter, setFilter] = useState<EvidenceFilter>("all");
  const [query, setQuery] = useState("");

  const runtime = caseId ? state.sessions[caseId] ?? null : null;
  const all = runtime?.evidence ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((e) => evidenceMatchesFilter(e, filter))
      .filter(
        (e) =>
          !q ||
          e.value.toLowerCase().includes(q) ||
          e.label.toLowerCase().includes(q) ||
          e.sourceMessageText.toLowerCase().includes(q),
      )
      .sort((a, b) => b.extractedAt - a.extractedAt);
  }, [all, filter, query]);

  const hash = useCallback(
    (evidenceId: string) =>
      caseId ? generateHash(caseId, evidenceId) : Promise.resolve(),
    [caseId, generateHash],
  );
  const verify = useCallback(
    async (
      evidenceId: string,
    ): Promise<"match" | "mismatch" | "generated" | "error"> =>
      caseId ? verifyEvidence(caseId, evidenceId) : "error",
    [caseId, verifyEvidence],
  );
  const setContent = useCallback(
    (evidenceId: string, content: string) =>
      caseId && setEvidenceContent(caseId, evidenceId, content),
    [caseId, setEvidenceContent],
  );
  const setNotes = useCallback(
    (evidenceId: string, notes: string) =>
      caseId && setEvidenceNotes(caseId, evidenceId, notes),
    [caseId, setEvidenceNotes],
  );

  return {
    all,
    filtered,
    filter,
    setFilter,
    query,
    setQuery,
    generateHash: hash,
    verifyEvidence: verify,
    setEvidenceContent: setContent,
    setEvidenceNotes: setNotes,
  };
}
