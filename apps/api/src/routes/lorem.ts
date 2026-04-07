import { Hono } from 'hono';
import { z } from 'zod';
import { ok } from '@unclick/core';
import type { AppVariables } from '../middleware/types.js';
import { requireScope } from '../middleware/auth.js';
import { zv } from '../middleware/validate.js';

// ─── Word corpus ──────────────────────────────────────────────────────────────

const LOREM_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
  'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
  'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate', 'velit',
  'esse', 'cillum', 'eu', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
  'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
  'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum', 'perspiciatis', 'unde',
  'omnis', 'iste', 'natus', 'error', 'voluptatem', 'accusantium', 'doloremque',
  'laudantium', 'totam', 'rem', 'aperiam', 'eaque', 'ipsa', 'quae', 'ab', 'illo',
  'inventore', 'veritatis', 'quasi', 'architecto', 'beatae', 'vitae', 'dicta',
  'explicabo', 'nemo', 'ipsam', 'quia', 'voluptas', 'aspernatur', 'odit', 'fugit',
  'consequuntur', 'magni', 'dolores', 'eos', 'ratione', 'sequi', 'nesciunt',
  'neque', 'porro', 'quisquam', 'nihil', 'molestiae', 'illum', 'quo', 'minus',
  'aliis', 'expedita', 'distinctio', 'libero', 'tempore', 'cum', 'soluta', 'nobis',
  'eligendi', 'optio', 'cumque', 'nihilque', 'impedit', 'minus', 'quod', 'maxime',
  'placeat', 'facere', 'possimus', 'omnis', 'voluptas', 'assumenda', 'repellendus',
  'temporibus', 'autem', 'quibusdam', 'officiis', 'debitis', 'rerum', 'necessitatibus',
  'saepe', 'eveniet', 'voluptates', 'repudiandae', 'recusandae', 'itaque', 'earum',
  'hic', 'tenetur', 'sapiente', 'delectus', 'reiciendis', 'voluptatibus', 'maiores',
  'alias', 'perferendis', 'doloribus', 'asperiores', 'repellat', 'harum', 'quidem',
  'facilis', 'expedita', 'distinctio', 'nam', 'libero', 'tempore', 'cum', 'soluta',
];

// ─── Name / address data ──────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Edward', 'Fiona', 'George', 'Hannah',
  'Ivan', 'Julia', 'Kevin', 'Laura', 'Michael', 'Nancy', 'Oliver', 'Patricia',
  'Quinn', 'Robert', 'Sarah', 'Thomas', 'Uma', 'Victor', 'Wendy', 'Xavier',
  'Yolanda', 'Zachary', 'Amelia', 'Benjamin', 'Charlotte', 'Daniel', 'Eleanor',
  'Felix', 'Grace', 'Henry', 'Isabella', 'James', 'Katherine', 'Liam', 'Madison',
  'Nathan', 'Olivia', 'Peter', 'Rachel', 'Samuel', 'Tessa', 'Ursula', 'Vincent',
  'Willa', 'Xander', 'Yasmine', 'Zoe',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Martinez', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris',
  'Martin', 'Thompson', 'Young', 'Robinson', 'Lewis', 'Walker', 'Hall', 'Allen',
  'Wright', 'Scott', 'King', 'Green', 'Baker', 'Adams', 'Nelson', 'Carter',
  'Mitchell', 'Perez', 'Roberts', 'Turner', 'Phillips', 'Campbell', 'Parker',
  'Evans', 'Edwards', 'Collins', 'Stewart', 'Sanchez', 'Morris', 'Rogers', 'Reed',
  'Cook', 'Morgan', 'Bell', 'Murphy',
];

const EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'protonmail.com',
  'hotmail.com', 'fastmail.com', 'hey.com', 'mail.com', 'example.com',
];

const STREET_NAMES = [
  'Main St', 'Oak Ave', 'Elm St', 'Maple Dr', 'Cedar Ln', 'Pine Rd',
  'Walnut Blvd', 'Birch Way', 'Sunset Blvd', 'Highland Ave', 'Park Place',
  'Riverside Dr', 'Lake View Rd', 'Forest Trail', 'Washington Blvd', 'Lincoln Ave',
  'Jefferson St', 'Adams Rd', 'Madison Ave', 'Monroe Dr',
];

const CITIES = [
  'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
  'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville',
  'Fort Worth', 'Columbus', 'Charlotte', 'Indianapolis', 'San Francisco',
  'Seattle', 'Denver', 'Nashville', 'Portland', 'Las Vegas', 'Memphis',
  'Louisville', 'Baltimore',
];

const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

// ─── Generation helpers ───────────────────────────────────────────────────────

// Simple deterministic-ish pseudo-random using index cycling - stateless.
function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]!;
}

function pickWords(count: number, offset = 0): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(LOREM_WORDS[(offset + i) % LOREM_WORDS.length]!);
  }
  return out;
}

function buildSentence(wordCount: number, offset: number): string {
  const words = pickWords(wordCount, offset);
  words[0] = words[0]!.charAt(0).toUpperCase() + words[0]!.slice(1);
  return words.join(' ') + '.';
}

function buildParagraph(sentenceCount: number, offset: number): string {
  const sentences: string[] = [];
  let cursor = offset;
  for (let i = 0; i < sentenceCount; i++) {
    const wc = 8 + ((cursor * 7 + i * 3) % 10); // 8-17 words per sentence
    sentences.push(buildSentence(wc, cursor));
    cursor += wc;
  }
  return sentences.join(' ');
}

function generateWords(count: number): string[] {
  return pickWords(count, 0);
}

function generateSentences(count: number): string[] {
  const out: string[] = [];
  let offset = 0;
  for (let i = 0; i < count; i++) {
    const wc = 8 + (i * 7 % 10);
    out.push(buildSentence(wc, offset));
    offset += wc;
  }
  return out;
}

function generateParagraphs(count: number): string[] {
  const out: string[] = [];
  let offset = 0;
  for (let i = 0; i < count; i++) {
    const sc = 4 + (i % 4); // 4-7 sentences per paragraph
    out.push(buildParagraph(sc, offset));
    offset += sc * 12;
  }
  return out;
}

function generateText(targetLength: number): string {
  let text = '';
  let offset = 0;
  while (text.length < targetLength) {
    const sc = 4 + (offset % 4);
    const para = buildParagraph(sc, offset * 12);
    text += (text ? '\n\n' : '') + para;
    offset++;
  }
  return text.slice(0, targetLength);
}

function generateListItems(count: number): string[] {
  const items: string[] = [];
  for (let i = 0; i < count; i++) {
    const wc = 3 + (i % 5); // 3-7 words per item
    const words = pickWords(wc, i * 5);
    words[0] = words[0]!.charAt(0).toUpperCase() + words[0]!.slice(1);
    items.push(words.join(' '));
  }
  return items;
}

function generateName(index: number): { first: string; last: string; full: string } {
  const first = pick(FIRST_NAMES, index * 7);
  const last = pick(LAST_NAMES, index * 13);
  return { first, last, full: `${first} ${last}` };
}

function generateEmail(index: number): string {
  const first = pick(FIRST_NAMES, index * 7).toLowerCase();
  const last = pick(LAST_NAMES, index * 13).toLowerCase();
  const domain = pick(EMAIL_DOMAINS, index * 3);
  const sep = pick(['.', '_', ''], index);
  return `${first}${sep}${last}${index > 0 ? index : ''}@${domain}`;
}

function generateAddress(index: number): {
  street_number: number;
  street: string;
  city: string;
  state: string;
  zip: string;
  full: string;
} {
  const num = 100 + (index * 173 % 9900);
  const street = pick(STREET_NAMES, index * 11);
  const city = pick(CITIES, index * 7);
  const state = pick(STATES, index * 3);
  const zip = String(10000 + (index * 397 % 89999)).padStart(5, '0');
  return {
    street_number: num,
    street,
    city,
    state,
    zip,
    full: `${num} ${street}, ${city}, ${state} ${zip}`,
  };
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const ParagraphsSchema = z.object({
  count: z.number().int().min(1).max(50).default(3),
});

const SentencesSchema = z.object({
  count: z.number().int().min(1).max(200).default(5),
});

const WordsSchema = z.object({
  count: z.number().int().min(1).max(1000).default(50),
});

const TextSchema = z.object({
  length: z.number().int().min(1).max(100_000).default(500),
});

const ListSchema = z.object({
  count: z.number().int().min(1).max(500).default(10),
});

const NameSchema = z.object({
  count: z.number().int().min(1).max(100).default(1),
});

const EmailSchema = z.object({
  count: z.number().int().min(1).max(100).default(1),
});

const AddressSchema = z.object({
  count: z.number().int().min(1).max(100).default(1),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export function createLoremRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /lorem/paragraphs - N paragraphs of lorem ipsum
  router.post('/paragraphs', requireScope('lorem:use'), zv('json', ParagraphsSchema), (c) => {
    const { count } = c.req.valid('json');
    const paragraphs = generateParagraphs(count);
    return ok(c, {
      count,
      paragraphs,
      text: paragraphs.join('\n\n'),
    });
  });

  // POST /lorem/sentences - N lorem ipsum sentences
  router.post('/sentences', requireScope('lorem:use'), zv('json', SentencesSchema), (c) => {
    const { count } = c.req.valid('json');
    const sentences = generateSentences(count);
    return ok(c, {
      count,
      sentences,
      text: sentences.join(' '),
    });
  });

  // POST /lorem/words - N lorem ipsum words
  router.post('/words', requireScope('lorem:use'), zv('json', WordsSchema), (c) => {
    const { count } = c.req.valid('json');
    const words = generateWords(count);
    return ok(c, {
      count,
      words,
      text: words.join(' '),
    });
  });

  // POST /lorem/text - text of approximate character length
  router.post('/text', requireScope('lorem:use'), zv('json', TextSchema), (c) => {
    const { length } = c.req.valid('json');
    const text = generateText(length);
    return ok(c, {
      length: text.length,
      text,
    });
  });

  // POST /lorem/list - N list items (useful for mock data)
  router.post('/list', requireScope('lorem:use'), zv('json', ListSchema), (c) => {
    const { count } = c.req.valid('json');
    const items = generateListItems(count);
    return ok(c, {
      count,
      items,
    });
  });

  // POST /lorem/name - random fake names
  router.post('/name', requireScope('lorem:use'), zv('json', NameSchema), (c) => {
    const { count } = c.req.valid('json');
    const names = Array.from({ length: count }, (_, i) => generateName(i));
    return ok(c, {
      count,
      names: count === 1 ? undefined : names,
      ...(count === 1 ? names[0] : {}),
    });
  });

  // POST /lorem/email - random fake email addresses
  router.post('/email', requireScope('lorem:use'), zv('json', EmailSchema), (c) => {
    const { count } = c.req.valid('json');
    const emails = Array.from({ length: count }, (_, i) => generateEmail(i));
    return ok(c, {
      count,
      emails: count === 1 ? undefined : emails,
      ...(count === 1 ? { email: emails[0] } : {}),
    });
  });

  // POST /lorem/address - random fake addresses
  router.post('/address', requireScope('lorem:use'), zv('json', AddressSchema), (c) => {
    const { count } = c.req.valid('json');
    const addresses = Array.from({ length: count }, (_, i) => generateAddress(i));
    return ok(c, {
      count,
      addresses: count === 1 ? undefined : addresses,
      ...(count === 1 ? addresses[0] : {}),
    });
  });

  return router;
}
