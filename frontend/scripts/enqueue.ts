import "dotenv/config";
import  prisma  from "../lib/prisma";
import { redis } from "../lib/redis";

async function enqueuePendingJobs() {
  const pendingJobs = await prisma.storage.findMany({
    where: { status: "PENDING" },
  });

  console.log(`Found ${pendingJobs.length} pending jobs`);
  console.log("Redis host (enqueue):", process.env.REDIS_HOST);
//   console.log("Redis host (worker):", process.env.REDIS_HOST);

    const length = await redis.llen("image-processing-queue");
    console.log("Queue length seen by worker:", length);

  for (const job of pendingJobs) {
    await redis.lpush("image-processing-queue", job.id.toString());
  }

  console.log("All jobs pushed to Redis");
  process.exit(0);
}

enqueuePendingJobs();