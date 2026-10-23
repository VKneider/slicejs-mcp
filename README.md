# Slice.js Documentation MCP

An MCP (Model Context Protocol) server that provides access to Slice.js documentation from the official GitHub repository. This server allows AI assistants and tools to query, search, and retrieve documentation seamlessly.

## Features

- **Dynamic Documentation Discovery**: Automatically discovers and indexes all documentation files from the GitHub repo
- **Intelligent Caching**: Infinite session cache to minimize API requests and improve performance
- **Full-Text Search**: Search across all documentation with keyword matching
- **Content Retrieval**: Fetch specific documentation pages or the complete documentation bundle
- **Lazy Initialization**: Docs structure is loaded on-demand when first needed

## Installation

### Global Installation (Recommended)
```bash
npm install -g slicejs-mcp
```

### Using npx (No Installation Required)
```bash
npx slicejs-mcp
```

## Usage

The MCP server runs as a stdio-based service, perfect for integration with AI assistants and MCP-compatible tools.

### Basic Usage
```bash
npx slicejs-mcp
```

### Integration with MCP Clients
This server is designed to work with MCP-compatible clients. When launched, it exposes the
original framework tools plus namespace-aware tools for the Slice.js Components catalog:

## Tools

### 1. `list_docs`
Returns a list of all available documentation sections and categories.

**Parameters:** None

**Response:** JSON array of documentation items with id, title, and path.

**Example:**
```json
[
  {
    "id": "getting-started",
    "title": "Getting Started",
    "path": "markdown/getting-started.md"
  }
]
```

### 2. `search_docs`
Searches across all documentation using keywords or phrases.

**Parameters:**
- `query` (string, required): Search term
- `max_results` (number, optional, default: 5): Maximum number of results

**Response:** JSON array of search results with snippets and metadata.

### 3. `get_doc_content`
Fetches the full content of specific documentation page(s).

**Parameters:**
- `doc_id` (string or string[], required): Documentation ID(s) to fetch
- `include_metadata` (boolean, optional, default: false): Include additional metadata

**Response:** JSON object(s) with document content, title, and optional metadata.

### 4. `get_llm_full_context`
Fetches the complete documentation bundle (~2000 lines) for comprehensive LLM context.

**Parameters:** None

**Response:** Complete documentation text

**Note:** This consumes considerable tokens but provides all documentation in one request.

### Framework catalog tools

These tools make the documentation source explicit while preserving the original tools above:

- `slice_framework_list_docs`
- `slice_framework_search_docs`
- `slice_framework_get_doc`

They read from `slicejs_docs` and return authored Markdown plus provenance metadata.

### Slice.js Components catalog tools

These tools provide access to Visual and Service component documentation:

- `slice_components_list_docs`
- `slice_components_search_docs`
- `slice_components_get_doc`

The Components tools read the catalog manifest published by `slice.js_visual_library` and retrieve
the original Markdown document, including its examples and `:::script` blocks. They do not execute
documentation examples or modify the project.

The catalog manifest is expected at:

```text
https://raw.githubusercontent.com/VKneider/slice.js_visual_library/master/agent/docs-manifest.json
```

## Examples

### List all documentation
```javascript
// Via MCP client
await callTool("list_docs", {});
```

### Search for routing information
```javascript
await callTool("search_docs", {
  query: "routing",
  max_results: 3
});
```

### Get specific documentation
```javascript
await callTool("get_doc_content", {
  doc_id: "getting-started/routing"
});
```

### Get full documentation context
```javascript
await callTool("get_llm_full_context", {});
```

## Architecture

- **Framework source**: Documentation fetched from https://github.com/VKneider/slicejs_docs
- **Components source**: Markdown and manifest fetched from https://github.com/VKneider/slice.js_visual_library
- **Caching**: Infinite session cache prevents redundant API calls
- **Initialization**: Lazy loading of document structure on first tool use
- **Rate Limiting**: Optimized to stay within GitHub API limits (60 req/hour)

The two catalogs are separate because framework behavior and component APIs have different
versioning and ownership. The MCP uses the same list/search/get pattern for both sources, while
the authored Markdown remains the canonical content.

Environment overrides are available for local development and mirrors:

```text
SLICE_FRAMEWORK_DOCS_BASE_URL
SLICE_FRAMEWORK_DOCS_REVISION
SLICE_FRAMEWORK_DOCS_API_BASE
SLICE_COMPONENTS_MANIFEST_URL
SLICE_COMPONENTS_RAW_BASE_URL
```

## Development

### Prerequisites
- Node.js >= 18
- npm or yarn

### Setup
```bash
git clone <repo>
cd slicejs-mcp
npm install
npm run build
```

### Running Locally
```bash
npm start
# or
node dist/index.js
```

### Testing with MCP Inspector
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Contributing

Contributions welcome! Please ensure:
- All tools maintain backward compatibility
- Cache behavior is preserved
- Error handling is robust

## License

MIT
