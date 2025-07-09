const formidable = require("formidable");
const {
  BlobServiceClient,
  StorageSharedKeyCredential,
} = require("@azure/storage-blob");

const account = process.env.AZURE_STORAGE_ACCOUNT;
const key = process.env.AZURE_STORAGE_KEY;
const containerName = "fullsize";

module.exports = async function (context, req) {
  try {
    // 🔐 Autoryzacja (GitHub)
    const principal = req.headers["x-ms-client-principal"];
    const auth = principal && JSON.parse(Buffer.from(principal, "base64").toString());
    const userId = auth?.userId;

    if (userId !== "df853e4c8f6849c397f13b8c3bbffdae") {
      context.log("❌ Unauthorized access attempt");
      context.res = {
        status: 401,
        body: "Unauthorized",
      };
      return;
    }

    // 📥 Parsowanie formularza
    const form = formidable({ multiples: false });
    const data = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const event = data.fields?.event;
    const file = data.files?.file;

    if (!event || !file) {
      context.log("❌ Missing event or file in request");
      context.res = {
        status: 400,
        body: "Missing event or file",
      };
      return;
    }

    const blobName = `${event}/${Date.now()}_${file.originalFilename}`;
    const credential = new StorageSharedKeyCredential(account, key);
    const blobServiceClient = new BlobServiceClient(
      `https://${account}.blob.core.windows.net`,
      credential
    );
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const fs = require("fs");
    const stream = fs.createReadStream(file.filepath);
    const stat = fs.statSync(file.filepath);

    await blockBlobClient.uploadStream(stream, stat.size);

    context.log(`✅ Uploaded ${blobName} (${stat.size} bytes)`);

    context.res = {
      status: 200,
      body: { message: "Uploaded", blobName },
    };
  } catch (err) {
    context.log.error("❌ Upload failed", err);
    context.res = {
      status: 500,
      body: "Internal Server Error: " + err.message,
    };
  }
};
