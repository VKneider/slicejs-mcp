import { z } from "zod";
import { DOCS_STRUCTURE, fetchDocContent, initializeDocsStructure, isInitialized } from "../utils.js";

export const getDocContentTool = {
  name: "get_doc_content",
  description: "Fetches full content of specific Slice.js framework documentation page(s)",
  parameters: z.object({
    doc_id: z.union([z.string(), z.array(z.string())]),
    include_metadata: z.boolean().optional().default(false),
  }),
  execute: async (args: { doc_id: string | string[]; include_metadata: boolean }) => {
    if (!isInitialized) await initializeDocsStructure();
    const { doc_id, include_metadata } = args;
    const ids = Array.isArray(doc_id) ? doc_id : [doc_id];
    const results: any[] = [];

    for (const id of ids) {
      const doc = DOCS_STRUCTURE.find(d => d.id === id);
      if (!doc) continue;

      const content = await fetchDocContent(id);
      if (!content) continue;

      const result: any = {
        doc_id: id,
        title: doc.title,
        content,
      };

      if (include_metadata) {
        result.metadata = {
          path: doc.path,
          fetched_at: new Date().toISOString(),
        };
      }

      results.push(result);
    }

    return JSON.stringify(results.length === 1 ? results[0] : results);
  },
};
