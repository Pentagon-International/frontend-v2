import { chatApi } from "../chatApi";

export type VannaTrainPayload = {
  type: "sql_example" | "ddl" | "documentation";
  question?: string;
  sql?: string;
  table?: string;
  content?: string;
  title?: string;
};

export type VannaMemoryItem = {
  id: string;
  document?: string;
  metadata?: {
    type?: string;
    question?: string;
    table?: string;
    title?: string;
  };
};

export const trainVanna = async (payload: VannaTrainPayload) => {
  const res = await chatApi.post("/api/vanna/v2/train", payload);
  return res.data;
};

export const listVannaMemory = async (limit = 200) => {
  const res = await chatApi.get("/api/vanna/v2/memory", { params: { limit } });
  return res.data as { items?: VannaMemoryItem[]; total?: number };
};

export const deleteVannaMemoryEntry = async (entryId: string) => {
  await chatApi.delete(`/api/vanna/v2/memory/${entryId}`);
};

export const searchVannaMemory = async (q: string) => {
  const res = await chatApi.get("/api/vanna/v2/search", { params: { q } });
  return res.data;
};
