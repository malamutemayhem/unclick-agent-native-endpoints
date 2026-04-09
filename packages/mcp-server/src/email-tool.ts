// ─── Universal Email Tool ─────────────────────────────────────────────────────
// Sending via Nodemailer (SMTP) + reading/managing via node-imap (IMAP).
// Credentials fall back to SMTP_USER/SMTP_PASS and IMAP_USER/IMAP_PASS env vars.

import nodemailer from "nodemailer";
import Imap from "imap";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SmtpArgs {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
}

interface ImapArgs {
  imap_host: string;
  imap_user: string;
  imap_pass: string;
  imap_port?: number;
  imap_tls?: boolean;
}

interface EmailMessage {
  uid: number;
  subject: string;
  from: string;
  to: string;
  date: string;
  flags: string[];
  body?: string;
}

// ─── SMTP helpers ─────────────────────────────────────────────────────────────

function getSmtpArgs(args: Record<string, unknown>): SmtpArgs {
  const smtp_host = String(args.smtp_host ?? process.env.SMTP_HOST ?? "").trim();
  const smtp_user = String(args.smtp_user ?? process.env.SMTP_USER ?? "").trim();
  const smtp_pass = String(args.smtp_pass ?? process.env.SMTP_PASS ?? "").trim();
  const smtp_port = Number(args.smtp_port ?? process.env.SMTP_PORT ?? 587);
  if (!smtp_host) throw new Error("smtp_host is required (or set SMTP_HOST env).");
  if (!smtp_user) throw new Error("smtp_user is required (or set SMTP_USER env).");
  if (!smtp_pass) throw new Error("smtp_pass is required (or set SMTP_PASS env).");
  return { smtp_host, smtp_port, smtp_user, smtp_pass };
}

// ─── IMAP helpers ─────────────────────────────────────────────────────────────

function getImapArgs(args: Record<string, unknown>): ImapArgs {
  const imap_host = String(args.imap_host ?? process.env.IMAP_HOST ?? "").trim();
  const imap_user = String(args.imap_user ?? process.env.IMAP_USER ?? "").trim();
  const imap_pass = String(args.imap_pass ?? process.env.IMAP_PASS ?? "").trim();
  const imap_port = Number(args.imap_port ?? process.env.IMAP_PORT ?? 993);
  const imap_tls  = args.imap_tls !== false; // default true
  if (!imap_host) throw new Error("imap_host is required (or set IMAP_HOST env).");
  if (!imap_user) throw new Error("imap_user is required (or set IMAP_USER env).");
  if (!imap_pass) throw new Error("imap_pass is required (or set IMAP_PASS env).");
  return { imap_host, imap_user, imap_pass, imap_port, imap_tls };
}

function makeImap(cfg: ImapArgs): Imap {
  return new Imap({
    user:     cfg.imap_user,
    password: cfg.imap_pass,
    host:     cfg.imap_host,
    port:     cfg.imap_port ?? 993,
    tls:      cfg.imap_tls ?? true,
    tlsOptions: { rejectUnauthorized: false },
    authTimeout: 10000,
    connTimeout: 15000,
  });
}

function imapConnect(imap: Imap): Promise<void> {
  return new Promise((resolve, reject) => {
    imap.once("ready",   () => resolve());
    imap.once("error",   (err: Error) => reject(err));
    imap.once("end",     () => reject(new Error("IMAP connection ended unexpectedly.")));
    imap.connect();
  });
}

function imapOpenBox(imap: Imap, folder: string, readOnly = false): Promise<Imap.Box> {
  return new Promise((resolve, reject) => {
    imap.openBox(folder, readOnly, (err, box) => {
      if (err) reject(err);
      else resolve(box);
    });
  });
}

function imapFetchMessages(
  imap: Imap,
  source: string | number[],
  opts: Imap.FetchOptions
): Promise<EmailMessage[]> {
  return new Promise((resolve, reject) => {
    const messages: EmailMessage[] = [];
    let fetch: Imap.ImapFetch;
    try {
      fetch = imap.fetch(source, opts);
    } catch (err) {
      return reject(err);
    }

    fetch.on("message", (msg, seqno) => {
      const message: Partial<EmailMessage> & { uid: number } = { uid: seqno };
      const bodyChunks: Buffer[] = [];

      msg.on("body", (stream) => {
        stream.on("data", (chunk: Buffer) => bodyChunks.push(chunk));
        stream.on("end", () => {
          const raw = Buffer.concat(bodyChunks).toString("utf8");
          // Extract key headers from raw message
          const getHeader = (name: string): string => {
            const match = raw.match(new RegExp(`^${name}:\\s*(.+)`, "im"));
            return match ? match[1].trim() : "";
          };
          message.subject = message.subject || getHeader("Subject");
          message.from    = message.from    || getHeader("From");
          message.to      = message.to      || getHeader("To");
          message.date    = message.date    || getHeader("Date");
          // Include a snippet of the body (strip headers)
          const bodyStart = raw.indexOf("\r\n\r\n");
          if (bodyStart !== -1) {
            message.body = raw.slice(bodyStart + 4, bodyStart + 500).trim() || undefined;
          }
        });
      });

      msg.once("attributes", (attrs) => {
        message.uid   = attrs.uid ?? seqno;
        message.flags = (attrs.flags ?? []) as string[];
        // Also parse date/subject from envelope if available
        const env = attrs.envelope as Record<string, unknown> | undefined;
        if (env) {
          message.subject = message.subject || String(env.subject ?? "");
          message.date    = message.date    || String(env.date ?? "");
          const fromArr = env.from as Array<Record<string, string>> | undefined;
          if (fromArr?.[0]) {
            message.from = message.from ||
              `${fromArr[0].name ?? ""} <${fromArr[0].mailbox}@${fromArr[0].host}>`.trim();
          }
          const toArr = env.to as Array<Record<string, string>> | undefined;
          if (toArr?.[0]) {
            message.to = message.to ||
              `${toArr[0].name ?? ""} <${toArr[0].mailbox}@${toArr[0].host}>`.trim();
          }
        }
      });

      msg.once("end", () => {
        messages.push(message as EmailMessage);
      });
    });

    fetch.once("error", reject);
    fetch.once("end", () => resolve(messages));
  });
}

function imapSearch(imap: Imap, criteria: unknown[]): Promise<number[]> {
  return new Promise((resolve, reject) => {
    imap.search(criteria, (err, results) => {
      if (err) reject(err);
      else resolve(results ?? []);
    });
  });
}

function imapAddFlags(imap: Imap, uid: number, flags: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    imap.addFlags(String(uid), flags, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function imapMove(imap: Imap, uid: number, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    imap.move(String(uid), dest, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// ─── Operations ──────────────────────────────────────────────────────────────

export async function sendEmail(args: Record<string, unknown>): Promise<unknown> {
  const { smtp_host, smtp_port, smtp_user, smtp_pass } = getSmtpArgs(args);

  const from    = String(args.from ?? smtp_user).trim();
  const to      = Array.isArray(args.to) ? args.to.map(String) : [String(args.to ?? "")];
  const subject = String(args.subject ?? "").trim();
  const body    = String(args.body ?? "").trim();
  const isHtml  = args.html === true || /<[a-z][\s\S]*>/i.test(body);

  if (!to[0]) throw new Error("to is required (array of email addresses).");
  if (!subject) throw new Error("subject is required.");
  if (!body)    throw new Error("body is required.");

  const transporter = nodemailer.createTransport({
    host:   smtp_host,
    port:   smtp_port,
    secure: smtp_port === 465,
    auth:   { user: smtp_user, pass: smtp_pass },
  });

  const mailOptions: nodemailer.SendMailOptions = {
    from,
    to:      to.join(", "),
    subject,
    ...(isHtml ? { html: body } : { text: body }),
  };

  if (args.cc) {
    mailOptions.cc = Array.isArray(args.cc)
      ? args.cc.map(String).join(", ")
      : String(args.cc);
  }
  if (args.bcc) {
    mailOptions.bcc = Array.isArray(args.bcc)
      ? args.bcc.map(String).join(", ")
      : String(args.bcc);
  }

  const info = await transporter.sendMail(mailOptions);

  return {
    success:    true,
    message_id: info.messageId,
    accepted:   info.accepted,
    rejected:   info.rejected,
  };
}

export async function readInbox(args: Record<string, unknown>): Promise<unknown> {
  const cfg    = getImapArgs(args);
  const folder = String(args.folder ?? "INBOX");
  const limit  = Math.min(50, Math.max(1, Number(args.limit ?? 10)));
  const unreadOnly = args.unread_only === true;

  const imap = makeImap(cfg);
  await imapConnect(imap);

  try {
    await imapOpenBox(imap, folder, true);
    const criteria: unknown[] = unreadOnly ? ["UNSEEN"] : ["ALL"];
    const uids = await imapSearch(imap, criteria);

    if (uids.length === 0) {
      return { folder, total: 0, messages: [] };
    }

    const recent = uids.slice(-limit);
    const messages = await imapFetchMessages(imap, recent, {
      bodies:   "HEADER.FIELDS (FROM TO SUBJECT DATE)",
      envelope: true,
      struct:   false,
    });

    return {
      folder,
      total:    uids.length,
      fetched:  messages.length,
      messages: messages.reverse(),
    };
  } finally {
    imap.end();
  }
}

export async function searchEmail(args: Record<string, unknown>): Promise<unknown> {
  const cfg   = getImapArgs(args);
  const folder = String(args.folder ?? "INBOX");
  const query  = String(args.query ?? "").trim();
  if (!query) throw new Error("query is required.");

  const criteria: unknown[] = [];
  // Support subject: or from: prefixes, otherwise search subject
  if (query.toLowerCase().startsWith("from:")) {
    criteria.push(["FROM", query.slice(5).trim()]);
  } else if (query.toLowerCase().startsWith("subject:")) {
    criteria.push(["SUBJECT", query.slice(8).trim()]);
  } else {
    criteria.push(["SUBJECT", query]);
  }

  if (args.since_date) {
    criteria.push(["SINCE", new Date(String(args.since_date))]);
  }

  const imap = makeImap(cfg);
  await imapConnect(imap);

  try {
    await imapOpenBox(imap, folder, true);
    const uids = await imapSearch(imap, criteria.length > 0 ? criteria : [["ALL"]]);

    if (uids.length === 0) {
      return { query, folder, total: 0, messages: [] };
    }

    const messages = await imapFetchMessages(imap, uids.slice(-20), {
      bodies:   "HEADER.FIELDS (FROM TO SUBJECT DATE)",
      envelope: true,
      struct:   false,
    });

    return {
      query,
      folder,
      total:    uids.length,
      messages: messages.reverse(),
    };
  } finally {
    imap.end();
  }
}

export async function getEmail(args: Record<string, unknown>): Promise<unknown> {
  const cfg = getImapArgs(args);
  const uid = Number(args.uid);
  if (!uid) throw new Error("uid is required.");
  const folder = String(args.folder ?? "INBOX");

  const imap = makeImap(cfg);
  await imapConnect(imap);

  try {
    await imapOpenBox(imap, folder, true);
    const messages = await imapFetchMessages(imap, [uid], {
      bodies:   "",
      envelope: true,
      struct:   false,
    });

    if (messages.length === 0) {
      return { error: `Email with UID ${uid} not found.` };
    }

    return messages[0];
  } finally {
    imap.end();
  }
}

export async function markRead(args: Record<string, unknown>): Promise<unknown> {
  const cfg = getImapArgs(args);
  const uid = Number(args.uid);
  if (!uid) throw new Error("uid is required.");
  const folder = String(args.folder ?? "INBOX");

  const imap = makeImap(cfg);
  await imapConnect(imap);

  try {
    await imapOpenBox(imap, folder, false);
    await imapAddFlags(imap, uid, ["\\Seen"]);
    return { success: true, uid, message: `Email ${uid} marked as read.` };
  } finally {
    imap.end();
  }
}

export async function deleteEmail(args: Record<string, unknown>): Promise<unknown> {
  if (args.must_confirm !== true) {
    throw new Error(
      "Destructive action: pass must_confirm=true to confirm email deletion."
    );
  }

  const cfg  = getImapArgs(args);
  const uid  = Number(args.uid);
  if (!uid) throw new Error("uid is required.");
  const folder = String(args.folder ?? "INBOX");

  const imap = makeImap(cfg);
  await imapConnect(imap);

  try {
    await imapOpenBox(imap, folder, false);

    // Try to move to Trash; fall back to flagging as deleted
    const trashFolders = ["Trash", "[Gmail]/Trash", "INBOX.Trash", "Deleted Items"];
    let moved = false;

    for (const trash of trashFolders) {
      try {
        await imapMove(imap, uid, trash);
        moved = true;
        break;
      } catch {
        // Try next candidate
      }
    }

    if (!moved) {
      await imapAddFlags(imap, uid, ["\\Deleted"]);
      await new Promise<void>((resolve, reject) => {
        imap.expunge((err) => (err ? reject(err) : resolve()));
      });
    }

    return {
      success: true,
      uid,
      message: moved
        ? `Email ${uid} moved to Trash.`
        : `Email ${uid} permanently deleted.`,
    };
  } finally {
    imap.end();
  }
}

// ─── Public dispatcher ────────────────────────────────────────────────────────

export async function emailAction(
  action: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (action) {
    case "send_email":    return sendEmail(args);
    case "read_inbox":    return readInbox(args);
    case "search_email":  return searchEmail(args);
    case "get_email":     return getEmail(args);
    case "mark_read":     return markRead(args);
    case "delete_email":  return deleteEmail(args);
    default:
      return {
        error:
          `Unknown email action: "${action}". ` +
          "Valid: send_email, read_inbox, search_email, get_email, mark_read, delete_email.",
      };
  }
}
