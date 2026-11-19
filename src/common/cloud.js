/**
 * 微信云开发封装
 *
 * 数据读写和照片换链都走 checkins 云函数中转(见 cloudfunctions/checkins/),
 * 因为免费体验期的数据库/存储权限锁死在「仅创建者可读写」,客户端直连会导致
 * 多个微信号之间数据不互通;云函数是服务端身份,不受该权限限制。
 *
 * 使用前:
 * 1. 微信开发者工具开通云开发,把 CLOUD_ENV 替换为你的环境 ID
 * 2. 构建小程序后,在开发者工具里右键 cloudfunctions/checkins -> 上传并部署:云端安装依赖
 * 3. 云控制台创建 checkins 集合(权限无需调整,客户端不再直连)
 */

// 云开发环境 ID
const CLOUD_ENV = 'cloud1-d7gxpk6yq2c4db27a'

// 云函数名
const FUNCTION = 'checkins'

let inited = false

function cloudAvailable() {
  // #ifdef MP-WEIXIN
  return typeof wx !== 'undefined' && !!wx.cloud
  // #endif
  // #ifndef MP-WEIXIN
  return false
  // #endif
}

export function initCloud() {
  // #ifdef MP-WEIXIN
  if (inited || !cloudAvailable()) return
  wx.cloud.init({ env: CLOUD_ENV, traceUser: true })
  inited = true
  // #endif
}

/**
 * 调用 checkins 云函数
 * @param {string} action list | add | update | tempUrls | wishList | wishAdd | wishRemove
 * @param {object} payload
 */
function call(action, payload = {}) {
  return wx.cloud
    .callFunction({ name: FUNCTION, data: { action, ...payload } })
    .then((res) => res.result)
}

/**
 * 拉取全部打卡记录
 * @returns {Promise<Array>} 按打卡日期倒序
 */
export async function getCheckins() {
  // #ifdef MP-WEIXIN
  const res = await call('list')
  return res.data || []
  // #endif
  // #ifndef MP-WEIXIN
  return []
  // #endif
}

/**
 * 新增打卡
 * @param {{adcode:number, province:string, title:string, note:string, date:string, photos:string[]}} data
 */
export async function addCheckin(data) {
  // #ifdef MP-WEIXIN
  return call('add', { data })
  // #endif
}

/**
 * 更新打卡记录(用于同一区县重复打卡时追加照片/文字)
 * @param {string} id 记录 _id
 * @param {{addPhotos?: string[], note?: string, visits?: number}} patch
 *   addPhotos: 追加到 photos 数组末尾的 fileID 列表
 *   note: 完整的新备注(调用方拼好再传入)
 *   visits: 新的到访次数(重复打卡时 +1)
 */
export async function updateCheckin(id, patch = {}) {
  // #ifdef MP-WEIXIN
  return call('update', { id, patch })
  // #endif
}

/**
 * 批量上传照片到云存储(上传不受读权限影响,仍在客户端直传)
 * @param {string[]} tempPaths uni.chooseMedia 返回的临时路径
 * @param {number|string} adcode 省份编码,用于目录归类
 * @returns {Promise<string[]>} fileID 列表
 */
export async function uploadPhotos(tempPaths, adcode) {
  // #ifdef MP-WEIXIN
  const tasks = tempPaths.map((path) => {
    const ext = (path.match(/\.[a-zA-Z0-9]+$/) || ['.jpg'])[0]
    const rand = Math.random().toString(36).slice(2, 8)
    const cloudPath = `checkins/${adcode}/${Date.now()}_${rand}${ext}`
    return wx.cloud
      .uploadFile({ cloudPath, filePath: path })
      .then((res) => res.fileID)
  })
  return Promise.all(tasks)
  // #endif
  // #ifndef MP-WEIXIN
  return []
  // #endif
}

/**
 * 拉取全部「我想去」心愿
 * @returns {Promise<Array>} 按许愿时间倒序
 */
export async function getWishes() {
  // #ifdef MP-WEIXIN
  const res = await call('wishList')
  return res.data || []
  // #endif
  // #ifndef MP-WEIXIN
  return []
  // #endif
}

/**
 * 新增心愿(同一区县重复调用幂等,返回已有记录)
 * @param {{adcode:number, province:string, cityAdcode:number, city:string, countyAdcode:number, county:string, note:string}} data
 */
export async function addWish(data) {
  // #ifdef MP-WEIXIN
  return call('wishAdd', { data })
  // #endif
}

/**
 * 删除心愿
 * @param {number} countyAdcode 区县编码
 */
export async function removeWish(countyAdcode) {
  // #ifdef MP-WEIXIN
  return call('wishRemove', { countyAdcode })
  // #endif
}

/**
 * 用 fileID 换临时 https 链接(走云函数,绕过存储读权限限制)
 * @param {string[]} fileIds
 * @returns {Promise<string[]>}
 */
export async function getTempUrls(fileIds) {
  // #ifdef MP-WEIXIN
  if (!fileIds.length) return []
  const res = await call('tempUrls', { fileIds })
  return res.urls || []
  // #endif
  // #ifndef MP-WEIXIN
  return []
  // #endif
}
