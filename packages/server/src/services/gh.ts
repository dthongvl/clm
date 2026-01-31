import { exec } from 'child_process';
import { promisify } from 'util';
import type { PRInfo, FileDiff } from '../types/index.js';

const execAsync = promisify(exec);

export async function checkGhCli(): Promise<boolean> {
  try {
    await execAsync('gh --version');
    return true;
  } catch {
    return false;
  }
}

export async function getPRInfo(prNumber: number, repo?: string): Promise<PRInfo> {
  const repoFlag = repo ? `--repo ${repo}` : '';
  const command = `gh pr view ${prNumber} ${repoFlag} --json number,title,author,body,baseRefName,headRefName`;
  
  const { stdout } = await execAsync(command);
  const data = JSON.parse(stdout);
  
  return {
    number: data.number,
    title: data.title,
    author: data.author.login || data.author,
    description: data.body || '',
    baseBranch: data.baseRefName,
    headBranch: data.headRefName,
    repo: repo || '',
  };
}

export async function getPRDiff(prNumber: number, repo?: string): Promise<FileDiff[]> {
  const repoFlag = repo ? `--repo ${repo}` : '';
  const command = `gh pr diff ${prNumber} ${repoFlag}`;
  
  const { stdout } = await execAsync(command);
  
  // Parse the diff output to extract file changes
  const files: FileDiff[] = [];
  const diffSections = stdout.split('diff --git');
  
  for (const section of diffSections.slice(1)) {
    const lines = section.trim().split('\n');
    const fileLine = lines[0];
    const match = fileLine.match(/a\/(.+) b\/(.+)/);
    
    if (match) {
      const filename = match[2];
      let status: FileDiff['status'] = 'modified';
      
      if (section.includes('new file mode')) {
        status = 'added';
      } else if (section.includes('deleted file mode')) {
        status = 'removed';
      } else if (section.includes('rename from')) {
        status = 'renamed';
      }
      
      const patch = 'diff --git' + section;
      const additions = (section.match(/^\+[^+]/gm) || []).length;
      const deletions = (section.match(/^-[^-]/gm) || []).length;
      
      files.push({
        filename,
        status,
        additions,
        deletions,
        patch,
      });
    }
  }
  
  return files;
}

export async function getFileContent(
  filename: string,
  branch: string,
  repo?: string
): Promise<string> {
  const repoFlag = repo ? `--repo ${repo}` : '';
  
  try {
    const command = `gh api repos/{owner}/{repo}/contents/${filename}?ref=${branch}`;
    const { stdout } = await execAsync(`${command} ${repoFlag}`);
    const data = JSON.parse(stdout);
    
    if (data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    return '';
  } catch {
    return '';
  }
}

export async function postComment(
  prNumber: number,
  body: string,
  commitId?: string,
  path?: string,
  line?: number,
  repo?: string
): Promise<void> {
  const repoFlag = repo ? `--repo ${repo}` : '';
  
  if (path && line) {
    // Review comment on a specific line
    const command = `gh api repos/{owner}/{repo}/pulls/${prNumber}/comments \
      -f body="${body}" \
      -f commit_id="${commitId}" \
      -f path="${path}" \
      -f line=${line}`;
    await execAsync(`${command} ${repoFlag}`);
  } else {
    // General PR comment
    const command = `gh pr comment ${prNumber} ${repoFlag} --body "${body}"`;
    await execAsync(command);
  }
}

export async function getCurrentRepo(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('gh repo view --json nameWithOwner -q .nameWithOwner');
    return stdout.trim();
  } catch {
    return null;
  }
}
