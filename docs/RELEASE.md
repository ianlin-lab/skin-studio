# Skin Studio 发布、安装与更新

## 给使用者

每个正式版本会发布在 GitHub Releases。下载名称中包含 `arm64` 的 DMG，打开后把 `Skin Studio.app` 拖到“应用程序”文件夹。

第一次从此前的开发版切换到正式应用时，Skin Studio 会尝试迁移已保存的主题、素材和当前主题状态；迁移只发生在新的正式数据目录为空时，不会覆盖现有正式版数据。

更新时下载新版本 DMG，用新的 `Skin Studio.app` 覆盖“应用程序”中的旧版本即可。第一版没有自动更新服务，也不需要账号或云端同步。

由于首版没有 Apple Developer 签名与公证，macOS 可能提示来自未识别开发者。请在 Finder 中右键 `Skin Studio.app`，选择“打开”，再在系统确认框中打开；不要关闭 macOS 的全局安全设置。

## 给维护者

源码保存在本 GitHub 仓库；DMG 不提交进 Git 历史，而是作为同一仓库 GitHub Release 的附件发布。这样克隆仓库的人得到完整源码，普通使用者只需下载 DMG。

发布流程：

1. 更新 `package.json` 版本号。
2. 运行 `npm test`、`npm run typecheck`、`npm run build`。
3. 运行 `npm run dist:mac`，在 `release/` 生成 Apple Silicon DMG。
4. 提交源码、推送 GitHub。
5. 创建与版本号对应的 GitHub Release，并上传 `release/` 内的 DMG。

未签名 DMG 适合作为私人免费工具分发。若以后需要自动更新、消除系统首次打开提示或面向更广泛用户分发，再申请 Apple Developer 账号并接入签名、公证与更新服务。
