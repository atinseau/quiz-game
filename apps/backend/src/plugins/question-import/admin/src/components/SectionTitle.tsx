import { Box, Typography, Badge } from "@strapi/design-system";

export function SectionTitle({ label, count }: { label: string; count: number }) {
  return (
    <Box paddingBottom={3}>
      <Typography variant="beta">
        {label} <Badge>{count}</Badge>
      </Typography>
    </Box>
  );
}
