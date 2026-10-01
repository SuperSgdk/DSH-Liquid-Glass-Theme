import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, readlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('Windows installer migrates, backs up and stays idempotent', { skip: process.platform !== 'win32' }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'liquidglass-test-'));
  try {
    const home = join(dir, 'home');
    const profile = join(home, 'profiles', 'web');
    const source = join(dir, 'source');
    await mkdir(profile, { recursive: true });
    await mkdir(join(source, 'lib'), { recursive: true });
    await writeFile(join(source, 'package.json'), JSON.stringify({ name: 'dsh-liquid-glass-theme' }));
    for (const file of ['lib/client.js', 'lib/index.js', 'LICENSE', 'NOTICE']) await writeFile(join(source, file), 'fixture');
    const manifest = JSON.stringify({ private: true, dependencies: { unrelated: '1.0.0', '@deepseek-ai/dsh-client-ui-aqua': 'link:old' } });
    const legacyPatch = "# Keep this comment\n- insert:\n    - id: client-ui-aqua\n      name: '@deepseek-ai/dsh-client-ui-aqua'\n";
    await writeFile(join(profile, 'package.json'), manifest);
    await writeFile(join(profile, 'cordis.patch.yml'), legacyPatch);
    const installer = fileURLToPath(new URL('../install.ps1', import.meta.url));
    const run = () => {
      const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', installer, '-Source', source, '-DshHome', home], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stdout + result.stderr);
    };
    run();
    run();
    const patch = await readFile(join(profile, 'cordis.patch.yml'), 'utf8');
    assert(patch.includes('# Keep this comment'));
    assert.equal((patch.match(/name: 'dsh-liquid-glass-theme'/g) ?? []).length, 1);
    assert(!patch.includes('@deepseek-ai/dsh-client-ui-aqua'));
    const updated = JSON.parse((await readFile(join(profile, 'package.json'), 'utf8')).replace(/^\uFEFF/, ''));
    assert.equal(updated.dependencies.unrelated, '1.0.0');
    assert(!updated.dependencies['@deepseek-ai/dsh-client-ui-aqua']);
    assert.equal(updated.dependencies['dsh-liquid-glass-theme'], 'link:' + source.replaceAll('\\', '/'));
    assert((await readlink(join(profile, 'node_modules', 'dsh-liquid-glass-theme'))).includes('source'));
    const backups = await readdir(join(profile, 'backups'));
    assert.equal(backups.length, 2);
    assert.equal(await readFile(join(profile, 'backups', backups.sort()[0], 'cordis.patch.yml'), 'utf8'), legacyPatch);
    await writeFile(join(profile, 'cordis.patch.yml'), '# Initial profile\n[]\n');
    run();
    const firstInstall = await readFile(join(profile, 'cordis.patch.yml'), 'utf8');
    assert(firstInstall.includes('# Initial profile'));
    assert(!firstInstall.includes('[]'));
    assert(firstInstall.includes('- insert:'));
  } finally {
    assert(dir.startsWith(join(tmpdir(), 'liquidglass-test-')));
    await rm(dir, { recursive: true, force: true });
  }
});
