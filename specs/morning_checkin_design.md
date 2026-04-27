# 晨光打卡改造设计

## 目标

将原“笔记打卡附件收集”改造为“晨光打卡”系统，支持每日项目打卡、早起加分、活动周期进度、后台记录管理和累计排名。

## 规则

- 同一学生同一天只有一份日打卡记录。
- 学生可多次提交，后续提交会更新所选项目的数据，并保留历史附件。
- 有效打卡定义为至少一个项目达标。
- 第一次有效打卡时间在 06:30:00 至 07:40:00，含边界，获得 1 分早起加分。
- 五个项目各 1 分，早起加分 1 分，每日最高 6 分。
- 跑步达标条件为距离 >= 2km 且配速 <= 10 min/km。

## 数据

- `daily_checkins` 保存学生某天的汇总记录。
- `checkin_items` 保存每个项目的完成量、是否达标、积分和排名换算量。
- `checkin_attachments` 保存项目对应的附件，后续提交只追加不删除旧附件。
- `activity_settings` 保存活动开始日期、持续天数和启用状态。

## API

- `GET /api/activity` 获取活动设置和进度。
- `POST /api/submissions` 提交或更新当天打卡。
- `GET /api/admin/submissions` 查询日打卡记录。
- `GET /api/admin/rankings` 查询活动周期排名。
- `GET /api/admin/activity` 查询活动设置。
- `PUT /api/admin/activity` 更新活动设置。
- `GET /api/admin/attachments/{attachment_id}/download` 下载附件。

## 安全

- 管理接口继续使用签名 Cookie 登录保护。
- 提交接口在服务端重新计算积分，不信任前端分数。
- 所有文件通过 COS key 访问，下载使用临时签名 URL。
- API 响应不返回密钥、Cookie 或环境变量。
