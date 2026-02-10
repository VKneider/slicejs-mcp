import { z } from "zod";
import { DOCS_STRUCTURE, initializeDocsStructure, isInitialized } from "../utils.js";

export const listDocsTool = {
  name: "list_docs",
  description: "Returns available documentation sections/categories",
  parameters: z.object({}),
  execute: async () => {
    if (!isInitialized) await initializeDocsStructure();
    return JSON.stringify(DOCS_STRUCTURE.map(doc => ({
      id: doc.id,
      title: doc.title,
      path: doc.path,
    })));
  },
};