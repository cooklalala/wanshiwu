/**
 * 下载小程序运行时需要的区县 GeoJSON 文件到 scripts/geo-data/
 *
 * 数据源:npm 包 china-province-city-district-geojson 的 tgz 包
 * (走 npmmirror 镜像,大陆网络稳定;该包的 files API 返回 403,故整包下载)
 *
 * 只保留运行时真正会请求的文件(与 src/common/geo.js 逻辑一致):
 *   - 全部省级文件(xx0000.json)
 *   - 省文件里 level 不是 district 且有下级的地级市文件
 * 区县文件不会被直接请求,不下下来(省 ~2800 个文件的体积)
 *
 * 用法:npm run fetch:geo
 * 产物:scripts/geo-data/*.json (之后上传到云存储 geo/ 目录)
 */
import { createWriteStream } from 'node:fs'
import { mkdir, readdir, readFile, copyFile, rm } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PKG = 'china-province-city-district-geojson'
const VERSION = '1.0.9'
const TGZ_URL = `https://registry.npmmirror.com/${PKG}/-/${PKG}-${VERSION}.tgz`

const TMP_DIR = join(__dirname, '.geo-tmp')
const OUT_DIR = join(__dirname, 'geo-data')

async function downloadTgz(tgzPath) {
  console.log(`下载 tgz 包: ${TGZ_URL}`)
  const res = await fetch(TGZ_URL)
  if (!res.ok || !res.body) throw new Error(`下载失败: ${res.status}`)
  await pipeline(res.body, createWriteStream(tgzPath))
}

async function main() {
  await rm(TMP_DIR, { recursive: true, force: true })
  await mkdir(TMP_DIR, { recursive: true })
  await mkdir(OUT_DIR, { recursive: true })

  // 1. 下载并解包(--force-local:防止 GNU tar 把 Windows 盘符 D: 误认为远程主机)
  const tgzPath = join(TMP_DIR, 'pkg.tgz')
  await downloadTgz(tgzPath)
  execFileSync('tar', ['--force-local', '-xzf', tgzPath, '-C', TMP_DIR])

  const dataDir = join(TMP_DIR, 'package', 'dist', 'data')
  const files = await readdir(dataDir)
  console.log(`包内共 ${files.length} 个区划文件`)

  // 2. 省级文件:adcode 以 0000 结尾
  const provFiles = files.filter((f) => /^\d{2}0000\.json$/.test(f))

  // 3. 解析省文件,收集需要再拉取的地级市 adcode(与 geo.js 的筛选条件一致)
  const cityAdcodes = new Set()
  for (const f of provFiles) {
    const geo = JSON.parse(await readFile(join(dataDir, f), 'utf8'))
    for (const feat of geo.features || []) {
      const p = feat.properties || {}
      if (p.level === 'district' || !p.childrenNum) continue
      cityAdcodes.add(`${p.adcode}.json`)
    }
  }

  // 4. 复制需要的文件
  const needed = [...provFiles, ...[...cityAdcodes].filter((f) => files.includes(f))]
  for (const f of needed) {
    await copyFile(join(dataDir, f), join(OUT_DIR, f))
  }
  await rm(TMP_DIR, { recursive: true, force: true })

  // 5. 统计产物体积
  let total = 0
  for (const f of await readdir(OUT_DIR)) {
    total += (await readFile(join(OUT_DIR, f))).length
  }
  console.log(
    `已生成 ${OUT_DIR}: ${provFiles.length} 个省 + ${needed.length - provFiles.length} 个市,` +
      `共 ${needed.length} 个文件 / ${(total / 1024 / 1024).toFixed(1)} MB`
  )
  console.log('下一步:把整个 geo-data 目录里的文件上传到云存储 geo/ 目录下')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
