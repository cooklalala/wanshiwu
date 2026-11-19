/**
 * 地图几何工具(纯函数,Node 脚本与小程序运行时共用)
 * - simplify: Douglas-Peucker 抽稀
 * - toLngLat: 规整 GeoJSON 的 center/centroid 为 [lng, lat]
 * - pointInRegion: 射线法判断经纬度点是否在区域内
 */

export function simplify(points, tolerance) {
  if (points.length <= 2) return points
  const sqTol = tolerance * tolerance

  function sqDist(p, a, b) {
    let [x, y] = a
    let dx = b[0] - x
    let dy = b[1] - y
    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)
      if (t > 1) {
        x = b[0]
        y = b[1]
      } else if (t > 0) {
        x += dx * t
        y += dy * t
      }
    }
    dx = p[0] - x
    dy = p[1] - y
    return dx * dx + dy * dy
  }

  function dp(pts, first, last, keep) {
    let maxSq = sqTol
    let index = -1
    for (let i = first + 1; i < last; i++) {
      const d = sqDist(pts[i], pts[first], pts[last])
      if (d > maxSq) {
        maxSq = d
        index = i
      }
    }
    if (index !== -1) {
      keep[index] = true
      dp(pts, first, index, keep)
      dp(pts, index, last, keep)
    }
  }

  const keep = new Array(points.length).fill(false)
  keep[0] = keep[points.length - 1] = true
  dp(points, 0, points.length - 1, keep)
  return points.filter((_, i) => keep[i])
}

// center/centroid 在多数数据文件中是 [lng, lat] 数组,
// 个别文件(如东莞/中山等直筒子市)是 {lng, lat} 对象,统一成数组
export function toLngLat(c) {
  if (Array.isArray(c)) return c
  if (c && typeof c.lng === 'number' && typeof c.lat === 'number') return [c.lng, c.lat]
  return null
}

/**
 * 射线法(偶奇规则)判断经纬度点是否在区域内
 * 经纬度直接当平面坐标用,不影响拓扑关系判断
 * @param {number} x 经度
 * @param {number} y 纬度
 * @param {{bbox:number[], polys:Array}} p 区域(bbox: [minLng, minLat, maxLng, maxLat])
 */
export function pointInRegion(x, y, p) {
  const [minx, miny, maxx, maxy] = p.bbox
  if (x < minx || x > maxx || y < miny || y > maxy) return false
  let inside = false
  for (const poly of p.polys) {
    for (const ring of poly) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]
        const [xj, yj] = ring[j]
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inside = !inside
        }
      }
    }
  }
  return inside
}
