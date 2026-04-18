import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Checkbox,
  Typography,
  Textarea,
  Alert,
  Badge,
} from "@strapi/design-system";
import { loadDraft, deleteDraft, type Draft } from "../lib/draftStore";
import { postCommit, type PreviewCandidate } from "../lib/api";
import { ConflictCard } from "../components/ConflictCard";

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
        const dec = decisions[c.index] ?? { include: false, overrideReason: "" };
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

function SectionTitle({ label, count }: { label: string; count: number }) {
  return (
    <Box paddingBottom={3}>
      <Typography variant="beta">
        {label} <Badge>{count}</Badge>
      </Typography>
    </Box>
  );
}

function CandidateRow({
  candidate,
  request,
  decision,
  onToggle,
  onReasonChange,
  requireReason,
}: {
  candidate: PreviewCandidate;
  request: any;
  decision: { include: boolean; overrideReason: string };
  onToggle: (i: number) => void;
  onReasonChange: (i: number, r: string) => void;
  requireReason?: boolean;
}) {
  return (
    <Box
      padding={3}
      marginBottom={3}
      background="neutral0"
      shadow="tableShadow"
      hasRadius
    >
      <Box paddingBottom={2}>
        <Checkbox
          value={decision?.include ?? false}
          onValueChange={() => onToggle(candidate.index)}
        >
          <Typography variant="omega" fontWeight="bold">
            {candidate.question}
          </Typography>
        </Checkbox>
      </Box>
      <Box paddingBottom={2}>
        <Typography variant="pi" textColor="neutral600">
          Réponse: {request.answer} · Catégorie: {request.category}
        </Typography>
      </Box>
      {candidate.matches.filter((m) => m.similarity >= 0.85).map((m) => (
        <ConflictCard key={m.questionId} match={m} />
      ))}
      {requireReason && decision?.include && (
        <Box paddingTop={2}>
          <Textarea
            label="Raison de l'override"
            placeholder="Pourquoi importer malgré le doublon ?"
            rows={2}
            value={decision.overrideReason}
            onChange={(e: any) => onReasonChange(candidate.index, e.target.value)}
          />
        </Box>
      )}
    </Box>
  );
}
