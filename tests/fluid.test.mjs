import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import vm from 'node:vm';

test('hidden canvas avoids GPU work and pointer NaN after restoring fluid', async () => {
  const source = await readFile(new URL('../src/client/fluid-shader.ts', import.meta.url), 'utf8');
  const compiled = await transform(source, { loader: 'ts', format: 'cjs' });
  const events = new Map();
  const uniforms = [];
  let drawCalls = 0;
  let nextFrame;
  const gl = new Proxy({}, { get(_, key) {
    if (String(key).startsWith('create')) return () => ({});
    if (key === 'getShaderParameter' || key === 'getProgramParameter') return () => true;
    if (key === 'getUniformLocation') return (_, name) => name;
    if (key === 'getAttribLocation') return () => 0;
    if (String(key).startsWith('uniform')) return (_, ...values) => uniforms.push(...values);
    if (key === 'drawArrays') return () => { drawCalls += 1; };
    return () => {};
  } });
  const canvas = { clientWidth: 100, clientHeight: 100, getContext: () => gl,
    getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; } };
  const module = { exports: {} };
  vm.runInNewContext(compiled.code, { module, exports: module.exports, console, Uint8Array, Float32Array,
    window: { devicePixelRatio: 1, matchMedia: () => ({ matches: false }), addEventListener: (key, fn) => events.set(key, fn), removeEventListener: key => events.delete(key) },
    navigator: { userAgent: 'Linux' }, performance: { now: () => 0 },
    requestAnimationFrame: fn => { nextFrame = fn; return 1; }, cancelAnimationFrame() {},
  });
  const handle = module.exports.attachFluidShader(canvas, module.exports.SITE_FLUID_PARAMS);
  nextFrame(40);
  const before = drawCalls;
  assert(before > 0);
  canvas.clientWidth = canvas.clientHeight = 0;
  events.get('mousemove')({ clientX: 50, clientY: 30 });
  nextFrame(80);
  assert.equal(drawCalls, before);
  canvas.clientWidth = canvas.clientHeight = 100;
  nextFrame(120);
  assert(drawCalls > before);
  assert(uniforms.every(Number.isFinite), 'Hidden pointer coordinates poisoned the shader');
  handle.dispose();
  assert(!events.has('mousemove'));
});
