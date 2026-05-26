# ==============================================================================
# .env — LINE WORKS bot のローカル env (テンプレート)
# ==============================================================================
# このファイル (.env.tpl) は tracked。実体 .env は 1Password (Worksmobile vault) から生成:
#   bun run secrets:inject   (= op inject -f -i .env.tpl -o .env)
# .tpl は op 参照のみ = secret 非含有なので PUBLIC repo でも安全に commit できる。.env は .gitignore 済。
# 本番 (Cloud Run) は Secret Manager 注入 (ADR-0009) なので本ファイルはローカル開発専用。
# ==============================================================================

CLIENT_ID="{{ op://Worksmobile/LINE WORKS Bot/client_id }}"
CLIENT_SECRET="{{ op://Worksmobile/LINE WORKS Bot/client_secret }}"
SERVICE_ACCOUNT="{{ op://Worksmobile/LINE WORKS Bot/service_account }}"
PRIVATE_KEY="{{ op://Worksmobile/LINE WORKS Bot/private_key }}"
BOT_ID="{{ op://Worksmobile/LINE WORKS Bot/bot_id }}"
BOT_SECRET="{{ op://Worksmobile/LINE WORKS Bot/bot_secret }}"
BASIC_ID="{{ op://Worksmobile/LINE WORKS Basic/basic_id }}"
BASIC_PASS="{{ op://Worksmobile/LINE WORKS Basic/basic_pass }}"
