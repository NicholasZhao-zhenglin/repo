# 02 · 核心调用链

共同前缀是项目根目录；架构见 [01](01-system-architecture.md)，验证见 [记录](evidence/verification.md)。

## 保存角色

`Editor.save` → `window.archive.save` → `preload.ts` 的 `archive:save` → `main.ts/handle` 检查窗口主 frame → `ArchiveStore.save` 进入串行队列 → `validateFields` → 可选头像解码/写入 → `commit` → 成功返回 `Character` → `App.updateCharacter` 和详情页。

渲染进程只读取用户选中的图片为 data URL。主进程检查格式及 20 MB 上限，使用 `nativeImage` 解码、限制像素数及输出长边尺寸，保留透明度。新图片先写入唯一文件名。`atomicWrite` 写临时文件、同步文件内容、重命名；元数据失败时界面仍保留草稿，内存仍是旧状态。不是跨文件事务，失败可能留下无引用图片。测试覆盖保存失败、重启读取和透明头像。

## 浏览与收藏

`App.load` → `archive:load` → `store.snapshot` 返回深拷贝。名称、别名、身份等搜索以及排序在 UI 中派生，不产生磁盘写入。`Portrait` 用受限 `oc-asset` 地址获取头像；协议处理器仅接受 UUID 文件名。收藏通过 `ArchiveStore.favorite` 串行提交后更新 UI；主进程未确认前不假装保存成功。

## 备份导出与恢复

导出：`App.exportBackup` → 主进程原生保存对话框 → `store.exportBackup` 排队 → 收集全部引用头像 → gzip JSON → 临时文件与重命名。取消文件选择返回 null，不修改角色库。

导入：选择 `.ocarchive` → 检查文件大小 → `inspectBackup` 限制解压尺寸、验证版本/字段/UUID、逐张图片解码 → 选择合并或替换（替换再确认）→ `importBackup` 排队并重新验证 → `safetyBackup` 保存当前库 → 新文件名写入图片 → `commit` 元数据。合并按 UUID 去重；不以姓名去重。坏备份验证不通过时，不写现有记录。备份成功而后续提交失败可留下安全副本和无引用图片，但不会报告导入成功。

## 删除与启动恢复

删除：UI 确认 → `store.remove` → 完整安全备份 → 提交移除该 UUID 的新快照 → 返回总览。备份失败则不删除。自动备份只清理符合内部命名规则且超出最近十份的文件。

启动：`ArchiveStore.init` 读取主文件。格式损坏时复制受损原件，再读取 `.previous`；恢复成功标记 `recovered`，UI 提示。若没有可用上一版，保留原件并显示错误，可打开目录或导入备份。仅主文件不存在时创建空库。`OC_ARCHIVE_DATA_DIR` 只用于明确选择的隔离运行目录，测试不访问正式库。
