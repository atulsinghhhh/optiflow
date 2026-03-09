import sharp from "sharp";
import { minioClient } from "@/lib/minio";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";

const PROCESSED_BUCKET = "processed-images";

async function processImage() {
    const processedExists = await minioClient.bucketExists(PROCESSED_BUCKET);
    if (!processedExists) await minioClient.makeBucket(PROCESSED_BUCKET);

    while (true) {
        let jobId: string | undefined;
        try {
            // brpop returns [key, value] | null
            const result = await redis.brpop('image-processing-queue', 0);
            if (!result) continue;

            jobId = result[1];
            console.log(`Processing storage file with id: ${jobId}`);

            await prisma.storage.update({
                where: { id: jobId },
                data: { status: "PROCESSING" }
            });

            const record = await prisma.storage.findUnique({ where: { id: jobId } });
            if (!record) {
                console.log(`No record found for id: ${jobId}`);
                continue;
            }

            const fileName = record.file_name;
            const bucket = process.env.MINIO_BUCKET_NAME!;

            const object = await minioClient.getObject(bucket, fileName);
            const chunks: Buffer[] = [];

            await new Promise((resolve, reject) => {
                object.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                object.on('end', resolve);
                object.on('error', reject);
            });

            const buffer = Buffer.concat(chunks);

            // process image using sharp
            const processedBuffer = await sharp(buffer)
                .resize(800, 600, { fit: "inside" })
                .toFormat("jpeg")
                .toBuffer();

            const processedFileName = `processed-${fileName}`;
            await minioClient.putObject(
                bucket,
                processedFileName,
                processedBuffer,
                processedBuffer.length,
                {
                    'Content-Type': 'image/jpeg'
                }
            );
            const processedUrl = `${process.env.MINIO_PUBLIC_URL}/${bucket}/${processedFileName}`;

            await prisma.storage.update({
                where: { id: jobId },
                data: {
                    status: "COMPLETED",
                    processed_url: processedUrl
                }
            });
            console.log(`Completed processing for storage file with id: ${jobId}`);
        } catch (error) {
            console.log('Error processing image:', error);
            if (jobId) {
                await prisma.storage.update({
                    where: { id: jobId },
                    data: { status: "FAILED" }
                });
            }
        }
    }
}

processImage();