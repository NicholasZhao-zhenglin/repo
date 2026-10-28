# 验收记录

日期：2026-10-28（Asia/Shanghai）。基线：v1.0.0 当次工作树。环境：macOS 26.6.2、arm64、Node.js 24.21.0、npm 11.19.0，Electron 45.1.0。

| 实际命令 / 检查 | 结果 | 覆盖与限制 |
| --- | --- | --- |
| `npm run build` | 退出 0 | TypeScript、Vite、esbuild；Lucide 的 use-client 构建提示不影响本地 React 应用 |
| `npm test` | 11 通过 / 0 失败 | 临时库；保存、并发、输入拒绝、完整备份、坏备份、删除恢复、损坏 JSON、提交失败 |
| `npx playwright test` | 2 通过 / 0 失败 | 真实开发版 Electron UI、IPC、图片与磁盘；替换原生选择器/确认框返回值 |
| `OC_ARCHIVE_EXECUTABLE=…/PersonaArchive npx playwright test` | 2 通过 / 0 失败 | 打包后二进制，同一完整流程及最小 1020×700 窗口、退出保护、透明头像 |
| `node scripts/package.mjs`（指定官方 zip 缓存） | 退出 0 | 生成 arm64 app 和 zip；官方 zip SHA-256 与安装包提供的校验表一致 |
| `codesign --verify --deep --strict` | 退出 0 | 本地临时签名可验证；不代表 Developer ID 公证 |
| 截图检查 | 已查看 | 空态、编辑器、详情、阵营列表及最小窗口；未发现遮挡主要操作或横向溢出 |
| `unzip -t -qq` | 退出 0 | 最终 zip 内部完整性检查 |
| 正常 macOS 启动 + 原生窗口截图 | 通过 | 交付目录中的 app 显示正式空库首页 |
| GitHub Release API 复核 | 已发布 | v1.0.0 非草稿，安装包 120,153,640 字节，远端 SHA-256 与本机一致 |

桌面验收的合成角色、合成 PNG 与数据目录由测试创建并删除；没有读取或写入正式用户库。截图见测试输出（被 Git 忽略），无用户信息的首页截图保存为 `docs/screenshots/home.png`。

未覆盖：其他操作系统/CPU、真实用户的大库压力、各种断电时序、经浏览器下载并带隔离标记的首次启动、公证服务。这里没有把计划或源码观察写成这些场景已经通过。

中间一次打包复验出现头像输入选择器等待超时、退出保护后保存断言超时；此前及最终产物的同两项均通过。该间歇性验收失败尚未确认根因，不能据最终通过宣称已穷尽所有窗口焦点与时序问题。若再次出现，应保留 Playwright trace 后定位；不要在真实库上重复故障注入。
