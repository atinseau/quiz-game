import { get, set, del, keys } from "idb-keyval";
import type { PreviewRequest, PreviewResponse } from "./api";

const PREFIX = "question-import-draft:";

export interface Draft {
  previewId: string;
  createdAt: number;
  request: PreviewRequest;
  response: PreviewResponse;
}

export async function saveDraft(draft: Draft): Promise<void> {
  await set(PREFIX + draft.previewId, draft);
}

export async function loadDraft(previewId: string): Promise<Draft | undefined> {
  return get(PREFIX + previewId);
}

export async function deleteDraft(previewId: string): Promise<void> {
  await del(PREFIX + previewId);
}

export async function listDrafts(): Promise<Draft[]> {
  const all = await keys();
  const out: Draft[] = [];
  for (const k of all) {
    if (typeof k === "string" && k.startsWith(PREFIX)) {
      const d = await get<Draft>(k);
      if (d) out.push(d);
    }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}
