#!/usr/bin/env node
/**
 * Initialize Super Admin API Key
 *
 * Generates a real API key for the super admin user and updates the database.
 * This solves the "chicken and egg" problem where you need an admin key to
 * create keys through the API.
 *
 * Usage:
 *   node scripts/init-admin-key.js                    # Local development (random key)
 *   node scripts/init-admin-key.js --fixed            # Local development (fixed key)
 *   node scripts/init-admin-key.js --prod             # Production (random key)
 *   node scripts/init-admin-key.js --config wrangler.xxx.jsonc  # Custom config
 *
 * Fixed key for local development: sk-admin_dev_fixed_key_local_2024
 */

import { execSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { prod: false, config: undefined, fixed: false, remote: false };

  for (const arg of args) {
    if (arg === "--prod") {
      result.prod = true;
    } else if (arg === "--fixed") {
      result.fixed = true;
    } else if (arg === "--remote") {
      result.remote = true;
    } else if (arg.startsWith("--config=")) {
      result.config = arg.split("=")[1];
    } else if (arg === "--config" && args.indexOf(arg) + 1 < args.length) {
      result.config = args[args.indexOf(arg) + 1];
    }
  }

  return result;
}

function getWranglerConfig(args) {
  if (args.config) {
    if (!fs.existsSync(args.config)) {
      console.error(`Error: Config file not found: ${args.config}`);
      process.exit(1);
    }
    return args.config;
  }

  if (args.prod) {
    const prodConfig = "wrangler.prod.jsonc";
    if (fs.existsSync(prodConfig)) {
      return prodConfig;
    }
  }

  // Prefer wrangler.jsonc, fallback to wrangler.toml
  if (fs.existsSync("wrangler.jsonc")) {
    return "wrangler.jsonc";
  }
  return "wrangler.toml";
}

function generateApiKey() {
  // Generate same format as AuthService.generateApiKey()
  // Prefix: sk- (dash), format: sk-{timestamp}_{uuid}
  const timestamp = Date.now();
  const uuid = crypto.randomUUID().replace(/-/g, "");
  return `sk-${timestamp}_${uuid}`;
}

function hashApiKey(apiKey) {
  // SHA-256 hash (same as AuthService)
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

function extractKeyPrefix(apiKey) {
  // Extract first 12 chars for display prefix
  if (apiKey.length <= 12) {
    return apiKey;
  }
  return apiKey.slice(0, 12);
}

function getDatabaseName(configPath) {
  const content = fs.readFileSync(configPath, "utf-8");

  // Try to parse JSON/JSONC
  try {
    // Remove JSONC comments
    const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
    const config = JSON.parse(cleanContent);

    const dbBinding = config.d1_databases?.find((db) => {
      if (typeof db !== "object" || db === null) return false;
      return db.binding === "DB";
    });

    return dbBinding?.database_name || "agate-db";
  } catch {
    return "agate-db";
  }
}

function executeSql(dbName, sql, config, local, remote) {
  const configFlag = `--config ${config}`;
  const localFlag = local ? "--local" : "";
  const remoteFlag = remote ? "--remote" : "";
  const command = `npx wrangler d1 execute ${dbName} ${configFlag} ${localFlag} ${remoteFlag} --command "${sql}"`;

  try {
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    console.error(`Failed to execute SQL: ${error}`);
    throw error;
  }
}

function executeSqlCapture(dbName, sql, config, local, remote) {
  const configFlag = `--config ${config}`;
  const localFlag = local ? "--local" : "";
  const remoteFlag = remote ? "--remote" : "";
  const command = `npx wrangler d1 execute ${dbName} ${configFlag} ${localFlag} ${remoteFlag} --command "${sql}"`;

  try {
    return execSync(command, { encoding: "utf-8" });
  } catch (error) {
    console.error(`Failed to execute SQL: ${error}`);
    throw error;
  }
}

async function main() {
  const args = parseArgs();
  const config = getWranglerConfig(args);
  const local = !args.prod;
  const remote = args.remote;
  const dbName = getDatabaseName(config);

  console.log("========================================");
  console.log("Initialize Super Admin API Key");
  console.log("========================================");
  console.log(`Environment: ${local ? "Local" : "Production"}`);
  console.log(`Database: ${dbName}`);
  console.log(`Config: ${config}`);
  console.log("");

  // Generate or use fixed API key
  const apiKey = args.fixed
    ? "sk-admin_dev_fixed_key_local_2024"
    : generateApiKey();
  const keyHash = hashApiKey(apiKey);
  const keyPrefix = extractKeyPrefix(apiKey);

  console.log(`${args.fixed ? "Fixed" : "Generated"} API Key: ${apiKey}`);
  console.log(`Key Prefix: ${keyPrefix}`);
  console.log("");

  // Check if admin user exists
  console.log("Checking admin user...");
  const checkUserSql = `SELECT id, email FROM users WHERE role = 'admin' LIMIT 1;`;

  try {
    const result = executeSqlCapture(dbName, checkUserSql, config, local, remote);

    // Parse result to find admin user
    const userIdMatch = result.match(/u_[a-zA-Z0-9_]+/);
    const userId = userIdMatch ? userIdMatch[0] : "u_admin";

    // Get company and department from user
    console.log("Getting user organization info...");
    const userSql = `SELECT company_id, department_id FROM users WHERE id = '${userId}';`;
    const userResult = executeSqlCapture(dbName, userSql, config, local, remote);

    const companyMatch = userResult.match(/co_[a-zA-Z0-9_]+/);
    const deptMatch = userResult.match(/dept_[a-zA-Z0-9_]+/);

    const companyId = companyMatch ? companyMatch[0] : "co_demo_company";
    const departmentId = deptMatch ? deptMatch[0] : "dept_engineering";

    // Check if admin API key already exists (for idempotency)
    console.log("Checking for existing admin API key...");
    const checkKeySql = `SELECT id, key_prefix FROM api_keys WHERE user_id = '${userId}' AND name = 'Super Admin Key' LIMIT 1;`;
    const keyResult = executeSqlCapture(dbName, checkKeySql, config, local, remote);

    if (keyResult.includes("sk-") && !args.fixed) {
      // Admin key already exists, just display it
      const keyPrefixMatch = keyResult.match(/"key_prefix":\s*"sk-[0-9]+/);
      const keyPrefix = keyPrefixMatch ? keyPrefixMatch[0].split('"')[3] : null;

      if (keyPrefix) {
        console.log("");
        console.log("========================================");
        console.log("✓ Admin API Key already exists!");
        console.log("========================================");
        console.log("");
        console.log(`Key Prefix: ${keyPrefix}`);
        console.log("");
        console.log("Use this key to access admin endpoints:");
        console.log(`  curl -H "x-api-key: <YOUR_KEY>" \\`);
        console.log(`       https://your-worker/admin/keys`);
        console.log("");
        console.log("Note: The existing key is still valid. Use --fixed to create a fixed key.");
        console.log("      To generate a new key, delete the existing one first.");
        return;
      }
    }

    // Generate key ID (fixed or dynamic)
    const keyId = args.fixed ? "ak_admin_key" : `ak_${Date.now()}`;
    const now = Date.now();

    // Delete existing admin keys with same ID (only for fixed key mode)
    if (args.fixed) {
      console.log("Removing existing fixed admin key...");
      const deleteSql = `DELETE FROM api_keys WHERE id = '${keyId}';`;
      executeSql(dbName, deleteSql, config, local, remote);
    }

    // Insert new admin key
    console.log("Inserting new admin key...");
    const insertSql = `INSERT INTO api_keys (
      id, key_hash, key_prefix, user_id, company_id, department_id,
      name, quota_daily, quota_used, quota_bonus, is_unlimited, is_active,
      created_at, updated_at
    ) VALUES (
      '${keyId}',
      '${keyHash}',
      '${keyPrefix}',
      '${userId}',
      '${companyId}',
      '${departmentId}',
      'Super Admin Key',
      0,
      0,
      0,
      1,
      1,
      ${now},
      ${now}
    );`;

    executeSql(dbName, insertSql, config, local, remote);

    console.log("");
    console.log("========================================");
    console.log("✓ Super Admin API Key Created!");
    console.log("========================================");
    console.log("");
    console.log(`API Key: ${apiKey}`);
    console.log("");
    console.log("IMPORTANT: Save this key now!");
    console.log("You will not be able to see it again.");
    console.log("");
    console.log("Use this key to access admin endpoints:");
    console.log(`  curl -H "x-api-key: ${apiKey}" \\`);
    console.log(`       https://your-worker/admin/keys`);
    console.log("");

    // Save to file
    const projectRoot = dirname(__dirname);
    const outputFile = `${projectRoot}/.admin-api-key`;
    fs.writeFileSync(outputFile, apiKey);
    console.log(`Key also saved to: ${outputFile}`);

  } catch (error) {
    console.error("Error initializing admin key:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
