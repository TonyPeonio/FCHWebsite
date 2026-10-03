// Local development only: creates the bucket in the local R2 stand-in (RustFS, see README) and lets
// the dev site upload to it from the browser. Safe to run more than once.
import { createHash } from "node:crypto";
import { AwsClient } from "aws4fetch";

const r2 = new AwsClient({ accessKeyId: "minioadmin", secretAccessKey: "minioadmin", service: "s3", region: "auto" });
const bucket = "http://localhost:9000/fch-files";

const made = await r2.fetch(bucket, { method: "PUT" });
console.log(made.ok ? "Bucket created" : made.status === 409 ? "Bucket already exists" : `Bucket: ${made.status} ${await made.text()}`);

const cors = `<CORSConfiguration><CORSRule><AllowedOrigin>http://localhost:5173</AllowedOrigin><AllowedMethod>GET</AllowedMethod><AllowedMethod>PUT</AllowedMethod><AllowedHeader>*</AllowedHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule></CORSConfiguration>`;
const set = await r2.fetch(`${bucket}?cors`, {
  method: "PUT",
  body: cors,
  headers: { "Content-Type": "application/xml", "Content-MD5": createHash("md5").update(cors).digest("base64") },
});
console.log(set.ok ? "Browser uploads allowed from http://localhost:5173" : `CORS: ${set.status} ${await set.text()}`);
