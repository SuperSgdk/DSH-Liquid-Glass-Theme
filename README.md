# DSH液态玻璃皮肤插件

由 **SuperSgdk** 独立维护并完成 Windows 桌面端适配的 DSH 界面主题。让顶栏、侧边栏、输入区和统计栏使用可调的玻璃材质，支持流体背景、图片/视频壁纸及明暗主题。

**v1.4.2 起已支持 DSH 桌面版。** 已在 Windows DSH `0.2.0-rc.2` 完成适配，修复主对话区背景、侧栏收起后无法展开、中间竖线和输入区占用过高的问题，见 [桌面版说明](docs/DESKTOP.md)。

在设置里关闭插件，可恢复原生界面。主题不修改 DSH 源码，也不参与模型调用或消息发送。

![DSH液态玻璃皮肤插件实际运行效果](docs/images/web-light.png)

## 兼容范围

| 环境 | 状态 |
| --- | --- |
| Windows + DSH Web `0.1.5-rc.1` | 已通过运行、设置与开关验证，见 [验证记录](docs/VALIDATION.md) |
| DSH `0.1.6` | 社区修复提供参考，维护版尚未实测 |
| Windows + DSH 桌面版 `0.2.0-rc.2` | 已适配，用户确认修复后正常；见 [桌面版说明](docs/DESKTOP.md) |
| 其他 DSH 桌面版本 / 非 Windows 平台 | 尚未实测 |

仓库名中的 Theme 表示界面主题；同一包 `dsh-liquid-glass-theme` 支持上述已验证的 Web 和桌面环境。

## Windows 安装

先初始化要使用的 DSH profile，再退出该 profile 对应的 DSH 进程。下载本项目安装脚本：

```powershell
Invoke-WebRequest 'https://raw.githubusercontent.com/SuperSgdk/DSH-Liquid-Glass-Theme/main/install.ps1' -OutFile install-liquid-glass.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-liquid-glass.ps1
```

默认安装最新 GitHub Release 到 `web` profile。也可以指定版本和 profile：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-liquid-glass.ps1 -Version v1.4.2 -Profile web
```

桌面版使用 `desktop` profile：先正常退出 DSH 桌面版，再执行安装并重新打开应用。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-liquid-glass.ps1 -Version v1.4.2 -Profile desktop
```

安装脚本会先备份该 profile 的 `cordis.patch.yml`、`package.json` 和原链接信息，然后在 **该 profile 自己的 node_modules** 建立链接。备份位置会打印出来。

重新启动 DSH，Web 版在 **设置 → 插件** 查找“DSH液态玻璃皮肤插件”；桌面版的主题开关位于 **设置 → 通用设置** 的外观附近。模糊度、磨砂度和壁纸等调节项位于 **外观** 下方。

首次维护版通过 GitHub Release 分发，尚未发布到 npm。

## 从旧 Aqua 迁移

同一个 profile 中只启用一个版本。安装脚本会把旧的 `@deepseek-ai/dsh-client-ui-aqua` 注册及 manifest 依赖迁移到新包名，保留其他插件和注释；原源码目录与旧链接目标不会被删除。

浏览器偏好的 `dsh.ui-aqua.*` 键及原媒体数据库继续保留，以便在同一浏览器、同一站点使用原来的设置。不同端口、浏览器和桌面端的存储各自独立，不会自动同步壁纸。

若需要恢复，先退出 DSH，将安装时打印的备份目录中的两个配置文件复制回 profile，再按 `link.json` 恢复原来的插件链接。新建链接此前没有目标时，可移除该 Junction；只处理链接本身。

## 本地开发

需要 Node.js 22 或更新版本及 pnpm 11.19.0。构建在本仓库内完成。

```powershell
pnpm install --frozen-lockfile
pnpm run check
```

Windows PowerShell 中也使用上述命令完成依赖安装、检查和构建。

`check` 依次进行类型检查、构建和回归检查。浏览器 bundle 使用 DSH 的模块加载器，CSS 和 CSS Modules 随 bundle 注入；`lib` 中的构建产物随版本提交，普通安装无需构建。

运行 `pnpm pack` 可生成完整 `.tgz` 包；Windows 也可运行 `./pack.ps1`，它先检查再打包。GitHub Release 流程会检查版本号、构建并上传包和安装脚本。

本地副本安装到已初始化的测试 profile：

```powershell
.\install.ps1 -Source $PWD.Path -DshHome '<测试 DSH_HOME>' -Profile '<测试 profile>'
```

浏览器检查需单独启动测试 profile，将带启动 token 的测试 URL 放入当前终端的 `DSH_TEST_URL` 环境变量，再运行 `node scripts/browser-smoke.mjs`。测试 URL 和 token 不应写入提交。使用已有 Chrome 时设置 `BROWSER_CHANNEL=chrome`，否则按 Playwright 的说明安装测试浏览器。

## 维护与贡献

当前维护者为 **SuperSgdk**。问题和新 PR 请提交到本仓库。兼容修复应写明 DSH 版本、复现步骤和验证结果；新贡献在采纳后记入贡献记录。

### 本地修复自动同步

本仓库已启用维护规则：**修复 → `pnpm run check` 通过 → 用户确认实际效果正常 → 维护者自动提交并推送 GitHub**。用户确认后无需再单独要求更新仓库，具体规则见 [AGENTS.md](AGENTS.md)。这由维护者收到确认后调用脚本执行，不是后台文件监视或定时任务。

审阅本次差异后，明确列出需要提交的文件（包含检查生成的构建产物）：

```powershell
pnpm run sync -- --confirmed --message "fix: describe the confirmed repair" --files src/client/example.ts lib/client.js lib/client.js.map
```

将示例路径替换为本次实际文件。脚本重新运行检查，只提交列出的修改，并核实 GitHub main 已包含该提交。已有暂存内容、未列出的改动、远端版本变化或检查失败时会停止；推送异常时保留本地提交并先核实远端，不盲目重试或强推。维护脚本和文档修改按用户对维护工作的授权同步。

普通推送触发 Check；新安装包仍由匹配包版本的 `v*` 标签触发 Release。本同步脚本不创建标签，不提升插件版本。云端检查结果需另行核实。

- [验证记录](docs/VALIDATION.md)
- [更新日志](CHANGELOG.md)

## 许可证与来源说明

本项目代码以 **AGPL-3.0-only** 分发，保留 [LICENSE](LICENSE) 全文。内嵌 Space Grotesk 字体遵循 [SIL OFL 1.1](licenses/SpaceGrotesk-OFL.txt)。版权来源与历史贡献记录见 [NOTICE](NOTICE)。项目维护、安装与版本发布入口均为本仓库。
