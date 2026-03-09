"use client";

import { FormEvent, useState } from "react";

type UploadResponse = {
  job_id?: string;
  status?: string;
  error?: string;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file) {
      setError("Please select a file.");
      return;
    }

    setError(null);
    setResult(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/storage", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as UploadResponse;

      if (!response.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }

      setResult(data);
    } catch {
      setError("Network error while uploading file.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">File Upload</h1>
      <p className="mt-2 text-sm text-zinc-600">POST to /api/storage</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <input
          type="file"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />

        <button
          type="submit"
          disabled={isUploading}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? "Uploading..." : "Upload"}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {result ? (
        <div className="mt-6 rounded-md border border-zinc-200 p-4 text-sm">
          <p>
            <span className="font-medium">Job ID:</span> {result.job_id}
          </p>
          <p>
            <span className="font-medium">Status:</span> {result.status}
          </p>
        </div>
      ) : null}
    </main>
  );
}
