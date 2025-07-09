const multiparty = require("multiparty");
const {
  BlobServiceClient,
  StorageSharedKeyCredential,
} = require("@azure/storage-blob");
const fs = require("fs");

const account = process.env.AZURE_STORAGE_ACCOUNT;
const key = process.env.AZURE_STORAGE_KEY;
const containerName = "fullsize";

module.exports = async function (context, req) {
  try {
    // 🧾 Loguj nagłówki i konto
    context.log("⬅️ Incoming request to uploadPhoto");
    context.log("🔑 account:", account);
    context.log("📦 container:", containerName);
    context.log("📩 headers:", req.headers);

    // 🔐 Autoryzacja po userId
    const principal = req.headers["x-ms-client-principal"];
    if (!principal) throw new Error("Missing client principal header");
    const auth = JSON.parse(Buffer.from(principal, "base64").toString());
    const userId = auth?.userId;

    context.log("👤 Authenticated user:", userId);
    if (userId !== "df853e4c8f6849c397f13b8c3bbffdae") {
      context.log("⛔ Unauthorized user");
      context.res = { status: 401, body: "Unauthorized" };
      return;
    }

    // 📤 Parsowanie formularza multipart
    const form = new multiparty.Form();
    const data = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const event = data.fields?.event?.[0];
    const file = data.files?.file?.[0];

    context.log("📁 Event:", event);
    context.log("📎 File info:", file);

    if (!event || !file) {
      context.log("❌ Missing event or file");
      context.res = { status: 400, body: "Missing event or file" };
      return;
    }

    // 🔧 Inicjalizacja klienta Blob Storage
    const blobName = `${event}/${Date.now()}_${file.originalFilename}`;
    const credential = new StorageSharedKeyCredential(account, key);
    const blobServiceClient = new BlobServiceClient(
      `https://${account}.blob.core.windows.net`,
      credential
    );
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // 📥 Upload do Azure
    const stream = fs.createReadStream(file.path);
    const stat = fs.statSync(file.path);
    context.log("⬆️ Uploading to blob:", blobName);
    await blockBlobClient.uploadStream(stream, stat.size);
    context.log("✅ Upload success");

    context.res = {
      status: 200,
      body: { message: "Uploaded", blobName },
    };
  } catch (err) {
    context.log("❗ ERROR:", err.message);
    context.res = {
      status: 500,
      body: `Server error: ${err.message}`,
    };
  }
};
