#!/usr/bin/env node

/**
 * UnClick Memory - Setup Wizard
 *
 * Interactive setup for connecting to Supabase (cloud mode).
 * Run: npx @unclick/memory-mcp setup
 *
 * For local mode, no setup is needed - it works out of the box.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as readline from "readline";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function print(msg: string): void {
  console.log(msg);
}

function printHeader(): void {
  print("");
  print("  UnClick Memory - Setup Wizard");
  print("  Persistent cross-session memory for AI agents");
  print("  -----------------------------------------------");
  print("");
}

// Detect which MCP config files exist
interface ConfigTarget {
  name: string;
  path: string;
  exists: boolean;
}

function detectConfigs(): ConfigTarget[] {
  const home = os.homedir();
  const platform = os.platform();

  const targets: ConfigTarget[] = [];

  // Claude Code
  const claudeCode = path.join(home, ".claude", "mcp.json");
  targets.push({ name: "Claude Code", path: claudeCode, exists: fs.existsSync(claudeCode) });

  // Claude Desktop
  let claudeDesktop: string;
  if (platform === "darwin") {
    claudeDesktop = path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  } else if (platform === "win32") {
    claudeDesktop = path.join(process.env.APPDATA ?? path.join(home, "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
  } else {
    claudeDesktop = path.join(home, ".config", "Claude", "claude_desktop_config.json");
  }
  targets.push({ name: "Claude Desktop", path: claudeDesktop, exists: fs.existsSync(claudeDesktop) });

  // Cursor
  const cursor = path.join(home, ".cursor", "mcp.json");
  targets.push({ name: "Cursor", path: cursor, exists: fs.existsSync(cursor) });

  return targets;
}

function buildConfigEntry(supabaseUrl?: string, supabaseKey?: string): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    command: "npx",
    args: ["-y", "@unclick/memory-mcp"],
  };

  if (supabaseUrl && supabaseKey) {
    entry.env = {
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: supabaseKey,
    };
  }

  return entry;
}

function addToConfig(configPath: string, supabaseUrl?: string, supabaseKey?: string): boolean {
  try {
    let config: Record<string, unknown> = {};

    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    }

    // Handle both formats: { mcpServers: {} } and flat { }
    const servers = (config.mcpServers as Record<string, unknown>) ?? config;
    const targetObj = config.mcpServers ? config : { mcpServers: config };

    if (config.mcpServers) {
      (targetObj.mcpServers as Record<string, unknown>)["unclick-memory"] = buildConfigEntry(supabaseUrl, supabaseKey);
    } else {
      config["unclick-memory"] = buildConfigEntry(supabaseUrl, supabaseKey);
    }

    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config.mcpServers ? targetObj : config, null, 2) + "\n");
    return true;
  } catch (err) {
    print(`  Could not write to ${configPath}: ${(err as Error).message}`);
    return false;
  }
}

async function main(): Promise<void> {
  printHeader();

  // Step 1: Choose mode
  print("  Memory works in two modes:");
  print("    1. Local (zero-config, data on this machine)");
  print("    2. Supabase Cloud (sync across machines, requires free account)");
  print("");

  const modeChoice = await ask("  Which mode? [1/2, default 1]: ");
  const useSupabase = modeChoice === "2";
  print("");

  let supabaseUrl: string | undefined;
  let supabaseKey: string | undefined;

  if (useSupabase) {
    // Step 2: Supabase credentials
    print("  -- Supabase Setup --");
    print("");
    print("  If you don't have a project yet, create one free at:");
    print("  https://supabase.com/dashboard");
    print("");

    supabaseUrl = await ask("  Supabase URL (e.g. https://abc123.supabase.co): ");
    if (!supabaseUrl.startsWith("http")) {
      print("  That doesn't look like a URL. Try again.");
      rl.close();
      process.exit(1);
    }

    supabaseKey = await ask("  Service Role Key (from Settings > API): ");
    if (!supabaseKey || supabaseKey.length < 20) {
      print("  That doesn't look like a valid key. Try again.");
      rl.close();
      process.exit(1);
    }

    // Step 3: Schema
    print("");
    print("  -- Database Schema --");
    print("");
    print("  You need to run the schema SQL in your Supabase SQL Editor.");
    print("  The schema file is included in this package at:");
    print("");

    // Find schema.sql location
    const schemaPath = path.resolve(new URL(".", import.meta.url).pathname, "..", "schema.sql");
    if (fs.existsSync(schemaPath)) {
      print(`    ${schemaPath}`);
    } else {
      print("    node_modules/@unclick/memory-mcp/schema.sql");
    }

    print("");
    print("  Steps:");
    print("    1. Go to your Supabase dashboard > SQL Editor");
    print("    2. Click 'New query'");
    print("    3. Paste the contents of schema.sql");
    print("    4. Click 'Run'");
    print("");

    await ask("  Press Enter when done (or Enter to skip and do it later)...");
    print("");
  }

  // Step 4: Configure MCP client
  print("  -- MCP Client Config --");
  print("");

  const configs = detectConfigs();
  const existing = configs.filter((c) => c.exists);
  const detected = existing.length > 0 ? existing : configs;

  if (existing.length > 0) {
    print(`  Detected: ${existing.map((c) => c.name).join(", ")}`);
  } else {
    print("  No existing MCP config files found. I'll create one for you.");
  }
  print("");

  for (let i = 0; i < detected.length; i++) {
    print(`    ${i + 1}. ${detected[i].name} (${detected[i].path})`);
  }
  print(`    ${detected.length + 1}. Show config (I'll add it manually)`);
  print(`    ${detected.length + 2}. Skip`);
  print("");

  const configChoice = await ask(`  Which one? [1-${detected.length + 2}]: `);
  const choiceNum = parseInt(configChoice, 10);

  if (choiceNum >= 1 && choiceNum <= detected.length) {
    const target = detected[choiceNum - 1];
    if (addToConfig(target.path, supabaseUrl, supabaseKey)) {
      print(`  Added unclick-memory to ${target.name} config.`);
    }
  } else if (choiceNum === detected.length + 1) {
    print("");
    print("  Add this to your MCP config:");
    print("");
    print(JSON.stringify({ "unclick-memory": buildConfigEntry(supabaseUrl, supabaseKey) }, null, 2));
  } else {
    print("  Skipped.");
  }

  // Done
  print("");
  print("  -----------------------------------------------");
  if (useSupabase) {
    print("  Setup complete! Restart your AI tool to start using memory.");
    print("  Your data lives in your Supabase - UnClick never sees it.");
  } else {
    print("  Setup complete! Restart your AI tool to start using memory.");
    print(`  Memory will be stored locally at: ${path.join(os.homedir(), ".unclick", "memory")}`);
    print("  To upgrade to cloud sync later, run: npx @unclick/memory-mcp setup");
  }
  print("");

  rl.close();
}

// Entry point
const args = process.argv.slice(2);
if (args[0] === "setup" || args[0] === "--setup") {
  main().catch((err) => {
    console.error("Setup error:", err);
    process.exit(1);
  });
} else {
  // If run without 'setup' flag, show help
  print("UnClick Memory MCP Server");
  print("");
  print("Usage:");
  print("  npx @unclick/memory-mcp setup    Interactive setup wizard");
  print("  npx @unclick/memory-mcp          Start MCP server (stdio)");
  print("");
  print("Modes:");
  print("  Local (default)    No config needed, data at ~/.unclick/memory/");
  print("  Supabase Cloud     Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  print("");
  // Fall through to start the server
  import("./index.js");
}
