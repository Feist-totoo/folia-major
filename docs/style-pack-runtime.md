# 风格包核心：契约、隔离运行时与 CLI

核心层可独立校验、创建和打包风格包，不依赖播放器接入、Studio 或 MCP。API 1 描述基础图层，API 2 允许自包含的 Canvas/WebGL 程序；格式校验不执行程序，也不代表视觉效果合格。

## 本地制作

在仓库安装依赖后，使用 Node 24.15 或更高的 24.x：

```sh
npm run style:new -- ./my-style my.first-style personality
# 编辑 my-style/manifest.json 和 renderer.js
npm run style:pack -- ./my-style ./my-style.folia-style.json
npm run style:check -- ./my-style.folia-style.json
```

`new` 拒绝覆盖已存在的目录。第三个参数也可以是 `lyric-template`，生成只有歌词的可改造起点。打包会合并本地模块，拒绝额外 CSS/资源输出；图片、字体等使用规范允许的内嵌资产。

## 渲染契约

类型参考 [renderer-api.d.ts](../dev/stylePacks/renderer-api.d.ts)。程序调用一次 `FoliaStyle.define(factory)`，返回 `update(scene)`、`render(frame)` 和可选 `dispose()`。宿主提供绝对歌曲时间、字词时序、音频采样、字体、主题和画幅；不向程序传递播放器账户、文件或网络能力。

API 2 宿主在不带同源权限的 iframe 内创建 Worker，渲染到 OffscreenCanvas。CSP 阻止远程请求；初始化与单次调用设有超时，失控 Worker 会被终止。宿主应通过 `dispose()` 释放资源，并处理运行错误。旧包缺省类别只做兼容解释，不重写文件。

`personality` 表示完整视觉设计，`lyric-template` 表示可复用歌词行为；分类与逐字、逐句、字词组句是独立维度。复杂连写文字在基础模板中保留整句塑形。`lyricTemplate` 是可选来源记录，不是运行时依赖。

## 核心检查

```sh
npm run typecheck
npm run test:unit -- test/unit/stylePacks
npx playwright test test/component/stylePackCore.spec.ts
```

浏览器测试直接使用核心宿主，验证权限隔离、网络阻止、失控终止、非空渲染及确定性重放，不依赖 Studio 页面。实际成品仍需验证连续动效、长短歌词、字号、横竖屏、暂停/跳转和减少动态。
