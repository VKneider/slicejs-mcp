import { z } from "zod";
import { DOCS_STRUCTURE, fetchDocContent, initializeDocsStructure, isInitialized } from "../utils.js";

export const searchDocsTool = {
  name: "search_docs",
  description: "Searches across all docs by keyword/phrase",
  parameters: z.object({
    query: z.string(),
    max_results: z.number().optional().default(5),
  }),
  execute: async (args: { query: string; max_results: number }) => {
    if (!isInitialized) await initializeDocsStructure();
    const { query, max_results } = args;
    const results: any[] = [];

    for (const doc of DOCS_STRUCTURE) {
      const content = await fetchDocContent(doc.id);
      if (!content) continue;

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.toLowerCase().includes(query.toLowerCase())) {
          const snippet = line.trim();
          results.push({
            doc_id: doc.id,
            title: doc.title,
            relevance_score: 1, // simple match
            snippet,
            path: doc.path,
          });
          if (results.length >= max_results) break;
        }
      }
      if (results.length >= max_results) break;
    }

    return JSON.stringify(results);
  },
};