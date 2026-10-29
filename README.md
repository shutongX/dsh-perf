# dsh-perf

Performance suite for DeepSeek Harness: measure per-plugin client cost, save and compare runs, generate agent-readable optimization reports, and tune client plugins with quadrant recommendations.

一体化的 DSH 性能套件：按插件采集耗时、保存/对比记录、生成给 agent 读的优化报告、按四象限推荐按需加载插件。


> 如果你以前用开发目录装过旧的 `@dsh-external/<name>` 版本，先移除旧插件，再装这里的无 scope 包；否则同一功能会同时加载两份。

## 安装

任选一种：

**方式一：DSH 插件页**

插件 → 添加插件 → 粘贴：

```text
https://github.com/shutongX/dsh-perf
```

**方式二：我的插件市场索引**

DSH → 插件 → 实验性插件 → 更多 → 开启「自定义插件市场」→ 发现 → 添加索引源：

```text
https://shutongX.github.io/dsh-plugins-index/index.json
```

**方式三：命令行**

```sh
dsh plugin --profile desktop add https://github.com/shutongX/dsh-perf
```

装完打开 DSH：右下角「性能」按钮，或 设置 →「性能套件」。

「性能」按钮可以拖到屏幕任意位置，位置会记住；不需要它的时候，去 设置 →「性能套件」→ 运行时优化，把「显示性能悬浮按钮」关掉。

## 三个页签

### 采集

1. 「开始记录」→ 关掉面板正常操作 → 右下角「● 性能 Ns」→「停止记录」。
2. 可以保存、查看、删除记录，也可以选两条对比。
3. 统计：事件监听器 / 定时器 / rAF 的同步执行时间，按注册位置归属到插件（含内置 ui-chat）；模块加载耗时；帧间隔和 >50ms 长帧。

### 优化

按「使用频率 × 开销」分四象限：

```text
          开销高                 开销低
常用   保持常驻，优先优化        保持常驻
不常用  推荐按需加载 ★           可按需，收益小
```

- 插件行右侧可以手动选「常用 / 偶尔 / 不用」；默认值只是一份粗略估计。
- 推荐 = 第三方 + 可禁用 + 开销高 + 不是常用。
- 点「采纳所有推荐」会自动勾选，再「保存并刷新」生效。
- 内置插件、本插件、被内置插件依赖的插件都不能禁用。
- 其他优化：聊天滚动优化、降特效、轮询降频、自定义 CSS / JS。
- 开销阈值可以调（默认：记录 ≥20ms 或加载 ≥4ms）。

> 额外优化点：新版 DSH 已默认修复 ui-chat 滚动性能问题，通常不需要再开实验项「聊天滚动优化」；报告里也会单独列出这一条。

### 报告

选一条记录 →「生成 Markdown 报告」。报告会写到 `$DSH_HOME/storages/dsh-perf/reports/`，内容包括：

1. 机器摘要（YAML）：`recommended_lazy`、`keep_resident`、`details`、`config_hint`，任何 DSH / agent 都能直接读。
2. 测量结果和四象限表。
3. 给 DSH 的优化方案设计指南：判定规则、安全约束、可直接采用的配置、验证方法。

也就是说，别人拿到这份报告，不需要再猜“为什么推荐这个、怎么改”。

## 文件位置

- 配置：`$DSH_HOME/storages/dsh-perf/config.json`
- 记录：`$DSH_HOME/storages/dsh-perf/runs/`
- 报告：`$DSH_HOME/storages/dsh-perf/reports/`

## 注意

- 禁用客户端插件要刷新页面；共享 bundle 仍可能被预取，按需只是不再挂载/执行。
- React 合成事件的渲染耗时归在核心 React 调度，不是具体插件；浏览器排版/绘制不计入 JS 时间，长帧单独记录。
- 聊天滚动优化是实验性的 content-visibility，可能影响滚动定位。

## 卸载

```sh
dsh plugin --profile desktop remove dsh-perf
```

## 开发

```sh
npm test
```

## License

BSD-3-Clause
