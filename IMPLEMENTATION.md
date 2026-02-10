This MCP will use fastmcp + typescript to create an mcp server like context7 to retrieve Slicejs documentation and improve the experience of developing apps with slice.js with ai agents, etc...

#Example code mcp

import { FastMCP } from "fastmcp";
import { z } from "zod"; // Or any validation library that supports Standard Schema

const server = new FastMCP({
  name: "My Server",
  version: "1.0.0",
});

server.addTool({
  name: "add",
  description: "Add two numbers",
  parameters: z.object({
    a: z.number(),
    b: z.number(),
  }),
  execute: async (args) => {
    return String(args.a + args.b);
  },
});

server.start({
  transportType: "stdio",
});


I want the mcp to work on stdio, i will publish the package on npm and install via npx.

## Architecture

### Data Fetching Strategy
- Use GitHub raw content URLs (no API rate limits)
- Format: `https://raw.githubusercontent.com/owner/repo/branch/path/to/file.md`
- Implement in-memory caching with TTL to improve performance

### Cache Implementation
```typescript
// Simple cache with TTL
const cache = new Map<string, { content: string, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key: string): string | null {
  const cached = cache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return cached.content;
}

function setCache(key: string, content: string): void {
  cache.set(key, { content, timestamp: Date.now() });
}
```

### Configuration
```typescript
const DOCS_CONFIG = {
  repo: 'owner/slicejs',
  branch: 'main',
  docsPath: 'docs',
  llmTxtPath: 'llm.txt',
  baseRawUrl: 'https://raw.githubusercontent.com/owner/slicejs/main',
  structure: [
    {
      id: 'getting-started',
      path: 'docs/getting-started.md',
      title: 'Getting Started',
      description: 'Introduction to Slicejs'
    },
    // ... more docs
  ]
};
```

## Tools

### 1. list_documentation
**Description:** Returns available documentation sections/categories

**Parameters:** None

**Returns:** JSON array with documentation structure
```json
[
  {
    "id": "getting-started",
    "title": "Getting Started",
    "description": "Introduction to Slicejs",
    "path": "docs/getting-started.md"
  }
]
```

### 2. search_documentation
**Description:** Searches across all docs by keyword/phrase

**Parameters:**
- `query` (string, required): Search term or phrase
- `max_results` (number, optional, default: 5): Maximum number of results

**Returns:** Ranked results with context snippets
```json
[
  {
    "doc_id": "getting-started",
    "title": "Getting Started",
    "relevance_score": 0.95,
    "snippet": "...matching text context...",
    "path": "docs/getting-started.md"
  }
]
```

### 3. get_documentation
**Description:** Fetches full content of specific doc page(s)

**Parameters:**
- `doc_id` (string or string[], required): Document ID(s) to fetch
- `include_metadata` (boolean, optional, default: false): Include doc metadata

**Returns:** Full markdown content
```json
{
  "doc_id": "getting-started",
  "title": "Getting Started",
  "content": "# Getting Started\n\n...",
  "metadata": {
    "path": "docs/getting-started.md",
    "fetched_at": "2026-02-09T..."
  }
}
```

### 4. get_llm_context
**Description:** Fetches the complete llm.txt from the repository

**Parameters:** None

**Returns:** Full llm.txt content for comprehensive LLM context