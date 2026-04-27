import type {
  ActivitySettings,
  AdminParticipantDetail,
  AdminParticipantSummary,
  DailyCheckin,
  PaginationResponse,
  PublicRanking,
  PublicUserStats,
  Ranking,
  SubmissionResult,
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function getActivity(): Promise<ActivitySettings> {
  return fetchApi("/activity");
}

export async function getTodayCheckin(studentId: string): Promise<DailyCheckin | null> {
  const query = new URLSearchParams({ student_id: studentId }).toString();
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
  studentId: string
): Promise<{ download_url: string }> {
  const query = new URLSearchParams({ student_id: studentId }).toString();
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
): Promise<{ success: boolean }> {
  return fetchApi("/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export async function logoutAdmin(): Promise<{ success: boolean }> {
  return fetchApi("/admin/logout", { method: "POST" });
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
  payload: Pick<ActivitySettings, "name" | "start_date" | "duration_days" | "is_active">
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
