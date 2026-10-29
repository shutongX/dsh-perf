window.__ModuleLoader__.load({ id: "dsh-perf", factory: (require) => {
	var module = { exports: {} };
	var exports = module.exports;
	Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
	var React = require("react");
	var h = React.createElement;
	var useState = React.useState;
	var useEffect = React.useEffect;
	var useCallback = React.useCallback;
	var useMemo = React.useMemo;

	var SELF_ID = "dsh-perf";
	var API = "/api/dsh-perf";
	var KEY = "__DSH_PERF__";
	var TUNE_STATE = "__DSH_PERF_TUNE_STATE__";

	function engine() { return window[KEY] }
	function tunerState() { return window[TUNE_STATE] || null }
	function shortId(id) {
		if (!id) return "?";
		return String(id).replace(/^@deepseek-ai\//, "").replace(/^@dsh-external\//, "").replace(/^@changfenhuang\//, "").replace(/^@nanmicoder\//, "");
	}
	function fmtMs(value) {
		var n = Number(value) || 0;
		if (n >= 1000) return (n / 1000).toFixed(2) + " s";
		if (n >= 10) return Math.round(n) + " ms";
		return n.toFixed(1) + " ms";
	}
	function timeLabel(ts) {
		if (!ts) return "";
		try { return new Date(ts).toLocaleString() } catch (error) { return String(ts) }
	}
	function errorText(error) { return String((error && error.message) || error) }
	function nowLabel() {
		var d = new Date();
		function p(n) { return n < 10 ? "0" + n : String(n) }
		return "run-" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
	}
	function emptyConfig() {
		return {
			version: 2, disabled: [], chatScroll: false, reduceEffects: false,
			throttle: { enabled: false, minIntervalMs: 10000, onlyHidden: false },
			customCss: "", customJs: "", usage: {},
			thresholds: { costMs: 20, moduleMs: 4 }
		};
	}
	function readJson(response) {
		return response.json().then(function (data) {
			if (!response.ok) throw new Error((data && data.error) || ("HTTP " + response.status));
			return data;
		});
	}
	function copyText(text) {
		try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text) } catch (error) {}
		return Promise.resolve();
	}

	var CSS = [
		".pf-page{box-sizing:border-box;height:100%;overflow:auto;padding:18px 22px 60px;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary)}",
		".pf-page *{box-sizing:border-box}",
		".pf-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}",
		".pf-tabs{display:inline-flex;border:0.5px solid var(--dsw-alias-border-l3);border-radius:9px;overflow:hidden}",
		".pf-tab{appearance:none;border:0;background:transparent;color:inherit;padding:6px 16px;font:inherit;cursor:pointer}",
		".pf-tab.on{background:var(--dsw-alias-bg-layer-3);font-weight:600}",
		".pf-muted{color:var(--dsw-alias-label-tertiary)}",
		".pf-small{font-size:11px}",
		".pf-card{border:0.5px solid var(--dsw-alias-border-l3);border-radius:10px;padding:14px 16px;margin-bottom:14px;background:var(--dsw-alias-bg-layer-1)}",
		".pf-card h3{margin:0 0 8px;font-size:14px;font-weight:600}",
		".pf-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}",
		".pf-btn{appearance:none;border:0.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2);color:inherit;border-radius:8px;padding:6px 12px;font:inherit;cursor:pointer}",
		".pf-btn:hover{border-color:var(--dsw-alias-border-l1)}",
		".pf-btn:disabled{opacity:.45;cursor:not-allowed}",
		".pf-btn.primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border-color:transparent}",
		".pf-btn.rec{background:var(--dsw-alias-state-error-primary,#dc2626);color:#fff;border-color:transparent}",
		".pf-input{border:0.5px solid var(--dsw-alias-border-l3);background:transparent;color:inherit;border-radius:8px;padding:6px 10px;font:inherit}",
		".pf-num{width:92px}",
		".pf-table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}",
		".pf-table th,.pf-table td{text-align:left;padding:6px 8px;border-bottom:0.5px solid var(--dsw-alias-border-l4);vertical-align:top}",
		".pf-table th{font-weight:500;color:var(--dsw-alias-label-tertiary);font-size:11px;white-space:nowrap}",
		".pf-table td.num,.pf-table th.num{text-align:right;white-space:nowrap}",
		".pf-bar{height:6px;border-radius:3px;background:var(--dsw-alias-bg-layer-3);overflow:hidden;min-width:60px}",
		".pf-bar>i{display:block;height:100%;background:var(--dsw-alias-brand-primary,#4f6ef7);border-radius:3px}",
		".pf-badge{display:inline-flex;border:0.5px solid var(--dsw-alias-border-l3);border-radius:999px;padding:0 7px;font-size:10.5px;color:var(--dsw-alias-label-secondary);margin-left:5px}",
		".pf-star{color:var(--dsw-alias-state-warning-primary,#b45309);font-weight:600}",
		".pf-toggle{display:flex;align-items:flex-start;gap:10px;padding:7px 0;border-bottom:0.5px solid var(--dsw-alias-border-l4)}",
		".pf-toggle:last-child{border-bottom:0}",
		".pf-toggle input{margin-top:3px}",
		".pf-textarea{width:100%;min-height:100px;border:0.5px solid var(--dsw-alias-border-l3);background:transparent;color:inherit;border-radius:8px;padding:8px 10px;font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.45;resize:vertical}",
		".pf-plugins{max-height:380px;overflow:auto;margin-top:8px}",
		".pf-plugin{display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:0.5px solid var(--dsw-alias-border-l4)}",
		".pf-plugin-main{flex:1;min-width:0}",
		".pf-plugin-name{font-weight:500}",
		".pf-plugin-desc{font-size:11px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
		".pf-quad{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}",
		".pf-quad-cell{border:0.5px solid var(--dsw-alias-border-l3);border-radius:9px;padding:8px 10px;min-height:88px}",
		".pf-quad-cell h4{margin:0 0 4px;font-size:11px;color:var(--dsw-alias-label-tertiary);font-weight:500}",
		".pf-chip{display:inline-flex;align-items:center;gap:4px;border:0.5px solid var(--dsw-alias-border-l3);border-radius:999px;padding:2px 8px;margin:2px 3px 2px 0;font-size:11px;background:transparent;color:inherit;cursor:pointer}",
		".pf-chip.rec{border-color:var(--dsw-alias-state-warning-primary,#b45309);color:var(--dsw-alias-state-warning-primary,#b45309)}",
		".pf-chip.muted{opacity:.45;cursor:default}",
		".pf-pre{white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,Consolas,monospace;font-size:11.5px;line-height:1.5;max-height:360px;overflow:auto;border:0.5px solid var(--dsw-alias-border-l4);border-radius:8px;padding:10px;background:var(--dsw-alias-bg-layer-2)}",
		".pf-err{color:var(--dsw-alias-state-error-primary,#dc2626)}",
		".pf-warn{color:var(--dsw-alias-state-warning-primary,#b45309)}",
	].join("\n");

	function Card(props) {
		return h("div", { className: "pf-card" }, props.title ? h("h3", null, props.title) : null, props.children);
	}
	function Btn(props) {
		return h("button", { className: "pf-btn" + (props.primary ? " primary" : "") + (props.rec ? " rec" : ""), disabled: props.disabled, onClick: props.onClick, title: props.title }, props.children);
	}
	function Stat(props) {
		return h("div", { style: { minWidth: "92px" } },
			h("div", { className: "pf-muted pf-small" }, props.label),
			h("div", { style: { fontSize: "17px", fontWeight: 600, fontVariantNumeric: "tabular-nums" } }, props.value),
			props.note ? h("div", { className: "pf-muted pf-small" }, props.note) : null
		);
	}
	function frameStats(rows) { return rows }

	function usageLabel(value) {
		return value === "often" ? "常用" : value === "never" ? "不用" : "偶尔";
	}

	function PerfPanel() {
		var [tab, setTab] = useState("meter");
		var [state, setState] = useState(null);
		var [snap, setSnap] = useState(null);
		var [booted, setBooted] = useState(false);
		var [notice, setNotice] = useState(null);

		var loadState = useCallback(function () {
			fetch(API + "/state", { cache: "no-store" }).then(readJson).then(function (data) {
				setState(data);
			}).catch(function (error) { setNotice({ kind: "error", text: "读取配置失败：" + errorText(error) }) });
		}, []);

		useEffect(function () { loadState() }, [loadState]);

		useEffect(function () {
			var now = engine();
			if (!now) {
				var timer = setInterval(function () { if (engine()) { setBooted(true); clearInterval(timer) } }, 1000);
				return function () { clearInterval(timer) };
			}
			setBooted(true);
			var update = function () { try { setSnap(engine().snapshot()) } catch (error) {} };
			update();
			return now.subscribe(update);
		}, []);

		return h("div", { className: "pf-page" },
			h("style", null, CSS),
			h("div", { className: "pf-head" },
				h("div", { className: "pf-tabs" },
					h("button", { className: "pf-tab" + (tab === "meter" ? " on" : ""), onClick: function () { setTab("meter") } }, "采集"),
					h("button", { className: "pf-tab" + (tab === "tune" ? " on" : ""), onClick: function () { setTab("tune") } }, "优化"),
					h("button", { className: "pf-tab" + (tab === "report" ? " on" : ""), onClick: function () { setTab("report") } }, "报告")
				),
				h("span", { className: "pf-muted pf-small" }, state ? ("客户端插件 " + String(state.plugins ? state.plugins.length : 0) + " · 配置：" + (state.configPath || "")) : "加载中…"),
				state ? h(Btn, { onClick: loadState }, "刷新") : null,
				!booted ? h("span", { className: "pf-warn pf-small" }, "探针未注入，刷新页面后可用") : null
			),
			notice ? h("div", { className: notice.kind === "error" ? "pf-err" : "pf-muted", style: { marginBottom: "10px" } }, notice.text) : null,
			tab === "meter" ? h(MeterTab, { snap: snap, booted: booted, onNotice: setNotice, onSaved: loadState }) : null,
			tab === "tune" ? h(TuneTab, { state: state, snap: snap, onNotice: setNotice, onRefresh: loadState }) : null,
			tab === "report" ? h(ReportTab, { state: state, snap: snap, onNotice: setNotice, onRefresh: loadState }) : null
		);
	}

	function MeterTab(props) {
		var snap = props.snap;
		var [name, setName] = useState(nowLabel);
		var [lastRun, setLastRun] = useState(null);
		var [viewRun, setViewRun] = useState(null);
		var [runs, setRuns] = useState([]);
		var [busy, setBusy] = useState("");
		var [selectedPlugin, setSelectedPlugin] = useState(null);
		var [baseId, setBaseId] = useState("");
		var [targetId, setTargetId] = useState("");
		var [compare, setCompare] = useState(null);
		var [notice, setNotice] = useState(null);

		function notify(kind, text) { setNotice({ kind: kind, text: text }); if (props.onNotice) props.onNotice({ kind: kind, text: text }) }
		var refreshRuns = useCallback(function () {
			fetch(API + "/runs", { cache: "no-store" }).then(readJson).then(function (data) { setRuns(Array.isArray(data.runs) ? data.runs : []) }).catch(function (error) { notify("error", "读取记录失败：" + errorText(error)) });
		}, []);
		useEffect(function () { refreshRuns() }, [refreshRuns]);

		var onStart = function () {
			var now = engine();
			if (!now || busy) return;
			setBusy("start");
			now.prepare().then(function () { return now.start(name) }).then(function () {
				notify("info", "记录中：去操作，停止后查看按插件耗时。");
			}).catch(function (error) { notify("error", "启动失败：" + errorText(error)) }).finally(function () { setBusy("") });
		};
		var onStop = function () {
			var now = engine();
			if (!now) return;
			var run = now.stop();
			setLastRun(run || null);
			setViewRun(null);
			setSelectedPlugin(null);
			notify("info", run ? "已停止，可以保存。" : "当前没有记录。");
		};
		var onSave = function () {
			if (!lastRun || busy) return;
			setBusy("save");
			fetch(API + "/runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name || nowLabel(), run: lastRun }) }).then(readJson).then(function (data) {
				notify("info", "已保存：" + (data.meta && data.meta.name ? data.meta.name : ""));
				setLastRun(null);
				refreshRuns();
				if (props.onSaved) props.onSaved();
			}).catch(function (error) { notify("error", "保存失败：" + errorText(error)) }).finally(function () { setBusy("") });
		};
		var onLoad = function (id) {
			fetch(API + "/runs?id=" + encodeURIComponent(id), { cache: "no-store" }).then(readJson).then(function (data) { if (data.run) { setViewRun(data.run); setLastRun(null); setSelectedPlugin(null) } });
		};
		var onDelete = function (id) {
			fetch(API + "/runs?id=" + encodeURIComponent(id), { method: "DELETE" }).then(readJson).then(function () { refreshRuns(); if (baseId === id) setBaseId(""); if (targetId === id) setTargetId("") }).catch(function (error) { notify("error", "删除失败：" + errorText(error)) });
		};
		var onCompare = function () {
			var cache = {};
			function pick(id) {
				if (id === "__last") return Promise.resolve(lastRun);
				if (cache[id]) return Promise.resolve(cache[id]);
				return fetch(API + "/runs?id=" + encodeURIComponent(id), { cache: "no-store" }).then(readJson).then(function (data) { cache[id] = data.run; return data.run });
			}
			Promise.all([pick(baseId), pick(targetId)]).then(function (list) {
				if (!list[0] || !list[1]) throw new Error("请选择两条记录");
				setCompare({ base: list[0], target: list[1] });
			}).catch(function (error) { notify("error", String(errorText(error))) });
		};

		var live = lastRun || viewRun;
		var showPlugins = snap && snap.recording ? snap.plugins : (live ? live.plugins : (snap ? snap.plugins : []));
		var showTotal = snap && snap.recording ? snap.totals.attributedMs : (live && live.totals ? live.totals.attributedMs : (snap ? snap.totals.attributedMs : 0));
		var frames = snap && snap.recording ? snap.frames : (live && live.frames ? live.frames : (snap ? snap.frames : null));
		var longFrames = live && live.longFrames ? live.longFrames : null;
		var rows = showPlugins || [];
		var threshold = 1;

		function pluginRows() {
			if (rows.length === 0) return h("div", { className: "pf-muted", style: { padding: "8px 0" } }, "还没有数据。开始记录后做操作，再回来查看。");
			return h("table", { className: "pf-table" },
				h("thead", null, h("tr", null,
					h("th", null, "插件 / 模块"), h("th", { className: "num" }, "总耗时"), h("th", { className: "num" }, "次数"), h("th", { className: "num" }, "最大"), h("th", { className: "num" }, "占比"), h("th", null, "")
				)),
				h("tbody", null, rows.map(function (plugin) {
					return h("tr", { key: plugin.id, style: { cursor: "pointer" }, onClick: function () { setSelectedPlugin(plugin.id) } },
						h("td", null, h("div", { style: { fontWeight: 500 } }, shortId(plugin.id)), h("div", { className: "pf-muted pf-small" }, plugin.id)),
						h("td", { className: "num" }, fmtMs(plugin.ms)),
						h("td", { className: "num" }, String(plugin.count)),
						h("td", { className: "num" }, fmtMs(plugin.maxMs)),
						h("td", { className: "num" }, ((plugin.ms / (showTotal || 1)) * 100).toFixed(1) + "%"),
						h("td", { style: { width: "100px" } }, h("div", { className: "pf-bar" }, h("i", { style: { width: Math.min(100, (plugin.ms / (showTotal || 1)) * 100) + "%" } })))
					);
				}))
			);
		}
		var selected = rows.find(function (plugin) { return plugin.id === selectedPlugin });

		return h("div", null,
			h(Card, null,
				h("div", { className: "pf-row" },
					h("input", { className: "pf-input", style: { flex: 1, minWidth: "200px" }, value: name, onChange: function (event) { setName(event.target.value) }, placeholder: "记录名称" }),
					snap && snap.recording ? h(Btn, { rec: true, onClick: onStop, disabled: !!busy }, "停止记录") : h(Btn, { primary: true, onClick: onStart, disabled: !props.booted || !!busy }, busy === "start" ? "准备中…" : "开始记录")
				),
				h("div", { className: "pf-row", style: { gap: "24px", marginTop: "14px" } },
					h(Stat, { label: "状态", value: snap && snap.recording ? "记录中" : (live ? "已停止" : "空闲"), note: snap && snap.recording ? fmtMs(snap.elapsedMs) : "" }),
					h(Stat, { label: "已归因", value: fmtMs(showTotal), note: "插件/核心 JS" }),
					h(Stat, { label: "帧", value: frames ? String(frames.count) : "0", note: frames ? ("p95 " + frames.p95 + "ms / 最长 " + frames.max + "ms") : "" }),
					h(Stat, { label: "长帧", value: String(longFrames ? longFrames.length : (snap ? snap.longFrames : 0)) })
				),
				notice ? h("div", { className: notice.kind === "error" ? "pf-err" : "pf-muted", style: { marginTop: "8px" } }, notice.text) : null,
				snap && snap.errors && snap.errors.length ? h("div", { className: "pf-warn pf-small", style: { marginTop: "6px" } }, "采集告警：" + snap.errors.join("；")) : null
			),
			h(Card, { title: snap && snap.recording ? "实时：按插件" : (live ? "记录详情：" + (live.name || "未命名") : "按插件") }, pluginRows()),
			selected ? h(Card, { title: shortId(selected.id) },
				h("table", { className: "pf-table" },
					h("thead", null, h("tr", null, h("th", null, "注册来源函数"), h("th", { className: "num" }, "耗时"), h("th", { className: "num" }, "次数"))),
					h("tbody", null, (selected.functions || []).map(function (fn, index) {
						return h("tr", { key: index }, h("td", null, fn.name || "(anonymous)"), h("td", { className: "num" }, fmtMs(fn.ms)), h("td", { className: "num" }, String(fn.count)));
					}))
				)
			) : null,
			lastRun ? h(Card, { title: "刚停止的记录" },
				h("div", { className: "pf-row", style: { justifyContent: "space-between" } },
					h("span", { className: "pf-muted pf-small" }, timeLabel(lastRun.createdAt) + " · " + fmtMs(lastRun.durationMs)),
					h("div", { className: "pf-row" }, h(Btn, { primary: true, onClick: onSave, disabled: !!busy }, busy === "save" ? "保存中…" : "保存这条"), h(Btn, { onClick: function () { setLastRun(null) } }, "丢弃"))
				)
			) : null,
			longFrames && longFrames.length ? h(Card, { title: "长帧（>50ms）" },
				h("table", { className: "pf-table" },
					h("thead", null, h("tr", null, h("th", null, "帧长"), h("th", null, "阻塞"), h("th", null, "脚本归因"))),
					h("tbody", null, longFrames.slice(0, 40).map(function (frame, index) {
						var scripts = (frame.scripts || []).slice(0, 3).map(function (script) { return shortId(script.id) + " · " + (script.fn || "?") + " (" + script.dur + "ms)" }).join("；");
						return h("tr", { key: index }, h("td", null, String(frame.dur) + " ms"), h("td", null, String(frame.blocking) + " ms"), h("td", { className: "pf-small" }, scripts || "无脚本归因（排版/绘制）"));
					}))
				)
			) : null,
			h(Card, { title: "保存的记录" },
				runs.length === 0 ? h("div", { className: "pf-muted" }, "还没有保存过记录。") : null,
				runs.map(function (run) {
					return h("div", { className: "pf-row", key: run.id, style: { justifyContent: "space-between", padding: "6px 0", borderBottom: "0.5px solid var(--dsw-alias-border-l4)" } },
						h("div", null, h("div", { style: { fontWeight: 500 } }, run.name || run.id), h("div", { className: "pf-muted pf-small" }, timeLabel(run.createdAt) + " · " + fmtMs(run.durationMs) + " · " + String((run.plugins || []).length) + " 个插件")),
						h("div", { className: "pf-row" }, h(Btn, { onClick: function () { onLoad(run.id) } }, "查看"), h(Btn, { onClick: function () { setBaseId(run.id); setTargetId("__last") } }, "设为对比"), h(Btn, { onClick: function () { onDelete(run.id) } }, "删除"))
					);
				})
			),
			h(Card, { title: "对比两条记录" },
				h("div", { className: "pf-row" },
					h("select", { className: "pf-input", value: baseId, onChange: function (event) { setBaseId(event.target.value) } },
						h("option", { value: "" }, "选择 A（基准）"),
						lastRun ? h("option", { value: "__last" }, "刚停止的记录") : null,
						runs.map(function (run) { return h("option", { key: run.id, value: run.id }, run.name || run.id) })
					),
					h("select", { className: "pf-input", value: targetId, onChange: function (event) { setTargetId(event.target.value) } },
						h("option", { value: "" }, "选择 B（对比）"),
						lastRun ? h("option", { value: "__last" }, "刚停止的记录") : null,
						runs.map(function (run) { return h("option", { key: run.id, value: run.id }, run.name || run.id) })
					),
					h(Btn, { onClick: onCompare, disabled: !baseId || !targetId }, "对比")
				),
				compare ? h(CompareTable, { base: compare.base, target: compare.target }) : null
			)
		);
	}

	function CompareTable(props) {
		var base = props.base;
		var target = props.target;
		var a = {}, b = {};
		(base.plugins || []).forEach(function (row) { a[row.id] = row.ms });
		(target.plugins || []).forEach(function (row) { b[row.id] = row.ms });
		var ids = Object.keys(a).concat(Object.keys(b).filter(function (id) { return !(id in a) }));
		ids.sort(function (x, y) { return Math.abs((b[y] || 0) - (a[y] || 0)) - Math.abs((b[x] || 0) - (a[x] || 0)) });
		return h("div", { style: { marginTop: "10px" } },
			h("div", { className: "pf-row", style: { gap: "22px", marginBottom: "8px" } },
				h(Stat, { label: "A", value: base.name || base.id, note: fmtMs(base.durationMs) }),
				h(Stat, { label: "B", value: target.name || target.id, note: fmtMs(target.durationMs) }),
				h(Stat, { label: "帧", value: String((base.frames && base.frames.count) || 0) + " → " + String((target.frames && target.frames.count) || 0) }),
				h(Stat, { label: "长帧", value: String((base.longFrames || []).length) + " → " + String((target.longFrames || []).length) })
			),
			h("table", { className: "pf-table" },
				h("thead", null, h("tr", null, h("th", null, "插件"), h("th", { className: "num" }, "A"), h("th", { className: "num" }, "B"), h("th", { className: "num" }, "差值 B-A"))),
				h("tbody", null, ids.map(function (id) {
					var av = a[id] || 0, bv = b[id] || 0, delta = bv - av;
					return h("tr", { key: id }, h("td", null, shortId(id)), h("td", { className: "num" }, fmtMs(av)), h("td", { className: "num" }, fmtMs(bv)), h("td", { className: "num", style: { color: delta > 0 ? "var(--dsw-alias-state-error-primary,#dc2626)" : (delta < 0 ? "var(--dsw-alias-state-success-primary,#16a34a)" : "inherit") } }, (delta > 0 ? "+" : "") + fmtMs(delta)));
				}))
			)
		);
	}

	function TuneTab(props) {
		var state = props.state;
		var [draft, setDraft] = useState(emptyConfig);
		var [search, setSearch] = useState("");
		var [busy, setBusy] = useState("");
		var [notice, setNotice] = useState(null);
		var [applied, setApplied] = useState(null);

		useEffect(function () {
			if (state && state.config) setDraft(Object.assign(emptyConfig(), state.config));
			setApplied(tunerState());
		}, [state && state.config]);

		var plugins = state && Array.isArray(state.plugins) ? state.plugins : [];
		var hints = state && state.usageHints ? state.usageHints : {};
		var latest = state && state.latestRun ? state.latestRun : null;
		var engineNow = engine();
		var liveLoad = engineNow && engineNow.moduleLoad ? engineNow.moduleLoad() : [];
		var loadMap = {};
		for (var i = 0; i < liveLoad.length; i++) loadMap[liveLoad[i].id] = liveLoad[i].ms;
		if (latest && Array.isArray(latest.moduleLoad)) {
			for (var j = 0; j < latest.moduleLoad.length; j++) { var row = latest.moduleLoad[j]; if (!(row.id in loadMap) || row.ms > loadMap[row.id]) loadMap[row.id] = row.ms }
		}
		var costMap = {};
		if (latest && Array.isArray(latest.plugins)) for (var k = 0; k < latest.plugins.length; k++) costMap[latest.plugins[k].id] = latest.plugins[k];
		var thresholds = draft.thresholds || { costMs: 20, moduleMs: 4 };
		var disabled = draft.disabled || [];
		var byId = {};
		plugins.forEach(function (plugin) { byId[plugin.id] = plugin });

		function usageOf(id) {
			if (draft.usage && draft.usage[id]) return draft.usage[id];
			if (id.indexOf("dsh-mnemon-source-") === 0) return "often";
			return hints[id] || "sometimes";
		}
		function infoOf(plugin) {
			var cost = costMap[plugin.id];
			var measured = cost ? Number(cost.ms) || 0 : 0;
			var loaded = Number(loadMap[plugin.id]) || 0;
			var usage = usageOf(plugin.id);
			var builtin = plugin.id.startsWith("@deepseek-ai/");
			var self = plugin.id === SELF_ID;
			var deps = plugin.dependents || [];
			var builtinDeps = deps.filter(function (dep) { return dep.startsWith("@deepseek-ai/") || dep === SELF_ID });
			var eligible = !builtin && !self && !plugin.bootstrap && builtinDeps.length === 0;
			var costHigh = measured >= (thresholds.costMs || 20) || loaded >= (thresholds.moduleMs || 4);
			var hasData = measured > 0 || loaded > 0;
			var recommended = eligible && hasData && costHigh && usage !== "often";
			return { cost: cost, measured: measured, loaded: loaded, usage: usage, builtin: builtin, self: self, deps: deps, builtinDeps: builtinDeps, eligible: eligible, costHigh: costHigh, hasData: hasData, recommended: recommended };
		}
		function cascade(id, out) {
			var plugin = byId[id];
			if (!plugin) return out;
			(plugin.dependents || []).forEach(function (dep) { if (!out.includes(dep)) { out.push(dep); cascade(dep, out) } });
			return out;
		}
		function togglePlugin(id, checked) {
			var next = disabled.slice();
			if (checked) { if (!next.includes(id)) next.push(id); cascade(id, next).forEach(function (dep) { if (!next.includes(dep)) next.push(dep) }) }
			else next = next.filter(function (item) { return item !== id });
			setDraft(Object.assign({}, draft, { disabled: next }));
		}
		function setUsage(id, value) {
			var usage = Object.assign({}, draft.usage || {});
			usage[id] = value;
			setDraft(Object.assign({}, draft, { usage: usage }));
		}
		function acceptRecommended() {
			var next = disabled.slice();
			plugins.forEach(function (plugin) { var info = infoOf(plugin); if (info.recommended) { if (!next.includes(plugin.id)) next.push(plugin.id); cascade(plugin.id, next).forEach(function (dep) { if (!next.includes(dep)) next.push(dep) }) } });
			setDraft(Object.assign({}, draft, { disabled: next }));
			setNotice({ kind: "info", text: "已把推荐插件加入按需列表，保存并刷新后生效。" });
		}
		function save(reload) {
			if (busy) return;
			setBusy(reload ? "save-reload" : "save");
			fetch(API + "/config", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ config: draft }) }).then(readJson).then(function (data) {
				if (data.config) setDraft(Object.assign(emptyConfig(), data.config));
				if (reload) { location.reload(); return }
				setNotice({ kind: "info", text: "已保存；刷新页面后生效。" });
				if (props.onRefresh) props.onRefresh();
			}).catch(function (error) { setNotice({ kind: "error", text: "保存失败：" + errorText(error) }) }).finally(function () { setBusy("") });
		}

		var filtered = plugins.filter(function (plugin) {
			if (!search) return true;
			var needle = search.toLowerCase();
			return plugin.id.toLowerCase().indexOf(needle) >= 0 || (plugin.description || "").toLowerCase().indexOf(needle) >= 0;
		});
		var eligibleList = plugins.map(function (plugin) { return { plugin: plugin, info: infoOf(plugin) } }).filter(function (row) { return row.info.eligible });
		var quad = { "high-high": [], "high-low": [], "low-high": [], "low-low": [] };
		eligibleList.forEach(function (row) {
			var usageHigh = row.info.usage === "often";
			var key = usageHigh ? (row.info.costHigh ? "high-high" : "high-low") : (row.info.costHigh ? "low-high" : "low-low");
			quad[key].push(row);
		});
		var recommendedCount = eligibleList.filter(function (row) { return row.info.recommended }).length;

		function quadCell(key, title) {
			return h("div", { className: "pf-quad-cell" },
				h("h4", null, title),
				quad[key].length === 0 ? h("span", { className: "pf-muted pf-small" }, "—") : quad[key].map(function (row) {
					return h("button", {
						key: row.plugin.id,
						className: "pf-chip" + (row.info.recommended ? " rec" : "") + (row.info.hasData ? "" : " muted"),
						title: (row.info.eligible ? "点击切换按需加载" : "不可禁用") + " · " + row.plugin.id + (row.info.hasData ? "" : " · 暂无测量数据"),
						onClick: function () { if (row.info.eligible) togglePlugin(row.plugin.id, !disabled.includes(row.plugin.id)) }
					}, shortId(row.plugin.id), row.info.recommended ? " ★" : (row.info.hasData ? "" : " ?"));
				})
			);
		}

		return h("div", null,
			!state ? h(Card, null, h("div", { className: "pf-muted" }, "加载中…")) : null,
			state ? h(Card, { title: "状态与采集" },
				h("div", { className: "pf-row", style: { gap: "22px" } },
					h("span", null, "客户端插件：", h("strong", null, String(plugins.length))),
					h("span", null, "按需：", h("strong", null, String(disabled.length))),
					h("span", null, "推荐：", h("strong", { className: "pf-star" }, String(recommendedCount))),
					h("span", { className: "pf-muted" }, latest ? ("最近记录：" + (latest.name || latest.id) + " · " + fmtMs(latest.durationMs)) : "还没有采集记录，建议先去「采集」录一次"),
					applied ? h("span", { className: "pf-muted pf-small" }, "本页生效：" + [applied.chatScroll ? "滚动优化" : "", applied.reduceEffects ? "降特效" : "", applied.throttle && applied.throttle.enabled ? "轮询降频" : "", applied.customJs ? "自定义JS" : ""].filter(Boolean).join("、")) : null
				)
			) : null,
			state ? h(Card, { title: "四象限（点击插件切换按需）" },
				h("div", { className: "pf-muted pf-small", style: { marginBottom: "4px" } }, "横轴：使用频率（左低 → 右高） · 纵轴：开销（上高 → 下低）。★ = 推荐按需加载；? = 暂无测量数据。"),
				h("div", { className: "pf-quad" },
					quadCell("low-high", "不常用 + 高开销（推荐按需）"),
					quadCell("high-high", "常用 + 高开销（保持常驻，优先优化）"),
					quadCell("low-low", "不常用 + 低开销（可按需，收益小）"),
					quadCell("high-low", "常用 + 低开销（保持常驻）")
				),
				h("div", { className: "pf-row", style: { marginTop: "10px" } },
					h(Btn, { primary: true, onClick: acceptRecommended, disabled: recommendedCount === 0 }, "采纳所有推荐 (" + recommendedCount + ")"),
					h(Btn, { onClick: function () { setDraft(Object.assign(emptyConfig(), { usage: draft.usage })) } }, "清空按需"),
					recommendedCount === 0 ? h("span", { className: "pf-muted pf-small" }, "当前没有「不常用 + 高开销」的插件；可以标记使用频率，或去采集一次。") : h("span", { className: "pf-muted pf-small" }, "标记「常用」的插件不会进入推荐；保存并刷新后生效。")
				)
			) : null,
			state ? h(Card, { title: "按需加载 / 使用频率" },
				h("div", { className: "pf-row" },
					h("input", { className: "pf-input", style: { flex: 1, minWidth: "220px" }, placeholder: "搜索插件名 / 描述", value: search, onChange: function (event) { setSearch(event.target.value) } }),
					h("span", { className: "pf-muted pf-small" }, "只允许禁用第三方插件；依赖会自动级联。")
				),
				h("div", { className: "pf-plugins" }, filtered.map(function (plugin) {
					var info = infoOf(plugin);
					var checked = disabled.includes(plugin.id);
					return h("div", { className: "pf-plugin", key: plugin.id },
						h("input", { type: "checkbox", checked: checked, disabled: !info.eligible, onChange: function (event) { togglePlugin(plugin.id, event.target.checked) } }),
						h("div", { className: "pf-plugin-main" },
							h("div", { className: "pf-plugin-name" },
								shortId(plugin.id),
								plugin.version ? h("span", { className: "pf-badge" }, plugin.version) : null,
								info.builtin ? h("span", { className: "pf-badge" }, "内置") : null,
								info.self ? h("span", { className: "pf-badge" }, "本插件") : null,
								info.builtinDeps.length ? h("span", { className: "pf-badge" }, "被内置依赖") : null,
								info.recommended ? h("span", { className: "pf-badge pf-star" }, "推荐按需") : null
							),
							plugin.description ? h("div", { className: "pf-plugin-desc" }, plugin.description) : null,
							h("div", { className: "pf-plugin-meta pf-muted pf-small" },
								plugin.id + " · 记录 " + fmtMs(info.measured) + " · 加载 " + fmtMs(info.loaded) + (info.deps.length ? " · 被依赖：" + info.deps.map(shortId).join(", ") : "")
							)
						),
						h("select", { className: "pf-input", style: { width: "92px" }, value: info.usage, onChange: function (event) { setUsage(plugin.id, event.target.value) }, disabled: !info.eligible },
							h("option", { value: "often" }, "常用"),
							h("option", { value: "sometimes" }, "偶尔"),
							h("option", { value: "never" }, "不用")
						)
					);
				}))
			) : null,
			state ? h(Card, { title: "运行时优化（刷新后生效）" },
				h("div", { className: "pf-muted pf-small", style: { marginBottom: "6px" } }, "已默认修复：新版 DSH 已优化 ui-chat 滚动性能，通常不需要再开实验项。"),
				h("label", { className: "pf-toggle" },
					h("input", { type: "checkbox", checked: !!draft.chatScroll, onChange: function (event) { setDraft(Object.assign({}, draft, { chatScroll: event.target.checked })) } }),
					h("div", null, h("strong", null, "聊天滚动优化（旧版兜底）"), h("div", { className: "pf-muted pf-small" }, "新版 DSH 已默认修复 ui-chat 滚动性能；此实验项只给旧版本用，给聊天行加 content-visibility，可能影响滚动定位。"))
				),
				h("label", { className: "pf-toggle" },
					h("input", { type: "checkbox", checked: !!draft.reduceEffects, onChange: function (event) { setDraft(Object.assign({}, draft, { reduceEffects: event.target.checked })) } }),
					h("div", null, h("strong", null, "降低动画/特效"), h("div", { className: "pf-muted pf-small" }, "关掉聊天区 transition / animation / backdrop-filter。"))
				),
				h("label", { className: "pf-toggle" },
					h("input", { type: "checkbox", checked: !!draft.throttle.enabled, onChange: function (event) { setDraft(Object.assign({}, draft, { throttle: Object.assign({}, draft.throttle, { enabled: event.target.checked }) })) } }),
					h("div", null, h("strong", null, "后台轮询降频"), h("div", { className: "pf-muted pf-small" }, "把小于阈值的 setInterval 拉长。"))
				),
				draft.throttle.enabled ? h("div", { className: "pf-row", style: { padding: "4px 0 8px 26px" } },
					h("span", { className: "pf-muted" }, "最小间隔"), h("input", { className: "pf-input pf-num", type: "number", min: 1000, max: 600000, step: 1000, value: draft.throttle.minIntervalMs, onChange: function (event) { setDraft(Object.assign({}, draft, { throttle: Object.assign({}, draft.throttle, { minIntervalMs: Number(event.target.value) || 10000 }) })) } }), h("span", { className: "pf-muted" }, "ms")
				) : null,
				h("div", { className: "pf-row", style: { marginTop: "8px" } },
					h("span", { className: "pf-muted" }, "推荐阈值：记录 ≥"), h("input", { className: "pf-input pf-num", type: "number", value: thresholds.costMs, onChange: function (event) { setDraft(Object.assign({}, draft, { thresholds: Object.assign({}, thresholds, { costMs: Number(event.target.value) || 20 }) })) } }), h("span", { className: "pf-muted" }, "ms 或加载 ≥"), h("input", { className: "pf-input pf-num", type: "number", value: thresholds.moduleMs, onChange: function (event) { setDraft(Object.assign({}, draft, { thresholds: Object.assign({}, thresholds, { moduleMs: Number(event.target.value) || 8 }) })) } }), h("span", { className: "pf-muted" }, "ms")
				)
			) : null,
			state ? h(Card, { title: "自定义优化" },
				h("div", { className: "pf-muted pf-small", style: { marginBottom: "4px" } }, "自定义 CSS"),
				h("textarea", { className: "pf-textarea", value: draft.customCss, onChange: function (event) { setDraft(Object.assign({}, draft, { customCss: event.target.value })) }, placeholder: "/* 例：.row { contain: layout paint; } */" }),
				h("div", { className: "pf-muted pf-small", style: { margin: "8px 0 4px" } }, "自定义 JS（页面启动时执行，风险自担）"),
				h("textarea", { className: "pf-textarea", value: draft.customJs, onChange: function (event) { setDraft(Object.assign({}, draft, { customJs: event.target.value })) }, placeholder: "// 例：window.__MY_OPT__ = true" })
			) : null,
			state ? h("div", { className: "pf-row" },
				h(Btn, { primary: true, disabled: !!busy, onClick: function () { save(true) } }, busy === "save-reload" ? "保存中…" : "保存并刷新"),
				h(Btn, { disabled: !!busy, onClick: function () { save(false) } }, busy === "save" ? "保存中…" : "仅保存"),
				h(Btn, { onClick: function () { setDraft(emptyConfig()) } }, "恢复默认"),
				notice ? h("span", { className: notice.kind === "error" ? "pf-err" : "pf-muted" }, notice.text) : null
			) : null
		);
	}

	function ReportTab(props) {
		var [runs, setRuns] = useState([]);
		var [selected, setSelected] = useState("");
		var [report, setReport] = useState(null);
		var [busy, setBusy] = useState("");
		var [notice, setNotice] = useState(null);
		var state = props.state;

		useEffect(function () {
			fetch(API + "/runs", { cache: "no-store" }).then(readJson).then(function (data) {
				var list = Array.isArray(data.runs) ? data.runs : [];
				setRuns(list);
				if (list.length > 0) setSelected(list[0].id);
			}).catch(function (error) { setNotice({ kind: "error", text: errorText(error) }) });
		}, []);

		function generate() {
			if (!selected || busy) return;
			setBusy("generate");
			fetch(API + "/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ runId: selected }) }).then(readJson).then(function (data) {
				setReport(data);
				setNotice({ kind: "info", text: "报告已生成：" + (data.path || "") });
				if (props.onRefresh) props.onRefresh();
			}).catch(function (error) { setNotice({ kind: "error", text: "生成失败：" + errorText(error) }) }).finally(function () { setBusy("") });
		}
		function loadReport(id) {
			fetch(API + "/report?id=" + encodeURIComponent(id), { cache: "no-store" }).then(readJson).then(function (data) { setReport({ markdown: data.markdown, path: data.path }) }).catch(function (error) { setNotice({ kind: "error", text: errorText(error) }) });
		}
		var reports = state && Array.isArray(state.reports) ? state.reports : [];

		return h("div", null,
			h(Card, { title: "生成报告" },
				h("div", { className: "pf-row" },
					h("select", { className: "pf-input", style: { flex: 1, minWidth: "260px" }, value: selected, onChange: function (event) { setSelected(event.target.value) } },
						h("option", { value: "" }, runs.length ? "选择一次采集记录" : "还没有采集记录，先去「采集」录一次"),
						runs.map(function (run) { return h("option", { key: run.id, value: run.id }, (run.name || run.id) + " · " + fmtMs(run.durationMs)) })
					),
					h(Btn, { primary: true, onClick: generate, disabled: !selected || !!busy }, busy === "generate" ? "生成中…" : "生成 Markdown 报告")
				),
				h("div", { className: "pf-muted pf-small", style: { marginTop: "6px" } }, "报告会写入 " + (state && state.configPath ? state.configPath.replace(/config\.json$/, "reports/") : "$DSH_HOME/storages/dsh-perf/reports/") + "，包含机器摘要、四象限、给 DSH/Agent 的优化方案设计指南。"),
				notice ? h("div", { className: notice.kind === "error" ? "pf-err" : "pf-muted", style: { marginTop: "6px" } }, notice.text) : null
			),
			report ? h(Card, { title: "报告预览" },
				h("div", { className: "pf-row", style: { marginBottom: "8px" } },
					h(Btn, { onClick: function () { copyText(report.markdown).then(function () { setNotice({ kind: "info", text: "已复制 Markdown。" }) }) } }, "复制 Markdown"),
					report.path ? h("span", { className: "pf-muted pf-small" }, report.path) : null
				),
				h("pre", { className: "pf-pre" }, report.markdown || "")
			) : null,
			h(Card, { title: "历史报告" },
				reports.length === 0 ? h("div", { className: "pf-muted" }, "还没有报告。") : null,
				reports.map(function (item) {
					return h("div", { className: "pf-row", key: item.id, style: { justifyContent: "space-between", padding: "6px 0", borderBottom: "0.5px solid var(--dsw-alias-border-l4)" } },
						h("div", null, h("div", null, item.name || item.id), h("div", { className: "pf-muted pf-small" }, timeLabel(item.createdAt))),
						h(Btn, { onClick: function () { loadReport(item.id) } }, "查看")
					);
				})
			)
		);
	}

	function PerfLauncher() {
		var [open, setOpen] = useState(false);
		var [live, setLive] = useState(null);
		useEffect(function () {
			var now = engine();
			if (!now) return;
			var update = function () { try { setLive(now.snapshot()) } catch (error) {} };
			update();
			return now.subscribe(update);
		}, []);
		var recording = !!(live && live.recording);
		var fab = {
			position: "fixed", right: "16px", bottom: "16px", zIndex: 80, pointerEvents: "auto",
			display: "inline-flex", alignItems: "center", gap: "6px",
			border: "0.5px solid " + (recording ? "var(--dsw-alias-state-error-primary,#dc2626)" : "var(--dsw-alias-border-l2)"),
			borderRadius: "999px", padding: "8px 14px",
			background: recording ? "color-mix(in srgb, var(--dsw-alias-state-error-primary,#dc2626) 14%, var(--dsw-alias-bg-layer-1))" : "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)", boxShadow: "0 2px 12px rgba(0,0,0,.18)", cursor: "pointer", font: "inherit", fontSize: "13px"
		};
		var backdrop = { position: "fixed", inset: 0, zIndex: 90, pointerEvents: "auto", background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "22px" };
		var card = { width: "min(1180px, 95vw)", height: "min(800px, 88vh)", overflow: "hidden", background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)", border: "0.5px solid var(--dsw-alias-border-l2)", borderRadius: "14px", display: "flex", flexDirection: "column", boxShadow: "0 18px 60px rgba(0,0,0,.4)" };
		return h("div", { style: { position: "fixed", inset: 0, pointerEvents: "none", zIndex: 80 } },
			h("button", { "data-dsh-perf-fab": "1", style: fab, title: recording ? "正在记录，点击查看/停止" : "性能套件", onClick: function () { setOpen(true) } }, recording ? ("● 性能 " + Math.round((live.elapsedMs || 0) / 1000) + "s") : "性能"),
			open ? h("div", { style: backdrop, onClick: function (event) { if (event.target === event.currentTarget) setOpen(false) } },
				h("div", { style: card },
					h("div", { className: "pf-row", style: { justifyContent: "flex-end", padding: "8px 16px", borderBottom: "0.5px solid var(--dsw-alias-border-l3)" } }, h("button", { className: "pf-btn", onClick: function () { setOpen(false) } }, "关闭")),
					h("div", { style: { flex: 1, minHeight: 0 } }, h(PerfPanel, {}))
				)
			) : null
		);
	}

	function apply(ctx) {
		ctx.effect(function () {
			return ctx.slots.inject("settings.section", function () {
				return ctx.slots.register({ name: "settings.section", id: "dsh-perf", order: 34, label: function () { return "性能套件" } }, PerfPanel);
			});
		}, "dsh-perf: settings section");
		ctx.effect(function () {
			return ctx.slots.inject("shell.overlay", function () {
				return ctx.slots.register({ name: "shell.overlay", id: "dsh-perf-launcher", order: 900 }, PerfLauncher);
			});
		}, "dsh-perf: launcher");
	}

	exports.name = "dsh-perf";
	exports.inject = ["slots"];
	exports.apply = apply;
	return module.exports;
} });
