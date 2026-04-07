// ─── Pure-local tool implementations ────────────────────────────────────────
// These run entirely inside the MCP process — no API calls, no external deps.

// ══════════════════════════════════════════════════════════════════════════════
// TEXT COUNT
// ══════════════════════════════════════════════════════════════════════════════

export function countText(text: string) {
  const chars = text.length;
  const charsNoSpaces = text.replace(/\s/g, "").length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const sentences = text.trim()
    ? (text.match(/[^.!?]*[.!?]+(?:\s|$)/g) ?? []).length
    : 0;
  const lines = text.split("\n").length;
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim()).length || (text.trim() ? 1 : 0);
  return { chars, chars_no_spaces: charsNoSpaces, words, sentences, lines, paragraphs };
}

// ══════════════════════════════════════════════════════════════════════════════
// SLUG
// ══════════════════════════════════════════════════════════════════════════════

export function generateSlug(text: string, separator = "-"): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // strip diacritics
    .replace(/[^a-z0-9\s_-]/g, "")    // strip non-alphanumeric
    .trim()
    .replace(/[\s_-]+/g, separator);   // collapse whitespace/underscores/hyphens
}

// ══════════════════════════════════════════════════════════════════════════════
// LOREM IPSUM
// ══════════════════════════════════════════════════════════════════════════════

const LOREM_POOL = (
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor " +
  "incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud " +
  "exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure " +
  "reprehenderit voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur " +
  "sint occaecat cupidatat non proident sunt culpa officia deserunt mollit anim est " +
  "laborum perspiciatis unde omnis iste natus error accusantium doloremque laudantium " +
  "totam rem aperiam eaque ipsa quae ab inventore veritatis quasi architecto beatae " +
  "vitae dicta explicabo nemo voluptatem quia voluptas aspernatur odit fugit eos " +
  "consequuntur magni dolores ratione sequi nesciunt neque porro quisquam adipisci " +
  "numquam eius modi tempora quaerat saepe eveniet repellat asperiores maxime placeat " +
  "facilis expedita distinctio nam libero tempore soluta nobis optio cumque impedit " +
  "minus praesentium ullam corporis suscipit laboriosam aliquid commodi consequatur " +
  "quis autem vel eum iure reprehenderit voluptatem accusantium doloremque"
).split(" ");

function loremWord(i: number): string {
  return LOREM_POOL[Math.abs(i) % LOREM_POOL.length];
}

function loremSentence(offset: number, len: number): string {
  const words: string[] = [];
  for (let i = 0; i < len; i++) words.push(loremWord(offset + i * 3));
  const s = words.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

export function generateLorem(
  count: number,
  unit: "words" | "sentences" | "paragraphs",
  startWithLorem: boolean
): string {
  const prefix = startWithLorem ? "Lorem ipsum dolor sit amet. " : "";

  if (unit === "words") {
    const words: string[] = [];
    for (let i = 0; i < count; i++) words.push(loremWord(i + 5));
    const out = words.join(" ");
    return startWithLorem ? "Lorem ipsum " + out : out;
  }

  if (unit === "sentences") {
    const sentences: string[] = [];
    for (let i = 0; i < count; i++) {
      const len = 7 + (i * 4 % 9); // 7–15 words
      sentences.push(loremSentence(i * 11 + 5, len));
    }
    const out = sentences.join(" ");
    return startWithLorem && !out.startsWith("Lorem") ? prefix + out : out;
  }

  // paragraphs
  const paras: string[] = [];
  for (let p = 0; p < count; p++) {
    const sentCount = 3 + (p % 3); // 3–5 sentences
    const sentences: string[] = [];
    for (let s = 0; s < sentCount; s++) {
      const len = 8 + ((p * 5 + s * 3) % 10); // 8–17 words
      sentences.push(loremSentence(p * 50 + s * 13 + 5, len));
    }
    paras.push(sentences.join(" "));
  }
  const out = paras.join("\n\n");
  return startWithLorem && !out.startsWith("Lorem") ? prefix + out : out;
}

// ══════════════════════════════════════════════════════════════════════════════
// JWT DECODER
// ══════════════════════════════════════════════════════════════════════════════

export function decodeJwt(token: string) {
  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT: expected 3 dot-separated parts");
  }

  const b64urlDecode = (s: string): unknown => {
    const padded = s.replace(/-/g, "+").replace(/_/g, "/")
      .padEnd(s.length + ((4 - (s.length % 4)) % 4), "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  };

  const header = b64urlDecode(parts[0]) as Record<string, unknown>;
  const payload = b64urlDecode(parts[1]) as Record<string, unknown>;

  const result: Record<string, unknown> = {
    header,
    payload,
    signature: parts[2],
    warning: "Signature NOT verified — for inspection only",
  };

  if (typeof payload.iat === "number") {
    result.issued_at = new Date(payload.iat * 1000).toISOString();
  }
  if (typeof payload.exp === "number") {
    const expDate = new Date(payload.exp * 1000);
    result.expires_at = expDate.toISOString();
    result.expired = expDate < new Date();
    if (!result.expired) {
      const secsLeft = Math.floor((expDate.getTime() - Date.now()) / 1000);
      result.expires_in_seconds = secsLeft;
    }
  }
  if (typeof payload.nbf === "number") {
    result.not_before = new Date(payload.nbf * 1000).toISOString();
  }

  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// HTTP STATUS LOOKUP
// ══════════════════════════════════════════════════════════════════════════════

const HTTP_STATUSES: Record<number, { phrase: string; category: string; description: string }> = {
  // 1xx Informational
  100: { phrase: "Continue", category: "Informational", description: "The server has received the request headers and the client should proceed to send the request body." },
  101: { phrase: "Switching Protocols", category: "Informational", description: "The requester has asked the server to switch protocols and the server has agreed to do so." },
  102: { phrase: "Processing", category: "Informational", description: "The server has received and is processing the request, but no response is available yet." },
  103: { phrase: "Early Hints", category: "Informational", description: "Used to return some response headers before final HTTP message." },
  // 2xx Success
  200: { phrase: "OK", category: "Success", description: "Standard response for successful HTTP requests." },
  201: { phrase: "Created", category: "Success", description: "The request has been fulfilled, resulting in the creation of a new resource." },
  202: { phrase: "Accepted", category: "Success", description: "The request has been accepted for processing, but the processing has not been completed." },
  203: { phrase: "Non-Authoritative Information", category: "Success", description: "The server is a transforming proxy that received a 200 OK from its origin, but is returning a modified version." },
  204: { phrase: "No Content", category: "Success", description: "The server successfully processed the request and is not returning any content." },
  205: { phrase: "Reset Content", category: "Success", description: "The server successfully processed the request, asks that the requester reset its document view." },
  206: { phrase: "Partial Content", category: "Success", description: "The server is delivering only part of the resource due to a range header sent by the client." },
  207: { phrase: "Multi-Status", category: "Success", description: "The message body that follows is by default an XML message and can contain a number of separate response codes." },
  208: { phrase: "Already Reported", category: "Success", description: "The members of a DAV binding have already been enumerated in a preceding part of the response." },
  226: { phrase: "IM Used", category: "Success", description: "The server has fulfilled a request for the resource, and the response is a representation of the result." },
  // 3xx Redirection
  300: { phrase: "Multiple Choices", category: "Redirection", description: "Indicates multiple options for the resource from which the client may choose." },
  301: { phrase: "Moved Permanently", category: "Redirection", description: "This and all future requests should be directed to the given URI." },
  302: { phrase: "Found", category: "Redirection", description: "The resource is temporarily located at another URI." },
  303: { phrase: "See Other", category: "Redirection", description: "The response to the request can be found under another URI using the GET method." },
  304: { phrase: "Not Modified", category: "Redirection", description: "The resource has not been modified since the version specified by the request headers." },
  307: { phrase: "Temporary Redirect", category: "Redirection", description: "The request should be repeated with another URI; same method must be used." },
  308: { phrase: "Permanent Redirect", category: "Redirection", description: "The request and all future requests should be repeated using another URI; same method must be used." },
  // 4xx Client Error
  400: { phrase: "Bad Request", category: "Client Error", description: "The server cannot or will not process the request due to an apparent client error." },
  401: { phrase: "Unauthorized", category: "Client Error", description: "Authentication is required and has failed or has not yet been provided." },
  402: { phrase: "Payment Required", category: "Client Error", description: "Reserved for future use. Original intention: digital payment systems." },
  403: { phrase: "Forbidden", category: "Client Error", description: "The request contained valid data but the server is refusing action. User may not have necessary permissions." },
  404: { phrase: "Not Found", category: "Client Error", description: "The requested resource could not be found but may be available in the future." },
  405: { phrase: "Method Not Allowed", category: "Client Error", description: "A request method is not supported for the requested resource." },
  406: { phrase: "Not Acceptable", category: "Client Error", description: "The requested resource is capable of generating only content not acceptable according to the Accept headers." },
  407: { phrase: "Proxy Authentication Required", category: "Client Error", description: "The client must first authenticate itself with the proxy." },
  408: { phrase: "Request Timeout", category: "Client Error", description: "The server timed out waiting for the request." },
  409: { phrase: "Conflict", category: "Client Error", description: "Indicates that the request could not be processed because of conflict in the current state of the resource." },
  410: { phrase: "Gone", category: "Client Error", description: "The resource requested is no longer available and will not be available again." },
  411: { phrase: "Length Required", category: "Client Error", description: "The request did not specify the length of its content, which is required by the requested resource." },
  412: { phrase: "Precondition Failed", category: "Client Error", description: "The server does not meet one of the preconditions that the requester put on the request." },
  413: { phrase: "Content Too Large", category: "Client Error", description: "The request is larger than the server is willing or able to process." },
  414: { phrase: "URI Too Long", category: "Client Error", description: "The URI provided was too long for the server to process." },
  415: { phrase: "Unsupported Media Type", category: "Client Error", description: "The request entity has a media type which the server or resource does not support." },
  416: { phrase: "Range Not Satisfiable", category: "Client Error", description: "The client has asked for a portion of the file, but the server cannot supply that portion." },
  417: { phrase: "Expectation Failed", category: "Client Error", description: "The server cannot meet the requirements of the Expect request-header field." },
  418: { phrase: "I'm a Teapot", category: "Client Error", description: "The server refuses the attempt to brew coffee with a teapot. (RFC 2324, April Fools' joke — but real!)" },
  421: { phrase: "Misdirected Request", category: "Client Error", description: "The request was directed at a server that is not able to produce a response." },
  422: { phrase: "Unprocessable Content", category: "Client Error", description: "The request was well-formed but was unable to be followed due to semantic errors." },
  423: { phrase: "Locked", category: "Client Error", description: "The resource that is being accessed is locked." },
  424: { phrase: "Failed Dependency", category: "Client Error", description: "The request failed because it depended on another request and that request failed." },
  425: { phrase: "Too Early", category: "Client Error", description: "Indicates that the server is unwilling to risk processing a request that might be replayed." },
  426: { phrase: "Upgrade Required", category: "Client Error", description: "The client should switch to a different protocol." },
  428: { phrase: "Precondition Required", category: "Client Error", description: "The origin server requires the request to be conditional." },
  429: { phrase: "Too Many Requests", category: "Client Error", description: "The user has sent too many requests in a given amount of time (rate limiting)." },
  431: { phrase: "Request Header Fields Too Large", category: "Client Error", description: "The server is unwilling to process the request because its header fields are too large." },
  451: { phrase: "Unavailable For Legal Reasons", category: "Client Error", description: "A server operator has received a legal demand to deny access to a resource." },
  // 5xx Server Error
  500: { phrase: "Internal Server Error", category: "Server Error", description: "A generic error message when an unexpected condition was encountered on the server." },
  501: { phrase: "Not Implemented", category: "Server Error", description: "The server either does not recognize the request method, or it lacks the ability to fulfill it." },
  502: { phrase: "Bad Gateway", category: "Server Error", description: "The server was acting as a gateway or proxy and received an invalid response from the upstream server." },
  503: { phrase: "Service Unavailable", category: "Server Error", description: "The server cannot handle the request (overloaded or down for maintenance)." },
  504: { phrase: "Gateway Timeout", category: "Server Error", description: "The server was acting as a gateway or proxy and did not receive a timely response from upstream." },
  505: { phrase: "HTTP Version Not Supported", category: "Server Error", description: "The server does not support the HTTP version used in the request." },
  506: { phrase: "Variant Also Negotiates", category: "Server Error", description: "Transparent content negotiation for the request results in a circular reference." },
  507: { phrase: "Insufficient Storage", category: "Server Error", description: "The server is unable to store the representation needed to complete the request." },
  508: { phrase: "Loop Detected", category: "Server Error", description: "The server detected an infinite loop while processing a request." },
  510: { phrase: "Not Extended", category: "Server Error", description: "Further extensions to the request are required for the server to fulfil it." },
  511: { phrase: "Network Authentication Required", category: "Server Error", description: "The client needs to authenticate to gain network access." },
};

export function lookupHttpStatus(code: number) {
  const entry = HTTP_STATUSES[code];
  if (!entry) {
    // Try to give a category hint even for unknown codes
    const known = Object.keys(HTTP_STATUSES).map(Number).filter((c) => c === code);
    if (known.length === 0) {
      const range = Math.floor(code / 100) * 100;
      const categories: Record<number, string> = {
        100: "1xx Informational", 200: "2xx Success",
        300: "3xx Redirection",   400: "4xx Client Error", 500: "5xx Server Error",
      };
      return {
        code,
        known: false,
        category: categories[range] ?? "Unknown",
        message: `HTTP ${code} is not a well-known status code.`,
      };
    }
  }
  return {
    code,
    known: true,
    phrase: entry.phrase,
    category: entry.category,
    description: entry.description,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// EMOJI SEARCH
// ══════════════════════════════════════════════════════════════════════════════

interface EmojiEntry { emoji: string; name: string; keywords: string[] }

const EMOJI_DB: EmojiEntry[] = [
  { emoji: "😀", name: "grinning face", keywords: ["happy", "smile", "grin", "joy", "laugh"] },
  { emoji: "😂", name: "face with tears of joy", keywords: ["laugh", "cry", "funny", "lol", "tears"] },
  { emoji: "🥹", name: "face holding back tears", keywords: ["moved", "grateful", "emotional", "tears"] },
  { emoji: "😍", name: "smiling face with heart-eyes", keywords: ["love", "crush", "heart", "adore"] },
  { emoji: "🤔", name: "thinking face", keywords: ["think", "ponder", "wonder", "hmm", "question"] },
  { emoji: "😎", name: "smiling face with sunglasses", keywords: ["cool", "sunglasses", "awesome", "chill"] },
  { emoji: "😭", name: "loudly crying face", keywords: ["cry", "sad", "tears", "sob", "upset"] },
  { emoji: "😤", name: "face with steam from nose", keywords: ["angry", "frustrate", "huff", "triumph"] },
  { emoji: "🤯", name: "exploding head", keywords: ["mind blown", "shock", "amazed", "wow", "surprised"] },
  { emoji: "🥳", name: "partying face", keywords: ["party", "celebrate", "birthday", "congrats", "fun"] },
  { emoji: "😴", name: "sleeping face", keywords: ["sleep", "tired", "bored", "zzz", "rest"] },
  { emoji: "🤮", name: "face vomiting", keywords: ["sick", "gross", "disgusting", "vomit", "nausea"] },
  { emoji: "😷", name: "face with medical mask", keywords: ["sick", "mask", "covid", "ill", "health"] },
  { emoji: "🥶", name: "cold face", keywords: ["cold", "freeze", "ice", "winter", "chill"] },
  { emoji: "🥵", name: "hot face", keywords: ["hot", "heat", "summer", "sweat", "fire"] },
  { emoji: "❤️",  name: "red heart", keywords: ["love", "heart", "romance", "affection", "like"] },
  { emoji: "🔥", name: "fire", keywords: ["fire", "hot", "lit", "burn", "flame", "trending"] },
  { emoji: "⭐", name: "star", keywords: ["star", "favorite", "rating", "excellent", "night"] },
  { emoji: "✅", name: "check mark button", keywords: ["check", "done", "complete", "yes", "ok", "correct"] },
  { emoji: "❌", name: "cross mark", keywords: ["no", "wrong", "error", "fail", "cancel", "delete"] },
  { emoji: "⚠️",  name: "warning", keywords: ["warning", "caution", "alert", "danger", "careful"] },
  { emoji: "🚀", name: "rocket", keywords: ["launch", "rocket", "space", "fast", "startup", "ship"] },
  { emoji: "💡", name: "light bulb", keywords: ["idea", "light", "tip", "suggest", "bright", "bulb"] },
  { emoji: "🎉", name: "party popper", keywords: ["celebrate", "party", "congrats", "hooray", "confetti"] },
  { emoji: "🎯", name: "bullseye", keywords: ["target", "goal", "aim", "focus", "hit", "precise"] },
  { emoji: "🏆", name: "trophy", keywords: ["win", "award", "trophy", "champion", "first", "best"] },
  { emoji: "💯", name: "hundred points", keywords: ["100", "perfect", "score", "great", "fire"] },
  { emoji: "🔑", name: "key", keywords: ["key", "lock", "access", "password", "security"] },
  { emoji: "🛠️",  name: "hammer and wrench", keywords: ["tool", "fix", "build", "repair", "settings", "developer"] },
  { emoji: "📝", name: "memo", keywords: ["note", "write", "memo", "edit", "list", "document"] },
  { emoji: "📊", name: "bar chart", keywords: ["chart", "graph", "stats", "data", "analytics", "bar"] },
  { emoji: "📈", name: "chart increasing", keywords: ["up", "growth", "increase", "profit", "success", "chart"] },
  { emoji: "📉", name: "chart decreasing", keywords: ["down", "decrease", "loss", "drop", "chart"] },
  { emoji: "📦", name: "package", keywords: ["box", "package", "shipping", "deliver", "npm", "deploy"] },
  { emoji: "🔗", name: "link", keywords: ["link", "url", "chain", "connect", "href"] },
  { emoji: "🐛", name: "bug", keywords: ["bug", "error", "issue", "debug", "insect"] },
  { emoji: "💻", name: "laptop computer", keywords: ["laptop", "computer", "code", "work", "dev"] },
  { emoji: "📱", name: "mobile phone", keywords: ["phone", "mobile", "app", "ios", "android", "cell"] },
  { emoji: "🌐", name: "globe with meridians", keywords: ["web", "internet", "globe", "world", "global", "network"] },
  { emoji: "🔒", name: "locked", keywords: ["lock", "secure", "private", "closed", "auth"] },
  { emoji: "🔓", name: "unlocked", keywords: ["unlock", "open", "access", "free"] },
  { emoji: "👍", name: "thumbs up", keywords: ["like", "good", "agree", "yes", "approve", "ok"] },
  { emoji: "👎", name: "thumbs down", keywords: ["dislike", "bad", "no", "disagree", "disapprove"] },
  { emoji: "👀", name: "eyes", keywords: ["look", "see", "watch", "eye", "view"] },
  { emoji: "💪", name: "flexed biceps", keywords: ["strong", "muscle", "power", "flex", "strength"] },
  { emoji: "🙏", name: "folded hands", keywords: ["please", "thanks", "pray", "namaste", "grateful"] },
  { emoji: "🤝", name: "handshake", keywords: ["deal", "agree", "partner", "shake", "cooperate"] },
  { emoji: "👋", name: "waving hand", keywords: ["wave", "hello", "hi", "bye", "greet"] },
  { emoji: "🤦", name: "person facepalming", keywords: ["facepalm", "ugh", "frustrated", "embarrass", "duh"] },
  { emoji: "🤷", name: "person shrugging", keywords: ["shrug", "idk", "dunno", "whatever", "confused"] },
  { emoji: "🐱", name: "cat face", keywords: ["cat", "kitty", "meow", "pet", "animal"] },
  { emoji: "🐶", name: "dog face", keywords: ["dog", "puppy", "woof", "pet", "animal"] },
  { emoji: "🦊", name: "fox", keywords: ["fox", "animal", "clever", "sly"] },
  { emoji: "🦁", name: "lion", keywords: ["lion", "king", "animal", "brave", "courage"] },
  { emoji: "🐧", name: "penguin", keywords: ["penguin", "linux", "animal", "bird", "cold"] },
  { emoji: "🌟", name: "glowing star", keywords: ["star", "glow", "shine", "sparkle", "special"] },
  { emoji: "🌈", name: "rainbow", keywords: ["rainbow", "color", "pride", "bright", "hope"] },
  { emoji: "⚡", name: "lightning", keywords: ["lightning", "fast", "electric", "power", "energy", "speed"] },
  { emoji: "🌊", name: "water wave", keywords: ["wave", "ocean", "sea", "surf", "water"] },
  { emoji: "🍕", name: "pizza", keywords: ["pizza", "food", "eat", "italian", "slice"] },
  { emoji: "☕", name: "hot beverage", keywords: ["coffee", "tea", "hot", "drink", "morning", "cafe"] },
  { emoji: "🍺", name: "beer mug", keywords: ["beer", "drink", "alcohol", "cheers", "mug"] },
  { emoji: "🎵", name: "musical note", keywords: ["music", "note", "song", "sound", "melody"] },
  { emoji: "🎮", name: "video game", keywords: ["game", "play", "controller", "gaming", "video"] },
  { emoji: "📸", name: "camera with flash", keywords: ["photo", "camera", "picture", "snap", "flash"] },
  { emoji: "🗺️",  name: "world map", keywords: ["map", "world", "travel", "navigate", "geography"] },
  { emoji: "⏰", name: "alarm clock", keywords: ["alarm", "clock", "time", "wake", "schedule"] },
  { emoji: "📅", name: "calendar", keywords: ["calendar", "date", "schedule", "event", "plan"] },
  { emoji: "🔔", name: "bell", keywords: ["bell", "notify", "alert", "ring", "notification"] },
  { emoji: "🗑️",  name: "wastebasket", keywords: ["trash", "delete", "garbage", "bin", "remove"] },
  { emoji: "🔄", name: "counterclockwise arrows button", keywords: ["refresh", "reload", "sync", "update", "repeat"] },
  { emoji: "➕", name: "plus sign", keywords: ["add", "plus", "new", "create", "more"] },
  { emoji: "➖", name: "minus sign", keywords: ["remove", "minus", "subtract", "less"] },
  { emoji: "🔀", name: "shuffle tracks button", keywords: ["shuffle", "random", "mix", "sort"] },
  { emoji: "📌", name: "pushpin", keywords: ["pin", "mark", "important", "save", "note"] },
  { emoji: "🏠", name: "house", keywords: ["home", "house", "building", "live", "location"] },
  { emoji: "🌍", name: "globe showing europe-africa", keywords: ["earth", "world", "global", "planet", "globe"] },
  { emoji: "🧪", name: "test tube", keywords: ["test", "experiment", "lab", "science", "chemistry"] },
  { emoji: "🧩", name: "puzzle piece", keywords: ["puzzle", "piece", "fit", "solve", "integration"] },
  { emoji: "🎁", name: "wrapped gift", keywords: ["gift", "present", "surprise", "wrap", "birthday"] },
  { emoji: "🚨", name: "police car light", keywords: ["alert", "emergency", "siren", "warning", "critical"] },
  { emoji: "🏗️",  name: "building construction", keywords: ["build", "construct", "work in progress", "wip", "develop"] },
  { emoji: "🤖", name: "robot", keywords: ["robot", "bot", "ai", "automation", "machine"] },
];

export function searchEmoji(keyword: string, limit = 10): EmojiEntry[] {
  const q = keyword.toLowerCase().trim();
  if (!q) return EMOJI_DB.slice(0, limit);

  const scored: Array<{ entry: EmojiEntry; score: number }> = [];
  for (const entry of EMOJI_DB) {
    let score = 0;
    if (entry.name === q) score += 100;
    else if (entry.name.startsWith(q)) score += 50;
    else if (entry.name.includes(q)) score += 30;
    for (const kw of entry.keywords) {
      if (kw === q) score += 40;
      else if (kw.startsWith(q)) score += 20;
      else if (kw.includes(q)) score += 10;
    }
    if (score > 0) scored.push({ entry, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.entry);
}

// ══════════════════════════════════════════════════════════════════════════════
// USER AGENT PARSER
// ══════════════════════════════════════════════════════════════════════════════

export function parseUserAgent(ua: string) {
  const s = ua.trim();

  // Device type
  const isBot = /bot|crawl|spider|slurp|baiduspider|yandex|googlebot/i.test(s);
  const isMobile = !isBot && /mobile|android.*mobile|iphone|ipod|blackberry|windows phone/i.test(s);
  const isTablet = !isBot && !isMobile && /tablet|ipad|android(?!.*mobile)/i.test(s);
  const deviceType = isBot ? "bot" : isMobile ? "mobile" : isTablet ? "tablet" : "desktop";

  // OS
  let os = "Unknown";
  if (/windows nt 10/i.test(s)) os = "Windows 10/11";
  else if (/windows nt 6\.3/i.test(s)) os = "Windows 8.1";
  else if (/windows nt 6\.2/i.test(s)) os = "Windows 8";
  else if (/windows nt 6\.1/i.test(s)) os = "Windows 7";
  else if (/windows/i.test(s)) os = "Windows";
  else if (/mac os x ([\d_]+)/i.test(s)) {
    const m = s.match(/mac os x ([\d_]+)/i);
    os = `macOS ${m ? m[1].replace(/_/g, ".") : ""}`;
  }
  else if (/iphone os ([\d_]+)/i.test(s)) {
    const m = s.match(/iphone os ([\d_]+)/i);
    os = `iOS ${m ? m[1].replace(/_/g, ".") : ""}`;
  }
  else if (/ipad.*os ([\d_]+)/i.test(s)) {
    const m = s.match(/os ([\d_]+)/i);
    os = `iPadOS ${m ? m[1].replace(/_/g, ".") : ""}`;
  }
  else if (/android ([\d.]+)/i.test(s)) {
    const m = s.match(/android ([\d.]+)/i);
    os = `Android ${m ? m[1] : ""}`;
  }
  else if (/linux/i.test(s)) os = "Linux";
  else if (/cros/i.test(s)) os = "ChromeOS";

  // Browser
  let browser = "Unknown";
  let browserVersion = "";

  const extractVersion = (pattern: RegExp): string => {
    const m = s.match(pattern);
    return m ? m[1] : "";
  };

  if (/edg\/([\d.]+)/i.test(s)) {
    browser = "Edge";
    browserVersion = extractVersion(/edg\/([\d.]+)/i);
  } else if (/opr\/([\d.]+)|opera\/([\d.]+)/i.test(s)) {
    browser = "Opera";
    browserVersion = extractVersion(/(?:opr|opera)\/([\d.]+)/i);
  } else if (/chrome\/([\d.]+)/i.test(s) && !/chromium/i.test(s)) {
    browser = "Chrome";
    browserVersion = extractVersion(/chrome\/([\d.]+)/i);
  } else if (/firefox\/([\d.]+)/i.test(s)) {
    browser = "Firefox";
    browserVersion = extractVersion(/firefox\/([\d.]+)/i);
  } else if (/safari\/([\d.]+)/i.test(s) && /version\/([\d.]+)/i.test(s)) {
    browser = "Safari";
    browserVersion = extractVersion(/version\/([\d.]+)/i);
  } else if (/msie ([\d.]+)|trident.*rv:([\d.]+)/i.test(s)) {
    browser = "Internet Explorer";
    browserVersion = extractVersion(/(?:msie |rv:)([\d.]+)/i);
  } else if (/chromium\/([\d.]+)/i.test(s)) {
    browser = "Chromium";
    browserVersion = extractVersion(/chromium\/([\d.]+)/i);
  } else if (isBot) {
    const botMatch = s.match(/(\w+bot|\w+spider|\w+crawler)/i);
    browser = botMatch ? botMatch[1] : "Bot";
  }

  // Rendering engine
  let engine = "Unknown";
  if (/gecko\/[\d.]+/i.test(s) && /rv:[\d.]+/i.test(s)) engine = "Gecko";
  else if (/applewebkit\/([\d.]+)/i.test(s)) engine = "WebKit/Blink";
  else if (/trident\/([\d.]+)/i.test(s)) engine = "Trident";
  else if (/presto\/([\d.]+)/i.test(s)) engine = "Presto";

  return {
    browser,
    browser_version: browserVersion,
    os,
    device_type: deviceType,
    engine,
    is_mobile: isMobile,
    is_tablet: isTablet,
    is_bot: isBot,
    raw: ua,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// README TEMPLATE GENERATOR
// ══════════════════════════════════════════════════════════════════════════════

export function generateReadme(opts: {
  name: string;
  description: string;
  install?: string;
  usage?: string;
  language?: string;
  license?: string;
  repo?: string;
  badges?: boolean;
}): string {
  const {
    name,
    description,
    install,
    usage,
    language = "",
    license = "MIT",
    repo = "",
    badges = true,
  } = opts;

  const lines: string[] = [];

  // Title
  lines.push(`# ${name}`);
  lines.push("");

  // Badges
  if (badges && repo) {
    const [owner, repoName] = repo.replace(/^https?:\/\/github\.com\//, "").split("/");
    if (owner && repoName) {
      lines.push(`![License](https://img.shields.io/badge/license-${encodeURIComponent(license)}-blue.svg)`);
      lines.push(`![GitHub stars](https://img.shields.io/github/stars/${owner}/${repoName})`);
      lines.push("");
    }
  }

  // Description
  lines.push(`> ${description}`);
  lines.push("");

  // Table of contents
  const sections = ["Installation", "Usage", "License"];
  lines.push("## Table of Contents");
  for (const s of sections) {
    lines.push(`- [${s}](#${s.toLowerCase()})`);
  }
  lines.push("");

  // Installation
  lines.push("## Installation");
  lines.push("");
  if (install) {
    lines.push("```bash");
    lines.push(install);
    lines.push("```");
  } else {
    const installCmd = language === "python"
      ? `pip install ${name.toLowerCase()}`
      : language === "rust"
      ? `cargo add ${name.toLowerCase()}`
      : language === "go"
      ? `go get ${repo || `github.com/owner/${name.toLowerCase()}`}`
      : `npm install ${name.toLowerCase()}`;
    lines.push("```bash");
    lines.push(installCmd);
    lines.push("```");
  }
  lines.push("");

  // Usage
  lines.push("## Usage");
  lines.push("");
  if (usage) {
    const ext = language === "python" ? "python"
      : language === "rust" ? "rust"
      : language === "go" ? "go"
      : "javascript";
    lines.push(`\`\`\`${ext}`);
    lines.push(usage);
    lines.push("```");
  } else {
    lines.push("<!-- Add usage examples here -->");
  }
  lines.push("");

  // Contributing
  lines.push("## Contributing");
  lines.push("");
  lines.push("Contributions are welcome! Please open an issue or submit a pull request.");
  lines.push("");

  // License
  lines.push("## License");
  lines.push("");
  lines.push(`This project is licensed under the **${license}** License.`);
  if (repo) lines.push(`See [LICENSE](${repo}/blob/main/LICENSE) for details.`);
  lines.push("");

  return lines.join("\n");
}

// ══════════════════════════════════════════════════════════════════════════════
// CHANGELOG ENTRY GENERATOR
// ══════════════════════════════════════════════════════════════════════════════

export function generateChangelog(opts: {
  version: string;
  date?: string;
  added?: string[];
  changed?: string[];
  deprecated?: string[];
  removed?: string[];
  fixed?: string[];
  security?: string[];
}): string {
  const {
    version,
    date = new Date().toISOString().slice(0, 10),
    added = [],
    changed = [],
    deprecated = [],
    removed = [],
    fixed = [],
    security = [],
  } = opts;

  const lines: string[] = [];
  lines.push(`## [${version}] - ${date}`);
  lines.push("");

  const section = (title: string, items: string[]) => {
    if (items.length === 0) return;
    lines.push(`### ${title}`);
    for (const item of items) {
      lines.push(`- ${item.startsWith("- ") ? item.slice(2) : item}`);
    }
    lines.push("");
  };

  section("Added", added);
  section("Changed", changed);
  section("Deprecated", deprecated);
  section("Removed", removed);
  section("Fixed", fixed);
  section("Security", security);

  if (lines[lines.length - 1] === "") lines.pop(); // trim trailing blank line

  return lines.join("\n");
}

// ══════════════════════════════════════════════════════════════════════════════
// FAVICON URL
// ══════════════════════════════════════════════════════════════════════════════

export function getFaviconUrls(input: string) {
  // Normalise: strip protocol, path, etc.
  let domain = input.trim().replace(/^https?:\/\//i, "").split("/")[0].split("?")[0];
  if (!domain) throw new Error("Could not parse domain from input");

  const directUrl = `https://${domain}/favicon.ico`;
  const googleUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  const duckUrl = `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`;

  return {
    domain,
    favicon_ico: directUrl,
    google_favicon_api: googleUrl,
    duckduckgo_favicon_api: duckUrl,
    note: "favicon_ico may return 404 if the site uses a non-standard location. The Google/DuckDuckGo URLs reliably return an icon for most domains.",
  };
}
