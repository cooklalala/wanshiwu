/**
 * 生成中国省级地图多边形数据(经纬度版,供原生 map 组件 polygons 使用)
 * 数据源:DataV.GeoAtlas 全国 GeoJSON(GCJ-02,与微信地图坐标系一致)
 * 用法:npm run gen:map
 * 产物:src/common/china-provinces.js
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { simplify, toLngLat } from '../src/common/geo-utils.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const GEO_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json'
const OUT_FILE = join(__dirname, '../src/common/china-provinces.js')

// 全国视野下展示,抽稀到约 2km 精度,兼顾形状与点数
const TOLERANCE = 0.02

const round5 = (n) => Math.round(n * 1e5) / 1e5

// feature -> 经纬度多边形区域(与 geo.js 中 featureToRegion 逻辑保持一致)
function featureToRegion(f, tolerance) {
  const { adcode, name, centroid, center } = f.properties
  const geoms = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
  const polys = []
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity
  for (const poly of geoms) {
    const rings = []
    for (const ring of poly) {
      for (const [x, y] of ring) {
        if (x < minx) minx = x
        if (x > maxx) maxx = x
        if (y < miny) miny = y
        if (y > maxy) maxy = y
      }
      const pts = simplify(
        ring.map(([x, y]) => [round5(x), round5(y)]),
        tolerance
      )
      if (pts.length >= 3) rings.push(pts)
    }
    if (rings.length) polys.push(rings)
  }
  if (!polys.length) return null
  const anchor = toLngLat(centroid) || toLngLat(center) || [(minx + maxx) / 2, (miny + maxy) / 2]
  return {
    adcode,
    name,
    anchor: anchor.map(round5),
    bbox: [round5(minx), round5(miny), round5(maxx), round5(maxy)],
    polys
  }
}

async function main() {
  console.log(`拉取 GeoJSON: ${GEO_URL}`)
  const res = await fetch(GEO_URL)
  if (!res.ok) throw new Error(`下载失败: ${res.status}`)
  const geo = await res.json()
  console.log(`共 ${geo.features.length} 个要素`)

  const regions = geo.features
    .filter((f) => f.geometry && typeof f.properties?.adcode === 'number')
    .map((f) => featureToRegion(f, TOLERANCE))
    .filter(Boolean)

  const code = `// 本文件由 scripts/gen-map-raw.mjs 自动生成,请勿手改
// 经纬度(GCJ-02)多边形,供原生 map 组件 polygons / 命中检测使用
// polys: [ [ ring:[ [lng,lat], ... ], ... ], ... ] (MultiPolygon -> Polygon -> Ring)
export const chinaProvinces = ${JSON.stringify(regions)}
`
  mkdirSync(dirname(OUT_FILE), { recursive: true })
  writeFileSync(OUT_FILE, code)
  const kb = (Buffer.byteLength(code) / 1024).toFixed(1)
  console.log(`已生成 ${OUT_FILE} (${kb} KB, ${regions.length} 个区域)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
