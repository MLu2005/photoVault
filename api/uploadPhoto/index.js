module.exports = async function (context, req) {
  context.log("⚙️ uploadPhoto function triggered");

  const principal = req.headers["x-ms-client-principal"];
  context.log("🔒 Decoding client principal:", principal);

  const auth = principal && JSON.parse(Buffer.from(principal, "base64").toString());
  const userId = auth?.userId;
  context.log("✅ Decoded userId:", userId);

  if (userId !== "df853e4c8f6849c397f13b8c3bbffdae") {
    context.log("❌ Unauthorized user");
    context.res = { status: 401, body: "Unauthorized" };
    return;
  }

  const multiparty = require("multiparty");
  const form = new multiparty.Form();

  const data = await new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) {
        context.log("❌ Form parsing error:", err);
        reject(err);
      } else {
        context.log("📦 Form parsed successfully");
        resolve({ fields, files });
      }
    });
  });

  const event = data.fields?.event?.[0];
  const file = data.files?.file?.[0];
  context.log("📂 Event:", event);
  context.log("🖼️ File:", file?.originalFilename);

  if (!event || !file) {
    context.log("⚠️ Missing event or file");
    context.res = { status: 400, body: "Missing event or file" };
    return;
  }

  const {
    BlobServiceClient,
    StorageSharedKeyCredential,
  } = require("@azure/storage-blob");
  const account = process.env.AZURE_STORAGE_ACCOUNT;
  const key = process.env.AZURE_STORAGE_KEY;
  context.log("🔑 Using storage account:", account);

  const blobName = `${event}/${Date.now()}_${file.originalFilename}`;
  const credential = new StorageSharedKeyCredential(account, key);
  const blobServiceClient = new BlobServiceClient(
    `https://${account}.blob.core.windows.net`,
    credential
  );
  const containerClient = blobServiceClient.getContainerClient("fullsize");
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  const fs = require("fs");
  const stream = fs.createReadStream(file.path);
  const stat = fs.statSync(file.path);

  context.log("⬆️ Uploading to Blob:", blobName);

  await blockBlobClient.uploadStream(stream, stat.size);

  context.res = {
    status: 200,
    body: { message: "Uploaded", blobName },
  };
};
