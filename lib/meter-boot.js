(function () {
  'use strict'
  var KEY = '__DSH_PERF__'
  if (window[KEY]) return
  var VERSION = 1
  var native = {
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    setInterval: window.setInterval.bind(window),
    clearInterval: window.clearInterval.bind(window),
    raf: window.requestAnimationFrame.bind(window),
    add: EventTarget.prototype.addEventListener,
    remove: EventTarget.prototype.removeEventListener
  }
  var state = {
    recording: false,
    prepared: false,
    preparing: null,
    startedAt: 0,
    startedWall: 0,
    durationMs: 0,
    name: '',
    plugins: new Map(),
    unattributed: { ms: 0, count: 0 },
    frames: [],
    loaf: [],
    eval: new Map(),
    errors: []
  }
  var mapping = null
  var mappingPromise = null
  var subscribers = new Set()
  var notifyTimer = 0
  var notifyPending = false
  var depth = 0
  var lastFrame = performance.now()
  var FRAME_CAP = 20000
  var LOAF_CAP = 300
  var tickTimer = 0

  function notify() {
    notifyPending = true
    if (notifyTimer) return
    notifyTimer = native.setTimeout(function () {
      notifyTimer = 0
      if (!notifyPending) return
      notifyPending = false
      var list = Array.from(subscribers)
      for (var i = 0; i < list.length; i++) { try { list[i]() } catch (error) {} }
    }, 250)
  }
  function round(value) { return Math.round(value * 10) / 10 }
  function errorText(error) { return String((error && error.message) || error) }

  function parseFrames(stack) {
    var out = []
    var lines = String(stack || '').split('\n')
    for (var i = 1; i < lines.length && out.length < 6; i++) {
      var line = lines[i].trim()
      if (line.indexOf('at ') !== 0) continue
      var rest = line.slice(3)
      var fn = ''
      var loc = rest
      var p = rest.indexOf(' (')
      if (p >= 0) {
        fn = rest.slice(0, p)
        loc = rest.slice(p + 2)
        if (loc.slice(-1) === ')') loc = loc.slice(0, -1)
      }
      var m = loc.match(/^(.*?):(\d+):(\d+)$/)
      if (!m) continue
      var url = m[1]
      if (url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0) continue
      out.push({ u: url.slice(0, 220), full: url, line: Number(m[2]), col: Number(m[3]), fn: fn })
    }
    return out
  }
  function captureFrames(skipFn) {
    var error = new Error()
    if (Error.captureStackTrace) Error.captureStackTrace(error, skipFn)
    return parseFrames(error.stack)
  }

  function singlePlugin(url) {
    var m = url.match(/\/plugins\/((?:@[^/]+\/)?[^/]+)\//)
    if (!m) return null
    var id = m[1]
    try { id = decodeURIComponent(id) } catch (error) {}
    if (id.indexOf('??') >= 0) return null
    return id
  }
  function coreId(url) {
    if (url.indexOf('/assets/vendor-') >= 0) return 'core:vendor'
    if (url.indexOf('/assets/index-') >= 0) return 'core:app'
    return null
  }
  function bundleFor(url) {
    if (!mapping) return null
    for (var i = 0; i < mapping.bundles.length; i++) {
      var bundle = mapping.bundles[i]
      if (bundle.prefix && url.indexOf(bundle.prefix) === 0) return bundle
    }
    return null
  }
  function moduleAtLine(bundle, line) {
    var found = null
    for (var i = 0; i < bundle.ranges.length; i++) {
      if (bundle.ranges[i].line <= line) found = bundle.ranges[i]
      else break
    }
    return found ? found.id : null
  }
  function moduleAtChar(bundle, pos) {
    var found = null
    for (var i = 0; i < bundle.ranges.length; i++) {
      if (bundle.ranges[i].char <= pos) found = bundle.ranges[i]
      else break
    }
    return found ? found.id : null
  }
  function resolveFrames(frames) {
    if (!frames || !frames.length) return null
    for (var i = 0; i < frames.length; i++) {
      var frame = frames[i]
      var single = singlePlugin(frame.full)
      if (single) return { id: single, fn: frame.fn }
      var bundle = bundleFor(frame.full)
      if (bundle && bundle.ranges.length) {
        var id = moduleAtLine(bundle, frame.line)
        if (id) return { id: id, fn: frame.fn }
      }
      var core = coreId(frame.full)
      if (core) return { id: core, fn: frame.fn }
    }
    return null
  }
  function attributeOf(holder) {
    if (holder.resolved) return holder.resolved
    var attr = resolveFrames(holder.frames)
    holder.resolved = attr || { id: null, fn: holder.fn || '' }
    return holder.resolved
  }
  function pluginRecord(id) {
    var record = state.plugins.get(id)
    if (record === undefined) {
      record = { id: id, ms: 0, count: 0, max: 0, functions: new Map() }
      state.plugins.set(id, record)
    }
    return record
  }
  function addTime(holder, ms) {
    if (!state.recording) return
    var attr = attributeOf(holder)
    if (attr.id === null) {
      state.unattributed.ms += ms
      state.unattributed.count += 1
      return
    }
    var record = pluginRecord(attr.id)
    record.ms += ms
    record.count += 1
    if (ms > record.max) record.max = ms
    var name = attr.fn || holder.fn || '(anonymous)'
    var fn = record.functions.get(name)
    if (fn === undefined) {
      fn = { ms: 0, count: 0 }
      record.functions.set(name, fn)
    }
    fn.ms += ms
    fn.count += 1
  }
  function measure(holder, body) {
    if (!state.recording) return body()
    if (depth > 0) return body()
    var start = performance.now()
    depth += 1
    try {
      return body()
    } finally {
      depth -= 1
      addTime(holder, performance.now() - start)
    }
  }

  var listeners = new WeakMap()
  function patchedAdd(type, listener, options) {
    var target = this
    var isFunction = typeof listener === 'function'
    var isObject = listener !== null && typeof listener === 'object' && typeof listener.handleEvent === 'function'
    if (!isFunction && !isObject) return native.add.call(target, type, listener, options)
    var frames = captureFrames(patchedAdd)
    var holder = { frames: frames, fn: frames.length ? frames[0].fn : String(type), resolved: null }
    var wrapper = function (event) {
      return measure(holder, function () {
        if (isFunction) return listener.call(this, event)
        return listener.handleEvent(event)
      })
    }
    try {
      var capture = typeof options === 'boolean' ? options : !!(options && options.capture)
      var key = String(type) + '|' + (capture ? '1' : '0')
      var map = listeners.get(listener)
      if (map === undefined) { map = new Map(); listeners.set(listener, map) }
      map.set(key, wrapper)
    } catch (error) {}
    return native.add.call(target, type, wrapper, options)
  }
  function patchedRemove(type, listener, options) {
    if (typeof listener === 'function' || (listener !== null && typeof listener === 'object')) {
      try {
        var capture = typeof options === 'boolean' ? options : !!(options && options.capture)
        var map = listeners.get(listener)
        var wrapper = map && map.get(String(type) + '|' + (capture ? '1' : '0'))
        if (wrapper) {
          map.delete(String(type) + '|' + (capture ? '1' : '0'))
          return native.remove.call(this, type, wrapper, options)
        }
      } catch (error) {}
    }
    return native.remove.call(this, type, listener, options)
  }

  var timerMeta = new Map()
  function patchedSetTimeout(handler, delay) {
    if (typeof handler !== 'function') return native.setTimeout.apply(null, arguments)
    var frames = captureFrames(patchedSetTimeout)
    var holder = { frames: frames, fn: frames.length ? frames[0].fn : 'timeout', resolved: null }
    var args = Array.prototype.slice.call(arguments, 2)
    var id = native.setTimeout(function () {
      return measure(holder, function () { return handler.apply(window, args) })
    }, delay)
    timerMeta.set(id, holder)
    return id
  }
  function patchedSetInterval(handler, delay) {
    if (typeof handler !== 'function') return native.setInterval.apply(null, arguments)
    var frames = captureFrames(patchedSetInterval)
    var holder = { frames: frames, fn: frames.length ? frames[0].fn : 'interval', resolved: null }
    var args = Array.prototype.slice.call(arguments, 2)
    var id = native.setInterval(function () {
      return measure(holder, function () { return handler.apply(window, args) })
    }, delay)
    timerMeta.set(id, holder)
    return id
  }
  function patchedClearTimeout(id) {
    timerMeta.delete(id)
    return native.clearTimeout(id)
  }
  function patchedClearInterval(id) {
    timerMeta.delete(id)
    return native.clearInterval(id)
  }
  var rafMeta = new Map()
  function patchedRaf(handler) {
    if (typeof handler !== 'function') return native.raf(handler)
    var frames = captureFrames(patchedRaf)
    var holder = { frames: frames, fn: frames.length ? frames[0].fn : 'animationFrame', resolved: null }
    var id = native.raf(function (time) {
      return measure(holder, function () { return handler(time) })
    })
    rafMeta.set(id, holder)
    return id
  }
  function patchedCaf(id) {
    rafMeta.delete(id)
    return native.caf ? native.caf(id) : window.cancelAnimationFrame(id)
  }

  function hookModuleCreate() {
    var loader = window.__ModuleLoader__
    if (!loader || typeof loader.create !== 'function' || loader.__perfMeterCreateHooked) return false
    loader.__perfMeterCreateHooked = true
    var originalCreate = loader.create
    loader.create = function (options) {
      var system = originalCreate.call(this, options)
      try {
        var originalRegister = system.register
        system.register = function (registration) {
          try {
            if (registration && typeof registration.factory === 'function' && !registration.__perfMeterWrapped) {
              var factory = registration.factory
              var id = String(registration.id || '')
              registration.factory = function (require) {
                var started = performance.now()
                try { return factory(require) }
                finally {
                  var spent = performance.now() - started
                  var record = state.eval.get(id)
                  if (record === undefined) { record = { ms: 0, count: 0 }; state.eval.set(id, record) }
                  record.ms += spent
                  record.count += 1
                }
              }
              registration.__perfMeterWrapped = true
            }
          } catch (error) { state.errors.push('register: ' + errorText(error)) }
          return originalRegister.call(this, registration)
        }
      } catch (error) { state.errors.push('create: ' + errorText(error)) }
      return system
    }
    return true
  }

  function frameStats(frames) {
    if (!frames || frames.length === 0) return { count: 0, avg: 0, p50: 0, p95: 0, p99: 0, max: 0, over20: 0, over50: 0, over100: 0 }
    var values = frames.slice().sort(function (a, b) { return a - b })
    var total = 0
    for (var i = 0; i < values.length; i++) total += values[i]
    function q(p) { return values[Math.min(values.length - 1, Math.floor(values.length * p))] }
    var over20 = 0, over50 = 0, over100 = 0
    for (var j = 0; j < values.length; j++) { if (values[j] > 20) over20 += 1; if (values[j] > 50) over50 += 1; if (values[j] > 100) over100 += 1 }
    return { count: values.length, avg: round(total / values.length), p50: round(q(0.5)), p95: round(q(0.95)), p99: round(q(0.99)), max: round(values[values.length - 1]), over20: over20, over50: over50, over100: over100 }
  }
  function attrScript(url, pos) {
    if (!url) return null
    var single = singlePlugin(url)
    if (single) return single
    var bundle = bundleFor(url)
    if (bundle && bundle.ranges.length) return moduleAtChar(bundle, pos || 0)
    return coreId(url)
  }

  try {
    var loafObserver = new PerformanceObserver(function (list) {
      if (!state.recording) return
      var entries = list.getEntries()
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i]
        var scripts = []
        var source = entry.scripts || []
        for (var j = 0; j < source.length; j++) {
          var script = source[j]
          scripts.push({
            url: script.sourceURL || '',
            fn: script.sourceFunctionName || '',
            pos: script.sourceCharPosition || 0,
            dur: Math.round(script.duration || 0),
            forced: Math.round(script.forcedStyleAndLayoutDuration || 0),
            id: attrScript(script.sourceURL || '', script.sourceCharPosition || 0)
          })
        }
        state.loaf.push({
          dur: Math.round(entry.duration || 0),
          blocking: Math.round(entry.blockingDuration || 0),
          renderStart: Math.round(entry.renderStart || 0),
          layoutStart: Math.round(entry.styleAndLayoutStart || 0),
          scripts: scripts
        })
        if (state.loaf.length > LOAF_CAP) state.loaf.shift()
      }
    })
    loafObserver.observe({ type: 'long-animation-frame' })
  } catch (error) { state.errors.push('loaf: ' + errorText(error)) }

  function frameLoop() {
    var now = performance.now()
    if (state.recording && state.frames.length < FRAME_CAP) state.frames.push(now - lastFrame)
    lastFrame = now
    native.raf(frameLoop)
  }
  native.raf(frameLoop)

  EventTarget.prototype.addEventListener = patchedAdd
  EventTarget.prototype.removeEventListener = patchedRemove
  window.setTimeout = patchedSetTimeout
  window.clearTimeout = patchedClearTimeout
  window.setInterval = patchedSetInterval
  window.clearInterval = patchedClearInterval
  window.requestAnimationFrame = patchedRaf
  if (native.caf) window.cancelAnimationFrame = patchedCaf
  hookModuleCreate()
  native.setTimeout(hookModuleCreate, 0)

  function prepare() {
    if (state.prepared) return Promise.resolve(true)
    if (mappingPromise) return mappingPromise
    mappingPromise = Promise.resolve().then(function () {
      var urls = []
      try {
        var resources = performance.getEntriesByType('resource')
        for (var i = 0; i < resources.length; i++) {
          var name = resources[i].name
          if (name.indexOf('/plugins/') < 0) continue
          if (name.indexOf('/plugins/events') >= 0) continue
          if (urls.indexOf(name) < 0) urls.push(name)
        }
      } catch (error) {}
      var bundles = []
      var chain = Promise.resolve()
      urls.forEach(function (url) {
        chain = chain.then(function () {
          if (url.indexOf('/plugins/??') < 0) {
            var single = singlePlugin(url)
            if (single) bundles.push({ prefix: url, url: url, ranges: [], single: single })
            return
          }
          return fetch(url, { credentials: 'same-origin', cache: 'force-cache' }).then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status)
            return response.text()
          }).then(function (text) {
            var ranges = []
            var re = /__ModuleLoader__\.load\(\{/g
            var match
            while ((match = re.exec(text))) {
              var segment = text.slice(match.index, match.index + 1500)
              var idm = segment.match(/id:\s*["'\x60]([^"'\x60]+)["'\x60]/)
              if (!idm) continue
              var line = text.slice(0, match.index).split('\n').length
              ranges.push({ line: line, char: match.index, id: idm[1] })
            }
            bundles.push({ prefix: url.slice(0, 200), url: url, ranges: ranges })
          }).catch(function (error) {
            state.errors.push('mapping ' + url.slice(0, 100) + ': ' + errorText(error))
          })
        })
      })
      return chain.then(function () {
        mapping = { bundles: bundles }
        state.prepared = true
        notify()
        return true
      })
    })
    mappingPromise.then(function () {}, function () {}).then(function () { mappingPromise = null })
    return mappingPromise
  }

  function snapshot() {
    var plugins = []
    state.plugins.forEach(function (record) {
      var functions = []
      record.functions.forEach(function (value, name) {
        functions.push({ name: name, ms: round(value.ms), count: value.count })
      })
      functions.sort(function (a, b) { return b.ms - a.ms })
      plugins.push({ id: record.id, ms: round(record.ms), count: record.count, maxMs: round(record.max), functions: functions.slice(0, 12) })
    })
    plugins.sort(function (a, b) { return b.ms - a.ms })
    var attributed = 0
    for (var i = 0; i < plugins.length; i++) attributed += plugins[i].ms
    return {
      recording: state.recording,
      prepared: state.prepared,
      elapsedMs: state.recording ? Math.round(performance.now() - state.startedAt) : Math.round(state.durationMs),
      plugins: plugins,
      totals: { attributedMs: round(attributed), unattributedMs: round(state.unattributed.ms) },
      frames: frameStats(state.frames),
      longFrames: state.loaf.length,
      errors: state.errors.slice(-5)
    }
  }

  function moduleLoad() {
    var out = []
    state.eval.forEach(function (value, id) {
      out.push({ id: id, ms: round(value.ms), count: value.count })
    })
    out.sort(function (a, b) { return b.ms - a.ms })
    return out
  }

  function start(name) {
    return prepare().then(function () {
      state.plugins.clear()
      state.unattributed = { ms: 0, count: 0 }
      state.frames = []
      state.loaf = []
      state.name = String(name || '').slice(0, 120)
      state.startedAt = performance.now()
      state.startedWall = Date.now()
      state.durationMs = 0
      lastFrame = performance.now()
      state.recording = true
      if (tickTimer === 0) {
        tickTimer = native.setInterval(function () {
          if (!state.recording) {
            native.clearInterval(tickTimer)
            tickTimer = 0
            return
          }
          notify()
        }, 500)
      }
      notify()
      return { ok: true, prepared: state.prepared }
    })
  }

  function buildRun() {
    var snap = snapshot()
    var plugins = snap.plugins.map(function (plugin) { return plugin })
    var moduleRows = moduleLoad()
    var env = {
      url: String(location.href || ''),
      userAgent: String(navigator.userAgent || ''),
      viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1 },
      release: (window.__DSH_BOOT__ && window.__DSH_BOOT__.release) || null
    }
    return {
      schema: 1,
      version: VERSION,
      name: state.name,
      createdAt: state.startedWall,
      durationMs: Math.round(state.durationMs),
      plugins: plugins,
      moduleLoad: moduleRows,
      frames: snap.frames,
      longFrames: state.loaf.slice(),
      totals: snap.totals,
      env: env,
      errors: state.errors.slice()
    }
  }

  function stop() {
    if (!state.recording) return null
    state.durationMs = performance.now() - state.startedAt
    state.recording = false
    if (tickTimer !== 0) { native.clearInterval(tickTimer); tickTimer = 0 }
    var run = buildRun()
    notify()
    return run
  }

  window[KEY] = {
    version: VERSION,
    prepare: prepare,
    start: start,
    stop: stop,
    snapshot: snapshot,
    moduleLoad: moduleLoad,
    subscribe: function (listener) {
      subscribers.add(listener)
      return function () { subscribers.delete(listener) }
    }
  }
})();