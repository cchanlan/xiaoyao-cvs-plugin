import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const resourceRoot = fileURLToPath(new URL('../resources/qrCode/', import.meta.url))
const fallbackTheme = {
  id: 'default', color: '#376fbd', files: {},
  backgroundPosition: '50%', backgroundBrightness: 1,
}
let themes = []
try {
  const parsed = JSON.parse(fs.readFileSync(path.join(resourceRoot, 'themes.json'), 'utf8'))
  if (Array.isArray(parsed)) themes = parsed
} catch {
  // 主题素材属于可选展示资源；不可用时仍然允许生成登录二维码。
}

function safeAsset(file) {
  return typeof file === 'string' && /^assets\/[a-z0-9-]+\.(?:png|jpg)$/.test(file)
}

function pick(items, random) {
  const value = Number(random())
  const fraction = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
  return items[Math.min(items.length - 1, Math.floor(fraction * items.length))]
}

/** 为一次登录固定角色与同地区风景。仅展示随机，不涉及账号选择。 */
export function selectQrTheme({ themeList = themes, random = Math.random, exists = fs.existsSync, root = resourceRoot } = {}) {
  const assetExists = file => safeAsset(file) && exists(path.join(root, file))
  const available = []
  for (const theme of Array.isArray(themeList) ? themeList : []) {
    if (!theme?.files || !assetExists(theme.files.character)) continue
    const backgrounds = (Array.isArray(theme.backgroundPool) ? theme.backgroundPool : [])
      .filter(background => assetExists(background?.file))
    if (backgrounds.length) available.push({ theme, backgrounds })
  }
  if (!available.length) return { ...fallbackTheme, files: {} }
  const { theme, backgrounds } = pick(available, random)
  const background = pick(backgrounds, random)
  return { ...theme, files: { ...theme.files, background: background.file } }
}

/** 以 JSON 字符串嵌入脚本，保留 &/引号/中文，防止 </script> 提前结束。 */
export function createQrRenderData(url, options) {
  if (typeof url !== 'string' || !url.trim()) throw new TypeError('二维码地址为空')
  return {
    theme: selectQrTheme(options),
    qrUrlJson: JSON.stringify(url).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'),
  }
}
