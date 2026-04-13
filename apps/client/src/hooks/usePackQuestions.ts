import { useQuery } from "@tanstack/react-query";
import { fetchPackQuestions } from "../lib/queries/questions";

export function usePackQuestions(packSlug: string | null) {
  return useQuery({
    queryKey: ["questions", packSlug],
    queryFn: () => fetchPackQuestions(packSlug as string),
    enabled: !!packSlug,
  });
}
