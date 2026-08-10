#!/usr/bin/env bash
# =============================================================================
# 実行基盤に依存しない HTTPS uptime check と alert policy を設定する。
#
# Notification Channel は Cloud Console または Monitoring API で先に作成し、resource nameを
# NOTIFICATION_CHANNEL_IDへ渡す。このスクリプトはemail addressや環境固有値を保持しない。
#
# 実行例:
#   PROJECT_ID=... \
#   SERVICE_HOST=bot.example.com \
#   NOTIFICATION_CHANNEL_ID=projects/.../notificationChannels/... \
#   ./scripts/setup-monitoring.sh
#
# 必須環境変数: PROJECT_ID / SERVICE_HOST / NOTIFICATION_CHANNEL_ID
# 任意環境変数: SERVICE_NAME / HEALTH_PATH
# =============================================================================
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID}"
SERVICE_NAME="${SERVICE_NAME:-worksmobile-message-bot}"
SERVICE_HOST="${SERVICE_HOST:?Set SERVICE_HOST}"
HEALTH_PATH="${HEALTH_PATH:-/health}"
NOTIFICATION_CHANNEL_ID="${NOTIFICATION_CHANNEL_ID:?Set NOTIFICATION_CHANNEL_ID}"

POLICY_UPTIME_NAME="[${SERVICE_NAME}] Uptime check 失敗 (${HEALTH_PATH})"
UPTIME_DISPLAY_NAME="${SERVICE_NAME}-health"

log() { echo "==> $*"; }

case "${NOTIFICATION_CHANNEL_ID}" in
  "projects/${PROJECT_ID}/notificationChannels/"*) ;;
  *)
    echo "ERROR: NOTIFICATION_CHANNEL_ID must belong to project ${PROJECT_ID}" >&2
    exit 1
    ;;
esac

# Uptime Check
log "Uptime Check (${UPTIME_DISPLAY_NAME}) を確認"
UPTIME_CONFIGS="$(gcloud monitoring uptime list-configs \
  --project="${PROJECT_ID}" \
  --format="value(name,displayName)")"
EXISTING_UPTIME="$(printf '%s\n' "${UPTIME_CONFIGS}" \
  | awk -v n="${UPTIME_DISPLAY_NAME}" -F'\t' '$2==n {print $1; exit}')"
if [ -z "${EXISTING_UPTIME}" ]; then
  log "  作成中..."
  gcloud monitoring uptime create "${UPTIME_DISPLAY_NAME}" \
    --project="${PROJECT_ID}" \
    --resource-labels=host="${SERVICE_HOST}",project_id="${PROJECT_ID}" \
    --resource-type=uptime-url \
    --path="${HEALTH_PATH}" \
    --port=443 \
    --protocol=https \
    --period=5 \
    --status-classes=2xx >/dev/null
  UPTIME_CONFIGS="$(gcloud monitoring uptime list-configs \
    --project="${PROJECT_ID}" \
    --format="value(name,displayName)")"
else
  log "  既存を再利用 (${EXISTING_UPTIME})"
fi
UPTIME_CHECK_ID="$(printf '%s\n' "${UPTIME_CONFIGS}" \
  | awk -v n="${UPTIME_DISPLAY_NAME}" -F'\t' '$2==n {print $1; exit}' \
  | awk -F/ '{print $NF}')"
log "  check id: ${UPTIME_CHECK_ID}"

# Alert Policy。既存の同名policyを置き換え、scriptの定義をSoTにする。
UPTIME_POLICY_YAML="$(cat <<EOF
displayName: "${POLICY_UPTIME_NAME}"
combiner: OR
conditions:
  - displayName: "uptime check failed"
    conditionThreshold:
      filter: 'metric.type="monitoring.googleapis.com/uptime_check/check_passed" AND metric.labels.check_id="${UPTIME_CHECK_ID}" AND resource.type="uptime_url"'
      aggregations:
        - alignmentPeriod: 1200s
          crossSeriesReducer: REDUCE_COUNT_FALSE
          groupByFields:
            - resource.label.host
          perSeriesAligner: ALIGN_NEXT_OLDER
      comparison: COMPARISON_GT
      duration: 60s
      thresholdValue: 1
      trigger:
        count: 1
notificationChannels:
  - "${NOTIFICATION_CHANNEL_ID}"
EOF
)"

log "Alerting Policy '${POLICY_UPTIME_NAME}' を適用"
EXISTING_POLICY="$(gcloud monitoring policies list \
  --project="${PROJECT_ID}" \
  --format="value(name,displayName)" \
  | awk -v n="${POLICY_UPTIME_NAME}" -F'\t' '$2==n {print $1; exit}')"
if [ -n "${EXISTING_POLICY}" ]; then
  log "  既存を削除 (${EXISTING_POLICY})"
  gcloud monitoring policies delete "${EXISTING_POLICY}" --project="${PROJECT_ID}" --quiet
fi
printf '%s\n' "${UPTIME_POLICY_YAML}" | gcloud monitoring policies create \
  --project="${PROJECT_ID}" \
  --policy-from-file=/dev/stdin >/dev/null

log "完了"
