const { fail } = require('./errors');
let cached;
function getStore() {
  if (cached) return cached;
  // Lazy loading keeps pure tests independent of Azure or installed packages.
  const { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions, SASProtocol } = require('@azure/storage-blob');
  const account = process.env.AZURE_STORAGE_ACCOUNT;
  const key = process.env.AZURE_STORAGE_KEY;
  const name = process.env.AZURE_STORAGE_CONTAINER || 'fullsize';
  if (!account || !key || !/^[a-z0-9]{3,24}$/.test(account)) fail(503, 'Brak konfiguracji Azure Blob Storage.', 'CONFIGURATION');
  const credential = new StorageSharedKeyCredential(account, key);
  const container = new BlobServiceClient(`https://${account}.blob.core.windows.net`, credential, {
    retryOptions: { maxTries: 3, tryTimeoutInMs: 12000 }
  }).getContainerClient(name);
  cached = {
    async list({ prefix, cursor, limit = 200, hierarchy = false } = {}) {
      const iterator = hierarchy ? container.listBlobsByHierarchy('/', { prefix }) : container.listBlobsFlat({ prefix, includeMetadata: true });
      const page = await iterator.byPage({ continuationToken: cursor, maxPageSize: limit }).next();
      return { items: page.value?.segment.blobItems || [], prefixes: (page.value?.segment.blobPrefixes || []).map(p => p.name), cursor: page.value?.continuationToken || null };
    },
    properties: name => container.getBlobClient(name).getProperties(),
    setMetadata: (name, metadata, etag) => container.getBlobClient(name).setMetadata(metadata, { conditions: etag ? { ifMatch: etag } : undefined }),
    remove: name => container.getBlobClient(name).deleteIfExists({ deleteSnapshots: 'include' }),
    async put(name, data, options = {}) {
      return container.getBlockBlobClient(name).uploadData(Buffer.from(data), {
        blobHTTPHeaders: { blobContentType: options.contentType || 'application/json', blobCacheControl: 'private, no-store' },
        conditions: options.conditions, metadata: options.metadata
      });
    },
    async read(name) {
      const client = container.getBlobClient(name);
      const response = await client.download();
      const chunks = []; let size = 0;
      for await (const chunk of response.readableStreamBody) {
        size += chunk.length;
        if (size > 8192) fail(500, 'Nieprawidłowe dane systemowe.');
        chunks.push(chunk);
      }
      return { text: Buffer.concat(chunks).toString(), etag: response.etag };
    },
    url(blobName, { write = false, download = false, filename = 'download', minutes = write ? 60 : 60 } = {}) {
      const expiresOn = new Date(Date.now() + minutes * 60000);
      const sas = generateBlobSASQueryParameters({ containerName: name, blobName,
        permissions: BlobSASPermissions.parse(write ? 'cw' : 'r'), startsOn: new Date(Date.now() - 5 * 60000), expiresOn,
        protocol: SASProtocol.Https, cacheControl: write ? undefined : 'private, max-age=300',
        contentDisposition: download ? `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(filename).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16))}` : undefined
      }, credential).toString();
      return { url: `${container.getBlobClient(blobName).url}?${sas}`, expiresAt: expiresOn.toISOString() };
    }
  };
  return cached;
}
module.exports = { getStore };
