# 桌面端适配待办

当前发布目标是已验证的 Web 维护基线。桌面端验证另行开展，以实测状态更新兼容表。

1. 核实桌面应用实际内置 DSH 版本、插件加载入口和 profile 位置。
2. 对照该版本的 Store、UI Renderer、Theme、Settings、settings.plugin.item 接口，确认 Host 命名空间与客户端 keyed slot 仍配对。
3. 检查模块表是否提供 `dsh-client-store`、UI primitives、React 与 jsx-runtime；不把缺失模块强行塞入 inject。
4. 在隔离或有完整备份的 desktop profile 安装，确认主开关卡、外观控件及卸载行为。
5. 检查新窗口表面、右侧栏、输入区、壁纸覆盖、滚动和缩放；必要时为新 DOM 添加受主题开关约束的规则。
6. 验证浅/深色、云母/兼容模式、图片/视频及流体来回切换。
7. 区分各站点的 localStorage/IndexedDB；不要宣称 Web 壁纸会自动迁移到桌面端。
8. 发布前记录实际版本、启动结果、页面错误和截图；失败时验证禁用/恢复路径。

首次维护工作没有安装桌面端，也没有修改正在使用的 Web profile。
