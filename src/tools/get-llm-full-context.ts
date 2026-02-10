import { z } from "zod";
import { getCached, setCache, BASE_URL } from "../utils.js";

export const getLlmFullContextTool = {
  name: "get_llm_full_context",
  description: "Fetches the complete llm.txt from the repository (~2000 lines, consumes considerable tokens but provides all documentation in one go)",
  parameters: z.object({}),
  execute: async () => {
    const cached = getCached('llm.txt');
    if (cached) return cached;

    const url = `${BASE_URL}llm.txt`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const content = await response.text();
      setCache('llm.txt', content);
      return content;
    } catch (error) {
      return `Error fetching llm.txt: ${error}`;
    }
  },
};