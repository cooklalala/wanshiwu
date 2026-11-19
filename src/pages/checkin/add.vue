<template>
  <view class="page">
    <!-- 温馨引导:说明这是忘记打卡的补救 -->
    <view class="banner">
      <text class="banner__title">当时忘了打卡也没关系</text>
      <text class="banner__sub">选个地方、挑个日子,把那段回忆补回来吧</text>
    </view>

    <view class="form">
      <!-- 打卡地点 -->
      <view class="form__item" @click="regionPickerShow = true">
        <text class="form__label">回忆发生地</text>
        <view class="form__value" :class="{ 'form__value--empty': !form.county }">
          <text>{{ regionText || '请选择省 / 市 / 区县' }}</text>
          <u-icon name="arrow-right" size="14" color="#c0c4cc"></u-icon>
        </view>
      </view>

      <!-- 日期 -->
      <view class="form__item" @click="datePickerShow = true">
        <text class="form__label">那天的日期</text>
        <view class="form__value">
          <text>{{ form.date }}</text>
          <u-icon name="arrow-right" size="14" color="#c0c4cc"></u-icon>
        </view>
      </view>

      <!-- 标题 -->
      <view class="form__item">
        <text class="form__label">标题</text>
        <u-input
          v-model="form.title"
          placeholder="比如:西湖边的日落"
          border="none"
          :custom-style="{ flex: 1 }"
        />
      </view>

      <!-- 备注 -->
      <view class="form__item form__item--column">
        <text class="form__label">备注</text>
        <u-textarea
          v-model="form.note"
          placeholder="记录当时的心情(选填)"
          border="none"
          count
          maxlength="200"
        ></u-textarea>
      </view>
    </view>

    <!-- 照片(补回忆允许没有照片,先点亮再说) -->
    <view class="photos">
      <text class="form__label">当时的照片<text class="photos__hint">(选填 {{ photos.length }}/9)</text></text>
      <view class="photos__grid">
        <view v-for="(path, i) in photos" :key="i" class="photos__cell">
          <image class="photos__img" :src="path" mode="aspectFill" />
          <view class="photos__del" @click="photos.splice(i, 1)">
            <u-icon name="close" size="12" color="#ffffff"></u-icon>
          </view>
        </view>
        <view v-if="photos.length < 9" class="photos__cell photos__add" @click="choosePhotos">
          <u-icon name="camera-fill" size="28" color="#c0c4cc"></u-icon>
          <text class="photos__add-text">选照片</text>
        </view>
      </view>
    </view>

    <u-button
      type="primary"
      color="#ff6b81"
      shape="circle"
      text="补回这段回忆"
      :loading="submitting"
      :disabled="submitting"
      :custom-style="{ margin: '60rpx 32rpx' }"
      @click="submit"
    ></u-button>

    <!-- 省/市/区县 三级联动选择器 -->
    <u-picker
      ref="regionPicker"
      :show="regionPickerShow"
      :columns="regionColumns"
      :default-index="regionDefaultIndex"
      @change="onRegionChange"
      @confirm="onRegionConfirm"
      @cancel="regionPickerShow = false"
    ></u-picker>

    <!-- 日期选择器 -->
    <u-datetime-picker
      :show="datePickerShow"
      v-model="dateValue"
      mode="date"
      :max-date="Date.now()"
      @confirm="onDateConfirm"
      @cancel="datePickerShow = false"
    ></u-datetime-picker>
  </view>
</template>

<script setup>
import { ref, reactive, computed, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { addCheckin, uploadPhotos } from '@/common/cloud.js'
import { pca } from '@/common/pca.js'
import { lookupRegion, normalizeAdcode } from '@/common/region-lookup.js'

// ---------- 省/市/区县 三级联动 ----------
const regionPicker = ref(null)
const regionPickerShow = ref(false)
// 各列的默认选中下标,补回忆预填地点时让滚轮停在对应位置
const regionDefaultIndex = ref([0, 0, 0])

// 当前选中的三个节点
const selProvince = ref(pca[0])
const selCity = ref(pca[0].children?.[0] || null)
const selCounty = ref(null)

// 无下级区县的市(东莞、中山等直筒子市),用市本身作为区县列
function citiesOf(p) {
  return p?.children || []
}
function countiesOf(c) {
  return c?.children?.length ? c.children : c ? [c] : []
}
const names = (list) => list.map((n) => n.name)

const regionColumns = ref([
  names(pca),
  names(citiesOf(selProvince.value)),
  names(countiesOf(selCity.value))
])

const regionText = computed(() =>
  form.province ? `${form.province} / ${form.city} / ${form.county}` : ''
)

function onRegionChange(e) {
  const { columnIndex, index } = e
  if (columnIndex === 0) {
    selProvince.value = pca[index]
    selCity.value = citiesOf(selProvince.value)[0] || null
    regionPicker.value.setColumnValues(1, names(citiesOf(selProvince.value)))
    regionPicker.value.setColumnValues(2, names(countiesOf(selCity.value)))
  } else if (columnIndex === 1) {
    selCity.value = citiesOf(selProvince.value)[index] || null
    regionPicker.value.setColumnValues(2, names(countiesOf(selCity.value)))
  }
}

function onRegionConfirm(e) {
  const [pName, cName, aName] = e.value
  const p = pca.find((n) => n.name === pName)
  const c = citiesOf(p).find((n) => n.name === cName) || null
  const a = countiesOf(c).find((n) => n.name === aName) || c
  form.adcode = normalizeAdcode(p.code)
  form.province = p.name
  form.cityAdcode = c ? normalizeAdcode(c.code) : null
  form.city = c?.name || ''
  form.countyAdcode = a ? normalizeAdcode(a.code) : null
  form.county = a?.name || ''
  regionPickerShow.value = false
}

// 从其他页面带着区县 adcode 进来时,预填地点并把选择器滚轮停到对应位置
async function prefillRegion(countyAdcode) {
  const info = lookupRegion(countyAdcode)
  if (!info) return
  form.adcode = info.adcode
  form.province = info.province
  form.cityAdcode = info.cityAdcode
  form.city = info.city
  form.countyAdcode = info.countyAdcode
  form.county = info.county

  const pi = pca.findIndex((p) => normalizeAdcode(p.code) === info.adcode)
  if (pi < 0) return
  selProvince.value = pca[pi]
  const cities = citiesOf(selProvince.value)
  const ci = Math.max(0, cities.findIndex((c) => normalizeAdcode(c.code) === info.cityAdcode))
  selCity.value = cities[ci] || null
  const counties = countiesOf(selCity.value)
  const ai = Math.max(0, counties.findIndex((a) => normalizeAdcode(a.code) === info.countyAdcode))
  selCounty.value = counties[ai] || null
  regionColumns.value = [names(pca), names(cities), names(counties)]
  // 等列数据先更新,再设置滚轮位置,避免被默认值覆盖
  await nextTick()
  regionDefaultIndex.value = [pi, ci, ai]
}

onLoad((options) => {
  const adcode = Number(options?.adcode)
  if (adcode) prefillRegion(adcode)
})

// ---------- 表单 ----------
const today = new Date()
const pad = (n) => String(n).padStart(2, '0')
const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

const form = reactive({
  adcode: null,
  province: '',
  cityAdcode: null,
  city: '',
  countyAdcode: null,
  county: '',
  date: todayStr,
  title: '',
  note: ''
})

const photos = ref([])
const submitting = ref(false)
const datePickerShow = ref(false)
const dateValue = ref(Date.now())

function onDateConfirm(e) {
  const d = new Date(e.value)
  form.date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  datePickerShow.value = false
}

async function choosePhotos() {
  try {
    const res = await uni.chooseMedia({
      count: 9 - photos.value.length,
      mediaType: ['image'],
      sizeType: ['compressed']
    })
    photos.value.push(...res.tempFiles.map((f) => f.tempFilePath))
  } catch (e) {
    // 用户取消,忽略
  }
}

async function submit() {
  if (!form.countyAdcode) {
    uni.showToast({ title: '先选选回忆发生的地方吧', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    // 照片选填:没留照片的日子,也值得被点亮
    const fileIds = photos.value.length
      ? await uploadPhotos(photos.value, form.countyAdcode)
      : []
    await addCheckin({
      adcode: form.adcode,
      province: form.province,
      cityAdcode: form.cityAdcode,
      city: form.city,
      countyAdcode: form.countyAdcode,
      county: form.county,
      title: form.title.trim(),
      note: form.note.trim(),
      date: form.date,
      photos: fileIds,
      visits: 1
    })
    uni.showToast({ title: '回忆已补回', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 800)
  } catch (e) {
    console.error('补充回忆失败', e)
    uni.showToast({ title: '保存失败,请重试', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
}

.banner {
  margin: 24rpx 32rpx 0;
  padding: 28rpx 32rpx;
  background: linear-gradient(135deg, #fff0e8 0%, #ffe8ee 100%);
  border-radius: 20rpx;
  display: flex;
  flex-direction: column;

  &__title {
    font-size: 30rpx;
    font-weight: 600;
    color: #d1665a;
    letter-spacing: 2rpx;
  }

  &__sub {
    font-size: 24rpx;
    color: #c98f7d;
    margin-top: 10rpx;
  }
}

.form {
  margin: 24rpx 32rpx;
  padding: 8rpx 32rpx;
  background: #ffffff;
  border-radius: 20rpx;

  &__item {
    display: flex;
    align-items: center;
    padding: 28rpx 0;
    border-bottom: 2rpx solid #f2f3f5;

    &:last-child {
      border-bottom: none;
    }

    &--column {
      flex-direction: column;
      align-items: stretch;

      .form__label {
        margin-bottom: 16rpx;
      }
    }
  }

  &__label {
    width: 150rpx;
    flex-shrink: 0;
    font-size: 28rpx;
    color: #303133;
    font-weight: 500;
  }

  &__value {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 28rpx;
    color: #303133;

    &--empty {
      color: #c0c4cc;
    }
  }
}

.photos {
  margin: 24rpx 32rpx;
  padding: 28rpx 32rpx;
  background: #ffffff;
  border-radius: 20rpx;

  &__hint {
    font-size: 22rpx;
    font-weight: 400;
    color: #c0c4cc;
    margin-left: 8rpx;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16rpx;
    margin-top: 24rpx;
  }

  &__cell {
    position: relative;
    width: 100%;
    height: 200rpx;
    border-radius: 12rpx;
    overflow: hidden;
  }

  &__img {
    width: 100%;
    height: 100%;
  }

  &__del {
    position: absolute;
    top: 8rpx;
    right: 8rpx;
    width: 36rpx;
    height: 36rpx;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__add {
    border: 2rpx dashed #dcdfe6;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  &__add-text {
    font-size: 22rpx;
    color: #c0c4cc;
    margin-top: 8rpx;
  }
}
</style>
