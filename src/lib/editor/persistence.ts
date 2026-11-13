/**
 * Persistencia local del borrador (IndexedDB). En la Fase 3 se añade un
 * `RemoteProjectRepository` contra la API (POST/PUT /api/designs) con la misma interfaz.
 */
import { del, get, set } from "idb-keyval";
import type { DesignDocument } from "./types";
import { parseDocument } from "./documentSchema";
export { parseDocument, documentSchema } from "./documentSchema";

export interface ProjectRepository {
  loadDraft(): Promise<DesignDocument | null>;
  saveDraft(doc: DesignDocument): Promise<void>;
  clearDraft(): Promise<void>;
}

const DRAFT_KEY = "sneakerlab:draft:v1"; // la clave se conserva; el contenido se migra por schemaVersion

export const localProjectRepository: ProjectRepository = {
  async loadDraft() {
    const raw = await get(DRAFT_KEY);
    return raw ? parseDocument(raw) : null;
  },
  async saveDraft(doc) {
    await set(DRAFT_KEY, doc);
  },
  async clearDraft() {
    await del(DRAFT_KEY);
  },
};
