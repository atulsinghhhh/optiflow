import { z } from "zod";

// Allowed MIME types for image uploads
const IMAGE_MIME_TYPES: string[] = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
];

// Allowed MIME types for file uploads (includes images + documents)
const FILE_MIME_TYPES: string[] = [
    ...IMAGE_MIME_TYPES,
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Max file sizes per type (in bytes)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;  // 50 MB

/**
 * Zod schema for validating the upload form data.
 * - `type`: "image" | "file" (defaults to "file")
 */
export const uploadTypeSchema = z.object({
    type: z.enum(["image", "file"]).default("file"),
});

/**
 * Validates the uploaded file against the given upload type.
 * Checks MIME type and file size constraints.
 *
 * @param file  - The uploaded File object
 * @param type  - "image" or "file"
 * @returns {{ success: true } | { success: false; error: string }}
 */
export function validateFile(
    file: File,
    type: "image" | "file"
): { success: true } | { success: false; error: string } {
    const allowedTypes = type === "image" ? IMAGE_MIME_TYPES : FILE_MIME_TYPES;
    const maxSize = type === "image" ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
    const maxSizeLabel = type === "image" ? "10 MB" : "50 MB";

    // Validate MIME type
    if (!allowedTypes.includes(file.type)) {
        return {
            success: false,
            error: `Invalid file type "${file.type}". Allowed types for ${type}: ${allowedTypes.join(", ")}`,
        };
    }

    // Validate file size
    if (file.size > maxSize) {
        return {
            success: false,
            error: `File size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds the ${maxSizeLabel} limit for ${type} uploads.`,
        };
    }

    return { success: true };
}
