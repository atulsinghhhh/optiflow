import "dotenv/config";
import { redis } from "../lib/redis";

async function monitor() {
    setInterval(async () => {
        const length = await redis.llen("image-processing-queue");
        console.log("Queue length:", length);
    }, 2000);
}

monitor();