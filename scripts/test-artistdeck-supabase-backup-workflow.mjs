import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const workflowPath = new URL('../.github/workflows/artistdeck-supabase-backup.yml', import.meta.url);
const workflow = await readFile(workflowPath, 'utf8');

const validationLine = workflow.split('\n').find((line) => line.includes('const isSessionPooler'));
assert.equal(
  validationLine?.trim(),
  'const isSessionPooler = /^aws-[a-z0-9-]+\\.pooler\\.supabase\\.com$/i.test(url.hostname);',
  'Workflow must use literal-dot hostname validation for the Supabase Session Pooler.',
);

const sessionPoolerHost = /^aws-[a-z0-9-]+\.pooler\.supabase\.com$/i;
for (const hostname of ['aws-0-eu-west-1.pooler.supabase.com', 'AWS-1-US-EAST-1.POOLER.SUPABASE.COM']) {
  assert.equal(sessionPoolerHost.test(hostname), true, 'Expected valid Session Pooler hostname: ' + hostname);
}
for (const hostname of ['db.ezmphpcytohigfdtfvzm.supabase.co', 'aws-0-eu-west-1.pooler.supabase.com.evil.test', 'aws_0_eu.pooler.supabase.com']) {
  assert.equal(sessionPoolerHost.test(hostname), false, 'Expected invalid Session Pooler hostname: ' + hostname);
}

assert.match(
  workflow,
  /\(\n\s+cd "\$artifact_dir"\n\s+sha256sum "\$archive_name" > "\$work_dir\/\$archive_name\.sha256"\n\s+\)/,
  'Workflow must create a portable checksum record using only the archive filename.',
);

const checksumTool = process.platform === 'darwin'
  ? { command: 'shasum', baseArgs: ['-a', '256'] }
  : { command: 'sha256sum', baseArgs: [] };
const sourceDir = await mkdtemp(join(tmpdir(), 'artistdeck-backup-checksum-source-'));
const downloadDir = await mkdtemp(join(tmpdir(), 'artistdeck-backup-checksum-download-'));
const archiveName = 'artistdeck-supabase-fixture.tar.gz.age';
const checksumName = archiveName + '.sha256';

try {
  const sourceArchive = join(sourceDir, archiveName);
  await writeFile(sourceArchive, 'encrypted backup fixture');
  const checksum = execFileSync(checksumTool.command, [...checksumTool.baseArgs, archiveName], {
    cwd: sourceDir,
    encoding: 'utf8',
  });
  assert.equal(checksum.includes(sourceDir), false, 'Checksum record must not contain its source directory.');
  await writeFile(join(sourceDir, checksumName), checksum);
  await copyFile(sourceArchive, join(downloadDir, archiveName));
  await copyFile(join(sourceDir, checksumName), join(downloadDir, checksumName));
  execFileSync(checksumTool.command, [...checksumTool.baseArgs, '-c', checksumName], {
    cwd: downloadDir,
    stdio: 'pipe',
  });
} finally {
  await rm(sourceDir, { recursive: true, force: true });
  await rm(downloadDir, { recursive: true, force: true });
}

console.log('Backup workflow static checks passed using ' + checksumTool.command + '.');
