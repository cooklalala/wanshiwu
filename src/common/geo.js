/**
 * 县级地图数据运行时加载(经纬度版,供原生 map 组件 polygons / 命中检测使用)
 *
 * 数据源:npm 包 china-province-city-district-geojson 的区划文件,
 * 托管在微信云开发存储 geo/ 目录(脚本 scripts/fetch-geo.mjs 生成,
 * tcb.qcloud.la 域名已在小程序 request 合法域名白名单内,且国内访问稳定;
 * DataV 官方源会拦截小程序 Referer 导致 403,jsdelivr 未加白名单,均不可用)
 * 坐标系:GCJ-02,与微信地图一致,可直接使用
 *
 * 策略:省文件 -> 直接下辖的区县(直辖市等)或城市;城市文件 -> 区县
 * 处理后的结果缓存到内存与本地存储,每个省只需加载一次
 *
 * 注意:云存储需设置权限为「所有用户可读」,否则 HTTP 下载会 403
 */
import { simplify, toLngLat } from './geo-utils.js'

const CACHE_VERSION = 'raw-v1'
const PKG = 'china-province-city-district-geojson'
const PKG_VERSION = '1.0.9'
// 主源:微信云开发存储(已加白名单);jsdelivr 节点仅作 H5 调试兜底
const BASE_URLS = [
  'https://636c-cloud1-d7gxpk6yq2c4db27a-1535144418.tcb.qcloud.la/geo',
  `https://cdn.jsdelivr.net/npm/${PKG}@${PKG_VERSION}/dist/data`,
  `https://fastly.jsdelivr.net/npm/${PKG}@${PKG_VERSION}/dist/data`,
  `https://gcore.jsdelivr.net/npm/${PKG}@${PKG_VERSION}/dist/data`
]

// 区县级多边形抽稀到约 100m 精度,在区县缩放下形状依然顺滑
const TOLERANCE = 0.001

const round5 = (n) => Math.round(n * 1e5) / 1e5

// 内存缓存,避免重复解析
const memoryCache = new Map()

function storageKey(adcode) {
  return `geo_${CACHE_VERSION}_${adcode}`
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    uni.request({
      url,
      timeout: 20000,
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          resolve(res.data)
        } else {
          reject(new Error(`请求失败(${res.statusCode}): ${url}`))
        }
      },
      fail: (err) => reject(new Error(`网络错误: ${url}`))
    })
  })
}

// 按主源 -> 兜底源顺序请求某个行政区划文件
async function fetchArea(adcode) {
  let lastErr = null
  for (const base of BASE_URLS) {
    try {
      return await requestJson(`${base}/${adcode}.json`)
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
}

// feature -> 经纬度多边形区域
// polys: [ [ ring:[ [lng,lat], ... ], ... ], ... ],bbox: [minLng, minLat, maxLng, maxLat]
function featureToRegion(f) {
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
        TOLERANCE
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

/**
 * 获取省份的区/县地图数据(经纬度多边形)
 * @param {number|string} adcode 省份行政区划代码
 * @returns {Promise<{regions: Array}>}
 */
export async function getProvinceGeoLngLat(adcode) {
  const key = String(adcode)
  if (memoryCache.has(key)) return memoryCache.get(key)

  // 本地缓存命中则直接用
  try {
    const cached = uni.getStorageSync(storageKey(key))
    if (cached && cached.regions) {
      memoryCache.set(key, cached)
      return cached
    }
  } catch (e) {
    // 缓存读取失败,继续走网络
  }

  // 1. 拉取省文件:直辖市/港澳直接得到区县,普通省得到地级市
  const prov = await fetchArea(key)
  const features = Array.isArray(prov.features) ? prov.features : []

  const districts = []
  const cityFetches = []
  for (const f of features) {
    if (!f.geometry) continue
    // childrenNum 为 0 表示没有下级文件:区县,或东莞/中山等直筒子市、
    // 东沙群岛这类特殊区域,直接用省文件里的轮廓,避免无效请求(404)
    if (f.properties?.level === 'district' || !f.properties?.childrenNum) {
      districts.push(f)
    } else {
      // 地级市 -> 需要再拉市文件拿区县(拉取失败时退化用市本身)
      cityFetches.push(
        fetchArea(f.properties.adcode).catch(() => ({ features: [f] }))
      )
    }
  }

  // 2. 并行拉取各市文件,收集区县
  const cities = await Promise.all(cityFetches)
  for (const city of cities) {
    const fs = (city.features || []).filter((f) => f.geometry)
    if (fs.length) districts.push(...fs)
  }

  if (!districts.length) {
    throw new Error(`未获取到 ${key} 的区县数据`)
  }

  // 3. 转经纬度多边形并抽稀
  const geo = { regions: districts.map(featureToRegion).filter(Boolean) }
  memoryCache.set(key, geo)

  try {
    uni.setStorageSync(storageKey(key), geo)
  } catch (e) {
    // 存储超限等情况忽略,下次仍可从网络加载
  }
  return geo
}
