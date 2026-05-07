import { API_BASE, getBotId, LineWorksApiError, postJson } from '@/services/lineworks/api'
import { logger } from '@/utils/logger'

const CALLER = 'services/lineworks/attachment'

export type UploadResult = {
  fileId: string
}

/**
 * LINE WORKS Bot にコンテンツをアップロードする 2 段階手順を 1 関数にまとめる:
 *  1. POST /bots/{botId}/attachments で `uploadUrl` と `fileId` を取得
 *  2. multipart/form-data を `uploadUrl` に POST
 */
export async function uploadAttachment(
  token: string,
  file: Blob,
  fileName: string,
): Promise<UploadResult> {
  const botId = getBotId()
  const issueUrl = `${API_BASE}/bots/${botId}/attachments`

  const issued = (await postJson(token, issueUrl, { fileName })) as {
    uploadUrl?: string
    fileId?: string
  }
  if (!issued?.uploadUrl || !issued.fileId) {
    throw new Error('uploadUrl / fileId の取得に失敗しました。')
  }

  const formData = new FormData()
  formData.append('resourceName', fileName)
  formData.append('file', file, fileName)

  const response = await fetch(issued.uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    logger.error('ファイルアップロードに失敗', {
      caller: `${CALLER}.uploadAttachment`,
      status: response.status,
      debug: body,
    })
    throw new LineWorksApiError(response.status, body)
  }

  logger.success('ファイルをアップロード', {
    caller: `${CALLER}.uploadAttachment`,
    id: issued.fileId,
  })
  return { fileId: issued.fileId }
}

/**
 * fileId から実ファイルの downloadUrl を取得する。
 *
 * LINE WORKS のダウンロードエンドポイントは 3xx で実 URL を Location ヘッダに返すため、
 * 自動リダイレクトを止めて Location を抽出する。
 */
export async function resolveDownloadUrl(token: string, fileId: string): Promise<string> {
  const botId = getBotId()
  const url = `${API_BASE}/bots/${botId}/attachments/${fileId}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    redirect: 'manual',
  })

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location')
    if (!location) {
      throw new Error('リダイレクト先 URL (Location ヘッダ) が取得できませんでした。')
    }
    return location
  }

  if (response.ok) {
    const data = (await response.json()) as { downloadUrl?: string }
    if (!data.downloadUrl) {
      throw new Error('downloadUrl がレスポンスに含まれていません。')
    }
    return data.downloadUrl
  }

  const body = await response.text().catch(() => '')
  logger.error('ダウンロード URL の取得に失敗', {
    caller: `${CALLER}.resolveDownloadUrl`,
    status: response.status,
    debug: body,
  })
  throw new LineWorksApiError(response.status, body)
}
