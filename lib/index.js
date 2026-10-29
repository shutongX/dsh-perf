import { readFile, writeFile, mkdir, readdir, stat, unlink } from 'node:fs/promises'
import { readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { buildReport, USAGE_HINTS, DEFAULT_THRESHOLDS } from './report.js'

export const name = 'dsh-perf'

const HOME_ENV = 'DSH_HOME'
const BOOTSTRAP_ID = '@deepseek-ai/dsh-client-modules'
const SELF_ID = 'dsh-perf'
const SELF_IDS = new Set([SELF_ID, '@dsh-external/dsh-perf'])
const LEGACY_IDS = new Set(['@dsh-external/dsh-perf-meter', '@dsh-external/dsh-perf-tuner'])
const MAX_RUN_BODY = 8 * 1024 * 1024
const MAX_CONFIG_BODY = 1024 * 1024
const MAX_CSS = 200000
const MAX_JS = 100000

function resolveHome() {
  const configured = process.env[HOME_ENV]
  const chosen = configured !== undefined && configured.trim().length > 0 ? configured : join(homedir(), '.dsh')
  return resolve(chosen)
}

function resolveProfileDir(home) {
  const configured = process.env.DSH_PROFILE_DIR
  if (configured !== undefined && configured.trim().length > 0) return resolve(configured)
  return join(home, 'profiles', process.env.DSH_PROFILE || 'desktop')
}

function storageDir(home) { return join(home, 'storages', 'dsh-perf') }
function configFile(home) { return join(storageDir(home), 'config.json') }
function runsDir(home) { return join(storageDir(home), 'runs') }
function reportsDir(home) { return join(storageDir(home), 'reports') }

function defaults() {
  return {
    version: 2,
    disabled: [],
    chatScroll: false,
    reduceEffects: false,
    throttle: { enabled: false, minIntervalMs: 10000, onlyHidden: false },
    customCss: '',
    customJs: '',
    usage: {},
    thresholds: { ...DEFAULT_THRESHOLDS },
    launcher: { enabled: true, x: null, y: null },
  }
}

function stringList(value, limit) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const text = item.trim()
    if (text.length === 0 || text.length > 200 || out.includes(text)) continue
    out.push(text)
    if (out.length >= limit) break
  }
  return out
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

function usageMap(value) {
  const out = {}
  if (value === null || typeof value !== 'object') return out
  for (const [id, level] of Object.entries(value)) {
    if (typeof id !== 'string' || id.length > 200) continue
    if (level === 'often' || level === 'sometimes' || level === 'never') out[id] = level
  }
  return out
}

function sanitizeConfig(input) {
  const base = defaults()
  if (input === null || typeof input !== 'object') return base
  const throttle = input.throttle !== null && typeof input.throttle === 'object' ? input.throttle : {}
  const thresholds = input.thresholds !== null && typeof input.thresholds === 'object' ? input.thresholds : {}
  const launcher = input.launcher !== null && typeof input.launcher === 'object' ? input.launcher : {}
  const launcherX = Number(launcher.x)
  const launcherY = Number(launcher.y)
  return {
    version: 2,
    disabled: stringList(input.disabled, 200),
    chatScroll: input.chatScroll === true,
    reduceEffects: input.reduceEffects === true,
    throttle: {
      enabled: throttle.enabled === true,
      minIntervalMs: clampNumber(throttle.minIntervalMs, 1000, 600000, 10000),
      onlyHidden: throttle.onlyHidden === true,
    },
    customCss: typeof input.customCss === 'string' ? input.customCss.slice(0, MAX_CSS) : '',
    customJs: typeof input.customJs === 'string' ? input.customJs.slice(0, MAX_JS) : '',
    usage: usageMap(input.usage),
    thresholds: {
      costMs: clampNumber(thresholds.costMs, 1, 100000, DEFAULT_THRESHOLDS.costMs),
      moduleMs: clampNumber(thresholds.moduleMs, 1, 100000, DEFAULT_THRESHOLDS.moduleMs),
    },
    launcher: {
      enabled: launcher.enabled !== false,
      x: Number.isFinite(launcherX) ? clampNumber(launcherX, -10000, 10000, null) : null,
      y: Number.isFinite(launcherY) ? clampNumber(launcherY, -10000, 10000, null) : null,
    },
  }
}

let cache = { mtime: 0, value: null }
function readConfigSync(file) {
  try {
    const info = statSync(file)
    if (cache.value !== null && info.mtimeMs === cache.mtime) return cache.value
    const parsed = sanitizeConfig(JSON.parse(readFileSync(file, 'utf8')))
    cache = { mtime: info.mtimeMs, value: parsed }
    return parsed
  } catch (error) {
    return defaults()
  }
}
async function readConfig(file) {
  try { return sanitizeConfig(JSON.parse(await readFile(file, 'utf8'))) } catch (error) { return defaults() }
}
async function writeConfig(file, config) {
  await mkdir(join(file, '..'), { recursive: true })
  await writeFile(file, JSON.stringify(config, null, 2), 'utf8')
  cache = { mtime: 0, value: null }
}

function json(status, payload) {
  return Response.json(payload, { status, headers: { 'cache-control': 'no-store' } })
}
function messageOf(error) { return String((error && error.message) || error) }
function safeId(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value) }
function stripClientSuffix(id) { return String(id).replace(/\/client$/, '') }

function escapeForScript(value) { return JSON.stringify(value).replace(/</g, '\\u003c') }

function bootCode(file) {
  try { return readFileSync(file, 'utf8') } catch (error) { console.error('dsh-perf: missing boot script', file, error); return '' }
}

function dependentsOf(graph, id) {
  const out = []
  if (graph === null || typeof graph !== 'object' || !Array.isArray(graph.entries)) return out
  for (const entry of graph.entries) {
    if (entry === null || typeof entry !== 'object' || !Array.isArray(entry.inject)) continue
    for (const dep of entry.inject) {
      if (typeof dep !== 'string') continue
      if (dep === id || stripClientSuffix(dep) === id) { out.push(entry.id); break }
    }
  }
  return out
}

function filterBootGraph(html, disabled) {
  const set = new Set(disabled)
  if (set.size === 0) return html
  const pattern = /globalThis\["__DSH_BOOT__"\] = (\{[\s\S]*?\})<\/script>/
  const match = html.match(pattern)
  if (match === null) return html
  let graph
  try { graph = JSON.parse(match[1]) } catch (error) { return html }
  if (graph === null || typeof graph !== 'object' || !Array.isArray(graph.entries)) return html
  const known = new Set(graph.entries.map((entry) => entry && entry.id).filter((id) => typeof id === 'string'))
  const safe = new Set([...set].filter((id) => known.has(id) && id !== BOOTSTRAP_ID && !SELF_IDS.has(id) && !id.startsWith('@deepseek-ai/')))
  let dropped = true
  while (dropped && safe.size > 0) {
    dropped = false
    for (const id of [...safe]) {
      for (const dependent of dependentsOf(graph, id)) {
        if (!safe.has(dependent)) { safe.delete(id); dropped = true; break }
      }
    }
  }
  if (safe.size === 0) return html
  const before = graph.entries.length
  graph.entries = graph.entries.filter((entry) => entry && !safe.has(entry.id))
  if (Array.isArray(graph.batches)) {
    graph.batches = graph.batches.map((batch) => {
      if (batch === null || typeof batch !== 'object' || !Array.isArray(batch.entries)) return batch
      return { ...batch, entries: batch.entries.filter((id) => !safe.has(id)) }
    }).filter((batch) => batch && Array.isArray(batch.entries) && batch.entries.length > 0)
  }
  if (graph.entries.length === before) return html
  const serialized = JSON.stringify(graph).replace(/</g, '\\u003c')
  return html.replace(match[0], 'globalThis["__DSH_BOOT__"] = ' + serialized + '</script>')
}

function injectBoot(html, config, meter, tuner) {
  if (html.indexOf('data-dsh-perf-suite-meter=') >= 0) return html
  if (meter.length === 0 || tuner.length === 0) return html
  const payload = escapeForScript(config)
  const tag = '<script data-dsh-perf-suite-config="1">globalThis.__DSH_PERF_TUNE__ = ' + payload + ';</script>' +
    '<script data-dsh-perf-suite-meter="1">' + meter + '</script>' +
    '<script data-dsh-perf-suite-tune="1">' + tuner + '</script>'
  return html.replace('</head>', tag + '\n</head>')
}

async function packageMeta(profileDir, id) {
  try {
    const parts = id.startsWith('@') ? id.split('/') : [id]
    const pkg = JSON.parse(await readFile(join(profileDir, 'node_modules', ...parts, 'package.json'), 'utf8'))
    return { version: typeof pkg.version === 'string' ? pkg.version : '', description: typeof pkg.description === 'string' ? pkg.description : '' }
  } catch (error) {
    return { version: '', description: '' }
  }
}

async function buildState(home, getGraph) {
  const profileDir = resolveProfileDir(home)
  const config = await readConfig(configFile(home))
  const graph = typeof getGraph === 'function' ? getGraph() : null
  const entries = graph && Array.isArray(graph.entries) ? graph.entries : []
  const plugins = []
  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object' || typeof entry.id !== 'string') continue
    if (LEGACY_IDS.has(entry.id)) continue
    const meta = await packageMeta(profileDir, entry.id)
    plugins.push({
      id: entry.id,
      rev: entry.rev || '',
      inject: Array.isArray(entry.inject) ? entry.inject : [],
      immediate: entry.immediately === true,
      bootstrap: entry.id === BOOTSTRAP_ID,
      version: meta.version,
      description: meta.description,
      dependents: dependentsOf(graph, entry.id),
      disabled: config.disabled.includes(entry.id),
    })
  }
  plugins.sort((a, b) => {
    const ao = a.id.startsWith('@deepseek-ai/') ? 1 : 0
    const bo = b.id.startsWith('@deepseek-ai/') ? 1 : 0
    if (ao !== bo) return ao - bo
    return a.id.localeCompare(b.id)
  })
  const latest = await latestRun(runsDir(home))
  return {
    config,
    plugins,
    usageHints: USAGE_HINTS,
    graphRev: graph && typeof graph.rev === 'string' ? graph.rev : null,
    release: graph && graph.release ? graph.release : null,
    profileDir,
    configPath: configFile(home),
    latestRun: latest,
    reports: await listReports(home),
  }
}

async function latestRun(dir) {
  try {
    const names = await readdir(dir)
    const metas = names.filter((name) => name.endsWith('.meta.json'))
    if (metas.length === 0) return null
    let best = null
    for (const name of metas) {
      try {
        const meta = JSON.parse(await readFile(join(dir, name), 'utf8'))
        if (best === null || (meta.createdAt || 0) > (best.createdAt || 0)) best = meta
      } catch (error) {}
    }
    return best
  } catch (error) { return null }
}

async function listReports(home) {
  const dir = reportsDir(home)
  try {
    const names = await readdir(dir)
    const out = []
    for (const name of names) {
      if (!name.endsWith('.json')) continue
      try {
        const info = await stat(join(dir, name))
        const data = JSON.parse(await readFile(join(dir, name), 'utf8'))
        out.push({ id: name.replace(/\.json$/, ''), name: data.name || '', createdAt: data.generatedAt ? Date.parse(data.generatedAt) : info.mtimeMs, path: join(dir, name.replace(/\.json$/, '.md')) })
      } catch (error) {}
    }
    out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    return out.slice(0, 50)
  } catch (error) { return [] }
}

async function saveRun(home, body) {
  const dir = runsDir(home)
  const run = body && typeof body === 'object' ? body.run : undefined
  if (run === undefined || run === null || typeof run !== 'object') throw new Error('run must be an object')
  const id = safeId(run.id) ? run.id : randomUUID()
  const createdAt = Date.now()
  const name = typeof body.name === 'string' && body.name.trim().length > 0 ? body.name.trim().slice(0, 120) : ('run-' + new Date(createdAt).toISOString())
  const saved = { ...run, id, name, createdAt }
  const text = JSON.stringify(saved)
  if (Buffer.byteLength(text, 'utf8') > MAX_RUN_BODY) throw new Error('run too large')
  await mkdir(dir, { recursive: true })
  const plugins = Array.isArray(saved.plugins) ? saved.plugins.map((row) => ({ id: row.id, ms: row.ms, count: row.count })) : []
  const meta = {
    id, name, createdAt,
    durationMs: saved.durationMs || 0,
    attributedMs: saved.totals ? saved.totals.attributedMs : null,
    unattributedMs: saved.totals ? saved.totals.unattributedMs : null,
    frames: saved.frames || null,
    longFrames: Array.isArray(saved.longFrames) ? saved.longFrames.length : 0,
    plugins,
    moduleLoad: Array.isArray(saved.moduleLoad) ? saved.moduleLoad : [],
  }
  await writeFile(join(dir, id + '.json'), text, 'utf8')
  await writeFile(join(dir, id + '.meta.json'), JSON.stringify(meta), 'utf8')
  return meta
}

async function listRuns(home) {
  const dir = runsDir(home)
  try {
    const names = await readdir(dir)
    const out = []
    for (const name of names) {
      if (!name.endsWith('.meta.json')) continue
      try { out.push(JSON.parse(await readFile(join(dir, name), 'utf8'))) } catch (error) {}
    }
    out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    return out.slice(0, 100)
  } catch (error) { return [] }
}

async function readRun(home, id) {
  return JSON.parse(await readFile(join(runsDir(home), id + '.json'), 'utf8'))
}

async function deleteRun(home, id) {
  for (const suffix of ['.json', '.meta.json']) {
    try { await unlink(join(runsDir(home), id + suffix)) } catch (error) { if (!(error && error.code === 'ENOENT')) throw error }
  }
}

async function generateReport(home, state, run) {
  const config = state.config
  const built = buildReport(run, state, config)
  const dir = reportsDir(home)
  await mkdir(dir, { recursive: true })
  const id = 'report-' + new Date().toISOString().replace(/[:.]/g, '-')
  const jsonPath = join(dir, id + '.json')
  const mdPath = join(dir, id + '.md')
  await writeFile(mdPath, built.markdown, 'utf8')
  await writeFile(jsonPath, JSON.stringify({ ...built.json, name: run.name || '', runId: run.id || '' }, null, 2), 'utf8')
  return { id, markdown: built.markdown, path: mdPath, jsonPath }
}

async function configRoute(request, home, getGraph) {
  try {
    if (request.method === 'GET') return json(200, await readConfig(configFile(home)))
    if (request.method !== 'POST') return json(405, { error: 'method not allowed' })
    const text = await request.text()
    if (Buffer.byteLength(text, 'utf8') > MAX_CONFIG_BODY) return json(413, { error: 'request body too large' })
    let body
    try { body = JSON.parse(text) } catch (error) { return json(400, { error: 'request body must be JSON' }) }
    const config = sanitizeConfig(body && body.config)
    const graph = typeof getGraph === 'function' ? getGraph() : null
    const entries = graph && Array.isArray(graph.entries) ? graph.entries : []
    const ids = new Set(entries.map((entry) => entry && entry.id).filter((id) => typeof id === 'string'))
    const disabled = new Set()
    for (const id of config.disabled) {
      if (!ids.has(id)) return json(400, { error: 'unknown client plugin: ' + id })
      if (id === BOOTSTRAP_ID) return json(400, { error: 'cannot disable the client module bootstrap' })
      if (id.startsWith('@deepseek-ai/')) return json(400, { error: 'built-in plugin cannot be disabled here: ' + id })
      if (SELF_IDS.has(id)) return json(400, { error: 'cannot disable the perf suite itself' })
      disabled.add(id)
    }
    for (const id of disabled) {
      const broken = dependentsOf(graph, id).filter((dependent) => !disabled.has(dependent))
      if (broken.length > 0) return json(400, { error: 'plugin ' + id + ' is required by: ' + broken.join(', ') + ' (disable them together)' })
    }
    config.disabled = [...disabled]
    await writeConfig(configFile(home), config)
    return json(200, { ok: true, config, needsReload: true })
  } catch (error) { return json(500, { error: messageOf(error) }) }
}

// The floating launcher writes its position and visibility here. Kept separate
// from /config so a drag never has to resend the whole configuration.
async function launcherRoute(request, home) {
  try {
    if (request.method !== 'POST') return json(405, { error: 'method not allowed' })
    const text = await request.text()
    if (Buffer.byteLength(text, 'utf8') > 8192) return json(413, { error: 'request body too large' })
    let body
    try { body = JSON.parse(text) } catch (error) { return json(400, { error: 'request body must be JSON' }) }
    const current = await readConfig(configFile(home))
    const next = {
      ...current,
      launcher: {
        ...current.launcher,
        ...(body && typeof body.enabled === 'boolean' ? { enabled: body.enabled } : {}),
        ...(body && body.x !== undefined ? { x: body.x } : {}),
        ...(body && body.y !== undefined ? { y: body.y } : {}),
      },
    }
    const config = sanitizeConfig(next)
    await writeConfig(configFile(home), config)
    return json(200, { ok: true, launcher: config.launcher, config })
  } catch (error) { return json(500, { error: messageOf(error) }) }
}

async function handleState(request, home, getGraph) {
  try { return json(200, await buildState(home, getGraph)) } catch (error) { return json(500, { error: messageOf(error) }) }
}

async function handleRuns(request, home) {
  const url = new URL(request.url, 'http://dsh-perf.invalid')
  try {
    if (request.method === 'GET') {
      const id = url.searchParams.get('id')
      if (id !== null) {
        if (!safeId(id)) return json(400, { error: 'invalid id' })
        return json(200, { run: await readRun(home, id) })
      }
      return json(200, { runs: await listRuns(home) })
    }
    if (request.method === 'POST') {
      const declared = Number(request.headers.get('content-length'))
      if (Number.isFinite(declared) && declared > MAX_RUN_BODY) return json(413, { error: 'request body too large' })
      const text = await request.text()
      if (Buffer.byteLength(text, 'utf8') > MAX_RUN_BODY) return json(413, { error: 'request body too large' })
      let body
      try { body = JSON.parse(text) } catch (error) { return json(400, { error: 'request body must be JSON' }) }
      return json(200, { ok: true, meta: await saveRun(home, body) })
    }
    if (request.method === 'DELETE') {
      const id = url.searchParams.get('id')
      if (!safeId(id)) return json(400, { error: 'invalid id' })
      await deleteRun(home, id)
      return json(200, { ok: true })
    }
    return json(405, { error: 'method not allowed' })
  } catch (error) { return json(500, { error: messageOf(error) }) }
}

async function handleReport(request, home, getGraph) {
  const url = new URL(request.url, 'http://dsh-perf.invalid')
  try {
    if (request.method === 'GET') {
      const id = url.searchParams.get('id')
      if (!safeId(id)) return json(400, { error: 'invalid id' })
      const mdPath = join(reportsDir(home), id + '.md')
      const jsonPath = join(reportsDir(home), id + '.json')
      const markdown = await readFile(mdPath, 'utf8')
      let data = null
      try { data = JSON.parse(await readFile(jsonPath, 'utf8')) } catch (error) {}
      return json(200, { markdown, data, path: mdPath })
    }
    if (request.method !== 'POST') return json(405, { error: 'method not allowed' })
    const text = await request.text()
    if (Buffer.byteLength(text, 'utf8') > 1024 * 1024) return json(413, { error: 'request body too large' })
    let body
    try { body = JSON.parse(text) } catch (error) { return json(400, { error: 'request body must be JSON' }) }
    const runId = body && typeof body.runId === 'string' ? body.runId : ''
    if (!safeId(runId)) return json(400, { error: 'invalid runId' })
    const run = await readRun(home, runId)
    const state = await buildState(home, getGraph)
    const generated = await generateReport(home, state, run)
    return json(200, { ok: true, ...generated })
  } catch (error) {
    const status = error && error.code === 'ENOENT' ? 404 : 500
    return json(status, { error: messageOf(error) })
  }
}

export function apply(ctx) {
  const home = resolveHome()
  const meter = bootCode(new URL('./meter-boot.js', import.meta.url))
  const tuner = bootCode(new URL('./tuner-boot.js', import.meta.url))
  let clientModules = null
  ctx.inject(['clientModules'], (services) => { clientModules = services.clientModules })
  const getGraph = () => (clientModules ? clientModules.graph() : null)

  ctx.inject(['webServer'], (web) => {
    ctx.effect(() => web.webServer.tapIndex((html) => {
      const config = readConfigSync(configFile(home))
      let out = html
      if (config.disabled.length > 0) out = filterBootGraph(out, config.disabled)
      return injectBoot(out, config, meter, tuner)
    }), 'dsh-perf: index tap')
  })

  ctx.inject(['connection'], (host) => {
    ctx.effect(() => host.connection.fetch.register({ path: '/api/dsh-perf/state', methods: ['GET'], requestBody: 'buffered', fetch: (request) => handleState(request, home, getGraph) }), 'dsh-perf: state api')
    ctx.effect(() => host.connection.fetch.register({ path: '/api/dsh-perf/config', methods: ['GET', 'POST'], requestBody: 'buffered', fetch: (request) => configRoute(request, home, getGraph) }), 'dsh-perf: config api')
    ctx.effect(() => host.connection.fetch.register({ path: '/api/dsh-perf/launcher', methods: ['POST'], requestBody: 'buffered', fetch: (request) => launcherRoute(request, home) }), 'dsh-perf: launcher api')
    ctx.effect(() => host.connection.fetch.register({ path: '/api/dsh-perf/runs', methods: ['GET', 'POST', 'DELETE'], requestBody: 'buffered', fetch: (request) => handleRuns(request, home) }), 'dsh-perf: runs api')
    ctx.effect(() => host.connection.fetch.register({ path: '/api/dsh-perf/report', methods: ['GET', 'POST'], requestBody: 'buffered', fetch: (request) => handleReport(request, home, getGraph) }), 'dsh-perf: report api')
  })
}
