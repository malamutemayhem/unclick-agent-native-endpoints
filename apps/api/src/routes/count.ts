import { Hono } from 'hono';
import { z } from 'zod';
import { ok } from '@unclick/core';
import { zv } from '../middleware/validate.js';
import { requireScope } from '../middleware/auth.js';
import type { AppVariables } from '../middleware/types.js';

const TextSchema = z.object({
  text: z.string().max(1_000_000),
  words_per_minute: z.number().int().min(1).max(10_000).default(200),
});

function countText(text: string, wpm: number) {
  const charCount = text.length;
  const charNoSpaces = text.replace(/\s/g, '').length;

  // Words: split on whitespace, filter empty tokens
  const words = text.trim() === '' ? [] : text.trim().split(/\s+/);
  const wordCount = words.length;

  // Sentences: split on .!? followed by whitespace or end of string
  const sentences = text.trim() === '' ? [] : text.trim().split(/[.!?]+(?:\s+|$)/).filter((s) => s.trim().length > 0);
  const sentenceCount = sentences.length;

  // Paragraphs: split on one or more blank lines
  const paragraphs = text.trim() === '' ? [] : text.trim().split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const paragraphCount = paragraphs.length;

  // Reading time: words / wpm, rounded to nearest second
  const readingTimeSec = Math.max(1, Math.round((wordCount / wpm) * 60));
  const readingTimeMin = wordCount === 0 ? 0 : Math.ceil(wordCount / wpm);

  return {
    characters: charCount,
    characters_no_spaces: charNoSpaces,
    words: wordCount,
    sentences: sentenceCount,
    paragraphs: paragraphCount,
    reading_time: {
      words_per_minute: wpm,
      seconds: readingTimeSec,
      minutes: readingTimeMin,
      display: readingTimeMin < 1 ? 'less than a minute' : readingTimeMin === 1 ? '1 minute' : `${readingTimeMin} minutes`,
    },
  };
}

export function createCountRouter() {
  const router = new Hono<{ Variables: AppVariables }>();

  // POST /count/text — count words, characters, sentences, paragraphs + reading time
  router.post('/text', requireScope('count:use'), zv('json', TextSchema), (c) => {
    const { text, words_per_minute } = c.req.valid('json');
    return ok(c, countText(text, words_per_minute));
  });

  return router;
}
