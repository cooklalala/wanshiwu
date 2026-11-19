<template>
  <view class="page">
    <view v-if="loading" class="page__loading">
      <u-loading-icon text="翻找回忆中"></u-loading-icon>
    </view>

    <view v-else-if="!entries.length" class="page__empty">
      <u-empty mode="data" text="还没有足迹,去点亮第一个地方吧"></u-empty>
    </view>

    <scroll-view v-else scroll-y class="page__scroll">
      <!-- 足迹总览:和省地图页统计卡同源的数字 -->
      <view class="overview">
        <view class="overview__row">
          <view class="overview__item">
            <text class="overview__num">{{ stats.provinces }}</text>
            <text class="overview__label">点亮省份</text>
          </view>
          <view class="overview__item">
            <text class="overview__num">{{ stats.cities }}</text>
            <text class="overview__label">走过城市</text>
          </view>
          <view class="overview__item">
            <text class="overview__num">{{ stats.counties }}</text>
            <text class="overview__label">点亮区县</text>
          </view>
          <view class="overview__item">
            <text class="overview__num">{{ stats.photos }}</text>
            <text class="overview__label">收藏照片</text>
          </view>
        </view>
        <text class="overview__slogan">{{ slogan }}</text>
      </view>

      <!-- 时光机 / 城市 双视图切换 -->
      <view class="tabs">
        <view
          class="tabs__item"
          :class="{ 'tabs__item--active': activeTab === 'time' }"
          hover-class="tabs__item--hover"
          @click="activeTab = 'time'"
        >
          时光机
        </view>
        <view
          class="tabs__item"
          :class="{ 'tabs__item--active': activeTab === 'city' }"
          hover-class="tabs__item--hover"
          @click="activeTab = 'city'"
        >
          城市
        </view>
      </view>

      <!-- ============ 时光机视图 ============ -->
      <template v-if="activeTab === 'time'">
        <!-- 时光回顾:按年回看走过的路 -->
        <scroll-view v-if="yearRecaps.length" scroll-x class="recaps" :show-scrollbar="false">
          <view class="recaps__track">
            <view v-for="r in yearRecaps" :key="r.year" class="recap">
              <text class="recap__year">{{ r.year }}</text>
              <text class="recap__text">走过了 {{ r.cities }} 个城市</text>
              <text class="recap__text">点亮了 {{ r.counties }} 个区县</text>
              <text class="recap__photos" v-if="r.photos">收藏了 {{ r.photos }} 张照片</text>
            </view>
          </view>
        </scroll-view>

        <!-- 足迹高光:值得记住的三个地方 -->
        <scroll-view v-if="highlights.length" scroll-x class="highs" :show-scrollbar="false">
          <view class="highs__track">
            <view v-for="h in highlights" :key="h.kind" class="high" @click="previewEntry(h.entry)">
              <text class="high__tag">{{ h.tag }}</text>
              <text class="high__place">{{ h.entry.place }}</text>
              <text class="high__sub">{{ h.sub }}</text>
            </view>
          </view>
        </scroll-view>

        <!-- 按月分组的时间线 -->
        <view v-for="g in groups" :key="g.key" class="month">
          <text class="month__title">{{ g.title }}</text>

          <view v-for="(item, i) in g.items" :key="item._id || i" class="entry">
            <view class="entry__head">
              <text class="entry__place">{{ item.place }}</text>
              <text class="entry__date">{{ item.date }}</text>
            </view>

            <view v-if="item.visits > 1" class="entry__visits">第 {{ item.visits }} 次到访</view>

            <text v-if="item.title" class="entry__title">{{ item.title }}</text>
            <text v-if="item.note" class="entry__note">{{ item.note }}</text>

            <view v-if="item.urls.length" class="entry__grid">
              <image
                v-for="(url, pi) in item.urls"
                :key="pi"
                class="entry__photo"
                :src="url"
                mode="aspectFill"
                lazy-load
                @click="preview(item.urls, pi)"
              />
            </view>
          </view>
        </view>

        <view class="page__footer">共 {{ entries.length }} 次打卡 · {{ stats.photos }} 张照片,都是好时光</view>
      </template>

      <!-- ============ 城市视图 ============ -->
      <template v-else>
        <view v-for="c in cityGroups" :key="c.key" class="city">
          <view class="city__head" hover-class="city__head--hover" @click="toggleCity(c.key)">
            <image v-if="c.cover" class="city__cover" :src="c.cover" mode="aspectFill" lazy-load />
            <view v-else class="city__cover city__cover--empty">
              <u-icon name="map-fill" size="26" color="#ffb3a0"></u-icon>
            </view>
            <view class="city__info">
              <text class="city__name">{{ c.name }}</text>
              <text class="city__meta">{{ c.count }} 个足迹 · {{ c.photos }} 张照片</text>
              <text class="city__meta">最近于 {{ c.latestDate }}</text>
            </view>
            <u-icon
              :name="expandedCity === c.key ? 'arrow-up' : 'arrow-down'"
              size="14"
              color="#c9b3a9"
            ></u-icon>
          </view>

          <view v-if="expandedCity === c.key" class="city__entries">
            <view v-for="(item, i) in c.items" :key="item._id || i" class="entry">
              <view class="entry__head">
                <text class="entry__place">{{ item.place }}</text>
                <text class="entry__date">{{ item.date }}</text>
              </view>

              <view v-if="item.visits > 1" class="entry__visits">第 {{ item.visits }} 次到访</view>

              <text v-if="item.title" class="entry__title">{{ item.title }}</text>
              <text v-if="item.note" class="entry__note">{{ item.note }}</text>

              <view v-if="item.urls.length" class="entry__grid">
                <image
                  v-for="(url, pi) in item.urls"
                  :key="pi"
                  class="entry__photo"
                  :src="url"
                  mode="aspectFill"
                  lazy-load
                  @click="preview(item.urls, pi)"
                />
              </view>
            </view>
          </view>
        </view>

        <view class="page__footer">{{ cityGroups.length }} 座城市,藏着 {{ entries.length }} 次好时光</view>
      </template>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getCheckins, getTempUrls } from '@/common/cloud.js'
import { normalizeAdcode } from '@/common/region-lookup.js'

/**
 * 我的足迹:参考大众点评「我的足迹」的手账升级版
 * 顶部足迹总览 + 时光机(年度回顾 / 足迹高光 / 时间线)+ 城市聚合双视图
 */

const loading = ref(true)
const entries = ref([])
const activeTab = ref('time') // time | city
const expandedCity = ref(null)

// 省 · 市 · 区县 拼地点,过滤“市辖区”这类没有信息量的名字
function placeOf(c) {
  const parts = [c.province, c.city, c.county]
    .filter(Boolean)
    .filter((n) => n !== '市辖区')
  return [...new Set(parts)].join(' · ')
}

onShow(async () => {
  loading.value = true
  try {
    const list = (await getCheckins()).map((c) => ({
      ...c,
      adcode: c.adcode != null ? normalizeAdcode(c.adcode) : c.adcode,
      cityAdcode: c.cityAdcode != null ? normalizeAdcode(c.cityAdcode) : c.cityAdcode,
      countyAdcode: c.countyAdcode != null ? normalizeAdcode(c.countyAdcode) : c.countyAdcode
    }))
    // 一次请求换取全部照片的临时链接,比逐条换省 N-1 次往返
    const allIds = list.flatMap((c) => c.photos || [])
    const urls = await getTempUrls(allIds)
    const urlMap = {}
    allIds.forEach((id, i) => (urlMap[id] = urls[i]))

    entries.value = list.map((c) => ({
      _id: c._id,
      date: c.date,
      place: placeOf(c),
      title: c.title,
      note: c.note,
      visits: c.visits || 1,
      adcode: c.adcode,
      cityAdcode: c.cityAdcode,
      countyAdcode: c.countyAdcode,
      city: c.city && c.city !== '市辖区' ? c.city : '',
      province: c.province || '',
      urls: (c.photos || []).map((id) => urlMap[id]).filter(Boolean)
    }))
    expandedCity.value = null
  } catch (e) {
    console.error('加载打卡记录失败', e)
    uni.showToast({ title: '记录加载失败,请重试', icon: 'none' })
  } finally {
    loading.value = false
  }
})

// ---------- 足迹总览 ----------
const stats = computed(() => {
  const provinces = new Set()
  const cities = new Set()
  const counties = new Set()
  let photos = 0
  for (const e of entries.value) {
    if (e.adcode != null) provinces.add(Number(e.adcode))
    if (e.cityAdcode != null) cities.add(Number(e.cityAdcode))
    if (e.countyAdcode != null) counties.add(Number(e.countyAdcode))
    photos += e.urls.length
  }
  return { provinces: provinces.size, cities: cities.size, counties: counties.size, photos }
})

// 最早的打卡(entries 按日期倒序,最后一条即第一次)
const firstEntry = computed(() => entries.value[entries.value.length - 1] || null)

const slogan = computed(() => {
  const first = firstEntry.value
  if (!first?.date) return '一路走,一路点亮'
  const [y, m] = first.date.split('-')
  return `从 ${y} 年 ${Number(m)} 月第一次打卡,一路都是好时光`
})

// ---------- 时光回顾:按年聚合 ----------
const yearRecaps = computed(() => {
  const map = new Map()
  for (const e of entries.value) {
    const year = (e.date || '').slice(0, 4)
    if (!year) continue
    if (!map.has(year)) map.set(year, { year, cities: new Set(), counties: new Set(), photos: 0 })
    const r = map.get(year)
    if (e.cityAdcode != null) r.cities.add(Number(e.cityAdcode))
    if (e.countyAdcode != null) r.counties.add(Number(e.countyAdcode))
    r.photos += e.urls.length
  }
  return [...map.values()].map((r) => ({
    year: r.year,
    cities: r.cities.size,
    counties: r.counties.size,
    photos: r.photos
  }))
  // entries 倒序遍历,年份自然按从近到远排列
})

// ---------- 足迹高光 ----------
const highlights = computed(() => {
  const out = []
  const first = firstEntry.value
  if (first) {
    out.push({ kind: 'first', tag: '初次足迹', entry: first, sub: first.date })
  }
  // 最常回访:visits 最大的(并列取最近的,遍历时倒序在前)
  let most = null
  for (const e of entries.value) {
    if (!most || e.visits > most.visits) most = e
  }
  if (most && most.visits > 1) {
    out.push({ kind: 'revisit', tag: '最常回访', entry: most, sub: `第 ${most.visits} 次到访` })
  }
  // 最新点亮:每个区县取最早一条(首次点亮),再取其中日期最新的
  const firstByCounty = new Map()
  for (const e of [...entries.value].reverse()) {
    if (e.countyAdcode == null) continue
    if (!firstByCounty.has(e.countyAdcode)) firstByCounty.set(e.countyAdcode, e)
  }
  let newest = null
  for (const e of firstByCounty.values()) {
    if (!newest || e.date > newest.date) newest = e
  }
  if (newest && entries.value.length > 1) {
    out.push({ kind: 'newest', tag: '最新点亮', entry: newest, sub: newest.date })
  }
  return out
})

// ---------- 城市聚合 ----------
const cityGroups = computed(() => {
  const map = new Map()
  for (const e of entries.value) {
    const name = e.city || e.province || '未知的地方'
    const key = e.cityAdcode != null ? `c${e.cityAdcode}` : `p${e.adcode ?? name}`
    if (!map.has(key)) map.set(key, { key, name, items: [], count: 0, photos: 0, latestDate: '' })
    const g = map.get(key)
    g.items.push(e)
    g.count += 1
    g.photos += e.urls.length
    if (e.date > g.latestDate) g.latestDate = e.date
  }
  return [...map.values()].map((g) => ({
    ...g,
    // 封面:最新一条含照片记录的第一张
    cover: g.items.find((e) => e.urls.length)?.urls[0] || ''
  }))
})

function toggleCity(key) {
  expandedCity.value = expandedCity.value === key ? null : key
}

// ---------- 时间线 ----------
// 按月份分组(getCheckins 已按日期倒序,分组的顺序自然就是倒序)
const groups = computed(() => {
  const map = new Map()
  for (const e of entries.value) {
    const key = (e.date || '').slice(0, 7) // 2026-11
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(e)
  }
  return [...map.entries()].map(([key, items]) => ({
    key,
    title: key ? `${key.slice(0, 4)} 年 ${Number(key.slice(5, 7))} 月` : '更早的时光',
    items
  }))
})

function preview(urls, current) {
  uni.previewImage({ urls, current })
}

// 点击高光卡:有照片就翻照片,没有就算了
function previewEntry(entry) {
  if (entry.urls?.length) preview(entry.urls, 0)
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: linear-gradient(180deg, #fff6f1 0%, #f7f8fa 30%);

  &__loading {
    display: flex;
    justify-content: center;
    padding-top: 40vh;
  }

  &__empty {
    padding-top: 30vh;
  }

  &__scroll {
    height: 100vh;
    box-sizing: border-box;
    padding: 24rpx 0 40rpx;
  }

  &__footer {
    text-align: center;
    font-size: 22rpx;
    color: #c9b3a9;
    padding: 40rpx 0 60rpx;
  }
}

// ---- 足迹总览 ----
.overview {
  margin: 0 32rpx;
  padding: 32rpx;
  background: linear-gradient(135deg, #fff0e8 0%, #ffe8ee 100%);
  border-radius: 24rpx;
  box-shadow: 0 8rpx 24rpx rgba(180, 120, 100, 0.1);

  &__row {
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
    color: #b59a8f;
    margin-top: 6rpx;
  }

  &__slogan {
    display: block;
    text-align: center;
    font-size: 22rpx;
    color: #c98f7d;
    letter-spacing: 2rpx;
    margin-top: 20rpx;
  }
}

// ---- Tab 切换 ----
.tabs {
  display: flex;
  margin: 24rpx 32rpx 8rpx;
  padding: 8rpx;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 999rpx;
  box-shadow: 0 6rpx 18rpx rgba(180, 120, 100, 0.08);

  &__item {
    flex: 1;
    text-align: center;
    padding: 14rpx 0;
    font-size: 26rpx;
    color: #b59a8f;
    border-radius: 999rpx;
    transition: all 0.2s ease;

    &--active {
      font-weight: 600;
      color: #ffffff;
      background: linear-gradient(135deg, #ff8fa3 0%, #ff5c74 100%);
      box-shadow: 0 6rpx 16rpx rgba(255, 92, 116, 0.3);
    }

    &--hover {
      opacity: 0.7;
    }
  }
}

// ---- 时光回顾 ----
.recaps {
  margin-top: 16rpx;
  white-space: nowrap;

  &__track {
    display: inline-flex;
    gap: 20rpx;
    padding: 8rpx 32rpx;
  }
}

.recap {
  display: inline-flex;
  flex-direction: column;
  min-width: 300rpx;
  padding: 24rpx 28rpx;
  background: linear-gradient(135deg, #ffe9d6 0%, #ffd9e0 100%);
  border-radius: 20rpx;
  box-shadow: 0 6rpx 18rpx rgba(180, 120, 100, 0.1);

  &__year {
    font-size: 34rpx;
    font-weight: 700;
    color: #d1665a;
    letter-spacing: 2rpx;
  }

  &__text {
    font-size: 24rpx;
    color: #8a736a;
    margin-top: 8rpx;
  }

  &__photos {
    font-size: 22rpx;
    color: #c98f7d;
    margin-top: 8rpx;
  }
}

// ---- 足迹高光 ----
.highs {
  margin-top: 20rpx;
  white-space: nowrap;

  &__track {
    display: inline-flex;
    gap: 20rpx;
    padding: 8rpx 32rpx;
  }
}

.high {
  display: inline-flex;
  flex-direction: column;
  min-width: 280rpx;
  max-width: 400rpx;
  padding: 22rpx 26rpx;
  background: #ffffff;
  border-radius: 20rpx;
  box-shadow: 0 6rpx 18rpx rgba(180, 120, 100, 0.08);

  &__tag {
    align-self: flex-start;
    padding: 4rpx 16rpx;
    font-size: 20rpx;
    color: #d18f3f;
    background: #fff4e2;
    border-radius: 999rpx;
  }

  &__place {
    font-size: 28rpx;
    font-weight: 600;
    color: #4a3b35;
    margin-top: 14rpx;
    white-space: normal;
  }

  &__sub {
    font-size: 22rpx;
    color: #b59a8f;
    margin-top: 6rpx;
  }
}

// ---- 时间线 ----
.month {
  padding: 0 32rpx;

  &__title {
    display: block;
    font-size: 30rpx;
    font-weight: 700;
    color: #8a736a;
    letter-spacing: 4rpx;
    padding: 28rpx 8rpx 16rpx;
  }
}

.entry {
  position: relative;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 8rpx 24rpx rgba(180, 120, 100, 0.08);

  &__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16rpx;
  }

  &__place {
    font-size: 30rpx;
    font-weight: 600;
    color: #4a3b35;
  }

  &__date {
    flex-shrink: 0;
    font-size: 24rpx;
    color: #b59a8f;
  }

  &__visits {
    display: inline-block;
    margin-top: 12rpx;
    padding: 4rpx 16rpx;
    font-size: 20rpx;
    color: #d18f3f;
    background: #fff4e2;
    border-radius: 999rpx;
  }

  &__title {
    display: block;
    font-size: 28rpx;
    font-weight: 500;
    color: #4a3b35;
    margin-top: 16rpx;
  }

  &__note {
    display: block;
    font-size: 26rpx;
    color: #7d6a62;
    line-height: 1.6;
    margin-top: 12rpx;
    white-space: pre-wrap;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12rpx;
    margin-top: 20rpx;
  }

  &__photo {
    width: 100%;
    height: 200rpx;
    border-radius: 16rpx;
    background-color: #f6ece7;
  }
}

// ---- 城市视图 ----
.city {
  margin: 0 32rpx 24rpx;
  background: #ffffff;
  border-radius: 24rpx;
  box-shadow: 0 8rpx 24rpx rgba(180, 120, 100, 0.08);
  overflow: hidden;

  &__head {
    display: flex;
    align-items: center;
    gap: 20rpx;
    padding: 24rpx 28rpx;

    &--hover {
      opacity: 0.75;
    }
  }

  &__cover {
    flex-shrink: 0;
    width: 96rpx;
    height: 96rpx;
    border-radius: 20rpx;
    background-color: #f6ece7;

    &--empty {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff0e8;
    }
  }

  &__info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  &__name {
    font-size: 30rpx;
    font-weight: 600;
    color: #4a3b35;
  }

  &__meta {
    font-size: 22rpx;
    color: #b59a8f;
    margin-top: 6rpx;
  }

  &__entries {
    padding: 0 20rpx 8rpx;
    border-top: 2rpx solid #f8ece7;

    .entry {
      margin-top: 20rpx;
      box-shadow: none;
      background: #fdf8f6;
    }
  }
}
</style>
