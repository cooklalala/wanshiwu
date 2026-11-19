/**
 * 生成省-市-区/县三级行政区划数据(用于打卡地点级联选择)
 * 数据源：china-division (pca-code.json)
 * 用法：npm run gen:pca
 * 产物：src/common/pca.js
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_FILE = join(__dirname, '../src/common/pca.js')

// 国内镜像优先,jsdelivr 兜底
const URLS = [
  'https://registry.npmmirror.com/china-division/latest/files/dist/pca-code.json',
  'https://cdn.jsdelivr.net/npm/china-division/dist/pca-code.json'
]

async function fetchPca() {
  for (const url of URLS) {
    try {
      console.log(`拉取行政区划数据: ${url}`)
      const res = await fetch(url)
      if (res.ok) return await res.json()
      console.warn(`失败(${res.status}),尝试下一个源`)
    } catch (e) {
      console.warn(`失败(${e.message}),尝试下一个源`)
    }
  }
  throw new Error('所有数据源均不可用')
}

// 只保留必要字段: [{ code, name, children: [{ code, name, children: [{ code, name }] }] }]
function slim(nodes) {
  return nodes.map((n) => {
    const item = { code: n.code, name: n.name }
    if (Array.isArray(n.children) && n.children.length) {
      item.children = slim(n.children)
    }
    return item
  })
}

async function main() {
  const data = await fetchPca()
  const tree = slim(data)
  const code = `// 本文件由 scripts/gen-pca.mjs 自动生成,请勿手改
// 省 -> 市 -> 区/县 三级行政区划(code 为民政部行政区划代码字符串)
export const pca = ${JSON.stringify(tree)}
`
  mkdirSync(dirname(OUT_FILE), { recursive: true })
  writeFileSync(OUT_FILE, code)
  const kb = (Buffer.byteLength(code) / 1024).toFixed(1)
  const counties = tree.reduce((n, p) => n + (p.children || []).reduce((m, c) => m + (c.children?.length || 0), 0), 0)
  console.log(`已生成 ${OUT_FILE} (${kb} KB, ${tree.length} 省, ${counties} 区县)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
