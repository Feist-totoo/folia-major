# Folium Authoring Tools（Windows x64）

独立 MCP 与视觉调试器，沿用已有 Folia 桌面版。安装器不包含播放器，也不修改播放器资料库、模组信任记录或客户端配置。工具使用打包时的 Folium 1.8 契约与 Folia 0.7.26 检查器快照；验收时核对实际播放器版本。

安装器为当前用户安装，包含 Node 24.15.0，无需全局 Node。开始菜单提供调试器（默认官方虹光示例）、接口自测、配置导出和本说明。安装路径：`%LOCALAPPDATA%\Programs\FoliumAuthoringTools`。它与旧 `FoliaStyleTools` 分开安装，旧 JSON 风格包不能直接作为 Folium 模组加载。

在安装目录运行：

```powershell
.\folium-authoring.cmd self-test
.\folium-authoring.cmd connect-codex
.\folium-authoring.cmd configs
.\folium-authoring.cmd new D:\MyMods\my-visualizer
.\folium-authoring.cmd studio D:\MyMods\my-visualizer
.\folium-authoring.cmd check D:\MyMods\my-visualizer
.\folium-authoring.cmd pack D:\MyMods\my-visualizer D:\MyMods\my-visualizer.zip
```

`connect-codex` 先备份 Codex 配置再调用官方 CLI 增加 `folium-authoring`；同名条目若指向另一安装则拒绝覆盖。`disconnect-codex` 只移除当前安装拥有的条目。卸载前运行它，卸载器不会擅自修改 Codex 配置。配置备份和导出片段位于 `%LOCALAPPDATA%\FoliumAuthoringTools`；不要把备份上传，因为原配置可能包含用户凭据。Claude、DeepSeek Harness、WorkBuddy 等按生成的片段接入；配置格式和 SDK 互通不能代替各客户端真实模型回合测试。

`self-test` 从不同工作目录启动打包后的 MCP，实际调用全部 7 个工具、全部文档与参考源、resources、prompt、有效/无效标准模组，并测试 stdio 和认证 HTTP。`doctor` 提供简短连接诊断。视频分析、三种歌词放出和轨迹验收流程见内附审美 skill；调试器功能与限制见 `app/docs/folium/studio.md`。

ZIP 内是标准模组文件。解压到播放器的模组目录后，由播放器重载并显示原生启用确认。本工具不替用户签名或启用。第三方壁纸素材不附带在安装器中；本地练习模组需要另行确认素材分发授权。

这是测试候选安装包，尚未通过上游维护者审查，也未取得代码签名证书。SHA-256 文件和 `SHA256SUMS.txt` 可核对下载与安装内容；`release.json` 记录源码提交、Node 官方归档校验及依赖版本。源代码：[Folium 工具分支](https://github.com/Feist-totoo/folia-major/tree/feat/folium-authoring-toolkit)，使用 AGPL-3.0，依赖许可证随包保留。

从源码构建：`node dev/folium/toolkit/build.mjs`。产物写到 `release/folium-tools`，每次创建独立 staging 目录；卸载只删除构建清单内的文件和已知快捷方式，保留用户后来加入的项目文件。
