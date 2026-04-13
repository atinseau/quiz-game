import { useAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useSyncPlayer() {
  const { isSignedIn } = useAuth();

  return useQuery({
    queryKey: ["player", "me"],
    queryFn: () => api.get("player/me").json(),
    enabled: !!isSignedIn,
  });
}
