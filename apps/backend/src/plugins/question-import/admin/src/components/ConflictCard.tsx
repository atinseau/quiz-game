import { Badge, Box, Typography } from "@strapi/design-system";
import type { PreviewCandidate } from "../lib/api";
import { SimilarityBar } from "./SimilarityBar";

interface Props {
  match: PreviewCandidate["matches"][number];
}

export function ConflictCard({ match }: Props) {
  return (
    <Box
      padding={3}
      marginBottom={2}
      background="neutral100"
      hasRadius
      shadow="filterShadow"
    >
      <Box paddingBottom={2}>
        <Typography variant="omega" fontWeight="bold">
          {match.text}
        </Typography>
      </Box>
      <Box paddingBottom={2}>
        <Typography variant="pi" textColor="neutral600">
          Pack: {match.packSlug} · Catégorie: {match.categoryName}
        </Typography>
      </Box>
      <Box paddingBottom={2}>
        <SimilarityBar similarity={match.similarity} />
      </Box>
      {match.sameAnswer && (
        <Badge backgroundColor="warning200" textColor="warning700">
          Même réponse normalisée
        </Badge>
      )}
    </Box>
  );
}
