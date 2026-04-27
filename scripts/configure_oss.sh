#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
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

prompt_required() {
    local label="$1"
    local value=""
    while [ -z "$value" ]; do
        printf "%s: " "$label" >&2
        read -r value
        if [ -z "$value" ]; then
            echo "不能为空，请重新输入。" >&2
        fi
    done
    printf "%s" "$value"
}

prompt_secret() {
    local label="$1"
    local value=""
    while [ -z "$value" ]; do
        printf "%s: " "$label" >&2
        stty -echo
        read -r value
        stty echo
        printf "\n" >&2
        if [ -z "$value" ]; then
            echo "不能为空，请重新输入。" >&2
        fi
    done
    printf "%s" "$value"
}

mkdir -p "$BACKEND_DIR"
if [ ! -f "$ENV_FILE" ]; then
    cp "$BACKEND_DIR/.env.example" "$ENV_FILE"
fi

echo "================================"
echo " Sealos 对象存储配置"
echo "================================"
echo "配置会写入 backend/.env，该文件不会提交到 Git。"
echo ""

OSS_ACCESS_KEY_ID_INPUT="$(prompt_required "Access Key")"
OSS_SECRET_ACCESS_KEY_INPUT="$(prompt_secret "Secret Key")"
OSS_INTERNAL_ENDPOINT_INPUT="$(prompt_required "Internal endpoint")"
OSS_EXTERNAL_ENDPOINT_INPUT="$(prompt_required "External endpoint")"
OSS_BUCKET_NAME_INPUT="$(prompt_required "桶名称")"

set_env "OSS_ACCESS_KEY_ID" "$OSS_ACCESS_KEY_ID_INPUT"
set_env "OSS_SECRET_ACCESS_KEY" "$OSS_SECRET_ACCESS_KEY_INPUT"
set_env "OSS_INTERNAL_ENDPOINT" "$OSS_INTERNAL_ENDPOINT_INPUT"
set_env "OSS_EXTERNAL_ENDPOINT" "$OSS_EXTERNAL_ENDPOINT_INPUT"
set_env "OSS_BUCKET_NAME" "$OSS_BUCKET_NAME_INPUT"
set_env "OSS_REGION" "us-east-1"

echo ""
echo "Sealos 对象存储配置已写入 backend/.env"
