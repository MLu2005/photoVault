const { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, SASProtocol, BlobSASPermissions } = require("@azure/storage-blob");

const accountName = process.env.AZURE_STORAGE_ACCOUNT;
const accountKey = process.env.AZURE_STORAGE_KEY;
const containerName = "fullsize";

module.exports = async function (context, req) {
  const event = req.query.event;
  if (!event) {
    context.res = {
  status: 500,
  body: JSON.stringify({ error: "Server error fetching photos" }),
  headers: { "Content-Type": "application/json" }
    };

    return;
  }

  try {
    const credential = new StorageSharedKeyCredential(accountName, accountKey);
    const blobServiceClient = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, credential);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    const prefix = `${event}/`;
    let urls = [];

    for await (const blob of containerClient.listBlobsFlat({ prefix })) {
      const sasToken = generateBlobSASQueryParameters({
        containerName,
        blobName: blob.name,
        permissions: BlobSASPermissions.parse("r"),
        expiresOn: new Date(new Date().valueOf() + 3600 * 1000), // 1h
        protocol: SASProtocol.Https,
      }, credential).toString();

      const url = `https://${accountName}.blob.core.windows.net/${containerName}/${blob.name}?${sasToken}`;
      urls.push(url);
    }

    context.res = {
      status: 200,
      body: urls,
    };
  } catch (err) {
    context.log(err.message);
    context.res = {
      status: 500,
      body: "Server error fetching photos",
    };
  }
};
