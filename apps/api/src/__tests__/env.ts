// This file runs before all test modules via vitest setupFiles.
// Set env vars here before any module with side effects is imported.
delete process.env.DB_PATH; // no path = in-memory PGlite
process.env.NODE_ENV = 'test';
