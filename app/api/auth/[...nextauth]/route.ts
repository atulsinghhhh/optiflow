import { handlers } from "@/lib/auth";

// Export GET and POST handlers for Auth.js v5
// These handle: sign-in, sign-out, CSRF, session, providers API
export const { GET, POST } = handlers;
