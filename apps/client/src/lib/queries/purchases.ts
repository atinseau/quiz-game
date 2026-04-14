import { api } from "../api";

export async function fetchMyPurchases(): Promise<string[]> {
  const json = await api
    .get("purchases/me")
    .json<{ data: { packSlug: string }[] }>();
  return json.data.map((p) => p.packSlug);
}
