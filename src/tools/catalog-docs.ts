import { z } from "zod";
import {
  CatalogSource,
  getCatalogDocuments,
  loadCatalog,
  qualifiedDocumentId,
  searchCatalog
} from "../catalogs.js";

function createListTool(source: CatalogSource) {
  const publicName = source === "framework" ? "slice_framework_list_docs" : "slice_components_list_docs";
  const label = source === "framework" ? "framework" : "Slice.js Components";
  return {
    name: publicName,
    description: `List documents available in the ${label} catalog`,
    parameters: z.object({}),
    execute: async () => {
      const documents = await loadCatalog(source);
      return JSON.stringify(documents.map((document) => ({
        doc_id: qualifiedDocumentId(document),
        id: document.id,
        source: document.source,
        title: document.title,
        path: document.path,
        component: document.component,
        kind: document.kind,
        route: document.route,
        tags: document.tags || []
      })));
    }
  };
}

function createSearchTool(source: CatalogSource) {
  const publicName = source === "framework" ? "slice_framework_search_docs" : "slice_components_search_docs";
  const label = source === "framework" ? "framework" : "Slice.js Components";
  return {
    name: publicName,
    description: `Search ${label} documentation and return ranked snippets. Use the returned doc_id with the matching get tool.`,
    parameters: z.object({
      query: z.string(),
      max_results: z.number().optional().default(5),
      snippets_per_doc: z.number().optional().default(3)
    }),
    execute: async (args: { query: string; max_results: number; snippets_per_doc: number }) => {
      const results = await searchCatalog(source, args.query, args.max_results, args.snippets_per_doc);
      return JSON.stringify(results);
    }
  };
}

function createGetTool(source: CatalogSource) {
  const publicName = source === "framework" ? "slice_framework_get_doc" : "slice_components_get_doc";
  const label = source === "framework" ? "framework" : "Slice.js Components";
  return {
    name: publicName,
    description: `Retrieve the authored Markdown and provenance metadata for ${label} document(s)`,
    parameters: z.object({
      doc_id: z.union([z.string(), z.array(z.string())]),
      include_metadata: z.boolean().optional().default(true)
    }),
    execute: async (args: { doc_id: string | string[]; include_metadata: boolean }) => {
      const results = await getCatalogDocuments(source, args.doc_id);
      const response = results.map(({ document, content }) => ({
        doc_id: qualifiedDocumentId(document),
        source: document.source,
        catalog: document.catalog,
        id: document.id,
        title: document.title,
        content,
        ...(args.include_metadata ? {
          metadata: {
            path: document.path,
            sourcePath: document.sourcePath,
            rawUrl: document.rawUrl,
            route: document.route || null,
            component: document.component || null,
            kind: document.kind || null,
            tags: document.tags || [],
            version: document.version || null,
            revision: document.revision || null
          }
        } : {})
      }));

      return JSON.stringify(response.length === 1 ? response[0] : response);
    }
  };
}

export const sliceFrameworkListDocsTool = createListTool("framework");
export const sliceFrameworkSearchDocsTool = createSearchTool("framework");
export const sliceFrameworkGetDocTool = createGetTool("framework");
export const sliceComponentsListDocsTool = createListTool("components");
export const sliceComponentsSearchDocsTool = createSearchTool("components");
export const sliceComponentsGetDocTool = createGetTool("components");
