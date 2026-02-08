import { BoundedStore } from '../utils/bounded-store.js';

interface PRContext {
  baseRef: string;
  headRef: string;
  updatedAt: string;
}

const prContextStore = new BoundedStore<string, PRContext>({
  maxSize: 200,
  ttlMs: 60 * 60 * 1000,
});

function buildKey(repo: string, prNumber: number): string {
  return `${repo}:${prNumber}`;
}

export function setPRContext(repo: string, prNumber: number, baseRef: string, headRef: string): void {
  prContextStore.set(buildKey(repo, prNumber), {
    baseRef,
    headRef,
    updatedAt: new Date().toISOString(),
  });
}

export function getPRContext(repo: string, prNumber: number): PRContext | undefined {
  return prContextStore.get(buildKey(repo, prNumber));
}
