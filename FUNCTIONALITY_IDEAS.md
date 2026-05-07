# OptiFlow – Proposed Functionalities & Roadmap

This document outlines potential features and improvements for OptiFlow, categorized by their impact and implementation area.

## 1. Core File Management (Essential)
These features round out the basic user experience of a file storage platform.

- [ ] **File Operations (CRUD):**
    - **Rename:** Allow users to rename files and folders.
    - **Delete (Recycle Bin):** Instead of permanent deletion, move files to a "Trash" folder where they are automatically deleted after 30 days.
    - **Move/Copy:** UI to move or copy files/folders between different directories.
- [ ] **Batch Actions:**
    - Support multi-selection of files/folders to delete, move, or download as a ZIP archive.
- [ ] **File Previews:**
    - Integrated viewer for Images, PDFs, Videos, and Code files (with syntax highlighting) directly in the browser.
- [ ] **Drag and Drop:**
    - Support for uploading folders/files by dragging them into the dashboard.
    - Drag-and-drop to move files into folders.

## 2. Collaboration & Sharing (Social)
Transform OptiFlow from a personal storage tool into a collaborative platform.

- [ ] **User-to-User Sharing:**
    - Share folders or files directly with other registered users via their email.
    - Assign permissions: `Viewer` (read-only) vs `Editor` (can upload/delete/rename).
- [ ] **Advanced Public Links:**
    - **Password Protection:** Require a password to access shared public links.
    - **Expiration Dates:** Automatically disable sharing links after a specific time (built into schema, needs UI).
    - **Download Limits:** Limit the number of times a shared link can be used.
- [ ] **Activity Feed / Audit Logs:**
    - Track who accessed, uploaded, or modified files in a shared folder.

## 3. Advanced Storage & Processing (Power User)
Leverage the "Flow" and "Worker" nature of the app.

- [ ] **File Versioning:**
    - Keep track of previous versions of a file. Allow users to "Restore" to an older version.
- [ ] **Advanced Processing Pipelines:**
    - **Video:** Automatic transcoding (e.g., to H.264), thumbnail generation, and GIF preview creation.
    - **Documents:** PDF to Image conversion, OCR (Optical Character Recognition) to make PDFs searchable.
    - **AI Integration:** Automatic tagging of images (e.g., "mountain", "beach") using Vision AI models.
- [ ] **Full-Text Search:**
    - Search not just by filename, but by the content inside documents (PDFs, .txt, .docx).
- [ ] **Global Search:**
    - A unified search bar that works across all folders.

## 4. User Experience & UI/UX (Polishing)
- [ ] **User Profile Management:**
    - Allow users to upload avatars, change display names, and update passwords.
- [ ] **Storage Quotas:**
    - Visual indicators of storage limits (e.g., "2GB of 10GB used").
- [ ] **Mobile Experience:**
    - Ensure the dashboard is fully responsive or implement a PWA (Progressive Web App) for offline access and native-like feel.
- [ ] **Dark Mode / Themes:**
    - Implement a "Glassmorphism" or "Neon" theme to match the current premium aesthetic.

## 5. Developer & Admin Tools (SaaS Ready)
- [ ] **API Access (API Keys):**
    - Allow users to generate API keys to upload/process files programmatically (e.g., for use in CI/CD or other apps).
- [ ] **Webhooks:**
    - Notify external services when a file processing job is completed.
- [ ] **Admin Dashboard:**
    - A dedicated view for admins to monitor system health, active workers, queue size, and user growth.
- [ ] **Usage Analytics:**
    - Detailed charts showing storage trends over time (improving the current mock velocity chart).

## 6. Security
- [ ] **Two-Factor Authentication (2FA):**
    - Support for TOTP (Google Authenticator) or Email OTP.
- [ ] **End-to-End Encryption (E2EE):**
    - Optional "Secure Vault" where files are encrypted on the client-side before upload.
