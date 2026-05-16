import type {
  ActivitySettings,
  AdminParticipantDetail,
  AdminParticipantSummary,
  DailyCheckin,
  PaginationResponse,
  PublicDailyCheckin,
  PublicRanking,
  PublicUserStats,
  Ranking,
  SubmissionResult,
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const CSRF_COOKIE_NAME = "admin_csrf";
const CSRF_HEADER_NAME = "X-CSRF-Token";
const CSRF_STORAGE_KEY = "admin_csrf_token";

function readCookie(name: string): string {
  const prefix = `${name}=`;
  return (
    document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix))
      ?.slice(prefix.length) || ""
  );
}

function buildHeaders(options?: RequestInit): Headers {
  const headers = new Headers(options?.headers);
  const method = (options?.method || "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrfToken = sessionStorage.getItem(CSRF_STORAGE_KEY) || readCookie(CSRF_COOKIE_NAME);
    if (csrfToken) {
      headers.set(CSRF_HEADER_NAME, csrfToken);
    }
  }
  return headers;
}

function rememberCsrfToken(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "csrf_token" in payload &&
    typeof payload.csrf_token === "string"
  ) {
    sessionStorage.setItem(CSRF_STORAGE_KEY, payload.csrf_token);
  }
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    credentials: "include",
    ...options,
    headers: buildHeaders(options),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  const data = (await res.json()) as T;
  rememberCsrfToken(data);
  return data;
}

export async function getActivity(): Promise<ActivitySettings> {
  return fetchApi("/activity");
}

export async function getTodayCheckin(
  studentId: string,
  checkinDate?: string
): Promise<PublicDailyCheckin | null> {
  const params: Record<string, string> = { student_id: studentId };
  if (checkinDate) params.checkin_date = checkinDate;
  const query = new URLSearchParams(params).toString();
  return fetchApi(`/submissions/today?${query}`);
}

export async function getMyStats(studentId: string): Promise<PublicUserStats | null> {
  const query = new URLSearchParams({ student_id: studentId }).toString();
  return fetchApi(`/submissions/me?${query}`);
}

export async function listPublicRankings(): Promise<PublicRanking[]> {
  return fetchApi("/rankings");
}

export async function getMyAttachmentDownloadUrl(
  id: string,
  studentId: string,
  checkinDate?: string
): Promise<{ download_url: string }> {
  const params: Record<string, string> = { student_id: studentId };
  if (checkinDate) params.checkin_date = checkinDate;
  const query = new URLSearchParams(params).toString();
  return fetchApi(`/submissions/attachments/${id}/download?${query}`);
}

export async function submitForm(data: FormData): Promise<SubmissionResult> {
  return fetchApi("/submissions", {
    method: "POST",
    body: data,
  });
}

export async function loginAdmin(
  username: string,
  password: string
): Promise<{ success: boolean; csrf_token: string }> {
  return fetchApi("/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export async function logoutAdmin(): Promise<{ success: boolean }> {
  try {
    return await fetchApi("/admin/logout", { method: "POST" });
  } finally {
    sessionStorage.removeItem(CSRF_STORAGE_KEY);
  }
}

export async function getAdminMe(): Promise<unknown> {
  return fetchApi("/admin/me");
}

export async function listSubmissions(
  params: Record<string, string>
): Promise<PaginationResponse> {
  const query = new URLSearchParams(params).toString();
  return fetchApi(`/admin/submissions?${query}`);
}

export async function listRankings(): Promise<Ranking[]> {
  return fetchApi("/admin/rankings");
}

export async function listParticipants(): Promise<AdminParticipantSummary> {
  return fetchApi("/admin/participants");
}

export async function getParticipantDetail(studentId: string): Promise<AdminParticipantDetail> {
  return fetchApi(`/admin/participants/${encodeURIComponent(studentId)}`);
}

export async function getCheckinDetail(id: string): Promise<DailyCheckin> {
  return fetchApi(`/admin/checkins/${id}`);
}

export async function getAdminActivity(): Promise<ActivitySettings> {
  return fetchApi("/admin/activity");
}

export async function updateAdminActivity(
  payload: Pick<
    ActivitySettings,
    "name" | "start_date" | "duration_days" | "checkin_start_time" | "checkin_end_time" | "is_active"
  >
): Promise<ActivitySettings> {
  return fetchApi("/admin/activity", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getDownloadUrl(id: string): Promise<{ download_url: string }> {
  return fetchApi(`/admin/attachments/${id}/download`);
}

export async function deleteSubmission(id: string): Promise<{ success: boolean }> {
  return fetchApi(`/admin/submissions/${id}`, { method: "DELETE" });
}
