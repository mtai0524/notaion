#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadEnv } from "./loadEnv.js";
import { loadConfig } from "./config.js";

loadEnv();
import { createAuth } from "./auth.js";
import { createApi } from "./api.js";
import {
  schemas,
  listDailyNotes,
  searchDailyNotes,
  createDailyNote,
  appendToDailyNote,
  updateDailyNote,
  deleteDailyNote,
} from "./tools/dailyNote.js";

const config = loadConfig();
const auth = createAuth(config);
const api = createApi({ apiUrl: config.apiUrl, auth });

const server = new McpServer({ name: "notaion", version: "0.1.0" });

function register(name, description, inputSchema, handler) {
  server.registerTool(name, { description, inputSchema }, async (args) => {
    try {
      const result = await handler(api, args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  });
}

register("list_daily_notes", "List Daily Notes for a date (defaults to today).", schemas.list_daily_notes, listDailyNotes);
register("search_daily_notes", "Search Daily Notes by keyword in title or content.", schemas.search_daily_notes, searchDailyNotes);
register("create_daily_note", "Create a new Daily Note sticky card.", schemas.create_daily_note, createDailyNote);
register("append_to_daily_note", "Append text to an existing Daily Note's content.", schemas.append_to_daily_note, appendToDailyNote);
register("update_daily_note", "Update fields of an existing Daily Note.", schemas.update_daily_note, updateDailyNote);
register("delete_daily_note", "Soft-delete a Daily Note (moves it to trash).", schemas.delete_daily_note, deleteDailyNote);

const transport = new StdioServerTransport();
await server.connect(transport);
