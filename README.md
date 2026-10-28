# 异闻档案

完全离线的个人 OC 角色档案馆，供 Apple Silicon Mac 本地使用（macOS 13 或更高版本）。你的角色，你的世界。

![角色馆藏首页](docs/screenshots/home.png)

## 开始使用

从 [Releases](https://github.com/NicholasZhao-zhenglin/repo/releases) 下载 `PersonaArchive-1.0.0-mac-arm64.zip`，解压后把 **异闻档案.app** 拖入「应用程序」，双击打开。不需要安装 Node.js，也不需要账号、网络或服务器。

如果直接拿到本机生成的 `.app`，可以立即双击运行。发行包为本地临时签名，未进行 Apple Developer ID 公证；从浏览器下载后若 macOS 拦截，可在「系统设置 → 隐私与安全性」中选择「仍要打开」。无需关闭系统安全保护。

## 可以做什么

- 创建、查看、编辑和删除角色；姓名必填，其他信息按需补充。
- 上传 PNG / JPG / WebP 大头像（最大 20 MB），支持拖入图片、调整显示位置及移除头像。保留透明背景，长边自动缩小到最多 1600 像素。
- 全部角色总览，以及「特异事务对策局」「异常物品鉴定工作室」分别浏览。
- 通过姓名、外文名、别名、身份、简介和标签搜索；按更新时间、创建时间、姓名排序；切换卡片大小。
- 收藏角色；填写基本信息、代表台词、性格、故事、能力装备、人物关系、手记和自定义条目。
- 导出包含头像的完整 `.ocarchive` 备份；合并导入时跳过相同编号，或明确确认后替换角色库。
- 删除、导入前自动备份完整角色库（最近 10 份）；每次保存保留上一版元数据；损坏主文件可从上一版恢复并保留受损原件。
- 未保存编辑离开时确认；`⌘ N` 新建，`⌘ F` 搜索，`Esc` 返回或关闭。

首次启动为空角色库。用户的参考图和创作资料不会随应用导入，也不会进入仓库。验收使用独立的合成测试角色。

## 数据存放位置

默认在 `~/Library/Application Support/异闻档案/archive/`：

```text
library.json           角色资料
library.json.previous  上一次保存的资料
portraits/             复制并规范化后的头像
backups/               自动完整备份与受损原件
```

App 的「备份与数据」可以直接打开这些文件夹。移动或重新安装 `.app` 不改变角色数据；删除上述数据目录会删除角色库。推荐定期导出到另一个磁盘或个人备份位置。原始图片不会被修改；若需要保留原始高分辨率绘图，应另行存档。

完整备份的解压后内容上限为 256 MB，单库最多 10,000 条记录，未对该规模作性能承诺。大库可在关闭 App 后整体复制数据目录。旧头像保留以支持上一版恢复，当前版本不自动清理。

## 从源码开发

本次验证环境：macOS 26.6.2 / arm64，Node.js 24.21.0，npm 11.19.0。精确依赖见 `package-lock.json`。Electron 45.1.0、React 19.3.1、TypeScript 7.0.2、Vite 8.3.5。

```sh
npm ci
# 如包管理器禁止依赖安装脚本，显式安装已锁定的 Electron 运行时：
node node_modules/electron/install.js
npm run dev
```

`npm run dev` 先构建再运行桌面应用。当前没有热更新开发服务器。

```sh
npm run build       # 类型检查、前端与主进程构建
npm test            # 11 项隔离存储测试
npm run test:e2e    # 2 项 Electron 桌面验收
npm run package     # 本机生成 arm64 .app 与 zip
```

打包产物位于 `release/`，不提交 Git，通过 GitHub Release 分发。已有 Electron 官方 zip 时，可通过 `OC_ELECTRON_ZIP_DIR` 指向其目录。图标来自本仓库 SVG，缺失 `.icns` 时由 Electron 渲染并调用 macOS `iconutil` 生成。

测试使用操作系统临时目录，通过 `OC_ARCHIVE_DATA_DIR` 隔离，不触碰正式角色库。测试打包后的二进制：

```sh
OC_ARCHIVE_EXECUTABLE="$PWD/release/异闻档案-darwin-arm64/异闻档案.app/Contents/MacOS/PersonaArchive" npx playwright test
```

桌面验收覆盖真实 UI、IPC、头像解码、文件写入及重启；只替换系统文件选择器和确认框的返回值，不模拟业务存储。

## 工程入口

后续开发先读 [AGENTS.md](AGENTS.md)、[architecture.md](architecture.md)、[current-task.md](current-task.md)。架构、调用链、已知边界和验证依据见 [工程资料](docs/architecture-review/01-system-architecture.md)。
