import { z } from 'zod'

/**
 * Only the fields the module reads. Anything else Smaart sends is stripped, and a field of an unexpected type is taken
 * as absent rather than failing the whole message: the module only needs to know of errors and the password prompt.
 */
const ResponseSchema = z.object({
	error: z.string().optional().catch(undefined),
	authenticationRequired: z.boolean().optional().catch(undefined),
})

/** A message from the API. Parsed once a second for as long as the connection is open, so it is compiled */
export const SmaartMessageSchema = z.compile(
	z.object({
		sequenceNumber: z.number().optional().catch(undefined),
		response: ResponseSchema.optional().catch(undefined),
	}),
)
export type SmaartMessage = z.infer<typeof SmaartMessageSchema>
