#!/usr/bin/env bash
# =============================================================================
# 監視・アラート設定を gcloud で一括適用するスクリプト (idempotent)。
#
# 適用内容:
#   1) Notification Channel (email)
#   2) Uptime Check on /healthz
#   3) Log-based metric: severity>=ERROR の発生数
#   4) Log-based metric: ACCESS_DENIED (Bot 退室) の発生数
#   5) Alerting Policy x3 (uptime / error rate / bot kicked)
#
# 前提:
#   - gcloud auth login 済 (本人 or 同等の権限を持つ identity)
#   - monitoring.googleapis.com / logging.googleapis.com が enable 済
#
# 実行:
#   ./scripts/setup-monitoring.sh
#
# 環境変数で上書き可:
#   PROJECT_ID / SERVICE_NAME / REGION / ALERT_EMAIL / SERVICE_HOST
# =============================================================================
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-office-381404}"
SERVICE_NAME="${SERVICE_NAME:-worksmobile-message-bot}"
REGION="${REGION:-asia-northeast1}"
ALERT_EMAIL="${ALERT_EMAIL:-fujii@miraius.co.jp}"
SERVICE_HOST="${SERVICE_HOST:-worksmobile-message-bot-6dkxmuzina-an.a.run.app}"

METRIC_ERRORS="worksmobile_message_bot_errors"
METRIC_KICKED="worksmobile_message_bot_kicked"

POLICY_UPTIME_NAME="[${SERVICE_NAME}] Uptime check 失敗 (/healthz)"
POLICY_ERRORS_NAME="[${SERVICE_NAME}] severity>=ERROR 発生"
POLICY_KICKED_NAME="[${SERVICE_NAME}] Bot がチャンネルから退室 (ACCESS_DENIED)"
UPTIME_DISPLAY_NAME="${SERVICE_NAME}-healthz"

log() { echo "==> $*"; }

# -----------------------------------------------------------------------------
# 1) Notification Channel (email): 既存なら id を再利用
# -----------------------------------------------------------------------------
log "Notification Channel (email=${ALERT_EMAIL}) を確認"
CHANNEL_DISPLAY="email:${ALERT_EMAIL}"
CHANNEL_ID="$(gcloud beta monitoring channels list \
  --project="${PROJECT_ID}" \
  --filter="type=email AND displayName=\"${CHANNEL_DISPLAY}\"" \
  --format="value(name)" | head -n1)"
if [ -z "${CHANNEL_ID}" ]; then
  log "  作成中..."
  CHANNEL_ID="$(gcloud beta monitoring channels create \
    --project="${PROJECT_ID}" \
    --display-name="${CHANNEL_DISPLAY}" \
    --type=email \
    --channel-labels="email_address=${ALERT_EMAIL}" \
    --format="value(name)")"
fi
log "  channel: ${CHANNEL_ID}"

# -----------------------------------------------------------------------------
# 2) Uptime Check on /healthz
# -----------------------------------------------------------------------------
log "Uptime Check (${UPTIME_DISPLAY_NAME}) を確認"
EXISTING_UPTIME="$(gcloud monitoring uptime list-configs \
  --project="${PROJECT_ID}" \
  --filter="displayName=\"${UPTIME_DISPLAY_NAME}\"" \
  --format="value(name)" | head -n1)"
if [ -z "${EXISTING_UPTIME}" ]; then
  log "  作成中..."
  gcloud monitoring uptime create "${UPTIME_DISPLAY_NAME}" \
    --project="${PROJECT_ID}" \
    --resource-labels=host="${SERVICE_HOST}",project_id="${PROJECT_ID}" \
    --resource-type=uptime-url \
    --path=/healthz \
    --port=443 \
    --protocol=https \
    --period=5 \
    --status-classes=STATUS_CLASS_2XX
else
  log "  既存を再利用 (${EXISTING_UPTIME})"
fi
UPTIME_CHECK_ID="$(gcloud monitoring uptime list-configs \
  --project="${PROJECT_ID}" \
  --filter="displayName=\"${UPTIME_DISPLAY_NAME}\"" \
  --format="value(name)" | head -n1 | awk -F/ '{print $NF}')"
log "  check id: ${UPTIME_CHECK_ID}"

# -----------------------------------------------------------------------------
# 3) Log-based metric: severity>=ERROR
# -----------------------------------------------------------------------------
log "Log-based metric '${METRIC_ERRORS}' を確認"
FILTER_ERRORS="resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${SERVICE_NAME}\" AND severity>=ERROR"
if gcloud logging metrics describe "${METRIC_ERRORS}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  log "  既存を更新"
  gcloud logging metrics update "${METRIC_ERRORS}" \
    --project="${PROJECT_ID}" \
    --description="Cloud Run service '${SERVICE_NAME}' の severity>=ERROR 発生数" \
    --log-filter="${FILTER_ERRORS}" >/dev/null
else
  log "  作成中..."
  gcloud logging metrics create "${METRIC_ERRORS}" \
    --project="${PROJECT_ID}" \
    --description="Cloud Run service '${SERVICE_NAME}' の severity>=ERROR 発生数" \
    --log-filter="${FILTER_ERRORS}" >/dev/null
fi

# -----------------------------------------------------------------------------
# 4) Log-based metric: ACCESS_DENIED (Bot 退室)
# -----------------------------------------------------------------------------
log "Log-based metric '${METRIC_KICKED}' を確認"
FILTER_KICKED="resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${SERVICE_NAME}\" AND jsonPayload.caller=\"services/lineworks/api.postJson.botKicked\""
if gcloud logging metrics describe "${METRIC_KICKED}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  log "  既存を更新"
  gcloud logging metrics update "${METRIC_KICKED}" \
    --project="${PROJECT_ID}" \
    --description="Bot がチャンネルから退室 (ACCESS_DENIED) されたケース" \
    --log-filter="${FILTER_KICKED}" >/dev/null
else
  log "  作成中..."
  gcloud logging metrics create "${METRIC_KICKED}" \
    --project="${PROJECT_ID}" \
    --description="Bot がチャンネルから退室 (ACCESS_DENIED) されたケース" \
    --log-filter="${FILTER_KICKED}" >/dev/null
fi

# -----------------------------------------------------------------------------
# 5) Alerting Policies (delete-then-create で idempotent に保つ)
#    削除→再作成で構成は常に YAML が正となる。手動 silence 等の状態は失われるので
#    運用上のミュートは Cloud Console 側で wrap せず、必要なら本スクリプトに反映する
# -----------------------------------------------------------------------------
apply_policy() {
  local display_name="$1"
  local yaml="$2"
  log "Alerting Policy '${display_name}' を適用"
  local existing
  existing="$(gcloud alpha monitoring policies list \
    --project="${PROJECT_ID}" \
    --filter="displayName=\"${display_name}\"" \
    --format="value(name)" | head -n1)"
  if [ -n "${existing}" ]; then
    log "  既存を削除 (${existing})"
    gcloud alpha monitoring policies delete "${existing}" --project="${PROJECT_ID}" --quiet
  fi
  log "  作成中..."
  echo "${yaml}" | gcloud alpha monitoring policies create \
    --project="${PROJECT_ID}" \
    --policy-from-file=/dev/stdin >/dev/null
}

# 5a) Uptime check 失敗
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
  - "${CHANNEL_ID}"
EOF
)"
apply_policy "${POLICY_UPTIME_NAME}" "${UPTIME_POLICY_YAML}"

# 5b) severity>=ERROR 発生
ERRORS_POLICY_YAML="$(cat <<EOF
displayName: "${POLICY_ERRORS_NAME}"
combiner: OR
conditions:
  - displayName: "severity>=ERROR rate > 0 (5 min window)"
    conditionThreshold:
      filter: 'metric.type="logging.googleapis.com/user/${METRIC_ERRORS}" AND resource.type="cloud_run_revision"'
      aggregations:
        - alignmentPeriod: 300s
          perSeriesAligner: ALIGN_DELTA
          crossSeriesReducer: REDUCE_SUM
      comparison: COMPARISON_GT
      duration: 0s
      thresholdValue: 0
      trigger:
        count: 1
notificationChannels:
  - "${CHANNEL_ID}"
EOF
)"
apply_policy "${POLICY_ERRORS_NAME}" "${ERRORS_POLICY_YAML}"

# 5c) Bot 退室 (ACCESS_DENIED)
KICKED_POLICY_YAML="$(cat <<EOF
displayName: "${POLICY_KICKED_NAME}"
combiner: OR
conditions:
  - displayName: "ACCESS_DENIED 発生 (LINE WORKS で Bot をチャンネルに再招待が必要)"
    conditionThreshold:
      filter: 'metric.type="logging.googleapis.com/user/${METRIC_KICKED}" AND resource.type="cloud_run_revision"'
      aggregations:
        - alignmentPeriod: 300s
          perSeriesAligner: ALIGN_DELTA
          crossSeriesReducer: REDUCE_SUM
      comparison: COMPARISON_GT
      duration: 0s
      thresholdValue: 0
      trigger:
        count: 1
notificationChannels:
  - "${CHANNEL_ID}"
EOF
)"
apply_policy "${POLICY_KICKED_NAME}" "${KICKED_POLICY_YAML}"

log "完了"
