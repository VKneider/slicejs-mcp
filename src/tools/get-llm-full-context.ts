import { z } from "zod";
import { getCached, setCache, BASE_URL, parseDocsFromLlmTxt, DOCS_STRUCTURE, isInitialized } from "../utils.js";

export const getLlmFullContextTool = {
  name: "get_llm_full_context",
  description: "Fetches the complete Slice.js framework documentation bundle (~2000 lines, consumes considerable tokens but provides all framework documentation in one go). IMPORTANT: Ask the user for confirmation before executing this tool as it will add the entire framework documentation to the context.",
  parameters: z.object({}),
  execute: async () => {
    const cached = getCached('llm.txt');
    if (cached) {
      console.error('[MCP] Returning cached llm.txt');
      return cached;
    }

    console.error('[MCP] Fetching llm.txt from GitHub');
    const url = `${BASE_URL}llm.txt`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const content = await response.text();
      setCache('llm.txt', content);
      console.error('[MCP] Fetched and cached llm.txt, now populating individual doc cache');

      // Parse once (shared logic, first-section-safe) and cache every doc body.
      const docs = parseDocsFromLlmTxt(content, true);
      console.error(`[MCP] Populated cache with ${docs.length} individual docs`);

      // Keep DOCS_STRUCTURE in sync if it was already built.
      if (isInitialized) {
        DOCS_STRUCTURE.length = 0; // Clear the array
        DOCS_STRUCTURE.push(...docs);
        console.error(`[MCP] Updated DOCS_STRUCTURE to ${DOCS_STRUCTURE.length} documents from llm.txt`);
      }

      return content;
    } catch (error) {
      console.error(`[MCP] Error fetching llm.txt: ${error}`);
      return `Error fetching llm.txt: ${error}`;
    }
  },
};
