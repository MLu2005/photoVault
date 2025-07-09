const { BlobServiceClient, StorageSharedKeyCredential } = require("@azure/storage-blob");
const Busboy = require("busboy");

const account = process.env.AZURE_STORAGE_ACCOUNT;
const key = process.env.AZURE_STORAGE_KEY;
const containerName = "fullsize";

module.exports = async function (context, req) {
  try {
    const principal = req.headers["x-ms-client-principal"];
    const auth = principal && JSON.parse(Buffer.from(principal, "base64").toString());
    const userId = auth?.userId;

    if (userId !== "df853e4c8f6849c397f13b8c3bbffdae") {
      context.res = { status: 401, body: "Unauthorized" };
      return;
    }

    const busboy = new Busboy({ headers: req.headers });
    const buffers = [];
    let filename = "";
    let eventName = "";

    await new Promise((resolve, reject) => {
      busboy.on("file", (fieldname, file, _filename, encoding, mimetype) => {
        filename = _filename;
        file.on("data", (data) => buffers.push(data));
      });

      busboy.on("field", (fieldname, val) => {
        if (fieldname === "event") eventName = val;
      });

      busboy.on("finish", resolve);
      busboy.on("error", reject);

      req.pipe(busboy); // kluczowe – Azure Functions obsługuje stream
    });

    if (!eventName || !filename) {
      context.res = { status: 400, body: "Missing event name or file" };
      return;
    }

    const blobName = `${eventName}/${Date.now()}_${filename}`;
    const buffer = Buffer.concat(buffers);

    const credential = new StorageSharedKeyCredential(account, key);
    const blobServiceClient = new BlobServiceClient(`https://${account}.blob.core.windows.net`, credential);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: "image/jpeg" }, // możesz poprawić typ MIME
    });

    context.res = {
      status: 200,
      body: { message: "Upload complete", blobName },
    };
  } catch (err) {
    context.log.error("❌ Upload failed", err);
    context.res = {
      status: 500,
      body: "Internal Server Error: " + err.message,
    };
  }
};
