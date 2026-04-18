import { Box, Checkbox, Textarea, Typography } from "@strapi/design-system";
import type { PreviewCandidate } from "../lib/api";
import { ConflictCard } from "./ConflictCard";

export function CandidateRow({
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
      {candidate.matches
        .filter((m) => m.similarity >= 0.85)
        .map((m) => (
          <ConflictCard key={m.questionId} match={m} />
        ))}
      {requireReason && decision?.include && (
        <Box paddingTop={2}>
          <Textarea
            label="Raison de l'override"
            placeholder="Pourquoi importer malgré le doublon ?"
            rows={2}
            value={decision.overrideReason}
            onChange={(e: any) =>
              onReasonChange(candidate.index, e.target.value)
            }
          />
        </Box>
      )}
    </Box>
  );
}
