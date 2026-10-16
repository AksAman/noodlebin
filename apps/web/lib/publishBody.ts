/** Stay under Vercel's 4.5 MB Function body cap, and under the 4 MB check in the API. */
export const FUNCTION_BODY_BUDGET = 3_600_000

export function coverByteBudget(treeBytes: number): number {
  return FUNCTION_BODY_BUDGET - treeBytes - 16_384
}

export function payloadTooLargeMessage(): string {
  return "That upload is larger than 4 MB. Vercel rejects it before the app can save it. Use a smaller cover, or a smaller graph."
}

export function publishFailureMessage(status: number, body: string): string | null {
  if (status === 413 || body.includes("FUNCTION_PAYLOAD_TOO_LARGE") || body.includes("Request Entity Too Large")) {
    return payloadTooLargeMessage()
  }
  return null
}
