export function validateStringParam(
  param: unknown,
  paramName: string,
  maxLength?: number,
): asserts param is string {
  if (!param || typeof param !== 'string') {
    throw new Error(`パラメータ '${paramName}' は必須で、文字列を指定してください。`)
  }
  if (maxLength && param.length > maxLength) {
    throw new Error(`パラメータ '${paramName}' は${maxLength}文字以内で指定してください。`)
  }
}
