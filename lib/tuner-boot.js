(function () {
  'use strict'
  var cfg = globalThis.__DSH_PERF_TUNE__ || {}
  var state = {
    at: Date.now(),
    chatScroll: cfg.chatScroll === true,
    reduceEffects: cfg.reduceEffects === true,
    throttle: null,
    customCssBytes: 0,
    customJs: false,
    disabledCount: Array.isArray(cfg.disabled) ? cfg.disabled.length : 0,
    bootEntries: null,
    errors: []
  }
  function fail(where, error) {
    state.errors.push(where + ': ' + String((error && error.message) || error))
  }
  function addStyle(label, text) {
    try {
      var style = document.createElement('style')
      style.dataset.dshPerfTuner = label
      style.textContent = text
      ;(document.head || document.documentElement).appendChild(style)
    } catch (error) { fail('style', error) }
  }
  function bootEntryCount() {
    try {
      if (globalThis.__DSH_BOOT__ && Array.isArray(globalThis.__DSH_BOOT__.entries)) return globalThis.__DSH_BOOT__.entries.length
    } catch (error) {}
    return null
  }
  var css = []
  if (cfg.chatScroll) {
    css.push('[data-chat-flow-key]{content-visibility:auto;contain-intrinsic-size:auto 280px}')
  }
  if (cfg.reduceEffects) {
    css.push('[data-conversation-scroll] *,[data-conversation-scroll] *::before,[data-conversation-scroll] *::after{animation-duration:.001s!important;animation-delay:0s!important;transition-duration:.001s!important;transition-delay:0s!important;scroll-behavior:auto!important}')
    css.push('[data-conversation-scroll] *{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}')
  }
  if (typeof cfg.customCss === 'string' && cfg.customCss.trim().length > 0) {
    css.push(cfg.customCss)
    state.customCssBytes = cfg.customCss.length
  }
  if (css.length > 0) addStyle('css', css.join('\n'))

  if (cfg.throttle && cfg.throttle.enabled === true) {
    try {
      var originalSetInterval = window.setInterval
      var min = Math.max(1000, Math.min(600000, Number(cfg.throttle.minIntervalMs) || 10000))
      var onlyHidden = cfg.throttle.onlyHidden === true
      var throttled = 0
      window.setInterval = function (handler, delay) {
        if (typeof handler !== 'function' || typeof delay !== 'number' || !isFinite(delay) || delay <= 0) {
          return originalSetInterval.apply(window, arguments)
        }
        var effective = delay
        if (delay < min) { effective = min; throttled += 1; state.throttle.throttled = throttled }
        if (onlyHidden) {
          var original = handler
          handler = function () {
            if (document.hidden) return
            return original.apply(this, arguments)
          }
        }
        return originalSetInterval.call(window, handler, effective)
      }
      state.throttle = { enabled: true, minIntervalMs: min, onlyHidden: onlyHidden, throttled: throttled }
    } catch (error) { fail('throttle', error) }
  }

  if (typeof cfg.customJs === 'string' && cfg.customJs.trim().length > 0) {
    try {
      var runner = new Function(cfg.customJs)
      runner.call(window)
      state.customJs = true
    } catch (error) { fail('customJs', error) }
  }

  state.bootEntries = bootEntryCount()
  globalThis.__DSH_PERF_TUNE_STATE__ = state
})();