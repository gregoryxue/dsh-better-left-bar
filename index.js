/**
 * dsh-better-left-bar — Host 半边（零依赖版）。
 *
 * 零依赖模式：不导出 Config，配置经 cordis.patch.yml 的 config 键以 rawConfig
 * 传入 apply（import '@deepseek-ai/schemastery' 在 Junction 指向的工作区路径下
 * 无法向上解析到 profile 的 node_modules，见 dsh-wb-skin v0.1.0 踩坑记录）。
 *
 * 可选配置（profile 层 cordis.patch.yml）：
 *   - id: dsh-better-left-bar
 *     config:
 *       skin: true     # WorkBuddy 浅蓝侧边栏皮肤（默认 true）
 *       layout: true   # 侧栏拖拽布局编辑器（默认 true）
 */

export const name = 'dsh-better-left-bar'

/** 缺省全开；浏览器半边拿不到 configForms 时也按全开兜底。 */
const DEFAULTS = { skin: true, layout: true }

function resolveFlags(raw) {
  const flags = { ...DEFAULTS }
  if (raw && typeof raw === 'object') {
    if (typeof raw.skin === 'boolean') flags.skin = raw.skin
    if (typeof raw.layout === 'boolean') flags.layout = raw.layout
  }
  return flags
}

export function apply(ctx, rawConfig = {}) {
  /* Host 半边无运行时行为；把配置写进 ctx 供浏览器半边经 configForms 读取。 */
  const flags = resolveFlags(rawConfig)
  if (ctx && typeof ctx === 'object') {
    try {
      ctx.dshBetterLeftBarFlags = flags
    } catch {}
  }
}

export const inject = []
