import { z } from 'zod'

const countSchema = z.preprocess(
  value => (value === '' ? undefined : value),
  z.coerce.number().int().min(1).max(100).optional(),
)

/** LINE WORKS の一覧 API で共通利用するページング query。 */
export const paginationQuerySchema = z.object({
  count: countSchema,
  cursor: z.string().optional(),
})

export type PaginationQuery = z.infer<typeof paginationQuerySchema>
