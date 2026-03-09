import fs from 'fs'
import crypto from 'crypto'
import { minioClient } from './minio'
import prisma from './prisma'

const CHUNK_SIZE = 1024 * 1024 * 5

export async function uploadFile(fileId: string,filePath: string) {
    const stream = fs.createReadStream(filePath, {highWaterMark: CHUNK_SIZE});

    let chunkIndex = 0;
    
    for await(const chunk of stream){
        const hash = crypto.createHash('sha256').update(chunk).digest('hex');
        const objectName = `${fileId}/${chunkIndex}`;

        await minioClient.putObject(
            "files",
            objectName,
            chunk,
        )

        await prisma.chunk.create({
            data: {
                file_id: fileId,
                chunk_index: chunkIndex,
                chunk_size: chunk.length,
                checkSum: hash,
                storage_id: fileId,
            }
        })

        chunkIndex++;
        
    }

}