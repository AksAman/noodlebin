import { env } from "@/env"
import {
  AZURE_STORED_PREFIX,
  UPLOAD_RULES,
  blendFilename,
  extensionFor,
  isStoredBlobName,
  readBlobToken,
  signBlob,
  sniffUpload,
  type UploadKind,
} from "@/lib/blobUpload"
import type { SharingError, StoredFile } from "@/lib/sharing"
import {
  BlobSASPermissions,
  BlobServiceClient,
  SASProtocol,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  type BlobServiceProperties,
} from "@azure/storage-blob"
import { randomUUID } from "node:crypto"

export function usesAzureBlob(): boolean {
  return Boolean(env.AZURE_STORAGE_ACCOUNT && env.AZURE_STORAGE_KEY && env.AZURE_STORAGE_CONTAINER)
}

function credential(): StorageSharedKeyCredential {
  return new StorageSharedKeyCredential(env.AZURE_STORAGE_ACCOUNT!, env.AZURE_STORAGE_KEY!)
}

function service(): BlobServiceClient {
  return new BlobServiceClient(`https://${env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`, credential())
}

let ready: Promise<void> | null = null

/** Creates the container, allows anonymous reads, and allows the browser to PUT with a signed URL. */
export function ensurePublicReads(): Promise<void> {
  ready ??= (async () => {
    const client = service()
    const container = client.getContainerClient(env.AZURE_STORAGE_CONTAINER!)
    await container.createIfNotExists({ access: "blob" })
    try {
      const policy = await container.getAccessPolicy()
      if (policy.blobPublicAccess !== "blob") await container.setAccessPolicy("blob")
    } catch (err) {
      ready = null
      const message = err instanceof Error ? err.message : ""
      throw new Error(
        message.includes("Public access is not permitted")
          ? "This storage account blocks public blob access. Allow public access, then publish again."
          : "Could not make the Azure container readable. Covers load from Azure, so the container needs public blob access.",
      )
    }
    try {
      const props = await client.getProperties()
      const cors = props.cors ?? []
      const allowsPut = cors.some(
        (rule) => rule.allowedOrigins.split(",").includes("*") && rule.allowedMethods.toUpperCase().includes("PUT"),
      )
      if (allowsPut) return
      const next: BlobServiceProperties = {
        cors: [
          ...cors,
          {
            allowedOrigins: "*",
            allowedMethods: "PUT,OPTIONS,HEAD",
            allowedHeaders: "content-type,x-ms-blob-type,x-ms-blob-content-type,content-length,x-ms-version",
            exposedHeaders: "*",
            maxAgeInSeconds: 3600,
          },
        ],
      }
      await client.setProperties(next)
    } catch {
      // The upload URL is still valid. CORS can be set on the storage account if this key cannot change service properties.
    }
  })()
  return ready
}

export async function createUpload(
  kind: UploadKind,
  contentType: string,
  byteSize: number,
): Promise<{ uploadUrl: string; token: string; contentType: string } | SharingError> {
  if (!usesAzureBlob()) return { ok: false, status: 404, error: "File upload is not configured." }
  const rule = UPLOAD_RULES[kind]
  const ext = extensionFor(kind, contentType)
  if (!ext) return { ok: false, status: 400, error: rule.wrongType }
  if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > rule.maxBytes) {
    return { ok: false, status: 400, error: rule.tooBig }
  }
  await ensurePublicReads()
  const blobName = `${rule.dir}/${randomUUID()}.${ext}`
  const sas = generateBlobSASQueryParameters(
    {
      containerName: env.AZURE_STORAGE_CONTAINER!,
      blobName,
      permissions: BlobSASPermissions.parse("cw"),
      startsOn: new Date(Date.now() - 5 * 60 * 1000),
      expiresOn: new Date(Date.now() + 15 * 60 * 1000),
      protocol: SASProtocol.Https,
      contentType,
    },
    credential(),
  ).toString()
  const uploadUrl = `https://${env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${env.AZURE_STORAGE_CONTAINER}/${blobName}?${sas}`
  return { uploadUrl, token: signBlob(kind, blobName, env.AZURE_STORAGE_KEY!), contentType }
}

export async function verifyUploaded(
  kind: UploadKind,
  token: string,
  filename?: string,
): Promise<StoredFile | SharingError> {
  if (!usesAzureBlob()) return { ok: false, status: 400, error: "File upload is not configured." }
  const rule = UPLOAD_RULES[kind]
  const parsed = readBlobToken(token, env.AZURE_STORAGE_KEY!)
  if (!parsed || parsed.kind !== kind) return { ok: false, status: 400, error: rule.invalid }
  await ensurePublicReads()
  const blob = service().getContainerClient(env.AZURE_STORAGE_CONTAINER!).getBlobClient(parsed.blobName)
  if (!(await blob.exists())) return { ok: false, status: 400, error: rule.missing }
  const props = await blob.getProperties()
  const size = props.contentLength ?? 0
  if (size <= 0 || size > rule.maxBytes) return { ok: false, status: 400, error: rule.tooBig }
  const head = await blob.downloadToBuffer(0, Math.min(32, size))
  const sniffed = sniffUpload(kind, new Uint8Array(head))
  if (!sniffed) return { ok: false, status: 400, error: rule.wrongType }
  const stored: StoredFile = {
    bytes: new Uint8Array(),
    type: sniffed.type,
    ext: sniffed.ext,
    storedPath: `${AZURE_STORED_PREFIX}${parsed.blobName}`,
  }
  if (kind === "blend") stored.filename = blendFilename(filename)
  return stored
}

export async function readAzureBlob(blobName: string): Promise<Buffer | null> {
  if (!usesAzureBlob() || !isStoredBlobName(blobName)) return null
  const blob = service().getContainerClient(env.AZURE_STORAGE_CONTAINER!).getBlobClient(blobName)
  if (!(await blob.exists())) return null
  return blob.downloadToBuffer()
}
