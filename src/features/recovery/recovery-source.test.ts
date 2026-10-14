import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.test.ts') ? [] : path.endsWith('.ts') || path.endsWith('.tsx') ? [path] : [];
  });
}

describe('recovery source safety', () => {
  it('contains no generated or random values', () => {
    const source = sourceFiles(resolve(process.cwd(), 'src/features/recovery')).map((path) => readFileSync(path, 'utf8')).join('\n');
    expect(source).not.toContain(['Math', 'random'].join('.'));
    expect(source.toLowerCase()).not.toContain(['mo', 'ck'].join(''));
  });
});
