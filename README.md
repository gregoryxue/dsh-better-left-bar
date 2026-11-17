# dsh-better-left-bar

**Better Left Sidebar for DSH** — DeepSeek Harness 左侧栏增强插件：顶栏一行化 + WorkBuddy 浅蓝皮肤 + 布局编辑器 + 工作区滚动修复。

**Better Left Sidebar for DSH** — One-row compact top bar, WorkBuddy-style light-blue skin, drag-to-reorder layout editor, and workspace scrolling fix for the DSH Web GUI.

![icon](icon.svg)

## ✨ 功能 / Features

| 功能 | 说明 |
|---|---|
| **顶栏一行化** | 新建会话（+）、导航四项（插件/自动化任务/MCP 连接器/更多）、底栏动作（Remote/会话与工作区/账号）全部收进顶行，纯图标等宽等间距，悬浮显示全名 |
| **WorkBuddy 皮肤** | 浅色模式下侧栏染成 WorkBuddy 浅蓝学术风（`#ECF3FF` 底 + 品牌蓝交互色） |
| **布局编辑器** | 左下 ⠿ 圆钮打开面板：行拖拽排序（↑↓）、逐项显隐（×）、重置 |
| **紧凑模式** | 隐藏品牌头，导航间距收紧（默认开） |
| **工作区滚动修复** | 修正新版侧栏工作区区域底部被裁切的问题，会话多时自动出现浅蓝细滚动条 |
| **logo 隐藏** | 品牌头收起，视觉更干净 |

| Feature | Details |
|---|---|
| **One-row top bar** | New-chat (+), nav items, and footer actions (Remote / Sessions / Account) collapsed into one icon row with hover titles |
| **WB skin** | Light-mode sidebar tinted WorkBuddy light-blue academic palette |
| **Layout editor** | ⠿ entry button: drag-to-reorder rows, per-row show/hide, reset |
| **Compact mode** | Brand header hidden, nav spacing tightened (default on) |
| **Scroll fix** | Fixes the workspace area being clipped at the bottom on newer sidebar UI; thin blue scrollbar when content overflows |
| **Logo hidden** | Brand row hidden by default |

## 📦 安装 / Install

**方式一：插件市场（推荐）**

在 DSH Web GUI → 插件 → 插件市场 搜索 `dsh-better-left-bar`。

**方式二：GitHub Release**

```bash
dsh plugin add https://github.com/<you>/dsh-better-left-bar/releases/download/v1.0.0/dsh-better-left-bar-1.0.0.tgz
```

或 GUI 插件页「添加插件」粘贴 Release tgz URL。

**Install via DSH GUI:** Plugins → Add plugin → paste the release tgz URL.

## 🎛 使用 / Usage

- 顶栏布局编辑：左下角 **⠿** 圆钮 → 面板内「一行:开/关」「紧凑:开/关」「全部显示」「重置」
- 悬浮任意图标查看全名
- 需要临时停用皮肤/布局：profile 层 `cordis.patch.yml` 加 `- id: dsh-better-left-bar / disabled: true`

**Layout editor:** click the ⠿ button at the bottom-left. Toggle one-row / compact, show all rows, or reset.

## ⚙️ 兼容性 / Compatibility

- DSH `>= 0.2.1-rc.5`（含 desktop-next 桌面壳与 `dsh web` 自托管）
- 兼容新版 csseja 侧栏 UI 与旧版 data-slot 契约（自动探测）
- 从 `dsh-wb-skin` 迁移：localStorage 布局数据自动搬迁，无需手动操作
- Windows / macOS / Linux

## 🧩 结构 / Anatomy

```
dsh-better-left-bar/
├── index.js          # Host 半边（零依赖，读 patch.yml config）
├── client.js         # 浏览器半边（皮肤 CSS + 布局引擎 + 悬浮操作条）
├── cordis.patch.yml  # bundle patch：insert 插件行
├── icon.svg          # 插件图标
├── package.json      # manifestVersion 1 / dsh.client.platform=web
├── LICENSE           # MIT
└── README.md
```

## 📄 License

MIT
