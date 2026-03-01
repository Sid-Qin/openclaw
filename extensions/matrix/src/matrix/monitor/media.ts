import type { MatrixClient } from "@vector-im/matrix-bot-sdk";
import { getMatrixRuntime } from "../../runtime.js";

// Type for encrypted file info
type EncryptedFile = {
  url: string;
  key: {
    kty: string;
    key_ops: string[];
    alg: string;
    k: string;
    ext: boolean;
  };
  iv: string;
  hashes: Record<string, string>;
  v: string;
};

function parseMxcUrl(mxcUrl: string): { serverName: string; mediaId: string } | null {
  if (!mxcUrl.startsWith("mxc://")) return null;
  const rest = mxcUrl.slice(6);
  const slash = rest.indexOf("/");
  if (slash === -1) return null;
  return { serverName: rest.slice(0, slash), mediaId: rest.slice(slash + 1) };
}

async function fetchMatrixMediaBuffer(params: {
  client: MatrixClient;
  mxcUrl: string;
  maxBytes: number;
  accessToken?: string;
  homeserver?: string;
}): Promise<{ buffer: Buffer; headerType?: string } | null> {
  const parsed = parseMxcUrl(params.mxcUrl);
  if (!parsed) return null;

  // Try authenticated media endpoint first (MSC3916 / Matrix v1.11+)
  if (params.accessToken && params.homeserver) {
    const base = params.homeserver.replace(/\/$/, "");
    const authUrl = `${base}/_matrix/client/v1/media/download/${encodeURIComponent(parsed.serverName)}/${encodeURIComponent(parsed.mediaId)}`;
    try {
      const res = await fetch(authUrl, {
        headers: { Authorization: `Bearer ${params.accessToken}` },
      });
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (buffer.byteLength > params.maxBytes) {
          throw new Error("Matrix media exceeds configured size limit");
        }
        return { buffer, headerType: res.headers.get("Content-Type") ?? undefined };
      }
      // 404 M_UNRECOGNIZED → server doesn't support authenticated media, fall through
      if (res.status === 404) {
        const body = await res.json().catch(() => ({}));
        if ((body as { errcode?: string }).errcode !== "M_UNRECOGNIZED") {
          throw new Error(`Matrix media download failed: HTTP ${res.status}`);
        }
      } else if (res.status !== 401) {
        throw new Error(`Matrix media download failed: HTTP ${res.status}`);
      }
      // 401 → also fall through to legacy endpoint
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Matrix media")) throw err;
      // Network/fetch errors fall through to legacy
    }
  }

  // Legacy unauthenticated path (/_matrix/media/v3/download)
  try {
    const result = await params.client.downloadContent(params.mxcUrl);
    const raw = result.data ?? result;
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);

    if (buffer.byteLength > params.maxBytes) {
      throw new Error("Matrix media exceeds configured size limit");
    }
    return { buffer, headerType: result.contentType };
  } catch (err) {
    throw new Error(`Matrix media download failed: ${String(err)}`, { cause: err });
  }
}

/**
 * Download and decrypt encrypted media from a Matrix room.
 * Uses @vector-im/matrix-bot-sdk's decryptMedia which handles both download and decryption.
 */
async function fetchEncryptedMediaBuffer(params: {
  client: MatrixClient;
  file: EncryptedFile;
  maxBytes: number;
}): Promise<{ buffer: Buffer } | null> {
  if (!params.client.crypto) {
    throw new Error("Cannot decrypt media: crypto not enabled");
  }

  // decryptMedia handles downloading and decrypting the encrypted content internally
  const decrypted = await params.client.crypto.decryptMedia(
    params.file as Parameters<typeof params.client.crypto.decryptMedia>[0],
  );

  if (decrypted.byteLength > params.maxBytes) {
    throw new Error("Matrix media exceeds configured size limit");
  }

  return { buffer: decrypted };
}

export async function downloadMatrixMedia(params: {
  client: MatrixClient;
  mxcUrl: string;
  contentType?: string;
  sizeBytes?: number;
  maxBytes: number;
  file?: EncryptedFile;
  accessToken?: string;
  homeserver?: string;
}): Promise<{
  path: string;
  contentType?: string;
  placeholder: string;
} | null> {
  let fetched: { buffer: Buffer; headerType?: string } | null;
  if (typeof params.sizeBytes === "number" && params.sizeBytes > params.maxBytes) {
    throw new Error("Matrix media exceeds configured size limit");
  }

  if (params.file) {
    // Encrypted media
    fetched = await fetchEncryptedMediaBuffer({
      client: params.client,
      file: params.file,
      maxBytes: params.maxBytes,
    });
  } else {
    // Unencrypted media
    fetched = await fetchMatrixMediaBuffer({
      client: params.client,
      mxcUrl: params.mxcUrl,
      maxBytes: params.maxBytes,
      accessToken: params.accessToken,
      homeserver: params.homeserver,
    });
  }

  if (!fetched) {
    return null;
  }
  const headerType = fetched.headerType ?? params.contentType ?? undefined;
  const saved = await getMatrixRuntime().channel.media.saveMediaBuffer(
    fetched.buffer,
    headerType,
    "inbound",
    params.maxBytes,
  );
  return {
    path: saved.path,
    contentType: saved.contentType,
    placeholder: "[matrix media]",
  };
}
