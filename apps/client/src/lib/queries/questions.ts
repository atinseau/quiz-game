import type { Question } from "../../types";
import { api, type StrapiList } from "../api";

export async function fetchPackQuestions(
  packSlug: string,
): Promise<Question[]> {
  const json = await api
    .get(
      `questions?filters[pack][slug][$eq]=${encodeURIComponent(packSlug)}&populate=category&pagination[pageSize]=1000`,
    )
    // biome-ignore lint/suspicious/noExplicitAny: Strapi REST shape
    .json<StrapiList<any>>();

  return json.data.map((q) => ({
    type: q.type,
    question: q.text,
    choices: q.choices ?? undefined,
    answer: q.type === "vrai_faux" ? q.answer === "true" : q.answer,
    category: q.category?.name ?? "Divers",
  }));
}
