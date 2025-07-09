const formidable = require("formidable");
const {
  BlobServiceClient,
  StorageSharedKeyCredential,
} = require("@azure/storage-blob");
const fs = require("fs");

const account = process.env.AZURE_STORAGE_ACCOUNT;
const key = process.env.AZURE_STORAGE_KEY;
const containerName = "fullsize";
const allowedUserId = "df853e4c8f6849c397f13b8c3bbffdae";

module.exports = async function (context, req) {
  context.log("📩 uploadPhoto triggered");

  try {
    // 🔐 Autoryzacja GitHub userId
    const principal = req.headers["x-ms-client-principal"];
    const auth = principal && JSON.parse(Buffer.from(principal, "base64").toString());
    const userId = auth?.userId;

    if (userId !== allowedUserId) {
      context.res = { status: 401, body: "Unauthorized" };
      return;
    }

    // 🧱 Parsowanie multipart/form-data
    const form = new formidable.IncomingForm({ multiples: false });

    const data = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const event = data.fields?.event;
    const file = data.files?.file;

    if (!event || !file) {
      context.res = { status: 400, body: "Missing event or file" };
      return;
    }

    const blobName = `${event}/${Date.now()}_${file.originalFilename}`;
    const credential = new StorageSharedKeyCredential(account, key);
    const blobServiceClient = new BlobServiceClient(`https://${account}.blob.core.windows.net`, credential);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const stream = fs.createReadStream(file.filepath);
    const stat = fs.statSync(file.filepath);

    await blockBlobClient.uploadStream(stream, stat.size);

    context.log("✅ Uploaded:", blobName);
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
