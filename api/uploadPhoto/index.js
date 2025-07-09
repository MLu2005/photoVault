const { BlobServiceClient, StorageSharedKeyCredential } = require("@azure/storage-blob");
const multiparty = require("multiparty");
const fs = require("fs");

const account = process.env.AZURE_STORAGE_ACCOUNT;
const key = process.env.AZURE_STORAGE_KEY;
const containerName = "fullsize";

module.exports = async function (context, req) {
  console.log("📥 uploadPhoto called");
  console.log("➡️ Headers:", req.headers);

  const principal = req.headers["x-ms-client-principal"];
  const auth = principal && JSON.parse(Buffer.from(principal, "base64").toString());
  const userId = auth?.userId;

  console.log("👤 userId:", userId);

  // Autoryzacja
  if (userId !== "df853e4c8f6849c397f13b8c3bbffdae") {
    console.log("❌ Unauthorized user");
    context.res = {
      status: 401,
      body: "Unauthorized",
    };
    return;
  }

  // Parsowanie form-data
  const form = new multiparty.Form();

  const data = await new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) {
        console.log("❌ Error parsing form:", err);
        reject(err);
      } else {
        console.log("📤 Form parsed");
        resolve({ fields, files });
      }
    });
  });

  const event = data.fields?.event?.[0];
  const file = data.files?.file?.[0];

  if (!event || !file) {
    console.log("❌ Missing event or file");
    context.res = {
      status: 400,
      body: "Missing event or file",
    };
    return;
  }

  console.log("📦 Uploading file to event:", event);

  const blobName = `${event}/${Date.now()}_${file.originalFilename}`;
  const credential = new StorageSharedKeyCredential(account, key);
  const blobServiceClient = new BlobServiceClient(
    `https://${account}.blob.core.windows.net`,
    credential
  );
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  const stream = fs.createReadStream(file.path);
  const stat = fs.statSync(file.path);

  try {
    await blockBlobClient.uploadStream(stream, stat.size);
    console.log("✅ Upload successful:", blobName);

    context.res = {
      status: 200,
      body: { message: "Uploaded", blobName },
    };
  } catch (err) {
    console.log("❌ Upload failed:", err);
    context.res = {
      status: 500,
      body: "Upload error: " + err.message,
    };
  }
};
