import "dotenv/config";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import  prisma  from "../lib/prisma";
import { redis } from "../lib/redis";
import { minioClient } from "../lib/minio";

const TOTAL_IMAGES = 1000;
const RAW_BUCKET = "optiflow";

async function ensureBucket() {
  const exists = await minioClient.bucketExists(RAW_BUCKET);
  if (!exists) {
    await minioClient.makeBucket(RAW_BUCKET);
    console.log("Created bucket:", RAW_BUCKET);
  }
}

async function generateImageBuffer() {
  return sharp({
    create: {
      width: 1000,
      height: 1000,
      channels: 3,
      background: {
        r: Math.floor(Math.random() * 255),
        g: Math.floor(Math.random() * 255),
        b: Math.floor(Math.random() * 255),
      },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function seed() {
  console.log(`Starting seeding ${TOTAL_IMAGES} images...`);

  await ensureBucket();

  for (let i = 1; i <= TOTAL_IMAGES; i++) {
    try {
      const buffer = await generateImageBuffer();
      const fileName = `${uuidv4()}.jpg`;

      // 1️⃣ Upload to MinIO
      await minioClient.putObject(
        RAW_BUCKET,
        fileName,
        buffer,
        buffer.length,
        { "Content-Type": "image/jpeg" }
      );

      const originalUrl = `${process.env.MINIO_PUBLIC_URL}/${RAW_BUCKET}/${fileName}`;

      // 2️⃣ Insert into DB
      const job = await prisma.storage.create({
        data: {
          status: "PENDING",
          original_url: originalUrl,
          file_name: fileName,
          file_size: buffer.length,
          mime_type: "image/jpeg",
        },
      });

      // 3️⃣ Push to Redis queue
      await redis.lpush("image-processing-queue", job.id.toString());

      console.log(`✅ Inserted & queued job ${job.id} (${i}/${TOTAL_IMAGES})`);
    } catch (error) {
      console.error(`❌ Failed at image ${i}`, error);
    }
  }

  console.log("🔥 Finished inserting 1000 images.");
  process.exit(0);
}

seed();