#!/usr/bin/env bun

/**
 * Test script for the intelligent grouping feature
 * Usage: bun scripts/test-grouping.ts
 */

import { spawn } from 'child_process';

const AI_BINARY = process.env.AI_BINARY || 'opencode';
const AI_MODEL = process.env.AI_MODEL || 'anthropic/claude-sonnet-4-5-20250929';
const PR_LINK = 'https://github.com/holistics/holistics/pull/15321';

function buildGroupingPrompt(prLink: string): string {
  // Extract PR number and repo from the link
  const match = prLink.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  const repo = match ? match[1] : '';
  const prNumber = match ? match[2] : '';
  
  return `Analyze GitHub PR and group files logically.

Step 1: Run this command to get PR files:
gh pr view ${prNumber} --repo ${repo} --json files,additions,deletions

Step 2: Group the files by purpose (e.g. "UI Components", "Store Logic", "Tests", "Config").

Step 3: Return ONLY this XML format (no other text):

<grouping>
<group>
<id>group-1</id>
<title>Title here</title>
<summary>What this group does</summary>
<files>
<file path="path/to/file.ts" additions="10" deletions="5"/>
</files>
</group>
</grouping>

Rules:
- Each file appears in only one group
- Use actual additions/deletions from gh output
- Return ONLY the XML, nothing else`;
}

function runOpencode(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Running: ${AI_BINARY} ${args.slice(0, 3).join(' ')} "<prompt>"\n`);
    
    const proc = spawn(AI_BINARY, args, {
      stdio: ['ignore', 'pipe', 'pipe'],  // ignore stdin to prevent blocking
    });

    let stdout = '';
    let stderr = '';
    let resolved = false;

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text); // Stream output in real-time
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text); // Stream errors in real-time
    });

    proc.on('close', (code) => {
      if (resolved) return;
      resolved = true;
      
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`opencode exited with code ${code}: ${stderr || stdout}`));
      }
    });

    proc.on('error', (error) => {
      if (resolved) return;
      resolved = true;
      reject(error);
    });

    // Set timeout manually
    const timeoutId = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      proc.kill('SIGTERM');
      reject(new Error('opencode timed out after 5 minutes'));
    }, 300000);

    proc.on('close', () => {
      clearTimeout(timeoutId);
    });
  });
}

function parseGroupingOutput(output: string) {
  // Find XML content in the output
  const xmlMatch = output.match(/<grouping>[\s\S]*<\/grouping>/);
  
  if (!xmlMatch) {
    console.error('\n❌ No XML grouping found in output');
    console.error('Output preview:', output.slice(0, 500));
    return { groups: [] };
  }
  
  const xmlContent = xmlMatch[0];
  console.log('\n✅ Found XML grouping:\n');
  console.log(xmlContent);
  
  // Parse groups
  const groups: Array<{
    id: string;
    title: string;
    summary: string;
    files: string[];
    totalAdditions: number;
    totalDeletions: number;
  }> = [];
  
  const groupMatches = xmlContent.matchAll(/<group>([\s\S]*?)<\/group>/g);
  
  for (const match of groupMatches) {
    const groupContent = match[1];
    
    const idMatch = groupContent.match(/<id>(.*?)<\/id>/);
    const id = idMatch ? idMatch[1].trim() : `group-${groups.length + 1}`;
    
    const titleMatch = groupContent.match(/<title>(.*?)<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : 'Unnamed Group';
    
    const summaryMatch = groupContent.match(/<summary>(.*?)<\/summary>/);
    const summary = summaryMatch ? summaryMatch[1].trim() : '';
    
    const files: string[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;
    
    const fileMatches = groupContent.matchAll(/<file\s+path="([^"]+)"\s+additions="(\d+)"\s+deletions="(\d+)"(?:\s*\/>|>.*?<\/file>)/g);
    
    for (const fileMatch of fileMatches) {
      files.push(fileMatch[1]);
      totalAdditions += parseInt(fileMatch[2], 10);
      totalDeletions += parseInt(fileMatch[3], 10);
    }
    
    // Handle alternative file format
    if (files.length === 0) {
      const simpleFileMatches = groupContent.matchAll(/<file>(.*?)<\/file>/g);
      for (const fileMatch of simpleFileMatches) {
        files.push(fileMatch[1].trim());
      }
    }
    
    groups.push({
      id,
      title,
      summary,
      files,
      totalAdditions,
      totalDeletions,
    });
  }
  
  return { groups };
}

async function main() {
  console.log('='.repeat(60));
  console.log('🧪 Testing Intelligent Grouping Feature');
  console.log('='.repeat(60));
  console.log(`\n📋 PR Link: ${PR_LINK}`);
  console.log(`🤖 Model: ${AI_MODEL}`);
  console.log(`💻 Binary: ${AI_BINARY}`);
  
  const prompt = buildGroupingPrompt(PR_LINK);
  
  try {
    const stdout = await runOpencode([
      'run',
      '-m', AI_MODEL,
      prompt
    ]);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Parsing Results');
    console.log('='.repeat(60));
    
    const result = parseGroupingOutput(stdout);
    
    console.log('\n' + '='.repeat(60));
    console.log('📦 Parsed Groups');
    console.log('='.repeat(60));
    
    if (result.groups.length === 0) {
      console.log('\n❌ No groups parsed from output');
    } else {
      console.log(`\n✅ Found ${result.groups.length} groups:\n`);
      for (const group of result.groups) {
        console.log(`📁 ${group.title} (${group.id})`);
        console.log(`   Summary: ${group.summary}`);
        console.log(`   Files: ${group.files.length}`);
        console.log(`   Changes: +${group.totalAdditions} -${group.totalDeletions}`);
        for (const file of group.files) {
          console.log(`     - ${file}`);
        }
        console.log('');
      }
    }
    
    console.log('='.repeat(60));
    console.log('✅ Test completed successfully!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
