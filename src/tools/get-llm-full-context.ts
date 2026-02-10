import { z } from "zod";
import { getCached, setCache, BASE_URL, parseDocsFromLlmTxt, DOCS_STRUCTURE, isInitialized } from "../utils.js";

export const getLlmFullContextTool = {
  name: "get_llm_full_context",
  description: "Fetches the complete documentation bundle (~2000 lines, consumes considerable tokens but provides all documentation in one go). IMPORTANT: Ask the user for confirmation before executing this tool as it will add the entire Slice.js documentation to the context.",
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

      // Populate cache with individual docs from llm.txt
      const sections = content.split(/\n=== /).slice(1); // Skip first empty
      let populatedCount = 0;
      for (const section of sections) {
        const lines = section.split('\n');
        const filePath = lines[0].replace(' ===', ''); // e.g., 'markdown/getting-started.md'
        const docContent = lines.slice(1).join('\n').trim();
        if (filePath && docContent) {
          // Compute cache key as doc id: remove 'markdown/' prefix and '.md' suffix
          const docId = filePath.replace(/^markdown\//, '').replace(/\.md$/, '');
          setCache(docId, docContent);
          populatedCount++;
        }
      }
      console.error(`[MCP] Populated cache with ${populatedCount} individual docs`);

      // Update DOCS_STRUCTURE if already initialized
      if (isInitialized) {
        DOCS_STRUCTURE.length = 0; // Clear the array
        DOCS_STRUCTURE.push(...parseDocsFromLlmTxt(content));
        console.error(`[MCP] Updated DOCS_STRUCTURE to ${DOCS_STRUCTURE.length} documents from llm.txt`);
      }

      return content;
    } catch (error) {
      console.error(`[MCP] Error fetching llm.txt: ${error}`);
      return `Error fetching llm.txt: ${error}`;
    }
  },
};