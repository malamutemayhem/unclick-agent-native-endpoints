// ─── Encrypted Credential Vault ───────────────────────────────────────────────
// AES-256-GCM at rest, PBKDF2 key derivation, per-secret IVs.
// Vault stored at ~/.unclick/vault.enc (fully encrypted).
// Audit log at ~/.unclick/vault-audit.log (encrypted).
// No external crypto dependencies - Node.js built-in crypto only.

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const VAULT_DIR   = path.join(os.homedir(), ".unclick");
const VAULT_FILE  = path.join(VAULT_DIR, "vault.enc");
const AUDIT_FILE  = path.join(VAULT_DIR, "vault-audit.log");
const LOCK_FILE   = path.join(VAULT_DIR, "vault.lock");

const PBKDF2_ITERATIONS = 100_000;
const KEY_BYTES         = 32;   // AES-256
const SALT_BYTES        = 32;
const IV_BYTES          = 12;   // 96-bit IV recommended for GCM

// ─── Types ────────────────────────────────────────────────────────────────────

interface GcmBlob {
  iv:         string; // hex
  authTag:    string; // hex
  ciphertext: string; // hex
}

interface SecretEntry extends GcmBlob {
  metadata:   Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface VaultData {
  secrets: Record<string, SecretEntry>;
}

interface VaultFile {
  version:    number;
  salt:       string; // hex PBKDF2 salt
  iv:         string;
  authTag:    string;
  ciphertext: string; // encrypted VaultData JSON
}

interface AuditEntry {
  action:    string;
  key:       string;
  timestamp: string;
  success:   boolean;
}

interface AuditFile {
  version: number;
  salt:    string; // hex - separate salt from vault salt
  entries: GcmBlob[];
}

// ─── Key derivation ───────────────────────────────────────────────────────────

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_BYTES, "sha256");
}

// ─── AES-256-GCM primitives ───────────────────────────────────────────────────

function gcmEncrypt(plaintext: string, key: Buffer): GcmBlob {
  const iv     = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc    = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    iv:         iv.toString("hex"),
    authTag:    cipher.getAuthTag().toString("hex"),
    ciphertext: enc.toString("hex"),
  };
}

function gcmDecrypt(blob: GcmBlob, key: Buffer): string {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(blob.iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(blob.authTag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

// ─── Advisory file lock ───────────────────────────────────────────────────────

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const maxWait    = 5_000;
  const pollMs     = 50;
  let   waited     = 0;

  ensureDir();

  while (fs.existsSync(LOCK_FILE)) {
    if (waited >= maxWait) {
      throw new Error("Vault is locked by another process. Try again shortly.");
    }
    await new Promise<void>((resolve) => setTimeout(resolve, pollMs));
    waited += pollMs;
  }

  fs.writeFileSync(LOCK_FILE, String(process.pid), { mode: 0o600 });
  try {
    return await fn();
  } finally {
    try { fs.unlinkSync(LOCK_FILE); } catch { /* ignore */ }
  }
}

function ensureDir(): void {
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true, mode: 0o700 });
  }
}

// ─── Atomic file writes ───────────────────────────────────────────────────────

function atomicWrite(filePath: string, content: string): void {
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, content, { mode: 0o600 });
  fs.renameSync(tmp, filePath);
}

// ─── Vault I/O ─────────────────────────────────────────────────────────────────

function readVaultFile(): VaultFile | null {
  if (!fs.existsSync(VAULT_FILE)) return null;
  return JSON.parse(fs.readFileSync(VAULT_FILE, "utf8")) as VaultFile;
}

function writeVaultFile(vf: VaultFile): void {
  atomicWrite(VAULT_FILE, JSON.stringify(vf));
}

interface UnlockedVault {
  data: VaultData;
  key:  Buffer;
  salt: Buffer;
}

// Derives key once. Throws if password is wrong (GCM auth tag mismatch).
function unlockVault(vf: VaultFile, password: string): UnlockedVault {
  const salt = Buffer.from(vf.salt, "hex");
  const key  = deriveKey(password, salt);
  const json = gcmDecrypt({ iv: vf.iv, authTag: vf.authTag, ciphertext: vf.ciphertext }, key);
  return { data: JSON.parse(json) as VaultData, key, salt };
}

function packVault(data: VaultData, key: Buffer, salt: Buffer): VaultFile {
  const blob = gcmEncrypt(JSON.stringify(data), key);
  return { version: 1, salt: salt.toString("hex"), ...blob };
}

// ─── Audit log I/O ────────────────────────────────────────────────────────────

function readAuditFile(): AuditFile | null {
  if (!fs.existsSync(AUDIT_FILE)) return null;
  return JSON.parse(fs.readFileSync(AUDIT_FILE, "utf8")) as AuditFile;
}

function writeAuditFile(af: AuditFile): void {
  atomicWrite(AUDIT_FILE, JSON.stringify(af));
}

function appendAuditEntry(verifiedKey: Buffer, entry: AuditEntry): void {
  let af = readAuditFile();
  let auditKey: Buffer;

  if (!af) {
    const salt = crypto.randomBytes(SALT_BYTES);
    auditKey   = deriveKey(Buffer.from(verifiedKey).toString("base64"), salt);
    af = { version: 1, salt: salt.toString("hex"), entries: [] };
  } else {
    const salt = Buffer.from(af.salt, "hex");
    auditKey   = deriveKey(Buffer.from(verifiedKey).toString("base64"), salt);
  }

  af.entries.push(gcmEncrypt(JSON.stringify(entry), auditKey));
  writeAuditFile(af);
}

function readAuditEntries(verifiedKey: Buffer, limit: number): AuditEntry[] {
  const af = readAuditFile();
  if (!af) return [];

  const salt     = Buffer.from(af.salt, "hex");
  const auditKey = deriveKey(Buffer.from(verifiedKey).toString("base64"), salt);

  const entries: AuditEntry[] = [];
  for (const blob of af.entries) {
    try {
      entries.push(JSON.parse(gcmDecrypt(blob, auditKey)) as AuditEntry);
    } catch {
      // skip corrupted entries silently - never surface partial data
    }
  }
  return entries.slice(-limit);
}

// ─── Secret masking ───────────────────────────────────────────────────────────

function maskValue(value: string): string {
  if (value.length <= 4) return "****";
  return `****${value.slice(-4)}`;
}

// ─── Vault actions ────────────────────────────────────────────────────────────

async function actionInit(password: string): Promise<unknown> {
  return withLock(async () => {
    if (fs.existsSync(VAULT_FILE)) {
      return { error: "Vault already exists. Use vault_store to add secrets." };
    }
    const salt = crypto.randomBytes(SALT_BYTES);
    const key  = deriveKey(password, salt);
    const vf   = packVault({ secrets: {} }, key, salt);
    writeVaultFile(vf);
    appendAuditEntry(key, {
      action:    "vault_init",
      key:       "",
      timestamp: new Date().toISOString(),
      success:   true,
    });
    return {
      success: true,
      message:
        "Vault initialized at ~/.unclick/vault.enc. " +
        "Keep your master password safe - it cannot be recovered.",
    };
  });
}

async function actionStore(
  password:  string,
  key:       string,
  value:     string,
  metadata?: Record<string, unknown>
): Promise<unknown> {
  return withLock(async () => {
    const vf = readVaultFile();
    if (!vf) return { error: "Vault not initialized. Call vault_init first." };

    let vault: UnlockedVault;
    try {
      vault = unlockVault(vf, password);
    } catch {
      return { error: "Invalid master password." };
    }

    const now      = new Date().toISOString();
    const existing = vault.data.secrets[key];
    const blob     = gcmEncrypt(value, vault.key);

    vault.data.secrets[key] = {
      ...blob,
      metadata:   metadata ?? existing?.metadata ?? {},
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };

    writeVaultFile(packVault(vault.data, vault.key, vault.salt));
    appendAuditEntry(vault.key, {
      action:    "vault_store",
      key,
      timestamp: now,
      success:   true,
    });

    return { success: true, key, message: `Secret "${key}" stored.` };
  });
}

async function actionRetrieve(
  password: string,
  key:      string,
  reveal:   boolean
): Promise<unknown> {
  return withLock(async () => {
    const vf = readVaultFile();
    if (!vf) return { error: "Vault not initialized. Call vault_init first." };

    let vault: UnlockedVault;
    try {
      vault = unlockVault(vf, password);
    } catch {
      return { error: "Invalid master password." };
    }

    const entry = vault.data.secrets[key];
    if (!entry) {
      return { error: `Secret "${key}" not found.` };
    }

    let plainValue: string;
    try {
      plainValue = gcmDecrypt(entry, vault.key);
    } catch {
      return { error: "Failed to decrypt secret. The vault may be corrupted." };
    }

    appendAuditEntry(vault.key, {
      action:    reveal ? "vault_retrieve_revealed" : "vault_retrieve",
      key,
      timestamp: new Date().toISOString(),
      success:   true,
    });

    return {
      key,
      value:      reveal ? plainValue : maskValue(plainValue),
      revealed:   reveal,
      metadata:   entry.metadata,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    };
  });
}

async function actionList(password: string): Promise<unknown> {
  return withLock(async () => {
    const vf = readVaultFile();
    if (!vf) return { error: "Vault not initialized. Call vault_init first." };

    let vault: UnlockedVault;
    try {
      vault = unlockVault(vf, password);
    } catch {
      return { error: "Invalid master password." };
    }

    appendAuditEntry(vault.key, {
      action:    "vault_list",
      key:       "",
      timestamp: new Date().toISOString(),
      success:   true,
    });

    const keys = Object.entries(vault.data.secrets).map(([k, v]) => ({
      key:        k,
      metadata:   v.metadata,
      created_at: v.created_at,
      updated_at: v.updated_at,
    }));

    return { count: keys.length, keys };
  });
}

async function actionDelete(password: string, key: string): Promise<unknown> {
  return withLock(async () => {
    const vf = readVaultFile();
    if (!vf) return { error: "Vault not initialized. Call vault_init first." };

    let vault: UnlockedVault;
    try {
      vault = unlockVault(vf, password);
    } catch {
      return { error: "Invalid master password." };
    }

    if (!vault.data.secrets[key]) {
      return { error: `Secret "${key}" not found.` };
    }

    delete vault.data.secrets[key];
    writeVaultFile(packVault(vault.data, vault.key, vault.salt));
    appendAuditEntry(vault.key, {
      action:    "vault_delete",
      key,
      timestamp: new Date().toISOString(),
      success:   true,
    });

    return { success: true, key, message: `Secret "${key}" deleted.` };
  });
}

async function actionRotate(
  password:  string,
  key:       string,
  new_value: string
): Promise<unknown> {
  return withLock(async () => {
    const vf = readVaultFile();
    if (!vf) return { error: "Vault not initialized. Call vault_init first." };

    let vault: UnlockedVault;
    try {
      vault = unlockVault(vf, password);
    } catch {
      return { error: "Invalid master password." };
    }

    const existing = vault.data.secrets[key];
    if (!existing) {
      return { error: `Secret "${key}" not found.` };
    }

    const now  = new Date().toISOString();
    const blob = gcmEncrypt(new_value, vault.key);

    vault.data.secrets[key] = {
      ...blob,
      metadata:   existing.metadata,
      created_at: existing.created_at,
      updated_at: now,
    };

    writeVaultFile(packVault(vault.data, vault.key, vault.salt));
    appendAuditEntry(vault.key, {
      action:    "vault_rotate",
      key,
      timestamp: now,
      success:   true,
    });

    return { success: true, key, message: `Secret "${key}" rotated with a new IV.` };
  });
}

async function actionAudit(password: string, limit: number): Promise<unknown> {
  return withLock(async () => {
    const vf = readVaultFile();
    if (!vf) return { error: "Vault not initialized. Call vault_init first." };

    let vault: UnlockedVault;
    try {
      vault = unlockVault(vf, password);
    } catch {
      return { error: "Invalid master password." };
    }

    const entries = readAuditEntries(vault.key, limit);
    return { count: entries.length, events: entries };
  });
}

// ─── Public dispatcher ────────────────────────────────────────────────────────

export async function vaultAction(
  action: string,
  args:   Record<string, unknown>
): Promise<unknown> {
  const password = String(args.master_password ?? "").trim();
  if (!password) return { error: "master_password is required." };

  switch (action) {
    case "vault_init":
      return actionInit(password);

    case "vault_store": {
      const key   = String(args.key   ?? "").trim();
      const value = String(args.value ?? "");
      if (!key)   return { error: "key is required."   };
      if (!value) return { error: "value is required." };
      const metadata =
        args.metadata && typeof args.metadata === "object" && !Array.isArray(args.metadata)
          ? (args.metadata as Record<string, unknown>)
          : undefined;
      return actionStore(password, key, value, metadata);
    }

    case "vault_retrieve": {
      const key    = String(args.key ?? "").trim();
      if (!key) return { error: "key is required." };
      const reveal = args.reveal === true;
      return actionRetrieve(password, key, reveal);
    }

    case "vault_list":
      return actionList(password);

    case "vault_delete": {
      const key = String(args.key ?? "").trim();
      if (!key) return { error: "key is required." };
      return actionDelete(password, key);
    }

    case "vault_rotate": {
      const key       = String(args.key       ?? "").trim();
      const new_value = String(args.new_value ?? "");
      if (!key)       return { error: "key is required."       };
      if (!new_value) return { error: "new_value is required." };
      return actionRotate(password, key, new_value);
    }

    case "vault_audit": {
      const limit = Math.min(100, Math.max(1, Number(args.limit ?? 20)));
      return actionAudit(password, limit);
    }

    default:
      return {
        error:
          `Unknown vault action: "${action}". ` +
          "Valid actions: vault_init, vault_store, vault_retrieve, " +
          "vault_list, vault_delete, vault_rotate, vault_audit.",
      };
  }
}
