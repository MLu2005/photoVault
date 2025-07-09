const {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions
} = require("@azure/storage-blob");

const account = process.env.AZURE_STORAGE_ACCOUNT;
const key = process.env.AZURE_STORAGE_KEY;
const containerName = "fullsize";
const allowedUserId = "df853e4c8f6849c397f13b8c3bbffdae";

module.exports = async function (context, req) {
  const principal = req.headers["x-ms-client-principal"];
  const auth = principal && JSON.parse(Buffer.from(principal, "base64").toString());
  const userId = auth?.userId;

  if (userId !== allowedUserId) {
    context.res = { status: 401, body: "Unauthorized" };
    return;
  }

  const { filename, event } = req.query;

  if (!filename || !event) {
    context.res = { status: 400, body: "Missing filename or event" };
    return;
  }

  const blobName = `${event}/${Date.now()}_${filename}`;
  const credential = new StorageSharedKeyCredential(account, key);
  const blobServiceClient = new BlobServiceClient(`https://${account}.blob.core.windows.net`, credential);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  const sasToken = generateBlobSASQueryParameters({
    containerName,
    blobName,
    permissions: BlobSASPermissions.parse("cw"),
    expiresOn: new Date(Date.now() + 5 * 60 * 1000),
  }, credential).toString();

  context.res = {
    status: 200,
    body: {
      uploadUrl: `${blockBlobClient.url}?${sasToken}`,
      blobName
    }
  };
};
