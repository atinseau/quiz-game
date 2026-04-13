import type { ApiPack, Question } from "../types";

const API_URL = "http://localhost:1337/api";

export async function fetchPacks(): Promise<ApiPack[]> {
  const res = await fetch(
    `${API_URL}/question-packs?populate[questions][count]=true&sort=displayOrder:asc&pagination[pageSize]=100&filters[published][$eq]=true`,
  );
  if (!res.ok) throw new Error("Failed to fetch packs");
  const json = await res.json();
  // biome-ignore lint/suspicious/noExplicitAny: Strapi REST response
  return json.data.map((pack: any) => ({
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
  const res = await fetch(
    `${API_URL}/questions?filters[pack][slug][$eq]=${encodeURIComponent(packSlug)}&populate=category&pagination[pageSize]=1000`,
  );
  if (!res.ok) throw new Error("Failed to fetch questions");
  const json = await res.json();
  // biome-ignore lint/suspicious/noExplicitAny: Strapi REST response
  return json.data.map((q: any) => ({
    type: q.type,
    question: q.text,
    choices: q.choices ?? undefined,
    answer: q.type === "vrai_faux" ? q.answer === "true" : q.answer,
    category: q.category?.name ?? "Divers",
  }));
}

export async function apiFetch(
  path: string,
  getToken: () => Promise<string | null>,
  options: RequestInit = {},
) {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
