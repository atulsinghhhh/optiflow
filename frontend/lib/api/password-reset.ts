import { authClient } from "./http";

export type PasswordResetRequestResponse = {
    reset_token: string;
    expires_at: string;
};

// TODO(email-delivery): auth-svc returns the raw reset token directly in this
// response (dev-mode) since no email/SMTP provider exists yet — see plan.md's
// Open Decisions. Once one is chosen, this becomes a generic "check your
// email" response and the token stops being exposed to the client here.
export async function requestPasswordReset(email: string): Promise<PasswordResetRequestResponse> {
    const res = await authClient.post<PasswordResetRequestResponse>("/password-reset/request", { email });
    return res.data;
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    await authClient.post("/password-reset/confirm", { token, new_password: newPassword });
}
