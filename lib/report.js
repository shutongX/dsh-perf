export const REPORT_SCHEMA = 'dsh-perf-report/v1'
export const DEFAULT_THRESHOLDS = { costMs: 20, moduleMs: 4 }
export const USAGE_HINTS = {
  'dsh-better-sidebar': 'often',
  '@changfenhuang/dsh-genui': 'sometimes',
  'dsh-context': 'often',
  'dsh-mnemon': 'often',
  'dsh-plugin-message-edit': 'often',
  'dsh-edit-diff': 'often',
  'dsh-cost-meter': 'often',
  'dsh-chat-import': 'sometimes',
  '@nanmicoder/dsh-agent-teams': 'sometimes',
  'dsh-pet': 'sometimes',
  'dsh-pocket': 'sometimes',
  '@dsh-external/dsh-super-injector': 'sometimes',
  'dsh-pocket-switch': 'sometimes',
  'dsh-global-rules': 'sometimes',
}

const SHORT = (id) => String(id || '?').replace(/^@deepseek-ai\//, '').replace(/^@dsh-external\//, '').replace(/^@changfenhuang\//, '').replace(/^@nanmicoder\//, '')
const ROUND = (value) => Math.round((Number(value) || 0) * 10) / 10

function usageOf(id, config) {
  const explicit = config.usage && typeof config.usage === 'object' ? config.usage[id] : undefined
  if (explicit === 'often' || explicit === 'sometimes' || explicit === 'never') return { value: explicit, source: 'user' }
  if (id.startsWith('dsh-mnemon-source-')) return { value: 'often', source: 'heuristic' }
  return { value: USAGE_HINTS[id] || 'sometimes', source: 'heuristic' }
}

export function buildReport(run, state, config) {
  const thresholds = Object.assign({}, DEFAULT_THRESHOLDS, config.thresholds || {})
  const meta = new Map((state.plugins || []).map((plugin) => [plugin.id, plugin]))
  const cost = new Map((run.plugins || []).map((row) => [row.id, row]))
  const load = new Map((run.moduleLoad || []).map((row) => [row.id, row]))
  const rows = []
  const usage = {}
  for (const [id, plugin] of meta) {
    const builtin = id.startsWith('@deepseek-ai/')
    const self = id === 'dsh-perf'
    const deps = Array.isArray(plugin.dependents) ? plugin.dependents : []
    const blocked = deps.some((dep) => dep.startsWith('@deepseek-ai/') || dep === 'dsh-perf')
    const u = usageOf(id, config)
    usage[id] = u.value
    const measured = cost.get(id) ? Number(cost.get(id).ms) || 0 : 0
    const loaded = load.get(id) ? Number(load.get(id).ms) || 0 : 0
    const costHigh = measured >= thresholds.costMs || loaded >= thresholds.moduleMs
    const usageHigh = u.value === 'often'
    const eligible = !builtin && !self && !blocked
    const recommended = eligible && costHigh && !usageHigh
    const quadrant = usageHigh ? (costHigh ? 'high-high' : 'high-low') : (costHigh ? 'low-high' : 'low-low')
    rows.push({ id, short: SHORT(id), version: plugin.version || '', builtin, eligible, dependents: deps, usage: u.value, usageSource: u.source, measured: ROUND(measured), loaded: ROUND(loaded), count: cost.get(id) ? cost.get(id).count : 0, costHigh, usageHigh, recommended, quadrant })
  }
  rows.sort((a, b) => (b.measured + b.loaded) - (a.measured + a.loaded))
  const recommended = rows.filter((row) => row.recommended).map((row) => row.id)
  const keep = rows.filter((row) => row.eligible && row.costHigh && !row.recommended).map((row) => row.id)
  const neutral = rows.filter((row) => row.eligible && !row.costHigh).map((row) => row.id)
  const generatedAt = new Date().toISOString()
  const details = rows.map((row) => ({ id: row.id, usage: row.usage, measuredMs: row.measured, loadMs: row.loaded, count: row.count, quadrant: row.quadrant, eligible: row.eligible, recommended: row.recommended, builtin: row.builtin }))
  const machine = { schema: REPORT_SCHEMA, generatedAt, run: { id: run.id || '', name: run.name || '', durationMs: run.durationMs || 0 }, environment: run.env || {}, thresholds, usage, recommendedLazy: recommended, keepResident: keep, neutral, details, configHint: { disabled: recommended, usage }, caveats: ['Only third-party client plugins can be disabled.', 'Never disable built-in plugins or this suite.', 'Disable dependents together.', 'Reload after config changes.', 'Bundles may still be prefetched; the graph entry is what mounts.'] }
  const lines = []
  lines.push('# DSH 性能报告 - ' + (run.name || '未命名'))
  lines.push('')
  lines.push('生成时间：' + generatedAt)
  lines.push('记录时长：' + ROUND((run.durationMs || 0) / 1000) + 's')
  lines.push('')
  lines.push('## 0. 机器摘要（给 DSH / Agent）')
  lines.push('')
  lines.push('```yaml')
  lines.push('schema: ' + REPORT_SCHEMA)
  lines.push('run_id: ' + JSON.stringify(run.id || ''))
  lines.push('thresholds: ' + JSON.stringify(thresholds))
  lines.push('recommended_lazy: ' + JSON.stringify(recommended))
  lines.push('keep_resident: ' + JSON.stringify(keep))
  lines.push('neutral: ' + JSON.stringify(neutral))
  lines.push('details:')
  for (const row of details) lines.push('  - ' + JSON.stringify(row))
  lines.push('config_hint:')
  lines.push('  disabled: ' + JSON.stringify(recommended))
  lines.push('  usage: ' + JSON.stringify(usage))
  lines.push('```')
  lines.push('')
  lines.push('## 1. 测量结果')
  lines.push('')
  const frames = run.frames || {}
  const longFrames = Array.isArray(run.longFrames) ? run.longFrames : []
  lines.push('- 帧数：' + (frames.count || 0) + '，平均 ' + (frames.avg || 0) + 'ms，p95 ' + (frames.p95 || 0) + 'ms，最长 ' + (frames.max || 0) + 'ms')
  lines.push('- 长帧（>50ms）：' + longFrames.length)
  lines.push('- 未归因 JS：' + ((run.totals && run.totals.unattributedMs) || 0) + 'ms')
  lines.push('')
  lines.push('| 插件 | 版本 | 频率 | 记录耗时 | 模块加载 | 次数 | 四象限 | 建议 |')
  lines.push('|---|---:|---|---:|---:|---:|---|---|')
  for (const row of rows) {
    if (row.builtin && row.measured === 0 && row.loaded === 0) continue
    const advice = row.recommended ? '推荐按需加载' : (row.builtin ? '内置，保持' : (row.costHigh ? '保留，优先优化' : '保持常驻'))
    lines.push('| ' + row.short + ' | ' + row.version + ' | ' + row.usage + ' | ' + row.measured + 'ms | ' + row.loaded + 'ms | ' + row.count + ' | ' + row.quadrant + ' | ' + advice + ' |')
  }
  lines.push('')
  lines.push('## 2. 四象限')
  lines.push('')
  const q = (key) => rows.filter((row) => row.quadrant === key).map((row) => row.short + (row.recommended ? ' ★' : '')).join(', ') || '—'
  lines.push('| 象限 | 插件 |')
  lines.push('|---|---|')
  lines.push('| 常用 + 高开销 | ' + q('high-high') + ' |')
  lines.push('| 常用 + 低开销 | ' + q('high-low') + ' |')
  lines.push('| 不常用 + 高开销 | ' + q('low-high') + ' |')
  lines.push('| 不常用 + 低开销 | ' + q('low-low') + ' |')
  lines.push('')
  lines.push('## 3. 给 DSH / Agent 的优化方案设计指南')
  lines.push('')
  lines.push('规则：')
  lines.push('1. 只看第三方客户端插件；内置插件、本套件、被内置插件依赖的插件不能禁用。')
  lines.push('2. 使用频率优先用配置 usage，否则用报告估计值。')
  lines.push('3. 高开销 = 记录耗时 >= ' + thresholds.costMs + 'ms 或模块加载 >= ' + thresholds.moduleMs + 'ms。')
  lines.push('4. 只有不常用 + 高开销才推荐按需加载；常用插件保持常驻。')
  lines.push('5. 禁用 A 时，所有依赖 A 的插件也必须一起禁用。')
  lines.push('6. 配置写入后刷新页面生效。')
  lines.push('')
  lines.push('可直接采用的配置：')
  lines.push('')
  lines.push('```json')
  lines.push(JSON.stringify({ disabled: recommended, usage, chatScroll: false, reduceEffects: false }, null, 2))
  lines.push('```')
  lines.push('')
  lines.push('验证：改完后用「采集」再录一次同样的操作，对比 ui-chat 和目标插件耗时、帧 p95、长帧数量；变差就回滚。')
  lines.push('')
  return { markdown: lines.join('\n'), json: machine }
}
