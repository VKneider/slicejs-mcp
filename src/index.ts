#!/usr/bin/env node

import { FastMCP } from "fastmcp";
import { listDocsTool } from "./tools/list-docs.js";
import { searchDocsTool } from "./tools/search-docs.js";
import { getDocContentTool } from "./tools/get-doc-content.js";
import { getLlmFullContextTool } from "./tools/get-llm-full-context.js";

const server = new FastMCP({
  name: "Slice.js Documentation MCP",
  version: "1.0.0",
});

server.addTool(listDocsTool);
server.addTool(searchDocsTool);
server.addTool(getDocContentTool);
server.addTool(getLlmFullContextTool);

server.start({
  transportType: "stdio",
});