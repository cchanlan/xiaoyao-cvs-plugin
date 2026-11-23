import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { selectQrTheme, createQrRenderData } from '../model/qrTheme.js'

const root = fileURLToPath(new URL('../resources/qrCode/', import.meta.url))
const themes = JSON.parse(fs.readFileSync(path.join(root, 'themes.json'), 'utf8'))
const allExist = () => true
const fixture = [
  { id: 'first', files: { character: 'assets/first.png' }, backgroundPool: [{ file: 'assets/first-a.jpg' }, { file: 'assets/first-b.jpg' }] },
  { id: 'last', files: { character: 'assets/last.png' }, backgroundPool: [{ file: 'assets/last-a.jpg' }, { file: 'assets/last-b.jpg' }] },
]

for (const [i, theme] of themes.entries()) {
  test(`角色与地区配对：${theme.id}`, () => {
    for (const [j, background] of theme.backgroundPool.entries()) {
      const values = [(i + 0.25) / themes.length, (j + 0.25) / theme.backgroundPool.length]
      const selected = selectQrTheme({ random: () => values.shift() })
      assert.equal(selected.id, theme.id)
      assert.equal(selected.files.character, theme.files.character)
      assert.equal(selected.files.background, background.file)
      assert.ok(selected.files.character.startsWith(`assets/${theme.regionId}-`))
      assert.ok(selected.files.background.startsWith(`assets/${theme.regionId}-`))
      assert.notEqual(selected, theme)
      assert.notEqual(selected.files, theme.files)
    }
  })
}

test('34个角色、39张背景、没有恢复删除的五个角色', () => {
  assert.equal(themes.length, 34)
  assert.equal(new Set(themes.map(t => t.id)).size, 34)
  assert.equal(new Set(themes.flatMap(t => t.backgroundPool.map(b => b.file))).size, 39)
  assert.ok(themes.some(t => t.id === 'inazuma-raiden'))
  for (const id of ['liyue-xiao', 'inazuma-raiden-mobile', 'sumeru-collei', 'sumeru-kirara', 'fontaine-clorinde', 'nodkrai-columbina']) {
    assert.ok(!themes.some(t => t.id === id))
  }
})

test('随机上下界、越界与非数值不会返回空主题', () => {
  for (const randomValue of [0, -1, NaN, Infinity]) {
    assert.equal(selectQrTheme({ themeList: fixture, random: () => randomValue, exists: allExist }).id, 'first')
  }
  for (const randomValue of [0.99999, 1, 2]) {
    assert.equal(selectQrTheme({ themeList: fixture, random: () => randomValue, exists: allExist }).id, 'last')
  }
})

test('缺少角色时跳过，不跨地区补图', () => {
  const selected = selectQrTheme({ themeList: fixture, random: () => 0, exists: f => !f.endsWith('first.png') })
  assert.equal(selected.id, 'last')
  assert.equal(selected.files.background, 'assets/last-a.jpg')
})

test('缺少部分背景仅在同地区剩余背景选择', () => {
  const selected = selectQrTheme({ themeList: fixture, random: () => 0, exists: f => !f.endsWith('first-a.jpg') })
  assert.equal(selected.id, 'first')
  assert.equal(selected.files.background, 'assets/first-b.jpg')
})

test('某角色全部背景缺失时跳过该角色', () => {
  assert.equal(selectQrTheme({ themeList: fixture, random: () => 0, exists: f => !/first-[ab]\.jpg$/.test(f) }).id, 'last')
})

test('所有素材不存在，或主题列表为空/无效，基础二维码仍可生成', () => {
  const selected = selectQrTheme({ exists: () => false })
  assert.equal(selected.id, 'default')
  assert.deepEqual(selected.files, {})
  for (const themeList of [[], null, {}]) {
    assert.equal(selectQrTheme({ themeList, exists: allExist }).id, 'default')
  }
  const fallback = createQrRenderData('https://example.invalid/?ticket=INVALID', { exists: () => false })
  assert.equal(JSON.parse(fallback.qrUrlJson), 'https://example.invalid/?ticket=INVALID')
})

test('拒绝素材路径穿越、绝对路径和外部图片', () => {
  for (const character of ['../secret.png', '/tmp/private.png', 'C:\\private.png', 'https://example.invalid/a.png', 'assets/../private.png']) {
    assert.equal(selectQrTheme({ themeList: [{ files: { character }, backgroundPool: [{ file: 'assets/ok.jpg' }] }], exists: allExist }).id, 'default')
  }
})

test('选择不修改原始元数据或其他请求', () => {
  const original = JSON.stringify(themes)
  const a = selectQrTheme({ random: () => 0 })
  const b = selectQrTheme({ random: () => 1 })
  a.files.background = 'changed'
  assert.notEqual(a.id, b.id)
  assert.equal(JSON.stringify(themes), original)
})

test('二维码地址逐字保留，不丢失&、引号、中文或换行', () => {
  for (const url of ['https://example.invalid/?a=1&b=2#fragment', 'https://example.invalid/?q="原神"&x=\'hello\'', 'https://example.invalid/?x=</script><script>INVALID</script>', 'https://example.invalid/?x=\u2028\u2029\n']) {
    const data = createQrRenderData(url)
    assert.equal(JSON.parse(data.qrUrlJson), url)
    assert.ok(!data.qrUrlJson.includes('</script>'))
    assert.ok(!data.qrUrlJson.includes('\u2028'))
    assert.ok(!data.qrUrlJson.includes('\u2029'))
  }
})

test('无效二维码地址明确失败，不生成空白码', () => {
  for (const url of [undefined, null, '', ' ', 123]) assert.throws(() => createQrRenderData(url))
})
