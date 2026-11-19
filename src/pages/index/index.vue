<template>
  <view class="page">
    <!-- 腾讯地图底图 + 点亮覆盖层(原生手势、真实地理信息) -->
    <map
      id="checkinMap"
      class="map"
      :latitude="center.lat"
      :longitude="center.lng"
      :scale="scale"
      :polygons="mapPolygons"
      :markers="mapMarkers"
      :circles="pulseCircles"
      show-location
      @tap="onMapTap"
      @markertap="onMarkerTap"
      @regionchange="onRegionChange"
    ></map>

    <!-- 顶部悬浮层:导航 + 统计卡片 -->
    <view class="top-overlay" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="navbar" :style="{ paddingRight: capsuleRightPad + 'px' }">
        <view
          v-if="mode === 'province'"
          class="navbar__back"
          hover-class="navbar__back--hover"
          @click="backToCountry"
        >
          <u-icon name="arrow-left" size="14" color="#ff5c74"></u-icon>
          <text>全国</text>
        </view>
        <text class="navbar__title">{{ mode === 'country' ? '打卡地图' : currentProvince.name }}</text>
        <text v-if="mode === 'country'" class="navbar__sub">双指放大查看区县</text>
        <!-- 不在当地/忘记打卡时的补救入口 -->
        <view class="navbar__manual" hover-class="navbar__manual--hover" @click="goAdd()">补充回忆</view>
      </view>

      <!-- 统计卡片:点击回看全部打卡记录 -->
      <view class="stats" hover-class="stats--hover" @click="goList">
        <view class="stats__row">
          <view class="stats__item">
            <text class="stats__num">{{ checkedProvinces }}</text>
            <text class="stats__label">已点亮省份</text>
          </view>
          <view class="stats__divider"></view>
          <view class="stats__item">
            <text class="stats__num">{{ checkedCounties }}</text>
            <text class="stats__label">已点亮区县</text>
          </view>
          <view class="stats__divider"></view>
          <view class="stats__item">
            <text class="stats__num">{{ totalPhotos }}</text>
            <text class="stats__label">打卡照片</text>
          </view>
        </view>
        <text class="stats__hint">点击查看我的足迹</text>
      </view>

      <!-- 心愿入口:点击展开「想去」清单 -->
      <view class="wish-entry" hover-class="wish-entry--hover" @click="wishPopupShow = true">
        <text class="wish-entry__text">✨ 想去 {{ wishes.length }} 个地方</text>
        <u-icon name="arrow-right" size="12" color="#8b7ad8"></u-icon>
      </view>
    </view>

    <!-- 区县地图加载中 -->
    <view v-if="geoLoading" class="page__loading">
      <u-loading-icon text="正在加载区县地图"></u-loading-icon>
    </view>

    <!-- 未分区县的旧打卡入口 -->
    <view
      v-if="mode === 'province' && legacyCheckins.length"
      class="legacy"
      hover-class="legacy--hover"
      @click="openLegacyPopup"
    >
      <text class="legacy__text">早期的省级打卡 {{ legacyCheckins.length }} 条(未分区县)</text>
      <u-icon name="arrow-right" size="12" color="#d19a3f"></u-icon>
    </view>

    <!-- 定位按钮:回到当前位置 -->
    <view class="locate" hover-class="locate--hover" @click="locate">
      <u-loading-icon v-if="locating" size="20" color="#ff5c74"></u-loading-icon>
      <view v-else class="locate__icon">
        <view class="locate__ring"></view>
        <view class="locate__dot"></view>
      </view>
    </view>

    <!-- 一键打卡按钮:定位当前位置并点亮所在区县 -->
    <view class="fab" :class="{ 'fab--busy': checkingIn }" hover-class="fab--hover" @click="quickCheckin">
      <u-loading-icon v-if="checkingIn" size="22" color="#ffffff"></u-loading-icon>
      <text v-else class="fab__plus">+</text>
      <text class="fab__text">{{ checkingIn ? '打卡中' : '打卡' }}</text>
    </view>

    <!-- 礼花动效层 -->
    <fireworks ref="fireworksRef" />

    <!-- 隐藏画布:把照片合成圆形图钉 -->
    <canvas type="2d" id="pinCanvas" class="pin-canvas"></canvas>

    <!-- 打卡成功温馨卡片 -->
    <checkin-celebrate
      v-model:show="celebrateShow"
      :county-name="celebrateCounty"
      :visit-count="celebrateVisit"
      :is-first="celebrateIsFirst"
      :wish-achieved="celebrateWishAchieved"
      :existing-photos="celebrateExistingPhotos"
      :saving="celebrateSaving"
      @finish="onCelebrateFinish"
    />

    <!-- 照片墙弹层 -->
    <checkin-popup
      v-model:show="popupShow"
      :province-name="popupTitle"
      :checkins="popupCheckins"
      @supplement="goAdd"
    />

    <!-- 「想去」心愿清单弹层 -->
    <wish-popup v-model:show="wishPopupShow" :wishes="wishes" @remove="onRemoveWish" />

    <!-- 未点亮区县的操作菜单:标记/取消「想去」 -->
    <u-action-sheet
      :show="wishActionShow"
      :actions="wishActions"
      :title="wishActionTitle"
      @select="onWishAction"
      @close="wishActionShow = false"
    ></u-action-sheet>
  </view>
</template>

<script setup>
import { ref, computed, nextTick, getCurrentInstance } from 'vue'
import { onReady, onShow } from '@dcloudio/uni-app'
import { getCheckins, addCheckin, updateCheckin, uploadPhotos, getTempUrls, getWishes, addWish, removeWish } from '@/common/cloud.js'
import { getProvinceGeoLngLat } from '@/common/geo.js'
import { lookupRegion, normalizeAdcode } from '@/common/region-lookup.js'
import { pointInRegion } from '@/common/geo-utils.js'
import { chinaProvinces } from '@/common/china-provinces.js'
import CheckinPopup from '@/components/checkin-popup/checkin-popup.vue'
import WishPopup from '@/components/wish-popup/wish-popup.vue'
import Fireworks from '@/components/fireworks/fireworks.vue'
import CheckinCelebrate from '@/components/checkin-celebrate/checkin-celebrate.vue'

const statusBarHeight = ref(20)
try {
  const info = uni.getWindowInfo()
  statusBarHeight.value = info.statusBarHeight || 20
} catch (e) {
  const info = uni.getSystemInfoSync()
  statusBarHeight.value = info.statusBarHeight || 20
}

// 小程序右上角胶囊按钮的占位宽度,导航栏右侧内容要避开它
const capsuleRightPad = ref(0)
// #ifdef MP-WEIXIN
try {
  const menu = uni.getMenuButtonBoundingClientRect()
  if (menu?.left) {
    const win = uni.getWindowInfo()
    capsuleRightPad.value = win.windowWidth - menu.left + 8
  }
} catch (e) {
  // 老基础库没有该 API,保持 0 即可
}
// #endif

// ---------- 原生地图 ----------
const instance = getCurrentInstance()
let mapCtx = null
// 全国概览视野
const center = ref({ lng: 105.0, lat: 35.8 })
const scale = ref(4)

const mode = ref('country') // country | province
const currentProvince = ref({ adcode: null, name: '' })
const provinceGeo = ref(null)
const geoLoading = ref(false)

const locating = ref(false)
let autoLocated = false

const checkins = ref([])
const popupShow = ref(false)
const popupTitle = ref('')
const popupCheckins = ref([])

// ---------- 「我想去」心愿 ----------
const wishes = ref([])
const wishPopupShow = ref(false)
// 地图点选区县后弹出的操作菜单
const wishActionShow = ref(false)
const wishActionCounty = ref(null)

// ---------- 一键打卡 ----------
const fireworksRef = ref(null)
const checkingIn = ref(false)
const celebrateShow = ref(false)
const celebrateSaving = ref(false)
const celebrateCounty = ref('')
const celebrateVisit = ref(1)
const celebrateIsFirst = ref(true)
const celebrateExistingPhotos = ref(0)
const celebrateWishAchieved = ref(false)
// 本次打卡写入/复用的记录,完成卡片时往它身上追加照片和文字
let celebrateTarget = null

// ---------- 点亮数据 ----------
// 全国视图:省份 -> 打卡次数(点亮依据是到访记录数,无照片的一键打卡也能点亮)
const countryChecked = computed(() => {
  const map = {}
  for (const c of checkins.value) {
    const key = Number(c.adcode)
    map[key] = (map[key] || 0) + 1
  }
  return map
})

// 当前省的打卡记录
const provinceCheckins = computed(() =>
  checkins.value.filter((c) => Number(c.adcode) === Number(currentProvince.value.adcode))
)

// 省内视图:区县 -> 打卡次数
const countyChecked = computed(() => {
  const map = {}
  for (const c of provinceCheckins.value) {
    if (c.countyAdcode == null) continue
    const key = Number(c.countyAdcode)
    map[key] = (map[key] || 0) + 1
  }
  return map
})

// 早期没有区县信息的打卡
const legacyCheckins = computed(() =>
  provinceCheckins.value.filter((c) => c.countyAdcode == null)
)

const currentChecked = computed(() =>
  mode.value === 'country' ? countryChecked.value : countyChecked.value
)

const checkedProvinces = computed(() => Object.keys(countryChecked.value).length)
const checkedCounties = computed(() => {
  const set = new Set()
  for (const c of checkins.value) {
    if (c.countyAdcode != null) set.add(Number(c.countyAdcode))
  }
  return set.size
})
const totalPhotos = computed(() =>
  checkins.value.reduce((n, c) => n + (c.photos?.length || 0), 0)
)

// ---------- 点亮覆盖层 ----------
// 只画已点亮的区域,未点亮的交给真实地图底图自己呈现
const litPolygons = computed(() => {
  const regions = mode.value === 'country' ? chinaProvinces : provinceGeo.value?.regions || []
  const checked = currentChecked.value
  const out = []
  for (const r of regions) {
    const count = checked[r.adcode]
    if (!count) continue
    // 到访越多颜色越深,暖色系(8 位 hex,末两位透明度)
    const fill = count >= 3 ? '#e8445c80' : count >= 2 ? '#ff5c7466' : '#ff8fa359'
    for (const poly of r.polys) {
      // map polygon 只支持单环,取外环(GeoJSON 第一个 ring)
      out.push({
        points: poly[0].map(([longitude, latitude]) => ({ longitude, latitude })),
        strokeColor: '#ff5c74',
        strokeWidth: 1,
        fillColor: fill,
        zIndex: 3
      })
    }
  }
  return out
})

// ---------- 「想去」覆盖层 ----------
// 心愿区县:淡紫半透明填充 + 细描边,和已点亮的暖色实色区分开
// 只在省份视图展示(心愿是区县粒度,全国视图没有区县边界数据)
const wishPolygons = computed(() => {
  if (mode.value !== 'province') return []
  const regions = provinceGeo.value?.regions || []
  const wished = new Set(
    wishes.value
      .filter((w) => Number(w.adcode) === Number(currentProvince.value.adcode))
      .map((w) => Number(w.countyAdcode))
  )
  const out = []
  for (const r of regions) {
    if (!wished.has(Number(r.adcode))) continue
    if (countyChecked.value[r.adcode]) continue // 已点亮的交给暖色层
    for (const poly of r.polys) {
      out.push({
        points: poly[0].map(([longitude, latitude]) => ({ longitude, latitude })),
        strokeColor: '#a78bfa',
        strokeWidth: 1,
        fillColor: '#b6a5f233',
        zIndex: 2 // 低于打卡层的 zIndex 3
      })
    }
  }
  return out
})

// 心愿层在下、点亮层在上
const mapPolygons = computed(() => [...wishPolygons.value, ...litPolygons.value])

// ---------- 照片图钉 ----------
// 点亮且传过照片的区域,在区域中心钉一枚圆形照片图钉,点击可回看该区域记录
const photoMarkers = ref([])
// markerId(数组下标) -> 区域 adcode
let markerRegions = []

// ---- 图钉合成:隐藏 canvas 画 圆形照片 + 白边 + 小尾巴,导出为图片给 marker 用 ----
const PIN_W = 96 // 逻辑尺寸,导出时按 dpr 放大保证清晰
const PIN_H = 112
let pinCanvasNode = null
let pinCtx = null
// 同一张照片只合成一次(fileID -> 本地临时图钉路径)
const pinCache = new Map()

function setupPinCanvas() {
  uni
    .createSelectorQuery()
    .in(instance.proxy)
    .select('#pinCanvas')
    .fields({ node: true, size: true })
    .exec((res) => {
      if (!res || !res[0] || !res[0].node) return
      pinCanvasNode = res[0].node
      const info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()
      const dpr = info.pixelRatio || 2
      pinCanvasNode.width = PIN_W * dpr
      pinCanvasNode.height = PIN_H * dpr
      pinCtx = pinCanvasNode.getContext('2d')
      // 画布就绪,此前因画布未初始化而跳过的心愿星标现在可以重建了
      buildWishMarkers()
    })
}

// 把一张照片合成图钉,返回本地临时图片路径;失败返回 null
async function composePin(photoSrc) {
  if (!pinCanvasNode || !pinCtx) return null
  try {
    const info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()
    const dpr = info.pixelRatio || 2
    // 先拿到图片本地路径
    const imgInfo = await new Promise((resolve, reject) =>
      uni.getImageInfo({ src: photoSrc, success: resolve, fail: reject })
    )
    const img = pinCanvasNode.createImage()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = imgInfo.path
    })

    const ctx = pinCtx
    const cx = (PIN_W / 2) * dpr
    const cy = 44 * dpr
    const r = 38 * dpr
    ctx.clearRect(0, 0, PIN_W * dpr, PIN_H * dpr)

    // 白色图钉底(圆 + 尾巴),带一点柔和投影
    ctx.save()
    ctx.shadowColor = 'rgba(74, 59, 53, 0.3)'
    ctx.shadowBlur = 6 * dpr
    ctx.shadowOffsetY = 2 * dpr
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(cx, cy, r + 5 * dpr, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(cx - 11 * dpr, cy + r * 0.82)
    ctx.lineTo(cx + 11 * dpr, cy + r * 0.82)
    ctx.lineTo(cx, (PIN_H - 8) * dpr)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    // 圆形裁剪后 cover 绘制照片
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.clip()
    const scale = Math.max((2 * r) / img.width, (2 * r) / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh)
    ctx.restore()

    return await new Promise((resolve, reject) =>
      uni.canvasToTempFilePath({
        canvas: pinCanvasNode,
        success: (e) => resolve(e.tempFilePath),
        fail: reject
      })
    )
  } catch (e) {
    console.error('合成照片图钉失败', e)
    return null
  }
}

async function buildPhotoMarkers() {
  const regions = mode.value === 'country' ? chinaProvinces : provinceGeo.value?.regions || []
  const checked = currentChecked.value
  const items = []
  for (const r of regions) {
    if (!checked[r.adcode]) continue
    // 该区域最新一条含照片的记录,取第一张当封面
    const withPhoto = checkins.value.find((c) =>
      mode.value === 'country'
        ? Number(c.adcode) === Number(r.adcode) && c.photos?.length
        : Number(c.countyAdcode) === Number(r.adcode) && c.photos?.length
    )
    if (!withPhoto) continue
    items.push({ adcode: r.adcode, anchor: r.anchor, photo: withPhoto.photos[0] })
  }
  if (!items.length) {
    photoMarkers.value = []
    markerRegions = []
    return
  }
  try {
    const urls = await getTempUrls(items.map((it) => it.photo))
    const pairs = []
    for (let i = 0; i < items.length; i++) {
      const url = urls[i]
      if (!url) continue
      // 优先用缓存的图钉,没有才合成(合成是串行的,共用一个画布)
      if (!pinCache.has(items[i].photo)) {
        pinCache.set(items[i].photo, await composePin(url))
      }
      const pin = pinCache.get(items[i].photo)
      pairs.push({ it: items[i], icon: pin || url, isPin: !!pin })
    }
    markerRegions = pairs.map((p) => p.it.adcode)
    photoMarkers.value = pairs.map((p, i) => ({
      id: i,
      latitude: p.it.anchor[1],
      longitude: p.it.anchor[0],
      iconPath: p.icon,
      // 合成图钉含尾巴,锚点在尾巴尖;裸图兜底则用中心
      width: p.isPin ? 48 : 40,
      height: p.isPin ? 56 : 40,
      anchor: p.isPin ? { x: 0.5, y: 0.93 } : { x: 0.5, y: 0.5 }
    }))
  } catch (e) {
    console.error('生成照片图钉失败', e)
  }
}

// ---------- 心愿星标 ----------
// 心愿区县在中心钉一颗 ⭐,和照片图钉共存;星标 id 从 WISH_MARKER_BASE 起编以区分
const WISH_MARKER_BASE = 10000
const wishMarkers = ref([])
let wishMarkerRegions = []
let starIconPath = ''

// 用隐藏画布画一颗 ⭐ 导出为图标(只需合成一次,所有心愿星标共用)
async function ensureStarIcon() {
  if (starIconPath) return starIconPath
  if (!pinCanvasNode || !pinCtx) return null
  try {
    const info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()
    const dpr = info.pixelRatio || 2
    pinCtx.clearRect(0, 0, PIN_W * dpr, PIN_H * dpr)
    pinCtx.font = `${48 * dpr}px sans-serif`
    pinCtx.textAlign = 'center'
    pinCtx.textBaseline = 'middle'
    pinCtx.fillText('⭐', (PIN_W / 2) * dpr, (PIN_H / 2) * dpr)
    starIconPath = await new Promise((resolve, reject) =>
      uni.canvasToTempFilePath({
        canvas: pinCanvasNode,
        success: (e) => resolve(e.tempFilePath),
        fail: reject
      })
    )
    return starIconPath
  } catch (e) {
    console.error('生成心愿星标失败', e)
    return null
  }
}

async function buildWishMarkers() {
  if (mode.value !== 'province') {
    wishMarkers.value = []
    wishMarkerRegions = []
    return
  }
  const regions = provinceGeo.value?.regions || []
  const items = wishes.value
    .filter((w) => Number(w.adcode) === Number(currentProvince.value.adcode))
    .filter((w) => !countyChecked.value[Number(w.countyAdcode)]) // 已点亮的不需要星标
    .map((w) => ({
      wish: w,
      region: regions.find((r) => Number(r.adcode) === Number(w.countyAdcode))
    }))
    .filter((it) => it.region)
  if (!items.length) {
    wishMarkers.value = []
    wishMarkerRegions = []
    return
  }
  const icon = await ensureStarIcon()
  if (!icon) return // 画布还没好,等下次 mode/数据变化时重建
  wishMarkerRegions = items.map((it) => Number(it.wish.countyAdcode))
  wishMarkers.value = items.map((it, i) => ({
    id: WISH_MARKER_BASE + i,
    latitude: it.region.anchor[1],
    longitude: it.region.anchor[0],
    iconPath: icon,
    width: 22,
    height: 22,
    anchor: { x: 0.5, y: 0.5 }
  }))
}

// 照片图钉 + 心愿星标合并成一份 markers 交给地图
const mapMarkers = computed(() => [...photoMarkers.value, ...wishMarkers.value])

// 点击照片图钉:查看该区域过往的打卡记录
function onMarkerTap(e) {
  const markerId = e.detail.markerId
  // 心愿星标:id 以 WISH_MARKER_BASE 起编,点开的是「想去」操作菜单
  if (markerId >= WISH_MARKER_BASE) {
    const adcode = wishMarkerRegions[markerId - WISH_MARKER_BASE]
    const county = (provinceGeo.value?.regions || []).find(
      (r) => Number(r.adcode) === Number(adcode)
    )
    if (county) openWishActionSheet(county)
    return
  }
  const adcode = markerRegions[markerId]
  if (adcode == null) return
  if (mode.value === 'country') {
    const prov = chinaProvinces.find((p) => Number(p.adcode) === Number(adcode))
    popupTitle.value = prov?.name || ''
    popupCheckins.value = checkins.value.filter((c) => Number(c.adcode) === Number(adcode))
  } else {
    const county = (provinceGeo.value?.regions || []).find(
      (r) => Number(r.adcode) === Number(adcode)
    )
    popupTitle.value = `${currentProvince.value.name} · ${county?.name || ''}`
    popupCheckins.value = provinceCheckins.value.filter(
      (c) => Number(c.countyAdcode) === Number(adcode)
    )
  }
  popupShow.value = true
}

// 点亮光晕:打卡成功时在新点亮区域上荡开的暖色圆环
const pulseCircles = ref([])
let pulseTimer = 0

const withAlpha = (hex, a) =>
  hex +
  Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, '0')

function playPulse([lng, lat]) {
  clearInterval(pulseTimer)
  let i = 0
  const frames = 10
  pulseTimer = setInterval(() => {
    i++
    const t = i / frames
    pulseCircles.value = [
      {
        longitude: lng,
        latitude: lat,
        radius: 300 + t * 2200,
        color: withAlpha('#ffb03a', 0.75 * (1 - t)),
        fillColor: withAlpha('#ffd166', 0.2 * (1 - t)),
        strokeWidth: 2
      }
    ]
    if (i >= frames) {
      clearInterval(pulseTimer)
      pulseCircles.value = []
    }
  }, 80)
}

// ---------- 视野 ----------
// 把一组区域的范围收进视野(padding: [上, 右, 下, 左],避开顶部统计卡和底部按钮)
function fitRegions(regions, padding = [210, 40, 120, 40]) {
  if (!mapCtx || !regions.length) return
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity
  for (const r of regions) {
    const [a, b, c, d] = r.bbox
    if (a < minx) minx = a
    if (b < miny) miny = b
    if (c > maxx) maxx = c
    if (d > maxy) maxy = d
  }
  mapCtx.includePoints({
    points: [
      { longitude: minx, latitude: miny },
      { longitude: maxx, latitude: maxy }
    ],
    padding
  })
}

// ---------- 命中检测 ----------
function findRegionAt(regions, lng, lat) {
  for (const p of regions) {
    if (pointInRegion(lng, lat, p)) return p
  }
  return null
}

// ---------- 交互 ----------
// 点击地图:只在省视图响应。已点亮区县弹照片墙;未点亮的弹出「想去」操作菜单
function onMapTap(e) {
  if (mode.value !== 'province') return
  const { latitude, longitude } = e.detail || {}
  if (latitude == null || longitude == null) return
  const county = findRegionAt(provinceGeo.value?.regions || [], longitude, latitude)
  if (!county) return
  if (!countyChecked.value[county.adcode]) {
    openWishActionSheet(county)
    return
  }
  popupTitle.value = `${currentProvince.value.name} · ${county.name}`
  popupCheckins.value = provinceCheckins.value.filter(
    (c) => Number(c.countyAdcode) === Number(county.adcode)
  )
  popupShow.value = true
}

// ---------- 「想去」操作菜单 ----------
const wishOfActionCounty = computed(() =>
  wishActionCounty.value
    ? wishes.value.find((w) => Number(w.countyAdcode) === Number(wishActionCounty.value.adcode))
    : null
)
const wishActions = computed(() =>
  wishOfActionCounty.value
    ? [{ key: 'remove', name: '💫 取消想去', color: '#8b7ad8' }]
    : [{ key: 'add', name: '✨ 标记为想去', color: '#8b7ad8' }]
)
const wishActionTitle = computed(() =>
  wishActionCounty.value
    ? `${currentProvince.value.name} · ${wishActionCounty.value.name}`
    : ''
)

function openWishActionSheet(county) {
  wishActionCounty.value = county
  wishActionShow.value = true
}

function onWishAction(action) {
  const county = wishActionCounty.value
  if (!county) return
  if (action.key === 'add') {
    // 用可编辑的模态框收集一句话心愿(选填,直接确定就是纯标记)
    uni.showModal({
      title: `想去${county.name}`,
      editable: true,
      placeholderText: '写一句想去的理由吧(选填)',
      confirmText: '许下心愿',
      success: (r) => {
        if (r.confirm) doAddWish(county, (r.content || '').trim())
      }
    })
  } else if (action.key === 'remove' && wishOfActionCounty.value) {
    onRemoveWish(wishOfActionCounty.value)
  }
}

// 许下心愿:补齐省市区县字段后写入,本地同步即时展示
async function doAddWish(county, note) {
  const info = lookupRegion(county.adcode) || {
    adcode: Number(currentProvince.value.adcode),
    province: currentProvince.value.name,
    cityAdcode: null,
    city: '',
    countyAdcode: Number(county.adcode),
    county: county.name
  }
  const data = {
    adcode: info.adcode,
    province: info.province,
    cityAdcode: info.cityAdcode,
    city: info.city,
    countyAdcode: info.countyAdcode,
    county: info.county,
    note
  }
  try {
    const res = await addWish(data)
    // 已有心愿时云函数幂等返回 existed,避免本地重复
    if (!res.existed) {
      wishes.value.unshift({ ...data, _id: res._id })
      buildWishMarkers()
    }
    uni.showToast({ title: '心愿已收下 ✨', icon: 'none' })
  } catch (e) {
    console.error('许愿失败', e)
    uni.showToast({ title: '许愿失败,请稍后重试', icon: 'none' })
  }
}

// 取消心愿(心愿清单弹层和操作菜单共用):先确认再删
function onRemoveWish(wish) {
  uni.showModal({
    title: '取消心愿',
    content: `不再想去${wish.county}了吗?`,
    confirmText: '取消心愿',
    confirmColor: '#8b7ad8',
    success: async (r) => {
      if (!r.confirm) return
      try {
        await removeWish(wish.countyAdcode)
        wishes.value = wishes.value.filter((w) => w._id !== wish._id)
        buildWishMarkers()
        uni.showToast({ title: '已取消心愿', icon: 'none' })
      } catch (e) {
        console.error('取消心愿失败', e)
        uni.showToast({ title: '操作失败,请稍后重试', icon: 'none' })
      }
    }
  })
}

// 缩放手势驱动视图切换(腾讯地图式):放大自动展开视野中心的省,缩小自动回全国
// 滞回阈值,避免在临界缩放级别来回抖动
const ENTER_SCALE = 6.5
const EXIT_SCALE = 5.5

async function onRegionChange(e) {
  const { type, causedBy } = e.detail || {}
  // 只响应手势结束;程序化的视野移动(includePoints)不干预
  if (type !== 'end' || causedBy !== 'gesture' || !mapCtx) return
  const [scaleRes, locRes] = await Promise.all([
    new Promise((resolve) => mapCtx.getScale({ success: resolve, fail: () => resolve(null) })),
    new Promise((resolve) =>
      mapCtx.getCenterLocation({ success: resolve, fail: () => resolve(null) })
    )
  ])
  const s = scaleRes?.scale
  if (s == null || !locRes) return

  if (mode.value === 'country') {
    if (s >= ENTER_SCALE) {
      const prov = findRegionAt(chinaProvinces, locRes.longitude, locRes.latitude)
      if (prov) enterProvince(prov.adcode, prov.name, { fit: false })
    }
    return
  }
  if (s < EXIT_SCALE) {
    mode.value = 'country'
    buildPhotoMarkers()
    buildWishMarkers()
    return
  }
  // 平移到了相邻省份:跟随视野中心切换区县覆盖层
  const prov = findRegionAt(chinaProvinces, locRes.longitude, locRes.latitude)
  if (prov && Number(prov.adcode) !== Number(currentProvince.value.adcode)) {
    enterProvince(prov.adcode, prov.name, { fit: false })
  }
}

async function enterProvince(adcode, name, { fit = true } = {}) {
  currentProvince.value = { adcode, name }
  geoLoading.value = true
  try {
    provinceGeo.value = await getProvinceGeoLngLat(adcode)
    mode.value = 'province'
    await nextTick()
    // 手势放大进入时不移动视野,保持用户当前的缩放和平移
    if (fit) fitRegions(provinceGeo.value.regions)
    buildPhotoMarkers()
    buildWishMarkers()
  } catch (e) {
    console.error('加载区县地图失败', e)
    uni.showToast({ title: '区县地图加载失败,请重试', icon: 'none' })
  } finally {
    geoLoading.value = false
  }
}

function backToCountry() {
  mode.value = 'country'
  fitRegions(chinaProvinces, [220, 30, 130, 30])
  buildPhotoMarkers()
  buildWishMarkers()
}

function openLegacyPopup() {
  popupTitle.value = `${currentProvince.value.name} · 省级打卡`
  popupCheckins.value = legacyCheckins.value
  popupShow.value = true
}

// 补充回忆:可带区域 adcode 预填地点(照片墙弹层进来时)
function goAdd(adcode) {
  const query = adcode ? `?adcode=${adcode}` : ''
  uni.navigateTo({ url: `/pages/checkin/add${query}` })
}

// 回看全部打卡记录
function goList() {
  uni.navigateTo({ url: '/pages/checkin/list' })
}

// 回到当前位置
function locate() {
  if (!mapCtx) return
  locating.value = true
  mapCtx.moveToLocation({
    complete: () => {
      locating.value = false
    }
  })
}

// ---------- 一键打卡 ----------
const pad2 = (n) => String(n).padStart(2, '0')
const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function getLocation() {
  return new Promise((resolve, reject) => {
    uni.getLocation({ type: 'gcj02', success: resolve, fail: reject })
  })
}

// 一键打卡:定位 -> 点亮所在区县 -> 聚焦/光晕/礼花 -> 温馨卡片补照片和文字
async function quickCheckin() {
  if (checkingIn.value) return
  checkingIn.value = true
  try {
    const pos = await getLocation()
    const { longitude, latitude } = pos

    // 全国图命中省份
    const prov = findRegionAt(chinaProvinces, longitude, latitude)
    if (!prov) {
      uni.showToast({ title: '当前位置不在中国境内,可去补充回忆', icon: 'none' })
      return
    }

    // 进入所在省份(已在该省则不重复加载;视野后面直接聚焦区县,这里不先适配全省)
    if (mode.value !== 'province' || Number(currentProvince.value.adcode) !== Number(prov.adcode)) {
      await enterProvince(prov.adcode, prov.name, { fit: false })
      if (mode.value !== 'province') return // 区县地图加载失败,enterProvince 已提示
    }

    // 省内命中区县
    const county = findRegionAt(provinceGeo.value?.regions || [], longitude, latitude)
    if (!county) {
      uni.showToast({ title: '没认出你在哪个区县,可去补充回忆', icon: 'none' })
      return
    }

    // 反查省市信息,补齐记录字段(个别特殊区域查不到则用地图数据兜底)
    const info = lookupRegion(county.adcode) || {
      adcode: Number(prov.adcode),
      province: prov.name,
      cityAdcode: null,
      city: '',
      countyAdcode: Number(county.adcode),
      county: county.name
    }

    // 该县已有记录则复用最新一条(照片追加进去),否则新建一条点亮记录
    const existing = checkins.value.filter(
      (c) => Number(c.countyAdcode) === Number(county.adcode)
    )
    const isFirst = existing.length === 0
    if (isFirst) {
      const record = {
        adcode: info.adcode,
        province: info.province,
        cityAdcode: info.cityAdcode,
        city: info.city,
        countyAdcode: info.countyAdcode,
        county: info.county,
        title: '',
        note: '',
        date: todayStr(),
        photos: [],
        visits: 1
      }
      const res = await addCheckin(record)
      celebrateTarget = { ...record, _id: res._id }
      // 先插入本地,地图立即点亮,不用等下次拉取
      checkins.value.unshift(celebrateTarget)
    } else {
      celebrateTarget = existing[0]
      // 累计到访次数(非关键路径,失败静默)
      celebrateTarget.visits = (celebrateTarget.visits || 1) + 1
      updateCheckin(celebrateTarget._id, { visits: celebrateTarget.visits }).catch(() => {})
    }

    // 心愿达成:打卡的区县曾在心愿单里,自动消除心愿并换专属庆祝文案
    const wishIdx = wishes.value.findIndex(
      (w) => Number(w.countyAdcode) === Number(county.adcode)
    )
    celebrateWishAchieved.value = wishIdx >= 0
    if (wishIdx >= 0) {
      const wish = wishes.value[wishIdx]
      wishes.value.splice(wishIdx, 1)
      buildWishMarkers()
      // 非关键路径,失败静默(下次拉取会兜底纠正)
      removeWish(wish.countyAdcode).catch(() => {})
    }

    // 庆祝反馈:视野聚焦所在区县 -> 暖色光晕 -> 礼花
    fitRegions([county], [240, 80, 220, 80])
    playPulse(county.anchor)
    fireworksRef.value?.celebrate()

    celebrateCounty.value = info.county
    celebrateIsFirst.value = isFirst
    celebrateVisit.value = celebrateTarget.visits || 1
    celebrateExistingPhotos.value = celebrateTarget.photos?.length || 0
    celebrateShow.value = true
  } catch (e) {
    console.error('一键打卡失败', e)
    uni.showToast({ title: '定位失败,请检查定位权限,或去补充回忆', icon: 'none' })
  } finally {
    checkingIn.value = false
  }
}

// 完成温馨卡片:照片上传后追加到本次记录,一句话拼进备注(都选填)
async function onCelebrateFinish({ photos, note }) {
  const target = celebrateTarget
  // 什么都没填直接关闭(点亮已生效)
  if (!target || (!photos.length && !note)) {
    celebrateShow.value = false
    return
  }
  celebrateSaving.value = true
  try {
    const patch = {}
    let fileIds = []
    if (photos.length) {
      fileIds = await uploadPhotos(photos, target.countyAdcode || target.adcode)
      patch.addPhotos = fileIds
    }
    if (note) {
      patch.note = target.note ? `${target.note}\n${note}` : note
    }
    await updateCheckin(target._id, patch)
    // 同步本地数据,照片墙和照片图钉立即可见
    target.photos = [...(target.photos || []), ...fileIds]
    if (note) target.note = patch.note
    buildPhotoMarkers()
    celebrateShow.value = false
    uni.showToast({ title: '已好好收藏', icon: 'none' })
  } catch (e) {
    console.error('保存打卡内容失败', e)
    uni.showToast({ title: '保存失败,请稍后重试', icon: 'none' })
  } finally {
    celebrateSaving.value = false
  }
}

async function loadCheckins() {
  try {
    const list = await getCheckins()
    // 兼容旧数据:省/市码曾是民政部短码(2/4 位),补足 6 位才能和地图数据匹配
    checkins.value = list.map((c) => ({
      ...c,
      adcode: c.adcode != null ? normalizeAdcode(c.adcode) : c.adcode,
      cityAdcode: c.cityAdcode != null ? normalizeAdcode(c.cityAdcode) : c.cityAdcode,
      countyAdcode: c.countyAdcode != null ? normalizeAdcode(c.countyAdcode) : c.countyAdcode
    }))
  } catch (e) {
    console.error('加载打卡记录失败', e)
  }
}

async function loadWishes() {
  try {
    const list = await getWishes()
    // 和打卡记录一样,旧数据可能有短码,补足 6 位才能和地图数据匹配
    wishes.value = list.map((w) => ({
      ...w,
      adcode: w.adcode != null ? normalizeAdcode(w.adcode) : w.adcode,
      countyAdcode: w.countyAdcode != null ? normalizeAdcode(w.countyAdcode) : w.countyAdcode
    }))
    buildWishMarkers()
  } catch (e) {
    console.error('加载心愿失败', e)
  }
}

onReady(() => {
  mapCtx = uni.createMapContext('checkinMap', instance.proxy)
  setupPinCanvas()
  // 初始视野收拢到全国范围
  fitRegions(chinaProvinces, [220, 30, 130, 30])
})

onShow(() => {
  loadCheckins().then(() => buildPhotoMarkers())
  loadWishes()
  // 首次进入把视野带到当前位置
  if (!autoLocated) {
    autoLocated = true
    // 等地图初始化完再移动
    setTimeout(locate, 600)
  }
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
}

// ---- 原生地图 ----
.map {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
}

// ---- 隐藏图钉画布 ----
.pin-canvas {
  position: fixed;
  left: -999rpx;
  top: -999rpx;
  width: 96px;
  height: 112px;
  pointer-events: none;
}

// ---- 顶部悬浮层 ----
.top-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  padding-bottom: 24rpx;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(255, 255, 255, 0) 100%);
}

.navbar {
  padding: 12rpx 32rpx 8rpx;
  display: flex;
  align-items: center;

  &__back {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 4rpx;
    font-size: 26rpx;
    color: #ff5c74;
    margin-right: 20rpx;
    padding: 8rpx 20rpx 8rpx 12rpx;
    background: rgba(255, 92, 116, 0.1);
    border-radius: 999rpx;
    white-space: nowrap;
  }

  &__back--hover {
    background: rgba(255, 92, 116, 0.22);
  }

  &__title {
    flex-shrink: 1;
    min-width: 0;
    font-size: 40rpx;
    font-weight: 700;
    color: #2b3140;
    letter-spacing: 2rpx;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__sub {
    flex-shrink: 0;
    font-size: 22rpx;
    color: #9aa3b5;
    margin-left: 16rpx;
  }

  &__manual {
    flex-shrink: 0;
    margin-left: auto;
    padding: 10rpx 24rpx;
    font-size: 24rpx;
    color: #ff5c74;
    background: rgba(255, 92, 116, 0.1);
    border-radius: 999rpx;
    white-space: nowrap;
  }

  &__manual--hover {
    background: rgba(255, 92, 116, 0.22);
  }
}

.stats {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 16rpx 32rpx 0;
  padding: 28rpx 0 16rpx;
  background: rgba(255, 255, 255, 0.88);
  border-radius: 28rpx;
  box-shadow: 0 10rpx 30rpx rgba(60, 80, 120, 0.1);

  &__row {
    width: 100%;
    display: flex;
    align-items: center;
  }

  &__item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  &__num {
    font-size: 44rpx;
    font-weight: 700;
    color: #ff5c74;
  }

  &__label {
    font-size: 22rpx;
    color: #98a1b3;
    margin-top: 6rpx;
  }

  &__divider {
    width: 2rpx;
    height: 52rpx;
    background: #eef0f6;
  }

  &__hint {
    margin-top: 14rpx;
    font-size: 20rpx;
    color: #c3cad9;
    letter-spacing: 2rpx;
  }
}

.stats--hover {
  opacity: 0.75;
}

// ---- 心愿入口 ----
.wish-entry {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  margin: 12rpx 32rpx 0;
  padding: 14rpx;
  background: rgba(250, 248, 255, 0.92);
  border: 2rpx solid #ece6fb;
  border-radius: 999rpx;
  box-shadow: 0 6rpx 18rpx rgba(60, 80, 120, 0.08);

  &__text {
    font-size: 24rpx;
    color: #8b7ad8;
  }
}

.wish-entry--hover {
  opacity: 0.8;
}

// ---- 加载中 ----
.page__loading {
  position: fixed;
  left: 50%;
  top: 45%;
  transform: translate(-50%, -50%);
  z-index: 10;
  padding: 24rpx 48rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 8rpx 24rpx rgba(60, 80, 120, 0.15);
}

// ---- 悬浮元素 ----
.legacy {
  position: fixed;
  left: 32rpx;
  right: 32rpx;
  bottom: 130rpx;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 18rpx;
  background: rgba(255, 248, 236, 0.95);
  border: 2rpx solid #ffe8c2;
  border-radius: 16rpx;
  box-shadow: 0 6rpx 18rpx rgba(60, 80, 120, 0.1);

  &__text {
    font-size: 24rpx;
    color: #d19a3f;
  }
}

.legacy--hover {
  opacity: 0.8;
}

.locate {
  position: fixed;
  right: 44rpx;
  bottom: 204rpx;
  z-index: 10;
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6rpx 18rpx rgba(60, 80, 120, 0.18);
  transition: transform 0.15s ease;

  // 纯 CSS 瞄准镜图标(uview 图标库没有定位类图标,且字体在小程序内加载不稳定)
  &__icon {
    position: relative;
    width: 40rpx;
    height: 40rpx;
  }

  &__ring {
    position: absolute;
    left: 7rpx;
    top: 7rpx;
    width: 26rpx;
    height: 26rpx;
    box-sizing: border-box;
    border: 3rpx solid #ff5c74;
    border-radius: 50%;

    // 上、下准星
    &::before {
      content: '';
      position: absolute;
      left: 50%;
      top: -10rpx;
      width: 3rpx;
      height: 7rpx;
      margin-left: -1.5rpx;
      background: #ff5c74;
      border-radius: 2rpx;
      box-shadow: 0 33rpx 0 #ff5c74;
    }

    // 左、右准星
    &::after {
      content: '';
      position: absolute;
      top: 50%;
      left: -10rpx;
      width: 7rpx;
      height: 3rpx;
      margin-top: -1.5rpx;
      background: #ff5c74;
      border-radius: 2rpx;
      box-shadow: 33rpx 0 0 #ff5c74;
    }
  }

  &__dot {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 8rpx;
    height: 8rpx;
    margin: -4rpx 0 0 -4rpx;
    background: #ff5c74;
    border-radius: 50%;
  }
}

.locate--hover {
  transform: scale(0.9);
}

.fab {
  position: fixed;
  right: 40rpx;
  bottom: 56rpx;
  z-index: 10;
  height: 88rpx;
  padding: 0 36rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #ff8fa3 0%, #ff5c74 100%);
  display: flex;
  align-items: center;
  gap: 6rpx;
  box-shadow: 0 10rpx 28rpx rgba(255, 92, 116, 0.4);
  transition: transform 0.15s ease;

  &__plus {
    font-size: 40rpx;
    font-weight: 300;
    color: #ffffff;
    line-height: 1;
    margin-top: -4rpx;
  }

  &__text {
    font-size: 28rpx;
    font-weight: 600;
    color: #ffffff;
    letter-spacing: 2rpx;
  }
}

.fab--hover {
  transform: scale(0.9);
}

.fab--busy {
  opacity: 0.85;
}
</style>
