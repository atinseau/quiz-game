import { useQuery } from "@tanstack/react-query";
import { fetchPacks } from "../lib/queries/packs";

export function usePacks() {
  return useQuery({
    queryKey: ["packs"],
    queryFn: fetchPacks,
  });
}
