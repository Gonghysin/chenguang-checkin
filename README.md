# 晨光打卡

面向英语学习与晨间运动的打卡系统。同学每天按项目提交完成量和对应截图，系统自动计算基础积分、早起加分和活动周期排名。

## 规则

- 每位学生每天保留一份打卡记录，后续提交会更新所选项目并追加截图。
- 第一次有效打卡在 06:30:00 至 07:40:00，含边界，当天获得 1 分早起加分。
- 有效打卡为至少完成一个达标项目。
- 每个项目 1 分，每日基础分最高 5 分，加早起分后每日最高 6 分。
- 跑步达标条件：距离 >= 2km，配速 <= 10 min/km。

## 项目积分

| 项目 | 达标条件 |
|------|----------|
| 听力 | 一套听力题，不少于 10 小题 |
| 阅读 | 两道阅读题，不少于 10 小题 |
| 英语作文 | 一篇英语作文，不少于 100 词 |
| 背单词 | 通过 App 学习 20 个以上新单词 |
| 跑步 | 跑步 2 公里及以上，配速 <= 10 min/km |

## 技术栈

- 后端：Python + FastAPI + SQLAlchemy 2.0 async + Alembic + 腾讯云 COS
- 前端：React + Vite + Tailwind CSS + React Router
- 数据库：SQLite/PostgreSQL，取决于 `DATABASE_URL`

## 启动与部署

后端配置文件放在 `backend/.env`。

常用命令统一走根目录 `Makefile`：

```bash
make help
```

清空默认端口 `8000 5173 5174`：

```bash
make clear-ports
```

本地开发一键启动前后端：

```bash
make dev
```

访问地址：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:8000`
- API 文档：`http://localhost:8000/docs`

一键部署前后端并用 PM2 启动：

```bash
make deploy BACKEND_URL=http://api.example.com
```

Ubuntu/Sealos 空环境部署推荐流程：

```bash
make bootstrap
make set-admin
make nohup
```

`make bootstrap` 会安装系统依赖、Node.js 22、uv，并同步前后端依赖。首次运行会创建 `backend/.env`，需要在服务器上填入真实 COS 配置；该文件已被 `.gitignore` 排除，不会上传到 GitHub。

`make nohup` 会交互询问两个公网地址：

- 后端公网地址：Sealos 中 8000 端口对应的公网地址，例如 `https://api.example.sealoszh.site`
- 前端公网地址：Sealos 中 5173 端口对应的公网地址，例如 `https://app.example.sealoszh.site`

nohup 运维命令：

```bash
make nohup-status
make nohup-logs
make nohup-stop
```

本地启动可以使用：

```bash
make start BACKEND_URL=http://localhost
```

脚本会把本地地址自动转换为前端可用的 `http://localhost:8000/api`。

已部署环境重新构建并启动：

```bash
make start BACKEND_URL=http://api.example.com
```

运维命令：

```bash
make status
make logs
make backend-logs
make set-admin
make restart
make stop
make update BACKEND_URL=http://api.example.com
```

管理员账号密码不写入代码。首次部署后可运行 `make set-admin` 交互式写入数据库，密码会以 bcrypt 哈希保存。

## API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/activity` | 获取活动进度 |
| POST | `/api/submissions` | 提交或更新当天打卡 |
| POST | `/api/admin/login` | 管理员登录 |
| POST | `/api/admin/logout` | 管理员登出 |
| GET | `/api/admin/submissions` | 查询每日打卡记录 |
| DELETE | `/api/admin/submissions/{id}` | 删除某天打卡记录 |
| GET | `/api/admin/rankings` | 查询活动周期排名 |
| GET | `/api/admin/activity` | 获取活动设置 |
| PUT | `/api/admin/activity` | 更新活动设置 |
| GET | `/api/admin/attachments/{id}/download` | 获取附件下载链接 |

## 安全

- 管理密码使用 bcrypt 哈希存储。
- 管理接口使用签名 Cookie 鉴权。
- 积分规则在服务端计算，前端提交的分数不被信任。
- 文件下载通过 COS 临时签名 URL。
