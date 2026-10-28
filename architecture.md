# 当前系统架构

更新：2026-10-28（Asia/Shanghai）。以下均为 v1.0.0 已实施内容。

## 运行结构

单实例 Electron 桌面应用，React 界面从应用包加载，无需本地 HTTP 服务或远端服务。`electron/main.ts` 初始化数据目录、头像协议、窗口及 IPC；`electron/preload.ts` 仅暴露 `ArchiveAPI`。所有 HTTP(S)/WebSocket 请求被主进程阻止，渲染层 CSP 的 `connect-src` 为 `none`。

| 位置 | 职责与依赖 |
| --- | --- |
| `src/App.tsx` | 总览、筛选、搜索、详情、备份入口；状态由主进程返回结果更新 |
| `src/Editor.tsx` | 三组资料编辑、头像选择/拖入、位置调整、未保存编辑保护 |
| `src/components.tsx` | 头像占位、对话框焦点管理、确认框和 SVG 空态 |
| `shared/model.ts` | 两个阵营、资料类型、IPC API 契约与空白字段 |
| `electron/store.ts` | 校验、串行保存、原子 JSON 写入、备份、恢复与损坏保护 |
| `electron/main.ts` | 权限边界、图片解码/缩放、受限头像协议、文件选择器 |
| `scripts/` | 构建、图标生成、Apple Silicon 打包与本地临时签名 |

## 数据流

选择图片 → FileReader 内存预览 → 保存时通过 preload IPC 传入字段和图片 → 主进程校验字段并用 `nativeImage` 解码 → 缩放到长边最多 1600、规范为 PNG → 写入新 UUID 头像 → 将新元数据写入临时文件并 fsync → 原子重命名为 `library.json` → 成功后更新内存和界面。

总览及筛选只操作界面快照。`oc-asset://portrait/<uuid>.png` 只允许读取头像目录中符合限定格式的文件名。窗口启用沙箱及上下文隔离、禁用 Node 集成，限制 IPC 发起者为主窗口主 frame。

## 存储与一致性

默认根目录为 `~/Library/Application Support/异闻档案/archive`。`library.json` 是权威元数据，`portraits` 保存图片。业务写入在同一个 Promise 队列中串行执行；提交失败不更新内存状态。上一版 JSON 原子写入 `library.json.previous`。跨文件写入并非数据库事务：头像写成功而元数据失败时可能留下无引用图片，但已提交角色不受影响。

`.ocarchive` 是 gzip JSON，含格式版本、角色库及引用图片的 base64。导入先完整验证资料、解码图片，再生成安全备份、重映射图片名、原子提交元数据。合并跳过现有 UUID；替换需要两次用户选择/确认。删除和导入前的完整备份保留最近 10 份，用户导出的文件不自动删除。

主 JSON 损坏时先复制原件到 `backups`，再尝试上一版；两者都不可读时展示错误并保留导入恢复入口，不静默覆盖为空库。头像历史文件暂不清理，确保上一版仍可读取。

## 交付边界

打包只带 `dist`、`dist-electron` 和最小 package.json，封装为 asar，不包含源码、fixture 或用户数据。当前仅交付 macOS arm64；签名为本机 ad-hoc，未做 Developer ID 公证。

未实施且不属本轮范围：云同步、多用户、其他平台、阵营编辑、原始高清图片仓库及大规模容量优化。详见 [工程资料](docs/architecture-review/01-system-architecture.md)。
