#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=deploy_common.sh
. "$SCRIPT_DIR/deploy_common.sh"
ENV_FILE="$BACKEND_DIR/.env"

set_env() {
    local key="$1"
    local value="$2"
    local tmp_file
    tmp_file="$(mktemp)"

    if [ -f "$ENV_FILE" ] && grep -q "^${key}=" "$ENV_FILE"; then
        awk -v key="$key" -v value="$value" '
            BEGIN { replaced = 0 }
            $0 ~ "^" key "=" {
                print key "=" value
                replaced = 1
                next
            }
            { print }
            END {
                if (replaced == 0) {
                    print key "=" value
                }
            }
        ' "$ENV_FILE" > "$tmp_file"
    else
        if [ -f "$ENV_FILE" ]; then
            cp "$ENV_FILE" "$tmp_file"
        else
            : > "$tmp_file"
        fi
        printf '%s=%s\n' "$key" "$value" >> "$tmp_file"
    fi

    mv "$tmp_file" "$ENV_FILE"
}

generate_secret() {
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex 48
        return
    fi

    if command -v python3 >/dev/null 2>&1; then
        python3 -c 'import secrets; print(secrets.token_hex(48))'
        return
    fi

    echo "错误: 找不到 openssl 或 python3，无法生成随机密钥" >&2
    exit 1
}

mkdir -p "$BACKEND_DIR"
if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$BACKEND_DIR/.env.example" ]; then
        cp "$BACKEND_DIR/.env.example" "$ENV_FILE"
    else
        : > "$ENV_FILE"
    fi
fi

SECRET="$(generate_secret)"
UPLOAD_MAX_FILE_SIZE_MB="${UPLOAD_MAX_FILE_SIZE_MB:-8}"
UPLOAD_MAX_FILES_PER_SUBMISSION="${UPLOAD_MAX_FILES_PER_SUBMISSION:-10}"

case "$UPLOAD_MAX_FILE_SIZE_MB" in
    ''|*[!0-9]*)
        echo "错误: UPLOAD_MAX_FILE_SIZE_MB 必须是正整数" >&2
        exit 1
        ;;
esac

case "$UPLOAD_MAX_FILES_PER_SUBMISSION" in
    ''|*[!0-9]*)
        echo "错误: UPLOAD_MAX_FILES_PER_SUBMISSION 必须是正整数" >&2
        exit 1
        ;;
esac

if [ "$UPLOAD_MAX_FILE_SIZE_MB" -le 0 ] || [ "$UPLOAD_MAX_FILES_PER_SUBMISSION" -le 0 ]; then
    echo "错误: 上传限制必须大于 0" >&2
    exit 1
fi

set_env "ENVIRONMENT" "production"
set_env "ADMIN_SESSION_SECRET" "$SECRET"
set_env "UPLOAD_MAX_FILE_SIZE_MB" "$UPLOAD_MAX_FILE_SIZE_MB"
set_env "UPLOAD_MAX_FILES_PER_SUBMISSION" "$UPLOAD_MAX_FILES_PER_SUBMISSION"
chown_to_project_user "$ENV_FILE"

echo "生产安全配置已写入 backend/.env"
echo "  ENVIRONMENT=production"
echo "  ADMIN_SESSION_SECRET=<已随机生成并写入>"
echo "  UPLOAD_MAX_FILE_SIZE_MB=$UPLOAD_MAX_FILE_SIZE_MB"
echo "  UPLOAD_MAX_FILES_PER_SUBMISSION=$UPLOAD_MAX_FILES_PER_SUBMISSION"
echo ""
echo "提示: 每次运行都会轮换 ADMIN_SESSION_SECRET，现有管理员登录会失效。"
