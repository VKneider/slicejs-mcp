// Cache implementation
export const cache = new Map<string, { content: string, timestamp: number }>();
export const CACHE_TTL = Infinity; // Never expire during session

export function getCached(key: string): string | null {
  const cached = cache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return cached.content;
}

export function setCache(key: string, content: string): void {
  cache.set(key, { content, timestamp: Date.now() });
}

export const BASE_URL = 'https://raw.githubusercontent.com/VKneider/slicejs_docs/master/';
export const API_BASE = 'https://api.github.com/repos/VKneider/slicejs_docs/contents/';

export interface DocItem {
  id: string;
  path: string;
  title: string;
  description?: string;
}

// Global structure, populated dynamically
export let DOCS_STRUCTURE: DocItem[] = [];
export let isInitialized = false;

// Function to strip frontmatter like build-llm.js
function stripFrontMatter(content: string): string {
  if (!content.startsWith('---')) return content;
  const end = content.indexOf('\n---');
  if (end === -1) return content;
  return content.slice(end + 4).replace(/^\n+/, '');
}
async function fetchGitHubContents(path: string): Promise<any> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
  return response.json();
}

// Recursive function to build DOCS_STRUCTURE
async function buildDocsStructure(dirPath: string, basePath: string = 'markdown'): Promise<DocItem[]> {
  const items: DocItem[] = [];
  const contents = await fetchGitHubContents(dirPath) as any[];

  for (const item of contents) {
    if (item.type === 'file' && item.name.endsWith('.md')) {
      const base = item.name.toLowerCase();
      if (base === 'markdown_spec.md' || base === 'index.md' || base === 'markdown-guide.md') continue; // Skip same as build-llm.js

      // Fetch title from content
      const rawUrl = `https://raw.githubusercontent.com/VKneider/slicejs_docs/master/${item.path}`;
      let title = item.name.replace('.md', ''); // fallback
      let content = '';
      try {
        const contentResponse = await fetch(rawUrl);
        if (contentResponse.ok) {
          content = await contentResponse.text();
          const titleMatch = content.split('\n').find(line => line.startsWith('# '));
          if (titleMatch) title = titleMatch.replace('# ', '');
        } else {
          continue; // Skip if cannot fetch
        }
      } catch (error) {
        console.warn(`Failed to fetch title for ${item.path}:`, error);
        continue; // Skip on error
      }

      // Strip frontmatter like build-llm.js
      const strippedContent = stripFrontMatter(content).trim();
      if (!strippedContent) continue; // Skip empty content

      const relativePath = item.path.replace(`${basePath}/`, '');
      const id = relativePath.replace(/\.md$/, '').replace(/\//g, '/');
      items.push({
        id,
        path: item.path,
        title,
      });
    } else if (item.type === 'dir') {
      // Recurse into subdirs
      const subItems = await buildDocsStructure(item.path, basePath);
      items.push(...subItems);
    }
  }

  console.error(`[MCP] Built docs from API: ${items.map(i => i.path).join(', ')}`);
  return items;
}

// Initialize docs structure dynamically
export async function initializeDocsStructure(): Promise<void> {
  if (isInitialized) return;

  try {
    let llmContent = getCached('llm.txt');
    if (!llmContent) {
      console.error('[MCP] Fetching llm.txt to build docs structure');
      const url = `${BASE_URL}llm.txt`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      llmContent = await response.text();
      setCache('llm.txt', llmContent);
    } else {
      console.error('[MCP] Using cached llm.txt to build docs structure');
    }
    // Parse DOCS_STRUCTURE from llm.txt and cache each doc's body, so
    // search_docs / get_doc_content run in-memory with no per-doc fetches.
    DOCS_STRUCTURE = parseDocsFromLlmTxt(llmContent, true);
    isInitialized = true;
    console.error(`[MCP] Initialized docs structure with ${DOCS_STRUCTURE.length} documents`);
  } catch (error) {
    console.error('[MCP] Failed to initialize docs structure:', error);
    DOCS_STRUCTURE = [];
  }
}

// Function to parse docs structure from llm.txt content.
// `cacheContent` also stores each doc's body in the shared cache keyed by id —
// so search_docs / get_doc_content never re-fetch (llm.txt already has it all).
export function parseDocsFromLlmTxt(content: string, cacheContent = false): DocItem[] {
  const items: DocItem[] = [];
  // Prepend a newline so the very first section (which has no leading "\n"
  // before its "=== " marker) is captured too. Without this, split().slice(1)
  // silently drops the first doc (e.g. markdown/api-reference.md).
  const sections = ('\n' + content).split(/\n=== /).slice(1);

  console.error(`[MCP] Parsing ${sections.length} sections from llm.txt`);

  for (const section of sections) {
    const lines = section.split('\n');
    const filePath = lines[0].replace(' ===', '');
    const docContent = lines.slice(1).join('\n').trim();

    if (filePath && docContent) {
      // Extract title from first # line
      const titleMatch = docContent.split('\n').find(line => line.startsWith('# '));
      const title = titleMatch ? titleMatch.replace('# ', '') : filePath.split('/').pop()?.replace('.md', '') || 'Untitled';

      const relativePath = filePath.replace(/^markdown\//, '');
      const id = relativePath.replace(/\.md$/, '');

      items.push({
        id,
        path: filePath,
        title,
      });

      if (cacheContent) setCache(id, docContent);
    } else {
      console.error(`[MCP] Skipped section from llm.txt: ${lines[0]}, has filePath: ${!!filePath}, docContent length: ${docContent.length}`);
    }
  }

  console.error(`[MCP] Parsed docs from llm.txt: ${items.map(i => i.path).join(', ')}`);
  return items;
}

// Helper function to fetch doc content from GitHub
export async function fetchDocContent(docId: string): Promise<string | null> {
  const cached = getCached(docId);
  if (cached) {
    console.error(`[MCP] Cache hit for doc: ${docId}`);
    return cached;
  }

    console.error(`[MCP] Cache miss for doc: ${docId}, fetching from GitHub`);
  const doc = DOCS_STRUCTURE.find(d => d.id === docId);
  if (!doc) return null;

  const url = `${BASE_URL}${doc.path}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const content = await response.text();
    setCache(docId, content);
    console.error(`[MCP] Fetched and cached doc: ${docId}`);
    return content;
  } catch (error) {
    console.error(`[MCP] Error fetching ${url}:`, error);
    return null;
  }
}