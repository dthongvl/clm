interface AppContext {
  prNumber: number;
  repo: string;
}

let context: AppContext | null = null;

export function initAppContext(): void {
  const prNumber = parseInt(process.env.PR_NUMBER || '', 10);
  const repo = process.env.REPO || '';

  if (!prNumber || isNaN(prNumber)) {
    throw new Error('PR_NUMBER environment variable is required');
  }

  if (!repo) {
    throw new Error('REPO environment variable is required');
  }

  context = { prNumber, repo };
}

export function getAppContext(): AppContext {
  if (!context) {
    throw new Error('App context not initialized. Call initAppContext() first.');
  }
  return context;
}
