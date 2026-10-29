import test from 'node:test';
import assert from 'node:assert/strict';

import * as plugin from '../lib/index.js';
import { buildReport, REPORT_SCHEMA } from '../lib/report.js';

test('plugin entry exposes a bundle host shape', () => {
  assert.equal(plugin.name, 'dsh-perf');
  assert.equal(typeof plugin.apply, 'function');
});

test('buildReport recommends a third-party high-cost, low-usage plugin', () => {
  const run = {
    id: 'run-1',
    name: 'smoke',
    durationMs: 1000,
    env: {},
    plugins: [
      { id: 'dsh-pocket-switch', ms: 40, count: 2 },
      { id: '@deepseek-ai/dsh-core', ms: 100, count: 1 },
    ],
    moduleLoad: [{ id: 'dsh-pocket-switch', ms: 6 }],
    frames: { count: 10, avg: 16, p95: 20, max: 30 },
    longFrames: [],
    totals: { unattributedMs: 2 },
  };
  const state = {
    plugins: [
      { id: 'dsh-pocket-switch', version: '0.1.0', dependents: [] },
      { id: '@deepseek-ai/dsh-core', version: '1.0.0', dependents: [] },
    ],
  };
  const config = { thresholds: { costMs: 20, moduleMs: 4 }, usage: {} };
  const report = buildReport(run, state, config);
  assert.equal(report.json.schema, REPORT_SCHEMA);
  assert.ok(report.json.recommendedLazy.includes('dsh-pocket-switch'));
  assert.match(report.markdown, /# DSH 性能报告/);
  assert.match(report.markdown, /recommended_lazy/);
  assert.match(report.markdown, /已知优化点/);
  assert.match(report.markdown, /已默认修复 ui-chat/);
});

test('buildReport never recommends the suite itself or built-in plugins', () => {
  const run = {
    id: 'run-2',
    name: 'self',
    durationMs: 10,
    env: {},
    plugins: [
      { id: 'dsh-perf', ms: 100, count: 3 },
      { id: '@deepseek-ai/dsh-core', ms: 100, count: 3 },
    ],
    moduleLoad: [],
  };
  const state = {
    plugins: [
      { id: 'dsh-perf', version: '0.1.0', dependents: [] },
      { id: '@deepseek-ai/dsh-core', version: '1.0.0', dependents: [] },
    ],
  };
  const report = buildReport(run, state, { thresholds: { costMs: 20, moduleMs: 4 }, usage: {} });
  assert.deepEqual(report.json.recommendedLazy, []);
});
