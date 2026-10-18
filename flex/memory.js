import fs from 'node:fs/promises';
import path from 'node:path';

export class MemoryStore {
  constructor(file = process.env.FLEX_MEMORY_FILE || 'flex-memory.json') {
    const rootDir = path.resolve('./data');
    const candidate = path.resolve(rootDir, String(file || 'flex-memory.json'));
    const safePrefix = rootDir.endsWith(path.sep) ? rootDir : rootDir + path.sep;
    this.file = (candidate === rootDir || candidate.startsWith(safePrefix))
      ? candidate
      : path.join(rootDir, 'flex-memory.json');
    this.items = [];
  }

  async init() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    try { this.items = JSON.parse(await fs.readFile(this.file, 'utf8')); }
    catch { this.items = []; }
  }

  async add(item) {
    this.items.push({ ...item, createdAt: new Date().toISOString() });
    if (this.items.length > 500) this.items = this.items.slice(-500);
    await fs.writeFile(this.file, JSON.stringify(this.items, null, 2));
  }

  search(query, limit = 6) {
    const words = String(query).toLowerCase().split(/\W+/).filter(Boolean);
    return this.items
      .map((item) => ({ item, score: words.reduce((n, word) => n + (JSON.stringify(item).toLowerCase().includes(word) ? 1 : 0), 0) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item }) => item);
  }

  stats() { return { count: this.items.length, file: this.file }; }
}
