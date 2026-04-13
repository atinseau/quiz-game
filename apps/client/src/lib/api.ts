import ky from "ky";
import type { ApiPack, Question } from "../types";

interface StrapiList<T> {
  data: T[];
}

let _getToken: (() => Promise<string | null>) | null = null;

export function initApi(getToken: () => Promise<string | null>) {
  _getToken = getToken;
}

const API_URL = process.env.PUBLIC_API_URL || "http://localhost:1337/api";

export const api = ky.create({
  prefix: API_URL,
  hooks: {
    beforeRequest: [
      async ({ request }) => {
        if (!_getToken) return;
        const token = await _getToken();
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
      },
    ],
  },
});

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
  }));
}

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
