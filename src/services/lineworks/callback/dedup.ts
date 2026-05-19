import { createHash } from 'node:crypto'

const TTL_MS = 5 * 60 * 1000

/**
 * key (raw body の SHA-256) → 失効する Unix epoch ms。
 * Cloud Run の `min-instances=1` で平常時は 1 instance に張り付くことを前提に動く。
 * auto-scale で 2 instance 以上が同時稼働すると instance ごとに別 Map が走り破綻する。
 * 詳細な運用前提・移行条件は README の「Callback (受信側) → Dedup」節を参照。
 */
const seen = new Map<string, number>()

function gc(now: number): void {
  for (const [key, expiry] of seen) {
    if (expiry <= now) seen.delete(key)
  }
}

/**
 * raw body の SHA-256 を dedup key として返す。
 * LINE WORKS の callback payload には event ID 相当のフィールドが無いため、
 * payload 全体のハッシュをキーにする。同一 payload の再送は同じ key を生む。
 */
export function buildDedupKey(rawBody: string): string {
  return createHash('sha256').update(rawBody, 'utf8').digest('hex')
}

/**
 * key が直近 5 分以内に登録されていれば true (= duplicate)、未登録なら登録して false。
 * 戻り値が true の場合、呼び出し側は副作用無しで 200 を返すべき (LINE WORKS は再送を止める)。
 *
 * 副作用のない pure な dedup check ではなく、check + register を 1 関数にまとめている。
 * 「check → 副作用 → register」の順だと副作用の途中で再送が来た時にすり抜けるため、
 * 必ず先に register することで「副作用着手前に重複だと判定する」性質を担保する。
 */
export function checkAndRegister(key: string, now: number = Date.now()): boolean {
  gc(now)
  const existing = seen.get(key)
  if (existing !== undefined && existing > now) return true
  seen.set(key, now + TTL_MS)
  return false
}

/**
 * 副作用 (dispatch) が throw した場合に呼ぶ。LINE WORKS の再送を再び受け付けられるよう
 * key を内部 Map から削除する。`checkAndRegister` で登録した直後の rollback 用。
 *
 * 呼ばない場合: dispatch 失敗 (例: 業務 API への書き込み失敗) → LINE WORKS の再送が
 * 来ても dedup で skip され、処理されないまま終わる (副作用喪失)。
 */
export function unregister(key: string): void {
  seen.delete(key)
}

/** テストから内部 Map を初期化するためのリセット。本番コードからは呼ばない */
export function _resetForTest(): void {
  seen.clear()
}
