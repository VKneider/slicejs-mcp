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

// Function to fetch GitHub API for directory contents
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
    if (item.type === 'file' && item.name.endsWith('.md') && item.name !== 'markdown-guide.md') {
      // Fetch title from content
      const rawUrl = `https://raw.githubusercontent.com/VKneider/slicejs_docs/master/${item.path}`;
      let title = item.name.replace('.md', ''); // fallback
      try {
        const contentResponse = await fetch(rawUrl);
        if (contentResponse.ok) {
          const content = await contentResponse.text();
          const titleMatch = content.split('\n').find(line => line.startsWith('# '));
          if (titleMatch) title = titleMatch.replace('# ', '');
        }
      } catch (error) {
        console.warn(`Failed to fetch title for ${item.path}:`, error);
      }

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

  return items;
}

// Initialize docs structure dynamically
export async function initializeDocsStructure(): Promise<void> {
  if (isInitialized) return;

  try {
    DOCS_STRUCTURE = await buildDocsStructure('markdown');
    isInitialized = true;
    console.log(`Initialized docs structure with ${DOCS_STRUCTURE.length} documents`);
  } catch (error) {
    console.error('Failed to initialize docs structure:', error);
    // Fallback to empty or hardcoded minimal
    DOCS_STRUCTURE = [];
  }
}

// Helper function to fetch doc content from GitHub
export async function fetchDocContent(docId: string): Promise<string | null> {
  const cached = getCached(docId);
  if (cached) return cached;

  const doc = DOCS_STRUCTURE.find(d => d.id === docId);
  if (!doc) return null;

  const url = `${BASE_URL}${doc.path}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const content = await response.text();
    setCache(docId, content);
    return content;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}