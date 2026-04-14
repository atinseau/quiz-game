import { useAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { fetchMyPurchases } from "../lib/queries/purchases";

export function usePurchases() {
  const { isSignedIn } = useAuth();

  return useQuery({
    queryKey: ["purchases", "me"],
    queryFn: fetchMyPurchases,
    enabled: !!isSignedIn,
    initialData: [],
  });
}
