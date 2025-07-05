const { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, SASProtocol, BlobSASPermissions } = require("@azure/storage-blob");

const accountName = process.env.STORAGE_ACCOUNT_NAME;
const accountKey = process.env.STORAGE_ACCOUNT_KEY;
const containerName = "fullsize";

module.exports = async function (context, req) {
  const event = req.query.event;
  if (!event) {
    context.res = {
      status: 400,
      body: "Missing 'event' query parameter.",
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
