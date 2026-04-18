import { Box, Typography } from "@strapi/design-system";

interface Props {
  similarity: number;
}

function color(sim: number): string {
  if (sim >= 0.92) return "#d32f2f";
  if (sim >= 0.85) return "#f9a825";
  return "#2e7d32";
}

export function SimilarityBar({ similarity }: Props) {
  const pct = Math.round(similarity * 100);
  return (
    <Box>
      <Box
        background="neutral200"
        style={{ height: 8, borderRadius: 4, overflow: "hidden", width: 180 }}
      >
        <Box
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color(similarity),
          }}
        />
      </Box>
      <Typography variant="pi">{pct}% similarité</Typography>
    </Box>
  );
}
