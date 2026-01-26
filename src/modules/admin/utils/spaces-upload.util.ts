import { createHash, createHmac, randomUUID } from 'crypto';
import * as https from 'https';
import { URL } from 'url';

export type SpacesConfig = {
  bucket?: string;
  region: string;
  endpoint: string;
  accessKey?: string;
  secretKey?: string;
  cdnBase?: string;
};

export function resolveSpacesConfigFromEnv(): SpacesConfig {
  const region = process.env.DO_SPACES_REGION?.trim() || 'fra1';
  const bucket = process.env.DO_SPACES_BUCKET?.trim();
  const endpoint =
    process.env.DO_SPACES_ENDPOINT?.trim() ||
    `https://${region}.digitaloceanspaces.com`;
  const cdnBase =
    process.env.DO_SPACES_CDN_ENDPOINT?.trim() ||
    (bucket ? `https://${bucket}.${region}.cdn.digitaloceanspaces.com` : undefined);

  return {
    bucket,
    region,
    endpoint,
    accessKey: process.env.DO_SPACES_KEY?.trim(),
    secretKey: process.env.DO_SPACES_SECRET?.trim(),
    cdnBase,
  };
}

function formatAmzDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function createSigningKey(secretKey: string, date: string, region: string): Buffer {
  const kDate = createHmac('sha256', `AWS4${secretKey}`).update(date).digest();
  const kRegion = createHmac('sha256', kDate).update(region).digest();
  const kService = createHmac('sha256', kRegion).update('s3').digest();
  return createHmac('sha256', kService).update('aws4_request').digest();
}

async function performHttpsPut(
  url: URL,
  headers: Record<string, string>,
  body: Buffer,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = https.request(
      {
        method: 'PUT',
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port ? Number(url.port) : undefined,
        path: `${url.pathname}${url.search}`,
        headers,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
            resolve();
          } else {
            const errorBody = Buffer.concat(chunks).toString();
            reject(
              new Error(
                `Spaces upload failed with status ${response.statusCode}: ${errorBody || 'empty response'}`,
              ),
            );
          }
        });
      },
    );

    request.on('error', (error) => {
      reject(error);
    });

    request.write(body);
    request.end();
  });
}

async function putObjectToSpaces(params: {
  key: string;
  body: Buffer;
  contentType: string;
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
  endpoint: string;
}): Promise<void> {
  const { key, body, contentType, bucket, region, accessKey, secretKey, endpoint } = params;
  const baseEndpoint = endpoint.trim();
  const endpointUrl = new URL(baseEndpoint.includes('://') ? baseEndpoint : `https://${baseEndpoint}`);
  let endpointHost = endpointUrl.hostname;
  const cdnSuffix = '.cdn.digitaloceanspaces.com';
  if (endpointHost.includes(cdnSuffix)) {
    endpointHost = endpointHost.replace(cdnSuffix, '.digitaloceanspaces.com');
  }

  const host = endpointHost.includes(bucket) ? endpointHost : `${bucket}.${endpointHost}`;
  const encodedKey = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const protocol = endpointUrl.protocol || 'https:';
  const url = new URL(`${protocol}//${host}/${encodedKey}`);
  const now = new Date();
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = createHash('sha256').update(body).digest('hex');

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-acl:public-read\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-acl;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = ['PUT', `/${encodedKey}`, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const hashedCanonicalRequest = createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    `${dateStamp}/${region}/s3/aws4_request`,
    hashedCanonicalRequest,
  ].join('\n');

  const signingKey = createSigningKey(secretKey, dateStamp, region);
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${dateStamp}/${region}/s3/aws4_request, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers: Record<string, string> = {
    'content-type': contentType,
    'content-length': body.length.toString(),
    'x-amz-acl': 'public-read',
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    Authorization: authorization,
    host,
  };

  await performHttpsPut(url, headers, body);
}

function getExtensionFromMimeType(mimeType: string): string {
  const subtype = mimeType.split('/')[1] ?? 'bin';
  const cleaned = subtype.split('+')[0];
  if (cleaned === 'jpeg') {
    return 'jpg';
  }
  return cleaned || 'bin';
}

function normalizePathSegment(value: string, fallback: string): string {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\-_\.]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

export function isSpacesUrl(
  imageUrl: string | null | undefined,
  config: SpacesConfig = resolveSpacesConfigFromEnv(),
): boolean {
  if (!imageUrl || !imageUrl.trim()) {
    return false;
  }

  try {
    const url = new URL(imageUrl);
    const host = url.hostname.toLowerCase();

    if (!host.includes('digitaloceanspaces.com')) {
      return false;
    }

    const bucket = config.bucket?.toLowerCase();
    if (!bucket) {
      return true;
    }

    const cdnHost = config.cdnBase
      ? new URL(config.cdnBase).hostname.toLowerCase()
      : `${bucket}.${config.region.toLowerCase()}.cdn.digitaloceanspaces.com`;

    const endpointHost = config.endpoint
      ? new URL(
          config.endpoint.includes('://')
            ? config.endpoint
            : `https://${config.endpoint}`,
        ).hostname.toLowerCase()
      : `${config.region.toLowerCase()}.digitaloceanspaces.com`;

    const bucketEndpointHost = endpointHost.includes(bucket)
      ? endpointHost
      : `${bucket}.${endpointHost}`;

    return host === cdnHost || host === bucketEndpointHost;
  } catch {
    return false;
  }
}

export async function uploadImageFromUrlToSpaces(
  imageUrl: string,
  options?: {
    regionKey?: string;
    partnerName?: string | null;
    categoryName?: string | null;
  },
): Promise<string> {
  const spacesConfig = resolveSpacesConfigFromEnv();
  const { bucket, accessKey, secretKey, region, endpoint } = spacesConfig;
  if (!bucket || !accessKey || !secretKey) {
    throw new Error('DigitalOcean Spaces credentials are not configured.');
  }

  if (!endpoint) {
    throw new Error('DigitalOcean Spaces endpoint is not configured.');
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image (${response.status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (!buffer.length) {
    throw new Error('Received an empty image file.');
  }

  const contentType =
    response.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream';
  const extension = getExtensionFromMimeType(contentType);
  const regionSegment = normalizePathSegment(options?.regionKey ?? 'unknown-region', 'unknown-region');
  const partnerSegment = normalizePathSegment(
    options?.partnerName ?? 'no-partner',
    'no-partner',
  );
  const categorySegment = normalizePathSegment(
    options?.categoryName ?? 'uncategorized',
    'uncategorized',
  );
  const key = `products/${regionSegment}/${partnerSegment}/${categorySegment}/${randomUUID()}.${extension}`;

  await putObjectToSpaces({
    key,
    body: buffer,
    contentType,
    bucket,
    region,
    accessKey,
    secretKey,
    endpoint,
  });

  const cdnBase = spacesConfig.cdnBase || `https://${bucket}.${region}.cdn.digitaloceanspaces.com`;
  return `${cdnBase}/${key}`;
}
