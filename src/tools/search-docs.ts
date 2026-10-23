import { z } from "zod";
import { DOCS_STRUCTURE, fetchDocContent, initializeDocsStructure, isInitialized } from "../utils.js";

interface Snippet {
  line: number;
  section: string;   // nearest preceding markdown heading, for orientation
  text: string;
}

interface DocResult {
  doc_id: string;
  title: string;
  path: string;
  relevance_score: number;
  matched_terms: string[];
  snippets: Snippet[];
}

// Score a single document against the query terms. Ranking favors: matches in the
// title/headings, lines that hit more distinct terms, exact phrase matches, and
// broad coverage of the query's terms (a doc that matches every term outranks one
// that only matches a common one). Returns null when nothing matches.
function scoreDoc(
  doc: { id: string; title: string; path: string },
  content: string,
  terms: string[],
  phrase: string,
  maxSnippets: number
): DocResult | null {
  const lines = content.split("\n");
  const titleLower = doc.title.toLowerCase();
  const matched = new Set<string>();
  let score = 0;

  // Title boosts.
  for (const t of terms) {
    if (titleLower.includes(t)) { score += 5; matched.add(t); }
  }
  if (terms.length > 1 && titleLower.includes(phrase)) score += 10;

  const hits: { line: number; text: string; lineScore: number; section: string }[] = [];
  let currentSection = "";

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const isHeading = /^#{1,6}\s/.test(raw);
    if (isHeading) currentSection = raw.replace(/^#{1,6}\s+/, "").trim();

    const lower = raw.toLowerCase();
    let lineScore = 0;
    for (const t of terms) {
      if (lower.includes(t)) { lineScore += isHeading ? 3 : 1; matched.add(t); }
    }
    if (terms.length > 1 && lower.includes(phrase)) lineScore += 5; // whole phrase on one line

    if (lineScore > 0) {
      score += lineScore;
      hits.push({ line: i + 1, text: raw.trim(), lineScore, section: currentSection });
    }
  }

  if (matched.size === 0) return null;

  // Coverage: downweight docs that matched only a fraction of the query terms.
  const coverage = matched.size / terms.length;
  score = score * (0.5 + 0.5 * coverage);

  const snippets: Snippet[] = hits
    .sort((a, b) => b.lineScore - a.lineScore || a.line - b.line)
    .slice(0, maxSnippets)
    .map((h) => ({ line: h.line, section: h.section || doc.title, text: h.text }));

  return {
    doc_id: doc.id,
    title: doc.title,
    path: doc.path,
    relevance_score: Math.round(score * 100) / 100,
    matched_terms: [...matched],
    snippets,
  };
}

export const searchDocsTool = {
  name: "search_docs",
  description:
    "Search across the Slice.js framework documentation. Tokenizes the query and returns the most relevant documents ranked by score (title/heading matches and term coverage rank higher), each with its best snippets and the section they fall under. Use the returned doc_id with get_doc_content to read the full page.",
  parameters: z.object({
    query: z.string(),
    max_results: z.number().optional().default(5),
    snippets_per_doc: z.number().optional().default(3),
  }),
  execute: async (args: { query: string; max_results: number; snippets_per_doc: number }) => {
    if (!isInitialized) await initializeDocsStructure();
    const { query, max_results, snippets_per_doc } = args;

    const phrase = query.toLowerCase().trim();
    const terms = [...new Set(phrase.split(/\s+/).filter(Boolean))];
    if (terms.length === 0) return JSON.stringify([]);

    const results: DocResult[] = [];
    for (const doc of DOCS_STRUCTURE) {
      const content = await fetchDocContent(doc.id);   // cached in-memory after init
      if (!content) continue;
      const scored = scoreDoc(doc, content, terms, phrase, snippets_per_doc);
      if (scored) results.push(scored);
    }

    results.sort((a, b) => b.relevance_score - a.relevance_score);
    return JSON.stringify(results.slice(0, max_results));
  },
};
