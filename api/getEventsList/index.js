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

  try {
    const credential = new StorageSharedKeyCredential(account, key);
    const blobServiceClient = new BlobServiceClient(
      `https://${account}.blob.core.windows.net`,
      credential
    );
    const containerClient = blobServiceClient.getContainerClient(containerName);

    const prefixes = new Set();

    for await (const blob of containerClient.listBlobsFlat()) {
      const parts = blob.name.split("/");
      if (parts.length > 1) {
        prefixes.add(parts[0]);
      }
    }

    context.res = {
      status: 200,
      body: Array.from(prefixes)
    };
  } catch (err) {
    context.log.error("Failed to list events", err);
    context.res = {
      status: 500,
      body: "Internal server error"
    };
  }
};
