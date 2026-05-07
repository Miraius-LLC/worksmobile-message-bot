import { validateUrl } from './url'

const ALLOWED_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'svg',
  'bmp',
  'webp',
  'tif',
  'tiff',
  'ico',
  'icns',
  'psd',
  'ai',
  'clip',
  'heic',
  'rw2',
])

/** HTTPS のみ + 画像系拡張子のみ許可 (拡張子なしは許可) */
export function validateImageUrl(url: unknown, paramName: string): asserts url is string {
  validateUrl(url, paramName, 1000)

  if (!/^https:\/\//i.test(url)) {
    throw new Error(`パラメータ '${paramName}' は HTTPS のURLを指定してください。`)
  }

  const urlPath = new URL(url).pathname
  const extMatch = urlPath.match(/\.([a-zA-Z0-9]+)$/)
  if (extMatch?.[1]) {
    const ext = extMatch[1].toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(`パラメータ '${paramName}' の拡張子 '${ext}' は許可されていません。`)
    }
  }
}
