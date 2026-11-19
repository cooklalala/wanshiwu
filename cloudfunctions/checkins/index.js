/**
 * 打卡记录云函数
 *
 * 为什么需要它:云开发免费体验期锁死了数据库/存储权限(仅创建者可读写),
 * 导致多个微信号之间记录和照片不互通。云函数里是服务端身份,不受客户端权限限制,
 * 所有数据读写、照片换链都走这里中转,账号之间自然互通。
 *
 * 部署:微信开发者工具里右键本目录 -> 上传并部署:云端安装依赖
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const COLLECTION = 'checkins'
const WISH_COLLECTION = 'wishes'

exports.main = async (event) => {
  const { action } = event
  switch (action) {
    case 'list':
      return list()
    case 'add':
      return add(event.data)
    case 'update':
      return update(event.id, event.patch || {})
    case 'tempUrls':
      return tempUrls(event.fileIds || [])
    case 'wishList':
      return wishList()
    case 'wishAdd':
      return wishAdd(event.data)
    case 'wishRemove':
      return wishRemove(event.countyAdcode)
    default:
      throw new Error(`未知操作: ${action}`)
  }
}

// 拉取全部打卡记录(云函数端单页上限 100 条,自动翻页),按打卡日期倒序
async function list() {
  try {
    const { total } = await db.collection(COLLECTION).count()
    const PAGE = 100
    const tasks = []
    for (let i = 0; i < Math.ceil(total / PAGE); i++) {
      tasks.push(
        db.collection(COLLECTION).orderBy('date', 'desc').skip(i * PAGE).limit(PAGE).get()
      )
    }
    const pages = await Promise.all(tasks)
    return { data: pages.flatMap((p) => p.data) }
  } catch (e) {
    // 集合还没创建时当作没有打卡记录
    if (e && (e.errCode === -502005 || String(e.errMsg || '').includes('collection not exists'))) {
      return { data: [] }
    }
    throw e
  }
}

// 新增打卡
async function add(data) {
  const { OPENID } = cloud.getWXContext()
  const res = await db.collection(COLLECTION).add({
    data: {
      ...data,
      _openid: OPENID, // 记录是谁打的卡,仅作归属标记,不影响共享展示
      createTime: db.serverDate()
    }
  })
  return { _id: res._id }
}

// 更新打卡记录(追加照片 / 拼备注 / 累计到访次数)
// 注意:这是共享手账,允许补充别人的记录(比如伴侣往同一区县追加照片),不做创建者校验
async function update(id, patch) {
  const data = {}
  if (patch.addPhotos?.length) data.photos = _.push(patch.addPhotos)
  if (patch.note !== undefined) data.note = patch.note
  if (patch.visits !== undefined) data.visits = patch.visits
  if (!Object.keys(data).length) return { updated: 0 }
  const res = await db.collection(COLLECTION).doc(id).update({ data })
  return { updated: res.stats.updated }
}

// 用 fileID 换临时 https 链接(服务端换链不受存储读权限限制)
// getTempFileURL 单次上限 50 个,分批换
async function tempUrls(fileIds) {
  if (!fileIds.length) return { urls: [] }
  const BATCH = 50
  const urls = []
  for (let i = 0; i < fileIds.length; i += BATCH) {
    const res = await cloud.getTempFileURL({ fileList: fileIds.slice(i, i + BATCH) })
    urls.push(...res.fileList.map((f) => (f.status === 0 ? f.tempFileURL : '')))
  }
  return { urls }
}

// ---- 「我想去」心愿单(wishes 集合,与打卡记录同为共享模式) ----

// 拉取全部心愿,按许愿时间倒序;集合不存在时当作没有心愿
async function wishList() {
  try {
    const { total } = await db.collection(WISH_COLLECTION).count()
    const PAGE = 100
    const tasks = []
    for (let i = 0; i < Math.ceil(total / PAGE); i++) {
      tasks.push(
        db.collection(WISH_COLLECTION).orderBy('createTime', 'desc').skip(i * PAGE).limit(PAGE).get()
      )
    }
    const pages = await Promise.all(tasks)
    return { data: pages.flatMap((p) => p.data) }
  } catch (e) {
    if (e && (e.errCode === -502005 || String(e.errMsg || '').includes('collection not exists'))) {
      return { data: [] }
    }
    throw e
  }
}

// 新增心愿;同一区县已有心愿时直接返回已有记录(幂等,防止重复标记)
async function wishAdd(data) {
  const { OPENID } = cloud.getWXContext()
  const exist = await db
    .collection(WISH_COLLECTION)
    .where({ countyAdcode: data.countyAdcode })
    .limit(1)
    .get()
  if (exist.data.length) return { _id: exist.data[0]._id, existed: true }
  const res = await db.collection(WISH_COLLECTION).add({
    data: {
      ...data,
      _openid: OPENID, // 记录是谁许的愿,仅作归属标记,不影响共享展示
      createTime: db.serverDate()
    }
  })
  return { _id: res._id }
}

// 按区县编码删除心愿(打卡达成时前端只知道 countyAdcode)
async function wishRemove(countyAdcode) {
  const res = await db
    .collection(WISH_COLLECTION)
    .where({ countyAdcode })
    .remove()
  return { removed: res.stats.removed }
}
