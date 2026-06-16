// Shared rules for choosing a new password (sign-up, reset, and change-password),
// so the sanity check lives in one place. Mirrors the Supabase server backstop
// `minimum_password_length = 8`.

export const MIN_PASSWORD = 8;

/** Returns an error message for an invalid new password, or null when it's fine. */
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (password !== confirm) return "Passwords don't match.";
  return null;
}
