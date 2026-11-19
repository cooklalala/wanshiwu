/**
 * 区县 adcode -> 省/市/区县 完整信息反查
 * 一键打卡定位命中区县后,用来补齐打卡记录所需的省市字段
 * 数据来自 pca.js(民政部行政区划代码)
 */
import { pca } from './pca.js'

// pca 用的是民政部短码(省 2 位、市 4 位、区县 6 位),
// 地图数据(DataV)用 6 位完整码,统一补足 6 位才能匹配上
export const normalizeAdcode = (code) => Number(String(code).padEnd(6, '0'))

const lookup = new Map()

for (const p of pca) {
  for (const c of p.children || []) {
    if (!c.children || !c.children.length) {
      // 直筒子市(东莞、中山等):没有下辖区县,市本身即“区县”
      lookup.set(normalizeAdcode(c.code), {
        adcode: normalizeAdcode(p.code),
        province: p.name,
        cityAdcode: normalizeAdcode(c.code),
        city: c.name,
        countyAdcode: normalizeAdcode(c.code),
        county: c.name
      })
    } else {
      for (const a of c.children) {
        lookup.set(normalizeAdcode(a.code), {
          adcode: normalizeAdcode(p.code),
          province: p.name,
          cityAdcode: normalizeAdcode(c.code),
          city: c.name,
          countyAdcode: normalizeAdcode(a.code),
          county: a.name
        })
      }
    }
  }
}

/**
 * 按区县 adcode 反查省/市/区县信息
 * @param {number|string} countyAdcode
 * @returns {{adcode:number, province:string, cityAdcode:number, city:string, countyAdcode:number, county:string} | null}
 */
export function lookupRegion(countyAdcode) {
  return lookup.get(Number(countyAdcode)) || null
}
