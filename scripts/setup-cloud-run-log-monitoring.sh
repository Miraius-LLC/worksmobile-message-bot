#!/usr/bin/env bash
# =============================================================================
# Cloud Runへデプロイする場合だけ使う、Cloud Loggingベースの追加監視。
# platform共通のuptime監視はsetup-monitoring.shで設定する。
#
# 実行例:
#   PROJECT_ID=... \
#   NOTIFICATION_CHANNEL_ID=projects/.../notificationChannels/... \
#   ./scripts/setup-cloud-run-log-monitoring.sh
#
# 必須環境変数: PROJECT_ID / NOTIFICATION_CHANNEL_ID
# 任意環境変数: SERVICE_NAME
# =============================================================================
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID}"
SERVICE_NAME="${SERVICE_NAME:-worksmobile-message-bot}"
NOTIFICATION_CHANNEL_ID="${NOTIFICATION_CHANNEL_ID:?Set NOTIFICATION_CHANNEL_ID}"

METRIC_ERRORS="worksmobile_message_bot_errors"
METRIC_KICKED="worksmobile_message_bot_kicked"
POLICY_ERRORS_NAME="[${SERVICE_NAME}] severity>=ERROR 発生"
POLICY_KICKED_NAME="[${SERVICE_NAME}] Bot がチャンネルから退室 (ACCESS_DENIED)"

log() { echo "==> $*"; }

case "${NOTIFICATION_CHANNEL_ID}" in
  "projects/${PROJECT_ID}/notificationChannels/"*) ;;
  *)
    echo "ERROR: NOTIFICATION_CHANNEL_ID must belong to project ${PROJECT_ID}" >&2
    exit 1
    ;;
esac

apply_metric() {
  local metric_name="$1"
  local description="$2"
  local log_filter="$3"
  log "Log-based metric '${metric_name}' を適用"
  if gcloud logging metrics describe "${metric_name}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud logging metrics update "${metric_name}" \
      --project="${PROJECT_ID}" \
      --description="${description}" \
      --log-filter="${log_filter}" >/dev/null
  else
    gcloud logging metrics create "${metric_name}" \
      --project="${PROJECT_ID}" \
      --description="${description}" \
      --log-filter="${log_filter}" >/dev/null
  fi
}

apply_policy() {
  local display_name="$1"
  local yaml="$2"
  local existing
  log "Alerting Policy '${display_name}' を適用"
  existing="$(gcloud monitoring policies list \
    --project="${PROJECT_ID}" \
    --format="value(name,displayName)" \
    | awk -v n="${display_name}" -F'\t' '$2==n {print $1; exit}')"
  if [ -n "${existing}" ]; then
    gcloud monitoring policies delete "${existing}" --project="${PROJECT_ID}" --quiet
  fi
  printf '%s\n' "${yaml}" | gcloud monitoring policies create \
    --project="${PROJECT_ID}" \
    --policy-from-file=/dev/stdin >/dev/null
}

FILTER_ERRORS="resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${SERVICE_NAME}\" AND severity>=ERROR"
FILTER_KICKED="resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${SERVICE_NAME}\" AND jsonPayload.caller=\"services/lineworks/api.postJson.botKicked\""

apply_metric \
  "${METRIC_ERRORS}" \
  "Cloud Run service '${SERVICE_NAME}' の severity>=ERROR 発生数" \
  "${FILTER_ERRORS}"
apply_metric \
  "${METRIC_KICKED}" \
  "Bot がチャンネルから退室 (ACCESS_DENIED) されたケース" \
  "${FILTER_KICKED}"

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
  - "${NOTIFICATION_CHANNEL_ID}"
EOF
)"

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
  - "${NOTIFICATION_CHANNEL_ID}"
EOF
)"

apply_policy "${POLICY_ERRORS_NAME}" "${ERRORS_POLICY_YAML}"
apply_policy "${POLICY_KICKED_NAME}" "${KICKED_POLICY_YAML}"

log "完了"
