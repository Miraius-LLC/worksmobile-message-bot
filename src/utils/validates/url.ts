import { validateStringParam } from './stringParam'

const URL_REGEX = /^(https?:\/\/)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/\S*)?$/

/** HTTP / HTTPS URL の形式と長さを検証 */
export function validateUrl(
  url: unknown,
  paramName: string,
  maxLength?: number,
): asserts url is string {
  validateStringParam(url, paramName, maxLength)
  if (!URL_REGEX.test(url)) {
    throw new Error(
      `パラメータ '${paramName}' は HTTP または HTTPS の正しい URL を指定してください。`,
    )
  }
}
