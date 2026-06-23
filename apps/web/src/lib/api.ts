const rawApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const API_URL = rawApiUrl.replace(/\/$/, "");

export function apiUrl(path: string) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    return `${API_URL}${normalizedPath}`;
}
