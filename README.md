# 打卡地图小程序

uni-app Vue3 + uview-plus + 微信云开发。首页是中国地图，点亮的省份可以深入查看区县打卡照片。

## 功能

- 全国地图省级点亮 → 点击省份进入**省内区县地图**，区县点亮 → 点击弹照片墙，全屏预览
- 添加打卡：省 → 市 → 区/县 三级联动选择，照片上传云存储
- 早期只有省份的打卡记录，在省内视图的「省级打卡」入口查看
- 「我想去」心愿单：省内视图点击未点亮区县 → 标记为想去（可写一句话理由），地图上以淡紫区域 + ⭐ 星标展示；打卡心愿地点后自动达成消除，配「心愿达成 🎉」庆祝文案。顶部「想去 N 个地方」入口可查看/取消心愿

## 开发

```bash
npm install          # 安装依赖(建议 --registry=https://registry.npmmirror.com)
npm run dev:mp-weixin    # 开发模式编译,产物在 dist/dev/mp-weixin
npm run build:mp-weixin  # 生产构建,产物在 dist/build/mp-weixin
npm run gen:map          # 重新生成全国省级地图数据(src/common/china-provinces.js)
npm run gen:pca          # 重新生成省市县三级数据(src/common/pca.js)
npm run fetch:geo        # 下载区县级 GeoJSON 到 scripts/geo-data/(供上传云存储)
```

用微信开发者工具导入 `dist/dev/mp-weixin`(或 build 产物)即可预览,appid 已配置为 `wxa2cb804d38b44f1d`。

## 云开发配置(一次性手动步骤)

1. 微信开发者工具中点击「云开发」开通，创建一个环境
2. 把环境 ID 填到 `src/common/cloud.js` 顶部的 `CLOUD_ENV`
3. 云控制台 → 数据库 → 新建集合 `checkins` 和 `wishes`,权限设为「所有用户可读，仅创建者可写」
4. 上传区县地图数据：先运行 `npm run fetch:geo` 生成 `scripts/geo-data/`（约 398 个 json），再整目录上传到云存储 `geo/` 文件夹下；存储权限设为「所有用户可读」

## 区县地图数据

省内区县级边界数据在运行时按需加载(`src/common/geo.js`，成功后有本地缓存)，主源是微信云存储 `geo/` 目录——其 `tcb.qcloud.la` 域名已在 request 合法域名白名单内，国内访问稳定，无需额外配置。jsdelivr 节点仅作 H5 调试兜底。

数据源为 npm 包 `china-province-city-district-geojson`(GCJ-02 坐标系，与微信地图一致)，由 `npm run fetch:geo` 筛选出运行时会请求的省/市两级文件（区县文件不直接请求，故不上传）。

## 数据结构

`checkins` 集合：

| 字段 | 类型 | 说明 |
|---|---|---|
| adcode | number | 省份行政区划代码 |
| province | string | 省份名 |
| cityAdcode | number | 城市代码(旧数据无此字段) |
| city | string | 城市名 |
| countyAdcode | number | 区/县代码(旧数据无此字段) |
| county | string | 区/县名 |
| title | string | 打卡标题 |
| note | string | 备注 |
| date | string | 打卡日期 YYYY-MM-DD |
| photos | string[] | 云存储 fileID 列表 |
| createTime | Date | 创建时间(服务端) |

`wishes` 集合(「我想去」心愿单)：

| 字段 | 类型 | 说明 |
|---|---|---|
| adcode | number | 省份行政区划代码 |
| province | string | 省份名 |
| cityAdcode | number | 城市代码 |
| city | string | 城市名 |
| countyAdcode | number | 区/县代码(同一区县最多一条心愿,云函数幂等保证) |
| county | string | 区/县名 |
| note | string | 一句话心愿(想去的理由,可空) |
| createTime | Date | 创建时间(服务端) |

## 说明

- 省市县三级数据源 `china-division` 仅含大陆 31 省级行政区，港澳台暂不能选为打卡地点
- 地图底图为腾讯地图原生 `<map>` 组件，点亮覆盖层为 polygons 矢量绘制；全国省图内置，区县图按需加载并缓存
