import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { apply, AQUA_SETTINGS_NAMESPACE } from '../lib/index.js';

const require = createRequire(import.meta.url);
test('Host registers a valid namespace through the current settings service', () => {
  let registered;
  apply({ inject(names, callback) {
    assert.deepEqual(names, ['settings']);
    callback({ settings: { register(ns, schema) { registered = ns; assert.deepEqual(schema({}), {}); } } });
  } });
  assert.equal(registered, AQUA_SETTINGS_NAMESPACE);
  assert.match(registered, /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
});

test('rebuilt client factory requests only declared platform modules', async () => {
  let registration;
  const moduleIds = [];
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, { window: { __ModuleLoader__: { load(row) { registration = row; } } } });
  assert.equal(registration.id, 'dsh-liquid-glass-theme');
  const face = registration.factory(id => {
    moduleIds.push(id);
    // The icon's DOM rendering is exercised in the browser integration check.
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return { IconCheckOutline16() {} };
    if (id === '@deepseek-ai/dsh-client-store') return { defineStore(definition) { return definition; } };
    return require(id);
  });
  assert.equal(typeof face.apply, 'function');
  assert.deepEqual(Array.from(face.inject), ['theme', 'slots', 'locale']);
  assert(moduleIds.includes('@deepseek-ai/dsh-client-store'));
  assert(!moduleIds.some(id => id.includes('dsh-client-runtime')));
});
