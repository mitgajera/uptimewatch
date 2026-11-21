import axios from "axios";

/** Best human-readable message from an API/axios error. */
export function apiErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; error?: string } | undefined;
    if (data?.message) return data.message;
    if (data?.error) return data.error;
    if (error.response?.status === 429) return "Too many requests. Try again in a minute.";
    if (!error.response) return "Can't reach the server. Check your connection.";
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
