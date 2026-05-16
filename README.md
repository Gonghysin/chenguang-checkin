# 晨光打卡

面向英语学习与晨间运动的打卡系统。同学每天按项目提交完成量和对应截图，系统自动计算基础积分、早起加分和活动周期排名。

## 规则

- 每位学生每天保留一份打卡记录，后续提交会更新所选项目并追加截图。
- 第一次有效打卡在 06:30:00 至 07:40:00，含边界，当天获得 1 分早起加分。
- 有效打卡为至少完成一个达标项目。
- 每个项目 1 分，每日基础分最高 6 分，加早起分后每日最高 7 分。
- 跑步达标条件：距离 >= 2km，配速 <= 10 min/km。

## 项目积分

| 项目 | 达标条件 |
|------|----------|
| 听力 | 一套听力题，不少于 10 小题 |
| 阅读 | 两道阅读题，不少于 10 小题 |
| 英语作文 | 一篇英语作文，不少于 100 词 |
| 背单词 | 通过 App 学习 20 个以上新单词 |
| 口语 | 一次口语练习，不少于 10 min 或不少于 15 句对话 |
| 跑步 | 跑步 2 公里及以上，配速 <= 10 min/km |

## 技术栈

- 后端：Python + FastAPI + SQLAlchemy 2.0 async + Alembic + Sealos 对象存储
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
make configure-oss
make set-admin
make nohup
```

`make bootstrap` 会安装系统依赖、Node.js 22、uv，并同步前后端依赖。首次运行会创建 `backend/.env`，需要在服务器上填入真实对象存储配置；该文件已被 `.gitignore` 排除，不会上传到 GitHub。

Sealos Devbox 建议用普通 devbox 用户部署：

```bash
cd /path/to/chenguang-checkin
make bootstrap
```

如果已经通过 `sudo -i` 切到了 root，也要先回到项目目录再执行命令：

```bash
cd /home/devbox/chenguang-checkin
make bootstrap
```

脚本会自动识别项目目录的拥有者。即使从 root 执行，`uv sync`、`npm ci`、构建、nohup 和 PM2 运维命令也会切回项目用户运行，避免 `.venv`、`node_modules`、`logs` 变成 root 权限后 devbox 用户无法继续维护。只有 `apt-get` 和全局安装 PM2 这类系统级步骤会使用 sudo/root。

依赖安装默认使用国内镜像：

```bash
UV_DEFAULT_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple
NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
```

如需改回官方源，可以在命令前覆盖：

```bash
UV_DEFAULT_INDEX=https://pypi.org/simple NPM_CONFIG_REGISTRY=https://registry.npmjs.org make bootstrap
```

耗时步骤会显示当前步骤、执行用户、工作目录、日志文件和一个简单进度动画。若安装卡住，可以另开终端查看提示中的 `logs/deploy-*.log`。

配置 Sealos 对象存储：

```bash
make configure-oss
```

该命令会交互询问 Access Key、Secret Key、Internal endpoint、External endpoint 和桶名称，并写入本机 `backend/.env`。不要把真实密钥写入 `.env.example` 或提交到 Git。

配置生产安全项：

```bash
make configure-security
```

该命令会自动生成随机 `ADMIN_SESSION_SECRET`，并把 `ENVIRONMENT=production`、上传大小限制和单次上传文件数限制写入 `backend/.env`。每次运行都会轮换管理员会话密钥，现有管理员登录会失效；通常首次上线或需要主动轮换密钥时运行即可，滚动更新前不需要每次执行。

可通过环境变量调整上传限制：

```bash
UPLOAD_MAX_FILE_SIZE_MB=12 UPLOAD_MAX_FILES_PER_SUBMISSION=15 make configure-security
```

`make nohup` 会交互询问两个公网地址：

- 后端公网地址：Sealos 中 8000 端口对应的公网地址，例如 `https://api.example.sealoszh.site`
- 前端公网地址：Sealos 中 5173 端口对应的公网地址，例如 `https://app.example.sealoszh.site`

nohup 运维命令：

```bash
make nohup-status
make nohup-logs
make nohup-stop
make rolling-update
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
- 文件预览通过 Sealos 对象存储临时签名 URL。
