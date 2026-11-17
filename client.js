/**
 * dsh-better-left-bar — 浏览器半边。
 *
 * 三段能力，各挂一个 <html> 门控属性：
 *
 * | 模块 | 开关属性          | 作用 |
 * |---|---|---|
 * | WB 皮肤 | data-wb-skin     | 浅色模式下把侧栏染成 WorkBuddy 浅蓝学术风 |
 * | 布局编辑 | data-wb-layout   | 行注册表：悬停操作条（↑↓×）+ 浮动面板 + 指针拖拽，存 localStorage |
 * | 紧凑模式 | data-wb-compact  | 隐藏品牌头、新对话收成小胶囊、压缩导航间距 |
 *
 * v0.1.4 行注册表泛化（老板截图反馈）：
 * - 品牌行（deepseek logo）与新对话行不在 panellist 槽位内，v0.1.3 引擎管不到；
 * - 新增 JS 探测器：按文本（deepseek / 新对话|新会话）+ 类名兜底找到行元素，
 *   爬升到合理行块后打标（data-wb-brand / data-wb-newchat / data-wb-id）；
 * - 悬停操作条改挂侧栏根（aside），导航行有 ↑↓×，额外行只有 ×（不可重排）；
 * - 面板行数 = 导航行 + 额外行，全部可显隐；
 * - 紧凑模式默认开，面板可切换；#wb-debug 哈希打开诊断浮层。
 *
 * v0.1.5 单行模式（老板 2026-11-16 需求：导航项放同一行、文字悬浮展示）：
 * - data-wb-onerow 开关：panellist 导航行改横向 flex，只留图标；
 * - JS 给每个导航行的文字标签元素打 data-wb-label，CSS 隐藏之，
 *   同时把全名写进行元素 title，鼠标悬浮即见；
 * - 面板新增「一行:开/关」切换，localStorage 持久化，默认开。
 *
 * v0.1.3 条目悬停操作条：body 级悬浮层按条目矩形定位，不注入宿主 DOM。
 * v0.1.2 布局引擎：浮动面板 + 指针拖拽 + MutationObserver/定时自愈重放。
 *
 * 硬约束（沿用踩坑结论）：
 * - 不 import 任何 @deepseek-ai/*；不用模板字符串；
 * - 只依赖 data-slot 公开契约与运行时探测，不写死哈希类名；
 * - 所有监听与观察器在 apply 内创建并返回清理函数。
 */

window.__ModuleLoader__.load({
  id: 'dsh-better-left-bar',
  factory() {
    /** 设置命名空间 = cordis.patch.yml 行 id。 */
    const SETTINGS_NS = 'dsh-better-left-bar'

    /** <html> 根标记。 */
    const ATTR_ROOT = 'data-wb-skin-loaded'
    /** 皮肤开关。 */
    const ATTR_SKIN = 'data-wb-skin'
    /** 布局模块开关。 */
    const ATTR_LAYOUT = 'data-wb-layout'
    /** 紧凑模式开关。 */
    const ATTR_COMPACT = 'data-wb-compact'
    /** 单行模式开关。 */
    const ATTR_ONEROW = 'data-wb-onerow'
    /** 拖拽进行中标记（挂 body）。 */
    const ATTR_DRAGGING = 'data-wb-dragging'
    /** 侧栏根元素标记（JS 实测后钉上）。 */
    const ATTR_SIDEBAR = 'data-wb-skin-root'
    /** 编辑模式标记。 */
    const ATTR_EDIT = 'data-wb-edit'

    /** 面板导航槽位：宿主公开契约。
     * v0.1.6：新版 UI 导航容器是 nav.csseja_panelList（data-slot 契约已内移到
     * 按钮内部的图标 div，不能再用）；保留旧选择器兜底。 */
    const NAV_SLOT_SELECTOR = 'nav.csseja_panelList, [data-slot="sidebar.panellist"]'

    /** 布局持久化键（每浏览器）。改名后读新 key miss 时回读旧 key（迁移兼容）。 */
    const STORE_KEY = 'dsh-better-left-bar:layout'
    /** 紧凑模式持久化键。 */
    const COMPACT_KEY = 'dsh-better-left-bar:compact'
    /** 单行模式持久化键。 */
    const ONEROW_KEY = 'dsh-better-left-bar:onerow'
    /** 旧版（dsh-wb-skin 时代）key 前缀：迁移兼容读。 */
    const LEGACY_PREFIX = 'dsh-wb-skin:'

    /** localStorage 读取：新 key 优先，miss 时回读旧 key 并自动搬迁。 */
    function readKey(key) {
      try {
        const v = window.localStorage.getItem(key)
        if (v !== null) return v
        const legacyKey = LEGACY_PREFIX + key.slice(key.indexOf(':') + 1)
        const legacy = window.localStorage.getItem(legacyKey)
        if (legacy !== null) {
          try { window.localStorage.setItem(key, legacy) } catch {}
          return legacy
        }
      } catch {}
      return null
    }

    /** 指针拖拽启动阈值（px）。 */
    const DRAG_THRESHOLD = 6
    /** 诊断浮层哈希。 */
    const DEBUG_HASH = '#wb-debug'

    /* ---------------- 工具 ---------------- */

    function readStore() {
      try {
        const raw = readKey(STORE_KEY)
        if (!raw) return null
        const v = JSON.parse(raw)
        if (v && typeof v === 'object') {
          return {
            order: Array.isArray(v.order) ? v.order : [],
            hidden: Array.isArray(v.hidden) ? v.hidden : [],
          }
        }
      } catch {}
      return null
    }

    function writeStore(state) {
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(state))
      } catch {}
    }

    function clearStore() {
      try {
        window.localStorage.removeItem(STORE_KEY)
      } catch {}
    }

    /** 紧凑模式开关（localStorage 优先，默认开）。 */
    function compactOn() {
      try {
        const v = readKey(COMPACT_KEY)
        if (v === '0') return false
        if (v === '1') return true
      } catch {}
      return true
    }

    /** 单行模式开关（localStorage 优先，默认开）。 */
    function oneRowOn() {
      try {
        const v = readKey(ONEROW_KEY)
        if (v === '0') return false
        if (v === '1') return true
      } catch {}
      return true
    }

    /** 实测页面是否深色：背景不透明且亮度 < 0.45 判深；透明/取不到按浅色处理。 */
    function isDark() {
      try {
        const bg = window.getComputedStyle(document.body).backgroundColor
        const m = /rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s]+([\d.]+))?\)/.exec(bg)
        if (m) {
          const alpha = m[4] === undefined ? 1 : Number(m[4])
          /* 透明或半透明背景亮度不可信：按浅色处理（皮肤保守生效）。 */
          if (alpha >= 0.9) {
            const lum = (0.299 * Number(m[1]) + 0.587 * Number(m[2]) + 0.114 * Number(m[3])) / 255
            return lum < 0.45
          }
          return false
        }
      } catch {}
      try {
        return window.matchMedia('(prefers-color-scheme: dark)').matches
      } catch {}
      return false
    }

    /* ---------------- 皮肤 CSS ---------------- */
    const SKIN_CSS = [
      'html[data-wb-skin] [data-wb-skin-root]{',
      'background:#ECF3FF !important;',
      '--dsw-alias-interactive-bg-hover:#DFEAFD;',
      '--dsw-alias-brand-primary:#3966AC;',
      '--dsw-alias-label-primary:#001F4Fe6;',
      '--dsw-alias-label-secondary:#001F4Fb3;',
      '--dsw-alias-label-tertiary:#001F4F80;',
      '--dsw-alias-border-l2:#DCE8FF;',
      '}',
      /* 条目 hover / 选中：WB 节奏只加深一档 */
      'html[data-wb-skin] [data-wb-skin-root] button:hover,',
      'html[data-wb-skin] [data-wb-skin-root] [role="menuitem"]:hover,',
      'html[data-wb-skin] [data-wb-skin-root] a:hover{background:#DFEAFD !important;color:#001F4Fe6 !important}',
      'html[data-wb-skin] [data-wb-skin-root] [aria-current="true"],',
      'html[data-wb-skin] [data-wb-skin-root] [aria-pressed="true"],',
      'html[data-wb-skin] [data-wb-skin-root] [data-state="active"],',
      'html[data-wb-skin] [data-wb-skin-root] [class*="active" i]:not([class*="inactive" i]){',
      'background:#D9E8FF !important;color:#22406E !important}',
      /* 文本与描边 */
      'html[data-wb-skin] [data-wb-skin-root]{color:#001F4Fe6}',
      'html[data-wb-skin] [data-wb-skin-root] hr,',
      'html[data-wb-skin] [data-wb-skin-root] [class*="divider"]{border-color:#DCE8FF !important}',
      /* 滚动条：浅蓝拇指 */
      'html[data-wb-skin] [data-wb-skin-root] *{scrollbar-color:#BAD3F2 transparent}',
      'html[data-wb-skin] [data-wb-skin-root] ::-webkit-scrollbar-thumb{background:#BAD3F2;border-radius:8px}',
      'html[data-wb-skin] [data-wb-skin-root] ::-webkit-scrollbar-track{background:transparent}',
      /* 输入类控件 */
      'html[data-wb-skin] [data-wb-skin-root] input,',
      'html[data-wb-skin] [data-wb-skin-root] textarea{background:#FFFFFF;border-color:#BAD3F2;color:#001F4Fe6}',
      'html[data-wb-skin] [data-wb-skin-root] input::placeholder,',
      'html[data-wb-skin] [data-wb-skin-root] textarea::placeholder{color:#001F4F4d}',
      /* 金色点缀：未读徽章类 */
      'html[data-wb-skin] [data-wb-skin-root] [class*="badge" i],',
      'html[data-wb-skin] [data-wb-skin-root] [class*="unread" i]{color:#B8960F}',

      /* ---------------- 布局编辑模式 ---------------- */
      'html[data-wb-layout] [data-wb-slot-nav]{display:flex !important;flex-direction:column !important}',
      'html[data-wb-edit] [data-wb-slot-nav]{',
      'outline:2px dashed #3966AC;outline-offset:2px;border-radius:10px;',
      'background-image:linear-gradient(#3966AC14 1px,transparent 1px),linear-gradient(90deg,#3966AC14 1px,transparent 1px);',
      'background-size:16px 16px;}',
      'html[data-wb-edit] [data-wb-slot-nav] > *{cursor:grab !important;border-radius:8px}',
      'html[data-wb-edit] [data-wb-slot-nav] > *:hover{outline:1px dashed #3966AC66;outline-offset:-1px}',
      'html[data-wb-edit] [data-wb-slot-nav] > [data-wb-dragging]{opacity:0.5;outline:2px solid #3966AC !important}',
      'html[data-wb-edit] [data-wb-slot-nav] > *[data-wb-hidden]{opacity:0.35;outline:1px dashed #E6C029}',
      /* 隐藏行：导航行 + 探测行通用（display 规则挂 data-wb-hidden） */
      'html[data-wb-layout] [data-wb-slot-nav] > *[data-wb-hidden]{display:none !important}',
      'html[data-wb-layout] [data-wb-skin-root] > [data-wb-hidden],',
      'html[data-wb-layout] [data-wb-brand][data-wb-hidden],',
      'html[data-wb-layout] [data-wb-newchat][data-wb-hidden]{display:none !important}',

      /* ---------------- 紧凑模式 ---------------- */
      /* 品牌头隐藏；新对话收成不占满行的小胶囊；导航间距收紧 */
      'html[data-wb-compact] [data-wb-brand]{display:none !important}',
      'html[data-wb-compact] [data-wb-newchat]{',
      'width:fit-content !important;max-width:160px !important;',
      'margin:4px auto 2px auto !important;}',
      'html[data-wb-compact] [data-wb-newchat] *{font-size:12px !important}',
      'html[data-wb-compact] [data-wb-slot-nav]{gap:1px !important;padding-top:2px !important;padding-bottom:2px !important}',

      /* ---------------- 单行模式（v0.1.5） ---------------- */
      /* 导航行横排一行；行内文字标签隐藏，全名走 title 悬浮展示。 */
      'html[data-wb-onerow] [data-wb-slot-nav]{',
      'flex-direction:row !important;flex-wrap:nowrap !important;',
      'justify-content:space-around !important;align-items:center !important;',
      'gap:2px !important;overflow-x:hidden !important;}',
      'html[data-wb-onerow] [data-wb-slot-nav] > [data-wb-id]{',
      'flex:none !important;width:auto !important;min-width:0 !important;}',
      'html[data-wb-onerow] [data-wb-slot-nav] > [data-wb-id] [data-wb-label]{',
      'display:none !important;}',
      /* 悬浮提示跟随原生 title，这里补一个视觉暗示：图标行 hover 加底色由皮肤规则负责 */

      /* ---------------- 合并一行（v0.1.7）：新会话胶囊 + 四个导航项同排 ---------------- */
      /* 侧栏根改 wrap 横排：logoRow 已被紧凑模式 display:none 不占位；
       * newSession 与 nav 归入第一行，regionArea/footArea 换行占满。 */
      'html[data-wb-onerow] [data-wb-skin-root].csseja_root{',
      'display:flex !important;flex-direction:row !important;flex-wrap:wrap !important;',
      'align-items:center !important;}',
      'html[data-wb-onerow] [data-wb-skin-root] .csseja_newSession{',
      'order:0 !important;flex:none !important;margin:4px 2px 2px 8px !important;}',
      'html[data-wb-onerow] [data-wb-skin-root] nav.csseja_panelList{',
      'order:1 !important;flex:1 1 0 !important;min-width:0 !important;margin:0 !important;}',
      'html[data-wb-onerow] [data-wb-skin-root] .csseja_regionArea,',
      'html[data-wb-onerow] [data-wb-skin-root] .csseja_footArea{',
      'order:2 !important;flex:1 1 100% !important;}',
      /* 合并后导航可用宽度变小：四项均分并隐藏文字不变；新会话胶囊不再居中 */
      'html[data-wb-onerow] [data-wb-skin-root] nav.csseja_panelList [data-wb-slot-nav]{',
      'justify-content:space-between !important;padding-left:2px !important;padding-right:2px !important;}',
      /* 旧版结构（非 csseja）不受合并影响：选择器全部带 .csseja_root 前缀 */

      /* ---------------- 底栏上收（v0.1.9）：Remote/会话管理/账号 并入顶行 ---------------- */
      /* v0.1.7 合并行把 footArea 挤出可视区（实测 y=716 > 侧栏 659）。改法：
       * footArea 整体隐藏，三个功能按钮由 JS 移入 nav 尾部并打 data-wb-foot；
       * CSS 图标化（只留图标、定宽），悬浮 title 由 JS 保留原 aria-label。 */
      'html[data-wb-onerow] [data-wb-skin-root] .csseja_footArea{display:none !important;}',
      'html[data-wb-onerow] [data-wb-skin-root] [data-wb-foot]{',
      'flex:none !important;width:28px !important;min-width:28px !important;max-width:28px !important;',
      'padding:0 !important;justify-content:center !important;overflow:hidden !important;}',
      'html[data-wb-onerow] [data-wb-skin-root] [data-wb-foot] [class*="wide"],',
      'html[data-wb-onerow] [data-wb-skin-root] [data-wb-foot] kbd,',
      'html[data-wb-onerow] [data-wb-skin-root] [data-wb-foot] [class*="Shortcut"],',
      'html[data-wb-onerow] [data-wb-skin-root] [data-wb-foot] [class*="Label"],',
      'html[data-wb-onerow] [data-wb-skin-root] [data-wb-foot] [class*="label" i],',
      'html[data-wb-onerow] [data-wb-skin-root] [data-wb-foot] [class*="text" i]:not(svg),',
      'html[data-wb-onerow] [data-wb-skin-root] [data-wb-foot] span:not([class*="Glyph"]):not([class*="glyph"]):not(:has(svg)):not(:has(img)){',
      'display:none !important;}',
      /* 头像缩成小圆与图标行协调；svg 图标 16px 对齐 */
      'html[data-wb-onerow] [data-wb-skin-root] [data-wb-foot] img,',
      'html[data-wb-onerow] [data-wb-skin-root] [data-wb-foot] [class*="avatar" i]{',
      'width:16px !important;height:16px !important;max-width:16px !important;object-fit:cover !important;}',
      'html[data-wb-onerow] [data-wb-skin-root] [data-wb-foot] svg{',
      'width:16px !important;height:16px !important;flex:none !important;}',
      /* 顶行排布（v0.2.0）：八项等宽等间距。
       * 实测结论：宿主给行加的 border-inline-width(2.7px paint-inset) 与水平 padding
       * 会干扰 flex 均分（border 参与盒计算导致两档宽度），必须一并归零。 */
      'html[data-wb-onerow] [data-wb-skin-root] nav.csseja_panelList{',
      'justify-content:space-between !important;gap:0 !important;}',
      'html[data-wb-onerow] [data-wb-skin-root] nav.csseja_panelList > [data-wb-id],',
      'html[data-wb-onerow] [data-wb-skin-root] nav.csseja_panelList > [data-wb-foot]{',
      'flex:1 1 0px !important;width:0px !important;min-width:0px !important;max-width:none !important;',
      'box-sizing:border-box !important;border-inline-width:0px !important;',
      'padding-left:0px !important;padding-right:0px !important;}',
      /* 每项内部图标居中 */
      'html[data-wb-onerow] [data-wb-skin-root] nav.csseja_panelList > [data-wb-id] > span:first-child{',
      'width:100% !important;display:flex !important;justify-content:center !important;}',
      'html[data-wb-onerow] [data-wb-skin-root] nav.csseja_panelList > [data-wb-id] button,',
      'html[data-wb-onerow] [data-wb-skin-root] nav.csseja_panelList > [data-wb-foot]{',
      'justify-content:center !important;display:flex !important;align-items:center !important;}',
      /* 新会话参与等分节奏：32px 定宽（=导航项均分宽度）+ 居中图标 */
      'html[data-wb-onerow] [data-wb-skin-root] .csseja_newSession{',
      'width:32px !important;flex:none !important;margin:4px 0 2px 6px !important;justify-content:center !important;display:flex !important;align-items:center !important;padding:0 !important;border-inline-width:0 !important;',
      /* v0.2.1：与导航行视觉统一 —— 去白底/描边，透明背景 */
      'background:transparent !important;border:0 !important;box-shadow:none !important;}',
      /* 新会话 hover 反馈对齐导航行（浅蓝底由皮肤变量承担） */
      'html[data-wb-onerow] [data-wb-skin-root] .csseja_newSession:hover{',
      'background:#DFEAFD !important;}',
      /* v0.2.3：只留 + 图标，去掉「新」字与快捷键提示 */
      'html[data-wb-compact] [data-wb-skin-root] .csseja_newSessionLabel,',
      'html[data-wb-onerow] [data-wb-skin-root] .csseja_newSessionLabel,',
      'html[data-wb-compact] [data-wb-skin-root] .csseja_newSessionShortcut,',
      'html[data-wb-onerow] [data-wb-skin-root] .csseja_newSessionShortcut{',
      'display:none !important;}',

      /* ---------------- 工作区滚动（v0.2.2）：region 限高防溢出 ---------------- */
      /* v0.1.7 起 regionArea 内容高 700 > 侧栏 659，底部被裁 95px（最后一屏会话
       * 看不见）。修复：region 定高占满顶行以下剩余空间，自身 overflow-y:auto
       * 兜底；内部 NSkPbW_list 本就有 overflow:auto，双层保险。 */
      'html[data-wb-onerow] [data-wb-skin-root].csseja_root{',
      'height:100% !important;}',
      'html[data-wb-onerow] [data-wb-skin-root] .csseja_regionArea{',
      'flex:0 0 auto !important;width:100% !important;min-height:0 !important;',
      'height:calc(100% - 54px) !important;',
      'overflow-y:auto !important;overflow-x:hidden !important;}',
      /* 滚动条样式与 WB 皮肤一致 */
      'html[data-wb-onerow] [data-wb-skin-root] .csseja_regionArea{',
      'scrollbar-width:thin;scrollbar-color:#BAD3F2 transparent;}',
      'html[data-wb-onerow] [data-wb-skin-root] .csseja_regionArea::-webkit-scrollbar{width:8px}',
      'html[data-wb-onerow] [data-wb-skin-root] .csseja_regionArea::-webkit-scrollbar-thumb{background:#BAD3F2;border-radius:8px}',
      'html[data-wb-onerow] [data-wb-skin-root] .csseja_regionArea::-webkit-scrollbar-track{background:transparent}',
      /* 新会话图标尺寸 */
      'html[data-wb-onerow] [data-wb-skin-root] .csseja_newSession svg,',
      'html[data-wb-compact] [data-wb-skin-root] .csseja_newSession svg{',
      'width:16px !important;height:16px !important;}',
      /* 紧凑未开单行（旧版布局）：footArea 原样保留不受影响 */

      /* ---------------- 图标风格统一（v0.1.8）：新会话图标对齐导航四项 ---------------- */
      /* 新会话原用 -outline-medium（更重）；导航四项是 -outline-regular（16px）。
       * 紧凑/单行下 JS 把 use href 换成同族 -regular 版本，并把尺寸提到 16px。 */
      'html[data-wb-compact] [data-wb-skin-root] .csseja_newSession svg{',
      'width:16px !important;height:16px !important;}',
      'html[data-wb-onerow] [data-wb-skin-root] .csseja_newSession svg{',
      'width:16px !important;height:16px !important;}',

      /* ---------------- 浮动编辑面板 ---------------- */
      '.wb-panel{position:fixed;left:12px;bottom:96px;z-index:2147483000;box-sizing:border-box;',
      'min-width:230px;max-width:300px;max-height:60vh;overflow:auto;padding:10px;',
      'border:1px solid #DCE8FF;border-radius:14px;background:#FFFFFF;color:#001F4Fe6;',
      'box-shadow:0 12px 28px rgba(0,31,79,.22);font-size:13px}',
      '.wb-panel-title{font-weight:600;color:#22406E;margin:0 0 8px;font-size:12px;letter-spacing:0.5px}',
      '.wb-row{display:flex;align-items:center;gap:4px;padding:3px 0}',
      '.wb-row[data-wb-row-hidden]{opacity:0.45}',
      '.wb-row[data-wb-row-extra] .wb-label{color:#001F4F80;font-style:italic}',
      '.wb-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
      'font-size:12px;color:#001F4Fe6;user-select:none}',
      '.wb-btn{flex:none;width:24px;height:24px;line-height:22px;text-align:center;padding:0;',
      'border:1px solid #BAD3F2;border-radius:7px;background:#ECF3FF;color:#22406E;',
      'font-size:12px;cursor:pointer}',
      '.wb-btn:hover{background:#DFEAFD}',
      '.wb-btn:disabled{opacity:0.3;pointer-events:none}',
      '.wb-row-actions{display:flex;flex:1;gap:4px;justify-content:flex-end}',
      '.wb-panel-foot{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}',
      '.wb-panel-foot button{flex:1;border:none;border-radius:8px;padding:7px 0;min-width:64px;',
      'background:#ECF3FF;color:#22406E;font:inherit;font-size:12px;cursor:pointer}',
      '.wb-panel-foot button:hover{background:#DFEAFD}',
      '.wb-panel-foot button[data-wb-primary]{background:#3966AC;color:#FFFFFF}',
      '.wb-panel-foot button[data-wb-primary]:hover{background:#2C4F87}',
      '.wb-hint{margin:8px 0 0;font-size:11px;color:#001F4F80;line-height:1.5}',

      /* 编辑入口圆钮 */
      '.wb-edit-entry{position:fixed;left:10px;bottom:96px;z-index:2147482999;width:26px;height:26px;',
      'border-radius:999px;border:1px solid #DCE8FF;background:#FFFFFF;color:#3966AC;',
      'font-size:13px;cursor:pointer;opacity:0.55;padding:0;line-height:24px;text-align:center}',
      '.wb-edit-entry:hover{opacity:1;background:#ECF3FF}',
      'html[data-wb-edit] .wb-edit-entry{display:none}',

      /* ---------------- 条目悬停操作条（body 级悬浮层） ---------------- */
      '.wb-itembar{position:fixed;z-index:2147483000;display:flex;gap:1px;padding:2px;',
      'border:1px solid #DCE8FF;border-radius:9px;background:#FFFFFF;color:#22406E;',
      'box-shadow:0 4px 14px rgba(0,31,79,.18)}',
      '.wb-itembar[hidden]{display:none}',
      '.wb-itembar .wb-btn{width:22px;height:22px;line-height:20px;text-align:center;padding:0;',
      'border:none;border-radius:7px;background:transparent;color:#22406E;font-size:12px;cursor:pointer}',
      '.wb-itembar .wb-btn:hover{background:#DFEAFD;color:#3966AC}',
      '.wb-itembar .wb-btn:disabled{opacity:0.25;pointer-events:none}',
      '.wb-itembar .wb-btn[data-wb-hide="1"]{color:#B8960F}',
      '.wb-itembar .wb-btn[data-wb-hide="1"]:hover{background:#fdf7e2}',

      /* ---------------- 诊断浮层（#wb-debug） ---------------- */
      '.wb-debug{position:fixed;right:8px;bottom:8px;z-index:2147483646;max-width:420px;',
      'max-height:50vh;overflow:auto;padding:10px;border-radius:10px;background:#0b1020e6;',
      'color:#9fe8a8;font:11px/1.6 Consolas,monospace;white-space:pre-wrap;pointer-events:none}',
    ]

    /* ---------------- 行探测（v0.1.4） ---------------- */

    /** 从含目标文本的最深元素向上爬到「stopAt 的直接子元素」为止——
     * 品牌行/新对话行都是侧栏容器的直接子级，结构判据比文本阈值稳定。 */
    function climbToRow(el, stopAt) {
      let row = el
      let guard = 0
      while (row.parentElement && row.parentElement !== stopAt && guard < 12) {
        row = row.parentElement
        guard++
      }
      /* row.parentElement === stopAt 时 row 即 stopAt 直接子级；guard 耗尽则保守返回原层。 */
      if (row.parentElement !== stopAt) return el
      return row
    }

    /** 在 scope 内找「自身文本节点」命中正则的最深元素。 */
    function probeDeepByOwnText(scope, re) {
      if (!scope) return null
      let deep = null
      for (const el of scope.querySelectorAll('*')) {
        for (const n of el.childNodes) {
          if (n.nodeType === 3 && n.textContent && re.test(n.textContent)) {
            deep = el
            break
          }
        }
      }
      return deep
    }

    /** 单行模式辅助：把导航行内的纯文字标签元素打 data-wb-label，
     * 同时把全名写进行元素 title（悬浮展示）。
     * v0.1.6：新版 UI 文字固定在 span.csseja_panelTitle，类名直取；
     * 旧版/未知结构退回「纯文本元素」启发式。 */
    function markNavLabels(row) {
      if (!row) return
      let label = row.querySelector('.csseja_panelTitle')
      if (!label) {
        for (const el of row.querySelectorAll('*')) {
          let own = ''
          for (const n of el.childNodes) {
            if (n.nodeType === 3 && n.textContent) own += n.textContent
          }
          own = own.trim()
          if (!own) continue
          if (el.querySelector('button, a, input, [role]')) continue
          label = el
          break
        }
      }
      if (label) label.setAttribute('data-wb-label', '')
      const name = (row.textContent || '').replace(/\s+/g, ' ').trim()
      if (name && !row.title) row.title = name
    }

    /* ---------------- 主体 ---------------- */

    return {
      inject: [],
      apply(ctx) {
        const disposers = []
        const push = (dispose) => {
          if (typeof dispose === 'function') disposers.push(dispose)
        }
        const doc = document
        const root = doc.documentElement

        /* ---------- 临时诊断横幅（v0.1.4 实验，验证后移除） ---------- */
        try {
          const banner = doc.createElement('div')
          banner.id = 'wb-skin-banner'
          banner.textContent = '✅ dsh-better-left-bar v1.0.0 已注入（诊断横幅，稍后移除）'
          banner.style.cssText =
            'position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:2147483647;' +
            'padding:6px 14px;background:#3966AC;color:#fff;font:12px/1.6 sans-serif;' +
            'border-radius:0 0 10px 10px;box-shadow:0 2px 10px rgba(0,0,0,.3)'
          doc.body.appendChild(banner)
          window.setTimeout(() => banner.remove(), 10000)
        } catch {}

        root.setAttribute(ATTR_ROOT, 'on')

        /* ---------- 开关读取 ---------- */
        let configApi = null
        try {
          if (ctx && ctx.configForms && typeof ctx.configForms.get === 'function') configApi = ctx.configForms
        } catch {}

        const readFlags = () => {
          const fallback = { skin: true, layout: true }
          if (!configApi) return fallback
          try {
            const v = configApi.get(SETTINGS_NS)
            if (v && typeof v === 'object') {
              return { skin: v.skin !== false, layout: v.layout !== false }
            }
          } catch {}
          return fallback
        }

        let flags = readFlags()

        /* ---------- 样式表 ---------- */
        const styleTag = doc.createElement('style')
        styleTag.dataset.plugin = 'dsh-better-left-bar'
        styleTag.textContent = SKIN_CSS.join('\n')
        doc.head.appendChild(styleTag)
        push(() => styleTag.remove())

        /* ---------- 开关 -> 属性 ---------- */
        let darkMedia = null
        try {
          darkMedia = window.matchMedia('(prefers-color-scheme: dark)')
        } catch {}

        const paintFlags = () => {
          flags = readFlags()
          if (flags.skin && !isDark()) root.setAttribute(ATTR_SKIN, 'on')
          else root.removeAttribute(ATTR_SKIN)
          if (flags.layout) root.setAttribute(ATTR_LAYOUT, 'on')
          else root.removeAttribute(ATTR_LAYOUT)
          if (flags.layout && compactOn()) root.setAttribute(ATTR_COMPACT, 'on')
          else root.removeAttribute(ATTR_COMPACT)
          if (flags.layout && oneRowOn()) root.setAttribute(ATTR_ONEROW, 'on')
          else root.removeAttribute(ATTR_ONEROW)
          if (!flags.layout) exitEdit()
        }
        paintFlags()

        if (darkMedia && typeof darkMedia.addEventListener === 'function') {
          darkMedia.addEventListener('change', paintFlags)
          push(() => darkMedia.removeEventListener('change', paintFlags))
        }
        const flagTimer = window.setInterval(paintFlags, 2000)
        push(() => window.clearInterval(flagTimer))

        /* ---------- 侧栏根实测与钉标 ---------- */
        let sidebarEl = null

        const findSidebar = () => {
          /* v0.1.6：优先新版 UI 的 csseja_root；否则沿用 panellist 爬升。 */
          const rootEl = doc.querySelector('.csseja_root')
          if (rootEl) return rootEl
          const nav = doc.querySelector(NAV_SLOT_SELECTOR)
          if (!nav) return null
          const aside = nav.closest('aside') || nav.closest('[class*="sidebar" i]') || nav.closest('nav')
          return aside || nav
        }

        const markSidebar = () => {
          const el = findSidebar()
          if (el === sidebarEl) return
          if (sidebarEl) sidebarEl.removeAttribute(ATTR_SIDEBAR)
          sidebarEl = el
          if (sidebarEl) sidebarEl.setAttribute(ATTR_SIDEBAR, '')
        }

        /* ---------- 布局引擎 ---------- */
        let navList = null
        let editMode = false
        let state = readStore() || { order: [], hidden: [] }
        let panelEl = null
        let entryEl = null

        const idFor = (el, seen) => {
          let label = ''
          try {
            label = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24)
          } catch {}
          const base = label || 'item'
          const n = seen.get(base) || 0
          seen.set(base, n + 1)
          return n === 0 ? base : base + '#' + n
        }

        const discover = () => {
          if (!flags.layout) return null
          const el = doc.querySelector(NAV_SLOT_SELECTOR)
          if (!el || el.children.length === 0) return null
          return el
        }

        /**
         * 额外行探测：品牌行 / 新对话行（不在 panellist 内）。
         * v0.1.6：新版 UI 直接按类名命中 .csseja_logoRow / .csseja_newSession，
         * 文本探测仅作旧版兜底。
         */
        const collectExtraRows = () => {
          if (!sidebarEl) return []
          const rows = []
          const seen = new Map()

          /* 品牌行：新版 .csseja_logoRow 优先；旧版文本/类名兜底。 */
          let brand =
            sidebarEl.querySelector('.csseja_logoRow') ||
            probeDeepByOwnText(sidebarEl, /deepseek/i) ||
            sidebarEl.querySelector('[class*="brand" i]')
          if (brand) {
            brand = climbToRow(brand, sidebarEl)
            if (brand && !brand.contains(navList) && brand !== navList) {
              brand.setAttribute('data-wb-brand', '')
              rows.push({ el: brand, seen })
            }
          }

          /* 新对话行：新版 .csseja_newSession 优先；旧版文本兜底。 */
          let nc =
            sidebarEl.querySelector('.csseja_newSession') ||
            probeDeepByOwnText(sidebarEl, /新对话|新会话/)
          if (nc) {
            nc = climbToRow(nc, sidebarEl)
            if (nc && !nc.contains(navList) && nc !== navList && !rows.some((r) => r.el === nc)) {
              nc.setAttribute('data-wb-newchat', '')
              /* 紧凑/单行下胶囊只剩图标：悬浮提示补全名。 */
              if (!nc.title) nc.title = '新会话 (Ctrl+Alt+N)'
              /* v0.1.8：图标换族 —— -outline-medium → -outline-regular，与导航四项同风格。
               * v0.2.0：老板要求直接换成「+」→ 用同族 #dsw-icon-plus-outline-regular。 */
              const useEl = nc.querySelector('use')
              if (useEl) {
                const href = useEl.getAttribute('href') || useEl.getAttribute('xlink:href') || ''
                if (href.indexOf('dsw-icon-') === 0 || href.indexOf('#dsw-icon-') === 0) {
                  const plus = '#dsw-icon-plus-outline-regular'
                  if (href !== plus) {
                    useEl.setAttribute('href', plus)
                    useEl.setAttribute('xlink:href', plus)
                  }
                }
              }
              rows.push({ el: nc, seen })
            }
          }
          return rows
        }

        /** 把 state 投影到行属性上（React 抹掉后由观察器/定时器重放）。 */
        const applyLayout = () => {
          if (!navList) return
          const orderIndex = new Map()
          state.order.forEach((id, i) => orderIndex.set(id, i))
          const hiddenSet = new Set(state.hidden)
          const seen = new Map()
          for (const item of Array.from(navList.children)) {
            const id = idFor(item, seen)
            item.setAttribute('data-wb-id', id)
            if (orderIndex.has(id)) item.style.order = String(orderIndex.get(id))
            else item.style.order = ''
            if (hiddenSet.has(id)) item.setAttribute('data-wb-hidden', '')
            else item.removeAttribute('data-wb-hidden')
            if (root.hasAttribute(ATTR_ONEROW)) markNavLabels(item)
            else {
              const lb = item.querySelector('[data-wb-label]')
              if (lb) lb.removeAttribute('data-wb-label')
            }
          }
          navList.setAttribute('data-wb-slot-nav', '')
          /* 额外行：打 id + 显隐（不可重排）。 */
          for (const row of collectExtraRows()) {
            const id = idFor(row.el, seen)
            row.el.setAttribute('data-wb-id', id)
            if (hiddenSet.has(id)) row.el.setAttribute('data-wb-hidden', '')
            else row.el.removeAttribute('data-wb-hidden')
          }
          collectFootButtons()
        }

        /**
         * 底栏上收（v0.1.9）：把 footArea 的 Remote / 会话与工作区 / 账号菜单
         * 三个按钮移入 nav 尾部打 data-wb-foot（单行+紧凑下 footArea 已 CSS 隐藏，
         * 不搬走就看不见）。React 重渲染重建按钮后由观察器重放：先归还旧宿主
         * 位置（parentElement 记录在按钮 data-wb-home），再重新搬入，避免重复搬移。
         */
        const collectFootButtons = () => {
          if (!navList || !sidebarEl) return
          if (!root.hasAttribute(ATTR_ONEROW)) {
            /* 关闭单行时归还原位。 */
            for (const el of Array.from(navList.querySelectorAll('[data-wb-foot]'))) {
              const home = el.getAttribute('data-wb-home')
              if (home) {
                try { doc.querySelector(home)?.appendChild(el) } catch {}
                el.removeAttribute('data-wb-foot')
                el.removeAttribute('data-wb-home')
              }
            }
            return
          }
          const foot = sidebarEl.querySelector('.csseja_footArea')
          if (!foot) return
          const picks = [
            '.dshRemoteModeButton',
            '.sm-footerBtn',
            '[class*="TLOgsq_trigger"], [aria-label="账号菜单"]',
          ]
          for (const sel of picks) {
            let btn = foot.querySelector(sel)
            if (!btn || navList.contains(btn)) continue
            /* home 选择器：类名前两段拼一个稳定选择器，重放时归还用。 */
            const cls = (typeof btn.className === 'string' ? btn.className : '').trim().split(/\s+/).slice(0, 2).map(c => '.' + c).join('')
            btn.setAttribute('data-wb-home', cls || '.csseja_footArea')
            btn.setAttribute('data-wb-foot', '')
            if (!btn.title) btn.title = btn.getAttribute('aria-label') || ''
            navList.appendChild(btn)
          }
        }

        /** 行快照：[{id, el, hidden, group}]，导航行在前、额外行在后。 */
        const snapshotItems = () => {
          const items = []
          const hiddenSet = new Set(state.hidden)
          if (navList) {
            const seen = new Map()
            for (const el of Array.from(navList.children)) {
              const id = idFor(el, seen)
              items.push({ id, el, hidden: hiddenSet.has(id), group: 'nav' })
            }
          }
          if (sidebarEl) {
            const seen = new Map()
            for (const row of collectExtraRows()) {
              const id = idFor(row.el, seen)
              items.push({ id, el: row.el, hidden: hiddenSet.has(id), group: 'extra' })
            }
          }
          return items
        }

        const moveInState = (id, delta) => {
          if (!navList) return
          const seen = new Map()
          const navIds = Array.from(navList.children).map((el) => idFor(el, seen))
          if (!navIds.includes(id)) return
          const from = navIds.indexOf(id)
          const to = Math.min(Math.max(from + delta, 0), navIds.length - 1)
          if (to === from) return
          navIds.splice(to, 0, navIds.splice(from, 1)[0])
          state.order = navIds
          writeStore(state)
          applyLayout()
          refreshPanel()
        }

        const toggleHidden = (id) => {
          const set = new Set(state.hidden)
          if (set.has(id)) set.delete(id)
          else set.add(id)
          state.hidden = Array.from(set)
          writeStore(state)
          applyLayout()
          refreshPanel()
        }

        /* ---------- 指针拖拽（编辑态，仅导航行） ---------- */
        let dragCtx = null

        const onPointerDown = (ev) => {
          if (!editMode || !navList) return
          if (ev.button !== 0) return
          const item = ev.target && ev.target.closest ? ev.target.closest('[data-wb-id]') : null
          if (!item || !navList.contains(item)) return
          dragCtx = {
            item,
            startX: ev.clientX,
            startY: ev.clientY,
            moved: false,
            pointerId: ev.pointerId,
          }
        }

        const onPointerMove = (ev) => {
          if (!dragCtx) return
          const dx = ev.clientX - dragCtx.startX
          const dy = ev.clientY - dragCtx.startY
          if (!dragCtx.moved) {
            if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
            dragCtx.moved = true
            dragCtx.item.setAttribute('data-wb-dragging', '')
            doc.body.setAttribute(ATTR_DRAGGING, 'on')
            try {
              if (navList.setPointerCapture && ev.pointerId !== undefined) {
                navList.setPointerCapture(ev.pointerId)
              }
            } catch {}
          }
          ev.preventDefault()
          const items = Array.from(navList.querySelectorAll('[data-wb-id]')).filter(
            (el) => el !== dragCtx.item,
          )
          let before = null
          for (const el of items) {
            const box = el.getBoundingClientRect()
            if (ev.clientY < box.top + box.height / 2) {
              before = el
              break
            }
          }
          if (before === null) navList.appendChild(dragCtx.item)
          else if (before !== dragCtx.item) navList.insertBefore(dragCtx.item, before)
        }

        const endDrag = (ev) => {
          if (!dragCtx) return
          const wasMoved = dragCtx.moved
          const item = dragCtx.item
          dragCtx = null
          doc.body.removeAttribute(ATTR_DRAGGING)
          item.removeAttribute('data-wb-dragging')
          if (!wasMoved) return
          try {
            if (navList.hasPointerCapture && ev.pointerId !== undefined && navList.hasPointerCapture(ev.pointerId)) {
              navList.releasePointerCapture(ev.pointerId)
            }
          } catch {}
          const seen = new Map()
          const domIds = Array.from(navList.children).map((el) => idFor(el, seen))
          const hiddenSet = new Set(state.hidden)
          const missing = state.order.filter((id) => !domIds.includes(id) && hiddenSet.has(id))
          state.order = domIds.concat(missing)
          writeStore(state)
          applyLayout()
          refreshPanel()
        }

        const onClickCapture = (ev) => {
          if (!editMode || !navList) return
          const t = ev.target
          if (t && typeof t.closest === 'function' && t.closest('[data-wb-id]')) {
            ev.preventDefault()
            ev.stopPropagation()
          }
        }

        const bindDrag = () => {
          if (!navList) return
          navList.addEventListener('pointerdown', onPointerDown, true)
          navList.addEventListener('pointermove', onPointerMove, true)
          navList.addEventListener('pointerup', endDrag, true)
          navList.addEventListener('pointercancel', endDrag, true)
          navList.addEventListener('click', onClickCapture, true)
        }

        const unbindDrag = () => {
          if (!navList) return
          navList.removeEventListener('pointerdown', onPointerDown, true)
          navList.removeEventListener('pointermove', onPointerMove, true)
          navList.removeEventListener('pointerup', endDrag, true)
          navList.removeEventListener('pointercancel', endDrag, true)
          navList.removeEventListener('click', onClickCapture, true)
        }

        /* ---------- 条目悬停操作条（挂侧栏根，导航行+额外行通用） ---------- */
        let itembarEl = null
        let itembarTarget = null
        let itembarBoundEl = null

        const buildItembar = () => {
          const bar = doc.createElement('div')
          bar.className = 'wb-itembar'
          bar.hidden = true
          const mk = (label, title, attr, onClick) => {
            const b = doc.createElement('button')
            b.className = 'wb-btn'
            b.type = 'button'
            b.textContent = label
            b.title = title
            if (attr) b.setAttribute(attr, '')
            b.addEventListener('pointerdown', (e) => e.stopPropagation())
            b.addEventListener('click', (e) => {
              e.stopPropagation()
              if (itembarTarget) onClick(itembarTarget)
              hideItembar()
            })
            return b
          }
          bar.appendChild(mk('↑', '上移', null, (id) => moveInState(id, -1)))
          bar.appendChild(mk('↓', '下移', null, (id) => moveInState(id, 1)))
          bar.appendChild(mk('×', '隐藏该项', 'data-wb-hide', (id) => toggleHidden(id)))
          doc.body.appendChild(bar)
          return bar
        }

        const hideItembar = () => {
          if (itembarEl) itembarEl.hidden = true
          itembarTarget = null
        }

        const onSidebarPointerMove = (ev) => {
          if (!sidebarEl || editMode) return
          const t = ev.target
          const item = t && typeof t.closest === 'function' ? t.closest('[data-wb-id]') : null
          if (!item || !sidebarEl.contains(item) || item.hasAttribute('data-wb-hidden')) {
            hideItembar()
            return
          }
          const id = item.getAttribute('data-wb-id')
          if (itembarTarget === id && itembarEl && !itembarEl.hidden) return
          itembarTarget = id
          if (!itembarEl) itembarEl = buildItembar()
          /* 额外行不可重排：↑↓ 置灰。 */
          const isNav = navList && navList.contains(item)
          const btns = itembarEl.querySelectorAll('.wb-btn')
          btns[0].disabled = !isNav
          btns[1].disabled = !isNav
          const box = item.getBoundingClientRect()
          const barH = 28
          const top = box.top + box.height / 2 - barH / 2
          itembarEl.style.left = Math.round(box.right - 4) + 'px'
          itembarEl.style.top = Math.round(Math.max(top, 4)) + 'px'
          itembarEl.hidden = false
        }

        const onSidebarPointerLeave = () => hideItembar()

        const bindItembar = (el) => {
          if (!el || itembarBoundEl === el) return
          if (itembarBoundEl) unbindItembar()
          el.addEventListener('pointermove', onSidebarPointerMove, true)
          el.addEventListener('pointerleave', onSidebarPointerLeave, true)
          itembarBoundEl = el
        }

        const unbindItembar = () => {
          if (!itembarBoundEl) return
          itembarBoundEl.removeEventListener('pointermove', onSidebarPointerMove, true)
          itembarBoundEl.removeEventListener('pointerleave', onSidebarPointerLeave, true)
          hideItembar()
          itembarBoundEl = null
        }

        /* ---------- 浮动编辑面板 ---------- */
        const makeBtn = (label, title, onClick) => {
          const b = doc.createElement('button')
          b.className = 'wb-btn'
          b.type = 'button'
          b.textContent = label
          b.title = title
          b.addEventListener('click', (e) => {
            e.stopPropagation()
            onClick()
          })
          return b
        }

        const buildPanel = () => {
          const panel = doc.createElement('div')
          panel.className = 'wb-panel'
          const title = doc.createElement('div')
          title.className = 'wb-panel-title'
          title.textContent = '侧栏布局编辑'
          panel.appendChild(title)
          const list = doc.createElement('div')
          list.className = 'wb-list'
          panel.appendChild(list)
          const hint = doc.createElement('p')
          hint.className = 'wb-hint'
          hint.textContent = '斜体行是探测到的头部区域（品牌/新对话），只能显隐；导航行可拖拽与排序。'
          panel.appendChild(hint)
          const foot = doc.createElement('div')
          foot.className = 'wb-panel-foot'
          const oneRowBtn = doc.createElement('button')
          oneRowBtn.type = 'button'
          const paintOneRowBtn = () => {
            oneRowBtn.textContent = root.hasAttribute(ATTR_ONEROW) ? '一行:开' : '一行:关'
          }
          paintOneRowBtn()
          oneRowBtn.addEventListener('click', () => {
            if (root.hasAttribute(ATTR_ONEROW)) {
              try {
                window.localStorage.setItem(ONEROW_KEY, '0')
              } catch {}
              root.removeAttribute(ATTR_ONEROW)
            } else {
              try {
                window.localStorage.setItem(ONEROW_KEY, '1')
              } catch {}
              root.setAttribute(ATTR_ONEROW, 'on')
            }
            paintOneRowBtn()
            applyLayout()
          })
          const compactBtn = doc.createElement('button')
          compactBtn.type = 'button'
          const paintCompactBtn = () => {
            compactBtn.textContent = root.hasAttribute(ATTR_COMPACT) ? '紧凑:开' : '紧凑:关'
          }
          paintCompactBtn()
          compactBtn.addEventListener('click', () => {
            if (root.hasAttribute(ATTR_COMPACT)) {
              try {
                window.localStorage.setItem(COMPACT_KEY, '0')
              } catch {}
              root.removeAttribute(ATTR_COMPACT)
            } else {
              try {
                window.localStorage.setItem(COMPACT_KEY, '1')
              } catch {}
              root.setAttribute(ATTR_COMPACT, 'on')
            }
            paintCompactBtn()
          })
          const showAll = doc.createElement('button')
          showAll.type = 'button'
          showAll.textContent = '全部显示'
          showAll.addEventListener('click', () => {
            state.hidden = []
            writeStore(state)
            applyLayout()
            refreshPanel()
          })
          const reset = doc.createElement('button')
          reset.type = 'button'
          reset.textContent = '重置'
          reset.addEventListener('click', () => {
            clearStore()
            state = { order: [], hidden: [] }
            applyLayout()
            refreshPanel()
          })
          const done = doc.createElement('button')
          done.type = 'button'
          done.setAttribute('data-wb-primary', '')
          done.textContent = '完成'
          done.addEventListener('click', exitEdit)
          foot.appendChild(oneRowBtn)
          foot.appendChild(compactBtn)
          foot.appendChild(showAll)
          foot.appendChild(reset)
          foot.appendChild(done)
          panel.appendChild(foot)
          return panel
        }

        const refreshPanel = () => {
          if (!panelEl) return
          const list = panelEl.querySelector('.wb-list')
          if (!list) return
          list.textContent = ''
          for (const it of snapshotItems()) {
            const row = doc.createElement('div')
            row.className = 'wb-row'
            if (it.hidden) row.setAttribute('data-wb-row-hidden', '')
            if (it.group === 'extra') row.setAttribute('data-wb-row-extra', '')
            const label = doc.createElement('span')
            label.className = 'wb-label'
            label.textContent = it.id
            label.title = it.id
            const actions = doc.createElement('div')
            actions.className = 'wb-row-actions'
            if (it.group === 'nav') {
              actions.appendChild(makeBtn('↑', '上移', () => moveInState(it.id, -1)))
              actions.appendChild(makeBtn('↓', '下移', () => moveInState(it.id, 1)))
            }
            actions.appendChild(
              makeBtn(it.hidden ? '＋' : '×', it.hidden ? '恢复显示' : '隐藏该项', () =>
                toggleHidden(it.id),
              ),
            )
            row.appendChild(label)
            row.appendChild(actions)
            list.appendChild(row)
          }
        }

        function enterEdit() {
          if (editMode || !navList) return
          editMode = true
          root.setAttribute(ATTR_EDIT, 'on')
          hideItembar()
          applyLayout()
          bindDrag()
          panelEl = buildPanel()
          doc.body.appendChild(panelEl)
          refreshPanel()
        }

        function exitEdit() {
          if (!editMode) return
          editMode = false
          root.removeAttribute(ATTR_EDIT)
          unbindDrag()
          applyLayout()
          if (panelEl) {
            panelEl.remove()
            panelEl = null
          }
        }

        const ensureEntry = () => {
          if (!flags.layout) return
          if (!entryEl) {
            entryEl = doc.createElement('button')
            entryEl.className = 'wb-edit-entry'
            entryEl.type = 'button'
            entryEl.textContent = '⠿'
            entryEl.title = '侧栏布局编辑（拖拽排序 / 显隐）'
            entryEl.addEventListener('click', enterEdit)
            doc.body.appendChild(entryEl)
          }
        }

        /* ---------- 诊断浮层（#wb-debug） ---------- */
        const maybeDebug = () => {
          if (typeof location === 'undefined' || location.hash !== DEBUG_HASH) return
          let box = doc.getElementById('wb-debug')
          if (!box) {
            box = doc.createElement('div')
            box.id = 'wb-debug'
            box.className = 'wb-debug'
            doc.body.appendChild(box)
          }
          const navIds = navList
            ? Array.from(navList.children).map((c) => c.getAttribute('data-wb-id'))
            : null
          const brandEl = sidebarEl ? sidebarEl.querySelector('[data-wb-brand]') : null
          const ncEl = sidebarEl ? sidebarEl.querySelector('[data-wb-newchat]') : null
          const lines = [
            'sidebar: ' + (sidebarEl ? 'OK ' + sidebarEl.tagName : '未找到'),
            'navList: ' + (navList ? 'OK ' + navList.children.length + ' 行' : '未找到'),
            'nav ids: ' + JSON.stringify(navIds),
            'brand: ' + (brandEl ? 'OK ' + brandEl.getAttribute('data-wb-id') : '未探测到'),
            'newchat: ' + (ncEl ? 'OK ' + ncEl.getAttribute('data-wb-id') : '未探测到'),
            'itembar: ' + (itembarBoundEl ? 'bound ' + itembarBoundEl.tagName : '未绑定'),
            'compact: ' + (root.hasAttribute(ATTR_COMPACT) ? 'on' : 'off'),
            'state: ' + JSON.stringify(state),
          ]
          box.textContent = lines.join('\n')
        }

        /* ---------- 观察器：React 重渲染后自愈重放 ---------- */
        let frame = null
        const scheduleSync = () => {
          if (frame) return
          frame = window.requestAnimationFrame(() => {
            frame = null
            markSidebar()
            const next = discover()
            if (next !== navList) {
              if (editMode) exitEdit()
              navList = next
              if (navList) applyLayout()
            } else if (navList) {
              applyLayout()
            }
            if (sidebarEl) bindItembar(sidebarEl)
            ensureEntry()
            maybeDebug()
          })
        }

        const observer = new MutationObserver(scheduleSync)
        observer.observe(doc.body, { childList: true, subtree: true })
        push(() => observer.disconnect())

        /* 周期性重同步兜底：MutationObserver 的 childList 看不见「只改属性/样式」的
         * React reconcile，补一个 1.5s 一轮的定时重放。 */
        const resyncTimer = window.setInterval(scheduleSync, 1500)
        push(() => window.clearInterval(resyncTimer))

        scheduleSync()

        push(() => {
          exitEdit()
          unbindItembar()
          if (itembarEl) itembarEl.remove()
          itembarEl = null
          if (entryEl) entryEl.remove()
          entryEl = null
          const dbg = doc.getElementById('wb-debug')
          if (dbg) dbg.remove()
          if (sidebarEl) sidebarEl.removeAttribute(ATTR_SIDEBAR)
          sidebarEl = null
          navList = null
        })
      },
    }
  },
})
