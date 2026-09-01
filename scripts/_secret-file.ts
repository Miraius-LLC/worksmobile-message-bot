import { randomUUID } from 'node:crypto'
import { chmod, lstat, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const SECRET_FILE_MODE = 0o600

type SecretFileWriteOptions = {
  writeTempFile?: (path: string, content: string) => Promise<void>
  renameFile?: (sourcePath: string, targetPath: string) => Promise<void>
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

/** 平文secretファイルを所有者限定でatomicに置き換える。 */
export async function writeSecretFile(
  targetPath: string,
  content: string,
  options: SecretFileWriteOptions = {},
): Promise<void> {
  try {
    if ((await lstat(targetPath)).isSymbolicLink()) {
      throw new Error('secretファイルのsymlink出力先は拒否します')
    }
  } catch (error) {
    if (!isMissingFile(error)) throw error
  }

  const temporaryPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${randomUUID()}.tmp`,
  )
  const writeTempFile =
    options.writeTempFile ??
    (async (filePath: string, fileContent: string) => {
      await writeFile(filePath, fileContent, {
        encoding: 'utf8',
        flag: 'wx',
        mode: SECRET_FILE_MODE,
      })
    })
  const renameFile = options.renameFile ?? rename

  let operationError: unknown
  try {
    await writeTempFile(temporaryPath, content)
    await chmod(temporaryPath, SECRET_FILE_MODE)
    await renameFile(temporaryPath, targetPath)
  } catch (error) {
    operationError = error
  }

  let cleanupError: unknown
  try {
    await unlink(temporaryPath)
  } catch (error) {
    if (!isMissingFile(error)) cleanupError = error
  }

  if (operationError !== undefined) throw operationError
  if (cleanupError !== undefined) throw cleanupError
}
