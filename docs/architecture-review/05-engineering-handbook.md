# 05 · 工程学习手册

适合了解 JavaScript/React、希望理解桌面本地存储边界的维护者。建议先读 [架构](01-system-architecture.md)，再沿以下源码学习。

## 保存按钮不等于保存成功

`Editor.save` 等待 IPC 返回；只有 `ArchiveStore.commit` 完成元数据重命名后才更新界面。一个容易忽略的反例是：先更新 UI 再写文件，磁盘失败时用户会看到虚假的已保存状态。这里保留草稿、显示错误，内存仍是旧快照。

`tests/store.test.ts` 的「提交失败不更新内存中的角色快照」在临时目录内制造 rename 失败，验证状态不变。建议练习（未执行）：把同一故障贯穿到 UI，观察错误与草稿仍存在。

## 原子文件不是跨文件事务

`atomicWrite` 使用唯一临时文件、文件 fsync 和同目录 rename。它保护单个 JSON 的完整替换，但头像与 JSON 是两次写入；新图成功、JSON 失败可能产生无引用文件。当前选择保留这些文件，不以节省空间牺牲上一版恢复。不能称为数据库级事务或对所有突然断电场景的承诺，目录本身未显式 fsync。

## 离线应用仍有输入边界

`preload.ts` 不暴露任意文件系统或任意 IPC 通道；`main.ts/handle` 校验来源；`validateFields/validateLibrary` 校验数据结构；头像协议拒绝路径遍历。导入文件即使由自己保存，也可能损坏或来自旧版本，所以在修改当前库前完整验证。桌面测试确认 renderer 不存在 `require`，网络请求受 CSP 阻止。

Electron 的上下文隔离、安全建议参见 [官方文档](https://www.electronjs.org/docs/latest/tutorial/security)。这是技术语义依据，当前实现的证据仍是源码及测试。

## 单测、桌面测试和打包测试是不同层次

存储单测用合成图片处理器验证提交和恢复，不验证 Electron 图片解码。桌面验收使用真实 nativeImage、真实 IPC 和磁盘，只固定系统选择器返回值，并检查透明像素、头像重启读取和未保存退出保护。相同桌面验收再针对打包后二进制运行，避免只在开发目录成功。

建议练习（未执行）：在临时副本中删除一张头像，观察导出失败和错误提示；不要在真实用户库做故障注入。学习顺序为 `shared/model.ts` → `Editor.save` → `preload.ts` → `main.ts/handle` → `ArchiveStore.save/commit` → 存储测试 → 桌面测试。
