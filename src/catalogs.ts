export type CatalogSource = "framework" | "components";

export interface CatalogDocument {
  source: CatalogSource;
  catalog: string;
  id: string;
  title: string;
  path: string;
  sourcePath?: string;
  rawUrl: string;
  description?: string;
  tags?: string[];
  route?: string | null;
  component?: string;
  kind?: string;
  version?: string;
  revision?: string;
  searchText?: string;
}

interface ComponentsManifest {
  catalog?: string;
  version?: string;
  revision?: string;
  documents?: Array<Record<string, unknown>>;
}

const DEFAULT_FRAMEWORK_BASE_URL = "https://raw.githubusercontent.com/VKneider/slicejs_docs/master/";
const DEFAULT_COMPONENTS_MANIFEST_URL = "https://raw.githubusercontent.com/VKneider/slice.js_visual_library/master/agent/docs-manifest.json";
const DEFAULT_COMPONENTS_RAW_BASE_URL = "https://raw.githubusercontent.com/VKneider/slice.js_visual_library";

const catalogCache = new Map<CatalogSource, Promise<CatalogDocument[]>>();
const contentCache = new Map<string, Promise<string>>();

function joinUrl(base: string, suffix: string): string {
  return `${base.replace(/\/+$/, "")}/${suffix.replace(/^\/+/, "")}`;
}

async function fetchResponse(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`);
  return response;
}

async function fetchText(url: string): Promise<string> {
  return (await fetchResponse(url)).text();
}

async function fetchJson<T>(url: string): Promise<T> {
  return await (await fetchResponse(url)).json() as T;
}

function titleFromContent(content: string, fallback: string): string {
  const line = content.split(/\r?\n/).find((candidate) => candidate.startsWith("# "));
  return line ? line.slice(2).trim() : fallback;
}

function parseFrameworkLlm(content: string, baseUrl: string, revision: string): CatalogDocument[] {
  const documents: CatalogDocument[] = [];
  const sections = (`\n${content}`).split(/\n=== /).slice(1);

  for (const section of sections) {
    const lines = section.split("\n");
    const path = lines[0].replace(" ===", "").trim();
    const searchText = lines.slice(1).join("\n").trim();
    if (!path || !searchText) continue;

    const id = path.replace(/^markdown\//, "").replace(/\.md$/, "");
    documents.push({
      source: "framework",
      catalog: "slicejs-docs",
      id,
      title: titleFromContent(searchText, id.split("/").pop() || id),
      path,
      sourcePath: path,
      rawUrl: joinUrl(baseUrl, path),
      revision,
      searchText
    });
  }

  return documents;
}

function normalizeComponentsManifest(
  manifest: ComponentsManifest,
  rawBaseUrl: string,
  preferRawBaseUrl = false
): CatalogDocument[] {
  if (!Array.isArray(manifest.documents)) {
    throw new Error("Components documentation manifest is missing a documents array");
  }

  return manifest.documents.map((rawDocument) => {
    const id = String(rawDocument.id || "");
    const sourcePath = String(rawDocument.sourcePath || rawDocument.path || "");
    if (!id || !sourcePath) throw new Error("Components documentation manifest contains an invalid document");

    const rawUrl = !preferRawBaseUrl && typeof rawDocument.rawUrl === "string"
      ? rawDocument.rawUrl
      : joinUrl(rawBaseUrl, `${manifest.revision || "master"}/${sourcePath}`);

    return {
      source: "components",
      catalog: manifest.catalog || "slicejs-components",
      id,
      title: String(rawDocument.title || id),
      path: sourcePath,
      sourcePath,
      rawUrl,
      description: typeof rawDocument.description === "string" ? rawDocument.description : undefined,
      tags: Array.isArray(rawDocument.tags) ? rawDocument.tags.map(String) : [],
      route: typeof rawDocument.route === "string" ? rawDocument.route : null,
      component: typeof rawDocument.component === "string" ? rawDocument.component : undefined,
      kind: typeof rawDocument.kind === "string" ? rawDocument.kind : undefined,
      version: typeof manifest.version === "string" ? manifest.version : undefined,
      revision: typeof manifest.revision === "string" ? manifest.revision : undefined
    };
  });
}

export async function loadCatalog(source: CatalogSource): Promise<CatalogDocument[]> {
  const cached = catalogCache.get(source);
  if (cached) return cached;

  const frameworkBaseUrl = process.env.SLICE_FRAMEWORK_DOCS_BASE_URL || DEFAULT_FRAMEWORK_BASE_URL;
  const frameworkRevision = process.env.SLICE_FRAMEWORK_DOCS_REVISION || "master";
  const componentsRawBaseOverride = process.env.SLICE_COMPONENTS_RAW_BASE_URL || null;
  const componentsRawBaseUrl = componentsRawBaseOverride || DEFAULT_COMPONENTS_RAW_BASE_URL;
  const promise = source === "framework"
    ? fetchText(joinUrl(frameworkBaseUrl, "llm.txt"))
      .then((content) => parseFrameworkLlm(content, frameworkBaseUrl, frameworkRevision))
    : fetchJson<ComponentsManifest>(
      process.env.SLICE_COMPONENTS_MANIFEST_URL || DEFAULT_COMPONENTS_MANIFEST_URL
    ).then((manifest) => normalizeComponentsManifest(
      manifest,
      componentsRawBaseUrl,
      Boolean(componentsRawBaseOverride)
    ));

  catalogCache.set(source, promise);
  return promise;
}

export function qualifiedDocumentId(document: CatalogDocument): string {
  return `${document.source}:${document.id}`;
}

export async function getCatalogDocumentContent(document: CatalogDocument): Promise<string> {
  const key = qualifiedDocumentId(document);
  const cached = contentCache.get(key);
  if (cached) return cached;

  const promise = fetchText(document.rawUrl);
  contentCache.set(key, promise);
  return promise;
}

export interface SearchSnippet {
  line: number;
  section: string;
  text: string;
}

export interface CatalogSearchResult {
  doc_id: string;
  source: CatalogSource;
  title: string;
  path: string;
  relevance_score: number;
  matched_terms: string[];
  snippets: SearchSnippet[];
}

export function scoreCatalogDocument(
  document: CatalogDocument,
  content: string,
  query: string,
  maxSnippets: number
): CatalogSearchResult | null {
  const phrase = query.toLowerCase().trim();
  const terms = [...new Set(phrase.split(/\s+/).filter(Boolean))];
  if (terms.length === 0) return null;

  const lines = content.split(/\r?\n/);
  const title = document.title.toLowerCase();
  const tags = (document.tags || []).join(" ").toLowerCase();
  const matched = new Set<string>();
  let score = 0;

  for (const term of terms) {
    if (title.includes(term)) {
      score += 6;
      matched.add(term);
    }
    if (tags.includes(term)) {
      score += 4;
      matched.add(term);
    }
  }
  if (terms.length > 1 && title.includes(phrase)) score += 10;

  const hits: Array<SearchSnippet & { lineScore: number }> = [];
  let section = "";
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^#{1,6}\s/.test(line)) section = line.replace(/^#{1,6}\s+/, "").trim();

    const lower = line.toLowerCase();
    let lineScore = 0;
    for (const term of terms) {
      if (lower.includes(term)) {
        lineScore += /^#{1,6}\s/.test(line) ? 3 : 1;
        matched.add(term);
      }
    }
    if (terms.length > 1 && lower.includes(phrase)) lineScore += 5;
    if (lineScore > 0) {
      score += lineScore;
      hits.push({
        line: index + 1,
        section: section || document.title,
        text: line.trim(),
        lineScore
      });
    }
  }

  if (matched.size === 0) return null;
  score *= 0.5 + 0.5 * (matched.size / terms.length);

  return {
    doc_id: qualifiedDocumentId(document),
    source: document.source,
    title: document.title,
    path: document.path,
    relevance_score: Math.round(score * 100) / 100,
    matched_terms: [...matched],
    snippets: hits
      .sort((a, b) => b.lineScore - a.lineScore || a.line - b.line)
      .slice(0, maxSnippets)
      .map(({ line, section: hitSection, text }) => ({ line, section: hitSection, text }))
  };
}

export async function searchCatalog(
  source: CatalogSource,
  query: string,
  maxResults = 5,
  snippetsPerDoc = 3
): Promise<CatalogSearchResult[]> {
  const documents = await loadCatalog(source);
  const results: CatalogSearchResult[] = [];

  for (const document of documents) {
    const content = document.searchText || await getCatalogDocumentContent(document);
    const result = scoreCatalogDocument(document, content, query, snippetsPerDoc);
    if (result) results.push(result);
  }

  return results
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, maxResults);
}

export async function getCatalogDocuments(
  source: CatalogSource,
  ids: string | string[]
): Promise<Array<{ document: CatalogDocument; content: string }>> {
  const requestedIds = Array.isArray(ids) ? ids : [ids];
  const documents = await loadCatalog(source);
  const results: Array<{ document: CatalogDocument; content: string }> = [];

  for (const requestedId of requestedIds) {
    const normalized = requestedId.toLowerCase();
    const document = documents.find((candidate) => [
      candidate.id,
      candidate.component,
      candidate.title,
      qualifiedDocumentId(candidate)
    ].filter(Boolean).some((value) => String(value).toLowerCase() === normalized));

    if (!document) throw new Error(`Documentation document not found: "${requestedId}" in source "${source}"`);
    results.push({ document, content: await getCatalogDocumentContent(document) });
  }

  return results;
}

export function resetCatalogCaches(): void {
  catalogCache.clear();
  contentCache.clear();
}
