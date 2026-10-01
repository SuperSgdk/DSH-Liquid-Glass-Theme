// Maintainer-triggered sync after the user confirms a repair. No background watcher.
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const repositoryOrigin = 'https://github.com/SuperSgdk/DSH-Liquid-Glass-Theme.git';

function execute(cwd, program, args, inherit = false) {
  const result = spawnSync(program, args, { cwd, encoding: 'utf8', stdio: inherit ? 'inherit' : 'pipe' });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || `${program} ${args.join(' ')} failed: ${result.stderr || result.stdout || result.status}`);
  }
  return result.stdout ?? '';
}

function normalizeOrigin(value) {
  return value.trim().replace(/^git@github\.com:/, 'https://github.com/').replace(/\/?(?:\.git)?$/, '');
}

function pathList(output) {
  return output.split('\0').filter(Boolean);
}

function selectedPaths(files) {
  if (!Array.isArray(files) || files.length === 0) throw new Error('List the reviewed files with --files.');
  return new Set(files.map(file => {
    const path = file.replaceAll('\\', '/');
    if (!path || isAbsolute(path) || /^[a-z]:/i.test(path) || path.split('/').some(part => !part || part === '.' || part === '..') || /^\.(git|validation)(\/|$)/.test(path)) {
      throw new Error(`Use an explicit repository-relative file path: ${file}`);
    }
    return path;
  }));
}

function runChecks(root) {
  // When invoked through pnpm, reuse its exact runtime without shell interpolation.
  if (process.env.npm_execpath) {
    execute(root, process.execPath, [process.env.npm_execpath, 'run', 'check'], true);
  } else if (process.platform === 'win32') {
    execute(root, 'cmd.exe', ['/d', '/s', '/c', 'pnpm run check'], true);
  } else {
    execute(root, 'pnpm', ['run', 'check'], true);
  }
}

export function syncRepository({ root = repositoryRoot, files, message, confirmed = false, expectedOrigin = repositoryOrigin }) {
  if (confirmed !== true) throw new Error('User confirmation is required. Run checks before requesting it, then use --confirmed.');
  if (typeof message !== 'string' || !message.trim()) throw new Error('A commit message is required.');
  const selected = selectedPaths(files);
  const git = (...args) => execute(root, 'git', args);
  const head = () => git('rev-parse', 'HEAD').trim();
  const changedPaths = () => [...new Set([
    ...pathList(git('diff', '--name-only', '-z', 'HEAD', '--')),
    ...pathList(git('ls-files', '--others', '--exclude-standard', '-z')),
  ])];
  const checkScope = () => {
    const paths = changedPaths();
    const outside = paths.filter(path => !selected.has(path));
    if (outside.length) throw new Error(`Changes outside the reviewed file list: ${outside.join(', ')}. Isolate or review them first.`);
    return paths;
  };
  const fetchAndVerify = () => {
    git('fetch', 'origin', 'refs/heads/main:refs/remotes/origin/main');
    if (head() !== git('rev-parse', 'refs/remotes/origin/main').trim()) {
      throw new Error('Local main differs from GitHub main. Inspect existing commits and synchronize before creating a new commit.');
    }
  };

  if (relative(realpathSync.native(root), realpathSync.native(git('rev-parse', '--show-toplevel').trim())) !== '') throw new Error('Run from the repository root.');
  if (git('symbolic-ref', '--short', 'HEAD').trim() !== 'main') throw new Error('Automatic sync requires the main branch.');
  const originUrls = [git('remote', 'get-url', '--all', 'origin'), git('remote', 'get-url', '--push', '--all', 'origin')]
    .map(output => output.trim().split(/\r?\n/));
  if (originUrls.some(urls => urls.length !== 1 || normalizeOrigin(urls[0]) !== normalizeOrigin(expectedOrigin))) {
    throw new Error('Unexpected origin fetch or push URL.');
  }
  if (pathList(git('diff', '--cached', '--name-only', '-z')).length) throw new Error('The index already contains staged changes. Preserve and review them first.');
  checkScope();
  fetchAndVerify();
  const base = head();
  runChecks(root);
  if (head() !== base || git('symbolic-ref', '--short', 'HEAD').trim() !== 'main') throw new Error('HEAD or branch changed during checks.');
  if (pathList(git('diff', '--cached', '--name-only', '-z')).length) throw new Error('The index changed during checks.');
  const changed = checkScope();
  if (!changed.length) return { status: 'unchanged', sha: base };
  // Recheck the remote after tests; a later concurrent push is rejected normally.
  fetchAndVerify();
  git('add', '--', ...changed.map(path => `:(literal)${path}`));
  const staged = pathList(git('diff', '--cached', '--name-only', '-z'));
  if (staged.length !== changed.length || staged.some(path => !changed.includes(path))) throw new Error('Unexpected staged files; inspect the index before committing.');
  git('commit', '-m', message.trim());
  const sha = head();
  let pushError;
  try {
    git('push', '--no-follow-tags', 'origin', 'HEAD:refs/heads/main');
  } catch (error) {
    pushError = error;
  }
  // Even a failed/ambiguous push can have reached GitHub. Verify before retrying.
  try {
    const remoteHead = git('ls-remote', '--exit-code', 'origin', 'refs/heads/main').trim().split(/\s+/)[0];
    if (remoteHead !== sha) {
      git('fetch', 'origin', 'refs/heads/main:refs/remotes/origin/main');
      git('merge-base', '--is-ancestor', sha, 'refs/remotes/origin/main');
    }
  } catch (error) {
    throw new Error(`Commit ${sha} is saved locally. Push is not verified; inspect the remote before retrying. ${pushError?.message || error.message}`);
  }
  return { status: 'pushed', sha };
}

function parseArgs(args) {
  const options = { files: [], confirmed: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') continue;
    if (arg === '--confirmed') options.confirmed = true;
    else if (arg === '--message' && args[i + 1]) options.message = args[++i];
    else if (arg === '--files') {
      while (args[i + 1] && !args[i + 1].startsWith('--')) options.files.push(args[++i]);
    } else throw new Error(`Unknown or incomplete argument: ${arg}`);
  }
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = syncRepository(parseArgs(process.argv.slice(2)));
    console.log(result.status === 'pushed' ? `Verified GitHub main contains ${result.sha}. Check GitHub Actions separately.` : 'Checks passed; no changes to commit.');
  } catch (error) {
    console.error(`Sync stopped: ${error.message}`);
    process.exitCode = 1;
  }
}
