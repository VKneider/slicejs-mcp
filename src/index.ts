#!/usr/bin/env node

import { FastMCP } from "fastmcp";
import { listDocsTool } from "./tools/list-docs.js";
import { searchDocsTool } from "./tools/search-docs.js";
import { getDocContentTool } from "./tools/get-doc-content.js";
import { getLlmFullContextTool } from "./tools/get-llm-full-context.js";
import {
  sliceComponentsGetDocTool,
  sliceComponentsListDocsTool,
  sliceComponentsSearchDocsTool,
  sliceFrameworkGetDocTool,
  sliceFrameworkListDocsTool,
  sliceFrameworkSearchDocsTool
} from "./tools/catalog-docs.js";

const server = new FastMCP({
  name: "Slice.js Documentation MCP",
  version: "1.0.0",
});

server.addTool(listDocsTool);
server.addTool(searchDocsTool);
server.addTool(getDocContentTool);
server.addTool(getLlmFullContextTool);
server.addTool(sliceFrameworkListDocsTool);
server.addTool(sliceFrameworkSearchDocsTool);
server.addTool(sliceFrameworkGetDocTool);
server.addTool(sliceComponentsListDocsTool);
server.addTool(sliceComponentsSearchDocsTool);
server.addTool(sliceComponentsGetDocTool);

server.start({
  transportType: "stdio",
});
