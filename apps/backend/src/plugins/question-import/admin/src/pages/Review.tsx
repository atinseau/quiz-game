import { Alert, Box, Button, Typography } from "@strapi/design-system";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CandidateRow } from "../components/CandidateRow";
import { SectionTitle } from "../components/SectionTitle";
import { type PreviewCandidate, postCommit } from "../lib/api";
import { type Draft, deleteDraft, loadDraft } from "../lib/draftStore";

type DecisionMap = Record<number, { include: boolean; overrideReason: string }>;

export default function Review() {
  const { previewId } = useParams<{ previewId: string }>();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [decisions, setDecisions] = useState<DecisionMap>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!previewId) return;
    setDraft(null);
    setDecisions({});
    loadDraft(previewId).then((d) => {
      if (!d) return;
      setDraft(d);
      const init: DecisionMap = {};
      for (const c of d.response.candidates) {
        init[c.index] = {
          include: c.status === "clean" || c.status === "needs_review",
          overrideReason: "",
        };
      }
      setDecisions(init);
    });
  }, [previewId]);

  if (!draft) {
    return (
      <Box padding={8}>
        <Alert variant="warning" title="Draft introuvable">
          Ce draft n'est plus disponible localement.
        </Alert>
      </Box>
    );
  }

  function toggle(index: number) {
    setDecisions((d) => ({
      ...d,
      [index]: { ...d[index], include: !d[index].include },
    }));
  }

  function setReason(index: number, reason: string) {
    setDecisions((d) => ({
      ...d,
      [index]: { ...d[index], overrideReason: reason },
    }));
  }

  async function handleCommit() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const requestQuestions = draft.request.questions;
      const questions = draft.response.candidates.map((c) => {
        const src = requestQuestions[c.index];
        const dec = decisions[c.index] ?? {
          include: false,
          overrideReason: "",
        };
        return {
          ...src,
          embedding: c.embedding,
          normalizedAnswer: c.normalizedAnswer,
          status: c.status,
          decision: (dec.include ? "import" : "skip") as "import" | "skip",
          overrideReason: dec.overrideReason || undefined,
        };
      });
      await postCommit({
        pack: draft.request.pack,
        embeddingModel: draft.response.embeddingModel,
        questions,
      });
      await deleteDraft(draft.previewId);
      navigate("..");
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const groups: Record<PreviewCandidate["status"], PreviewCandidate[]> = {
    clean: [],
    needs_review: [],
    auto_blocked: [],
    intra_batch_duplicate: [],
  };
  for (const c of draft.response.candidates) {
    groups[c.status].push(c);
  }

  return (
    <Box padding={8}>
      <Typography variant="alpha" tag="h1">
        Review de l'import {draft.previewId.slice(0, 8)}
      </Typography>
      {error && (
        <Box paddingTop={4}>
          <Alert variant="danger" title="Erreur">
            {error}
          </Alert>
        </Box>
      )}
      <Box paddingTop={6}>
        <SectionTitle label="Propres" count={groups.clean.length} />
        {groups.clean.map((c) => (
          <CandidateRow
            key={c.index}
            candidate={c}
            request={draft.request.questions[c.index]}
            decision={decisions[c.index]}
            onToggle={toggle}
            onReasonChange={setReason}
          />
        ))}
      </Box>
      <Box paddingTop={6}>
        <SectionTitle label="À reviewer" count={groups.needs_review.length} />
        {groups.needs_review.map((c) => (
          <CandidateRow
            key={c.index}
            candidate={c}
            request={draft.request.questions[c.index]}
            decision={decisions[c.index]}
            onToggle={toggle}
            onReasonChange={setReason}
          />
        ))}
      </Box>
      <Box paddingTop={6}>
        <SectionTitle label="Bloqués auto" count={groups.auto_blocked.length} />
        {groups.auto_blocked.map((c) => (
          <CandidateRow
            key={c.index}
            candidate={c}
            request={draft.request.questions[c.index]}
            decision={decisions[c.index]}
            onToggle={toggle}
            onReasonChange={setReason}
            requireReason
          />
        ))}
      </Box>
      <Box paddingTop={6}>
        <SectionTitle
          label="Doublons intra-batch"
          count={groups.intra_batch_duplicate.length}
        />
        {groups.intra_batch_duplicate.map((c) => (
          <CandidateRow
            key={c.index}
            candidate={c}
            request={draft.request.questions[c.index]}
            decision={decisions[c.index]}
            onToggle={toggle}
            onReasonChange={setReason}
          />
        ))}
      </Box>
      <Box paddingTop={8}>
        <Button loading={busy} onClick={handleCommit}>
          Commit
        </Button>
      </Box>
    </Box>
  );
}
