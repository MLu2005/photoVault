const { BlobServiceClient } = require("@azure/storage-blob");

const containerName = "fullsize";
const connectionString = process.env.AzureWebJobsStorage; // używa tego, co masz już w konfiguracji Functions

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
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    const prefix = `${event}/`;
    let urls = [];

    for await (const blob of containerClient.listBlobsFlat({ prefix })) {
      const blobClient = containerClient.getBlobClient(blob.name);
      urls.push(blobClient.url);
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
