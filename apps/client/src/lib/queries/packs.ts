import type { ApiPack, StrapiList } from "../../types";
import { api } from "../api";

export async function fetchPacks(): Promise<ApiPack[]> {
  const json = await api
    .get(
      "question-packs?populate[questions][count]=true&sort=displayOrder:asc&pagination[pageSize]=100&filters[published][$eq]=true",
    )
    // biome-ignore lint/suspicious/noExplicitAny: Strapi REST shape
    .json<StrapiList<any>>();

  return json.data.map((pack) => ({
    documentId: pack.documentId,
    slug: pack.slug,
    name: pack.name,
    description: pack.description ?? "",
    icon: pack.icon ?? "",
    gradient: pack.gradient ?? "",
    isFree: pack.isFree ?? true,
    published: pack.published ?? true,
    displayOrder: pack.displayOrder ?? 0,
    questionCount: pack.questions?.count ?? 0,
    price: pack.price ?? null,
  }));
}
