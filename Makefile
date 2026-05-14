PORTS ?= 8000 5173 5174

.PHONY: help clear-ports dev bootstrap setup deploy start nohup rolling-update nohup-stop nohup-status nohup-logs update stop restart status logs backend-logs set-admin configure-oss configure-security build-frontend sync-backend seed-admin

help:
	@echo "可用命令:"
	@echo "  make clear-ports                 清空默认端口: $(PORTS)"
	@echo "  make dev                         本地一键启动后端 8000 和前端 5173"
	@echo "  make bootstrap                   Ubuntu 空环境安装系统依赖、uv、Node、前后端依赖"
	@echo "  make setup                       仅安装依赖并初始化数据库，不启动服务"
	@echo "  make nohup                       交互填写公网地址，用 nohup 启动后端 8000 和前端 5173"
	@echo "  make rolling-update              拉取远程 main，重新构建并重启 nohup 服务"
	@echo "  make nohup-stop                  停止 nohup 启动的服务"
	@echo "  make nohup-status                查看 nohup 服务状态"
	@echo "  make nohup-logs                  查看 nohup 服务日志"
	@echo "  make configure-oss               交互式配置 Sealos 对象存储到 backend/.env"
	@echo "  make configure-security          生成生产安全配置并写入 backend/.env"
	@echo "  make deploy BACKEND_URL=<url>    一键安装依赖、构建前端、初始化后端并用 PM2 启动"
	@echo "  make start BACKEND_URL=<url>     构建并启动前后端 PM2 服务"
	@echo "  make update BACKEND_URL=<url>    拉取代码、重建前端、同步后端依赖并重启"
	@echo "  make stop                        停止 PM2 服务"
	@echo "  make restart                     重启 PM2 服务"
	@echo "  make status                      查看 PM2 状态"
	@echo "  make logs                        查看 PM2 日志"
	@echo "  make backend-logs                实时查看后端应用日志"
	@echo "  make set-admin                   交互式设置管理员账号密码"
	@echo "  make build-frontend              安装前端依赖并构建 dist"
	@echo "  make sync-backend                同步后端 uv 依赖"
	@echo "  make seed-admin                  使用环境变量初始化管理员账号"

clear-ports:
	@for port in $(PORTS); do \
		if ! command -v lsof >/dev/null 2>&1; then \
			echo "错误: lsof 未安装，无法清空端口"; \
			exit 1; \
		fi; \
		pids=$$(lsof -ti tcp:$$port 2>/dev/null || true); \
		if [ -n "$$pids" ]; then \
			echo "清空端口 $$port: $$pids"; \
			kill -9 $$pids; \
		else \
			echo "端口 $$port 未被占用"; \
		fi; \
	done

dev: clear-ports
	@./scripts/dev.sh

bootstrap:
	@bash ./scripts/bootstrap_ubuntu.sh

setup:
	@./scripts/deploy.sh

deploy: clear-ports
	@if [ -z "$(BACKEND_URL)" ]; then \
		echo "错误: 未设置 BACKEND_URL"; \
		echo "用法: make deploy BACKEND_URL=http://api.example.com"; \
		exit 1; \
	fi
	@./scripts/deploy.sh
	@BACKEND_URL="$(BACKEND_URL)" ./scripts/start.sh

start: clear-ports
	@if [ -z "$(BACKEND_URL)" ]; then \
		echo "错误: 未设置 BACKEND_URL"; \
		echo "用法: make start BACKEND_URL=http://api.example.com"; \
		exit 1; \
	fi
	@BACKEND_URL="$(BACKEND_URL)" ./scripts/start.sh

nohup: clear-ports
	@bash ./scripts/nohup_start.sh

rolling-update:
	@bash ./scripts/rolling_update.sh

nohup-stop:
	@bash ./scripts/nohup_start.sh stop

nohup-status:
	@bash ./scripts/nohup_start.sh status

nohup-logs:
	@bash ./scripts/nohup_start.sh logs

update:
	@if [ -z "$(BACKEND_URL)" ]; then \
		echo "错误: 未设置 BACKEND_URL"; \
		echo "用法: make update BACKEND_URL=http://api.example.com"; \
		exit 1; \
	fi
	@BACKEND_URL="$(BACKEND_URL)" ./scripts/update.sh

stop:
	@./scripts/stop.sh

restart:
	@./scripts/restart.sh

status:
	@./scripts/status.sh

logs:
	@./scripts/logs.sh

backend-logs:
	@mkdir -p logs
	@touch logs/backend.log
	@tail -f logs/backend.log

set-admin:
	@./scripts/set_admin.sh

configure-oss:
	@bash ./scripts/configure_oss.sh

configure-security:
	@bash ./scripts/configure_security.sh

build-frontend:
	@bash -lc '. ./scripts/deploy_common.sh && if [ -f "$$FRONTEND_DIR/package-lock.json" ]; then run_project_step "安装前端依赖" "$$FRONTEND_DIR" "npm ci"; else run_project_step "安装前端依赖" "$$FRONTEND_DIR" "npm install"; fi && run_project_step "构建前端" "$$FRONTEND_DIR" "npm run build"'

sync-backend:
	@bash -lc '. ./scripts/deploy_common.sh && run_project_step "同步后端依赖" "$$BACKEND_DIR" "uv sync --locked"'

seed-admin:
	@bash -lc '. ./scripts/deploy_common.sh && run_project_step "初始化管理员账号" "$$BACKEND_DIR" "uv run python scripts/seed_admin.py"'
