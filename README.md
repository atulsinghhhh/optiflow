# OptiFlow

OptiFlow is a high-performance, scalable file management and processing platform built with Next.js, Prisma, and MinIO. It provides a robust architecture for uploading, storing, and processing files with a focus on background job processing and efficient storage management.

## 🚀 Features

- **File Management:** Upload, organize, and manage files in a hierarchical folder structure.
- **Background Processing:** Asynchronous file processing pipeline using Redis and dedicated worker processes.
- **Thumbnail Generation:** Automatic generation of optimized image thumbnails (800x600 JPEG) using the Sharp library.
- **Chunked Uploads:** Support for large file uploads through a chunked upload mechanism, ensuring reliability and resumability.
- **Secure Sharing:** Generate shareable tokens for files with optional expiration and recipient restrictions.
- **Authentication:** Secure user authentication powered by NextAuth.js.
- **Analytics:** Integrated analytics to track storage usage and file activity.
- **Modern UI:** A polished, responsive interface built with Shadcn UI, Framer Motion, and Three.js.

## 🛠️ Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Database:** [PostgreSQL](https://www.postgresql.org/) with [Prisma ORM](https://www.prisma.io/)
- **Object Storage:** [MinIO](https://min.io/) (S3 Compatible)
- **Queue & Caching:** [Redis](https://redis.io/) (via ioredis)
- **Image Processing:** [Sharp](https://sharp.pixelplumbing.com/)
- **Authentication:** [NextAuth.js](https://next-auth.js.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/)
- **Animations:** [Framer Motion](https://www.framer.com/motion/) & [React Three Fiber](https://r3f.docs.pmnd.rs/)

## 📦 Project Structure

```text
├── app/              # Next.js app router pages and API routes
├── components/       # Reusable UI components (Shadcn UI)
├── lib/              # Core utility functions and client initializations (Prisma, MinIO, Redis)
├── prisma/           # Database schema and migrations
├── workers/          # Background worker for file processing
├── public/           # Static assets
└── scripts/          # Maintenance and seeding scripts
```

## ⚙️ Getting Started

### Prerequisites

- Node.js (v20+)
- Docker and Docker Compose (for running PostgreSQL, MinIO, and Redis)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd optiflow
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory based on `.env.example` (if available) or include the following:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/optiflow"
   NEXTAUTH_SECRET="your-secret"
   NEXTAUTH_URL="http://localhost:3000"
   
   MINIO_ENDPOINT="localhost"
   MINIO_PORT=9000
   MINIO_USE_SSL=false
   MINIO_ACCESS_KEY="minioadmin"
   MINIO_SECRET_KEY="minioadmin"
   MINIO_IMAGE_BUCKET="images"
   MINIO_PUBLIC_URL="http://localhost:9000"
   
   REDIS_URL="redis://localhost:6379"
   ```

4. **Start the infrastructure (using Docker):**
   ```bash
   docker-compose up -d
   ```

5. **Run database migrations:**
   ```bash
   npx prisma migrate dev
   ```

6. **Seed the database (optional):**
   ```bash
   npm run seed
   ```

### Running the Application

1. **Start the Next.js development server:**
   ```bash
   npm run dev
   ```

2. **Start the background worker:**
   ```bash
   npm run worker
   ```

## 🖼️ Thumbnail Generation

OptiFlow includes a dedicated worker (`workers/worker.ts`) that listens to a Redis queue (`processing_queue`). When an image is uploaded, a job is added to the queue. The worker then:
1. Picks up the job and marks the storage record as `PROCESSING`.
2. Fetches the original image from MinIO.
3. Uses **Sharp** to resize the image to 800x600 (maintaining aspect ratio).
4. Converts the image to JPEG format.
5. Uploads the processed thumbnail back to MinIO with a `processed-` prefix.
6. Updates the storage record status to `COMPLETED` and stores the `processed_url`.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.
