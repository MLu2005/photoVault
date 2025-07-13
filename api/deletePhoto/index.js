const {
  BlobServiceClient,
  StorageSharedKeyCredential
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

  const { blobName } = req.query;

  if (!blobName) {
    context.res = { status: 400, body: "Missing blobName" };
    return;
  }

  try {
    const credential = new StorageSharedKeyCredential(account, key);
    const blobServiceClient = new BlobServiceClient(`https://${account}.blob.core.windows.net`, credential);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);
    await blobClient.deleteIfExists();

    context.res = { status: 200, body: "Deleted" };
  } catch (err) {
    context.log("❌ Error deleting photo", err);
    context.res = { status: 500, body: "Failed to delete" };
  }
};
