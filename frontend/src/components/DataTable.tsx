import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Eye,
  FileSpreadsheet,
  RefreshCw,
  Save,
  Search,
  Settings,
  Trash2,
  Trophy,
  Users,
  X,
} from "lucide-react";
import {
  deleteSubmission,
  getAdminActivity,
  getCheckinDetail,
  getDownloadUrl,
  getParticipantDetail,
  listRankings,
  listSubmissions,
  listParticipants,
  updateAdminActivity,
} from "../api/client";
import type {
  ActivitySettings,
  AdminParticipantDetail,
  AdminParticipantSummary,
  CheckinAttachment,
  CheckinItemType,
  DailyCheckin,
  Ranking,
} from "../types";

interface DataTableProps {
  onLogout: () => void;
}

type TabKey = "records" | "rankings" | "participants" | "settings";

const ITEM_LABELS: Record<CheckinItemType, string> = {
  listening: "听力",
  reading: "阅读",
  writing: "作文",
  vocabulary: "单词",
  speaking: "口语",
  running: "跑步",
};

export default function DataTable({ onLogout }: DataTableProps) {
  const [tab, setTab] = useState<TabKey>("records");
  const [records, setRecords] = useState<DailyCheckin[]>([]);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [participants, setParticipants] = useState<AdminParticipantSummary | null>(null);
  const [activity, setActivity] = useState<ActivitySettings | null>(null);
  const [participantDetail, setParticipantDetail] = useState<AdminParticipantDetail | null>(null);
  const [checkinDetail, setCheckinDetail] = useState<DailyCheckin | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterStudentId, setFilterStudentId] = useState("");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");

  const fetchRecords = useCallback(
    async (currentPage: number) => {
      setLoading(true);
      try {
        const params: Record<string, string> = {
          page: String(currentPage),
          page_size: String(pageSize),
        };
        if (filterName) params.name = filterName;
        if (filterStudentId) params.student_id = filterStudentId;
        if (filterStart) params.start_date = filterStart;
        if (filterEnd) params.end_date = filterEnd;

        const res = await listSubmissions(params);
        setRecords(res.items);
        setTotal(res.total);
        setPage(res.page);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    },
    [filterEnd, filterName, filterStart, filterStudentId, pageSize]
  );

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    try {
      setRankings(await listRankings());
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "加载排名失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchActivity = useCallback(async () => {
    try {
      setActivity(await getAdminActivity());
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "加载活动设置失败");
    }
  }, []);

  const fetchParticipants = useCallback(async () => {
    setLoading(true);
    try {
      setParticipants(await listParticipants());
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "加载参与同学失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords(1);
    fetchRankings();
    fetchParticipants();
    fetchActivity();
  }, [fetchActivity, fetchParticipants, fetchRankings, fetchRecords]);

  const totalPages = Math.ceil(total / pageSize);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("确定删除这天的打卡记录吗？")) return;
      try {
        await deleteSubmission(id);
        fetchRecords(page);
        fetchRankings();
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "删除失败");
      }
    },
    [fetchRankings, fetchRecords, page]
  );

  const handleDownload = useCallback(async (id: string) => {
    try {
      const res = await getDownloadUrl(id);
      setPreviewUrl(res.download_url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "图片预览失败");
    }
  }, []);

  const handlePreviewAttachment = useCallback(async (attachment: CheckinAttachment) => {
    try {
      const res = await getDownloadUrl(attachment.id);
      setPreviewTitle(attachment.file_name || attachment.display_name || "打卡附件");
      setPreviewUrl(res.download_url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "图片预览失败");
    }
  }, []);

  const handleOpenParticipant = useCallback(async (studentId: string) => {
    try {
      setParticipantDetail(await getParticipantDetail(studentId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "加载同学详情失败");
    }
  }, []);

  const handleOpenCheckin = useCallback(async (id: string) => {
    try {
      setCheckinDetail(await getCheckinDetail(id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "加载打卡详情失败");
    }
  }, []);

  const handleSaveActivity = useCallback(async () => {
    if (!activity) return;
    setSettingsMessage("");
    try {
      const saved = await updateAdminActivity({
        name: activity.name,
        start_date: activity.start_date,
        duration_days: activity.duration_days,
        checkin_start_time: activity.checkin_start_time,
        checkin_end_time: activity.checkin_end_time,
        morning_bonus_start_time: activity.morning_bonus_start_time,
        morning_bonus_end_time: activity.morning_bonus_end_time,
        is_active: activity.is_active,
      });
      setActivity(saved);
      setSettingsMessage("活动设置已保存，已有记录积分已按当前早起时间重算");
      fetchRecords(page);
      fetchRankings();
      fetchParticipants();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "保存失败");
    }
  }, [activity, fetchParticipants, fetchRankings, fetchRecords, page]);

  const exportRows = useMemo(() => {
    if (tab === "rankings") {
      return rankings.map((row) => ({
        排名: row.rank,
        姓名: row.name,
        学号: row.student_id,
        总积分: row.total_points,
        基础积分: row.base_points,
        早起次数: row.morning_bonus_count,
        有效天数: row.valid_days,
        口语次数: row.speaking_count,
        总完成量: row.total_volume,
      }));
    }
    return records.map((row) => ({
      日期: row.checkin_date,
      姓名: row.name,
      学号: row.student_id,
      基础分: row.base_points,
      早起加分: row.earned_morning_bonus ? 1 : 0,
      总分: row.total_points,
      项目: describeItems(row),
      更新时间: formatDateTime(row.updated_at),
    }));
  }, [rankings, records, tab]);

  const handleExport = useCallback(() => {
    if (exportRows.length === 0) return;
    const headers = Object.keys(exportRows[0]);
    const csv = [
      headers.join(","),
      ...exportRows.map((row) =>
        headers
          .map((header) => `"${String(row[header as keyof typeof row]).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `morning_checkin_${tab}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [exportRows, tab]);

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <TabButton active={tab === "records"} onClick={() => setTab("records")}>
            <CalendarDays size={15} />
            打卡记录
          </TabButton>
          <TabButton active={tab === "rankings"} onClick={() => setTab("rankings")}>
            <Trophy size={15} />
            积分排名
          </TabButton>
          <TabButton active={tab === "participants"} onClick={() => setTab("participants")}>
            <Users size={15} />
            参与同学
          </TabButton>
          <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>
            <Settings size={15} />
            活动设置
          </TabButton>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
          {tab !== "settings" && (
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 sm:py-1.5"
            >
              <FileSpreadsheet size={14} />
              导出 CSV
            </button>
          )}
          <button
            onClick={
              tab === "rankings"
                ? fetchRankings
                : tab === "participants"
                  ? fetchParticipants
                  : () => fetchRecords(page)
            }
            className="flex items-center justify-center gap-1 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 sm:py-1.5"
          >
            <RefreshCw size={14} />
            刷新
          </button>
          <button
            onClick={onLogout}
            className="rounded-lg bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-800 sm:py-1.5"
          >
            退出登录
          </button>
        </div>
      </div>

      {tab === "records" && (
        <RecordsView
          records={records}
          loading={loading}
          total={total}
          page={page}
          totalPages={totalPages}
          filterName={filterName}
          filterStudentId={filterStudentId}
          filterStart={filterStart}
          filterEnd={filterEnd}
          setFilterName={setFilterName}
          setFilterStudentId={setFilterStudentId}
          setFilterStart={setFilterStart}
          setFilterEnd={setFilterEnd}
          fetchRecords={fetchRecords}
          onDelete={handleDelete}
          onDownload={handleDownload}
          onOpenDetail={handleOpenCheckin}
          onOpenParticipant={handleOpenParticipant}
        />
      )}

      {tab === "rankings" && <RankingsView rankings={rankings} loading={loading} />}

      {tab === "participants" && (
        <ParticipantsView
          data={participants}
          loading={loading}
          onOpenParticipant={handleOpenParticipant}
        />
      )}

      {tab === "settings" && activity && (
        <SettingsView
          activity={activity}
          message={settingsMessage}
          onChange={setActivity}
          onSave={handleSaveActivity}
        />
      )}

      {participantDetail && (
        <ParticipantDetailModal
          detail={participantDetail}
          onClose={() => setParticipantDetail(null)}
          onOpenCheckin={handleOpenCheckin}
        />
      )}
      {checkinDetail && (
        <CheckinDetailModal
          checkin={checkinDetail}
          onClose={() => setCheckinDetail(null)}
          onPreviewAttachment={handlePreviewAttachment}
        />
      )}
      {previewUrl && (
        <ImagePreviewModal
          title={previewTitle}
          url={previewUrl}
          onClose={() => {
            setPreviewUrl("");
            setPreviewTitle("");
          }}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-sm sm:px-3 sm:py-1.5 ${
        active ? "bg-gray-900 text-white" : "bg-white text-gray-700 ring-1 ring-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

function RecordsView({
  records,
  loading,
  total,
  page,
  totalPages,
  filterName,
  filterStudentId,
  filterStart,
  filterEnd,
  setFilterName,
  setFilterStudentId,
  setFilterStart,
  setFilterEnd,
  fetchRecords,
  onDelete,
  onDownload,
  onOpenDetail,
  onOpenParticipant,
}: {
  records: DailyCheckin[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  filterName: string;
  filterStudentId: string;
  filterStart: string;
  filterEnd: string;
  setFilterName: (value: string) => void;
  setFilterStudentId: (value: string) => void;
  setFilterStart: (value: string) => void;
  setFilterEnd: (value: string) => void;
  fetchRecords: (page: number) => void;
  onDelete: (id: string) => void;
  onDownload: (id: string) => void;
  onOpenDetail: (id: string) => void;
  onOpenParticipant: (studentId: string) => void;
}) {
  return (
    <div>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-3">
        <input
          type="text"
          placeholder="按姓名筛选"
          value={filterName}
          onChange={(event) => setFilterName(event.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 lg:w-auto lg:py-1.5"
        />
        <input
          type="text"
          placeholder="按学号筛选"
          value={filterStudentId}
          onChange={(event) => setFilterStudentId(event.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 lg:w-auto lg:py-1.5"
        />
        <input
          type="date"
          value={filterStart}
          onChange={(event) => setFilterStart(event.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 lg:w-auto lg:py-1.5"
        />
        <input
          type="date"
          value={filterEnd}
          onChange={(event) => setFilterEnd(event.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 lg:w-auto lg:py-1.5"
        />
        <button
          onClick={() => fetchRecords(1)}
          className="flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 lg:py-1.5"
        >
          <Search size={14} />
          查询
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-[760px] divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">日期</th>
              <th className="px-4 py-3">学生</th>
              <th className="px-4 py-3">积分</th>
              <th className="px-4 py-3">项目</th>
              <th className="px-4 py-3">附件</th>
              <th className="px-4 py-3">更新时间</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  加载中...
                </td>
              </tr>
            )}
            {!loading && records.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  暂无记录
                </td>
              </tr>
            )}
            {!loading &&
              records.map((record) => (
                <tr key={record.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">{record.checkin_date}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOpenParticipant(record.student_id)}
                      className="font-medium text-emerald-700 hover:text-emerald-900 hover:underline"
                    >
                      {record.name}
                    </button>
                    <div className="text-xs text-gray-500">{record.student_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{record.total_points} 分</div>
                    <div className="text-xs text-gray-500">
                      基础 {record.base_points}，早起 {record.earned_morning_bonus ? 1 : 0}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{describeItems(record)}</td>
                  <td className="px-4 py-3">
                    <AttachmentButtons record={record} onDownload={onDownload} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                    {formatDateTime(record.updated_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => onOpenDetail(record.id)}
                        className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800"
                      >
                        <Eye size={14} />
                        详情
                      </button>
                      <button
                        onClick={() => onDelete(record.id)}
                        className="inline-flex items-center gap-1 text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={14} />
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-gray-500">
          共 {total} 条记录，第 {page} / {totalPages || 1} 页
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchRecords(page - 1)}
            disabled={page <= 1}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            上一页
          </button>
          <button
            onClick={() => fetchRecords(page + 1)}
            disabled={page >= totalPages}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}

function ParticipantsView({
  data,
  loading,
  onOpenParticipant,
}: {
  data: AdminParticipantSummary | null;
  loading: boolean;
  onOpenParticipant: (studentId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const students = (data?.students ?? []).filter((student) => {
    if (!normalizedQuery) return true;
    return (
      student.name.toLowerCase().includes(normalizedQuery) ||
      student.student_id.toLowerCase().includes(normalizedQuery)
    );
  });

  if (loading) {
    return <div className="rounded-lg bg-white p-8 text-center text-sm text-gray-500">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-500">参与人数</div>
          <div className="mt-2 text-3xl font-semibold text-gray-900">{data?.total_students ?? 0}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-500">有效打卡记录</div>
          <div className="mt-2 text-3xl font-semibold text-gray-900">
            {data?.valid_checkin_records ?? 0}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="按姓名或学号筛选"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 sm:max-w-sm"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-[820px] divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">学生</th>
              <th className="px-4 py-3">总分</th>
              <th className="px-4 py-3">打卡天数</th>
              <th className="px-4 py-3">明细</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.map((student) => (
              <tr key={student.student_id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{student.name}</div>
                  <div className="text-xs text-gray-500">{student.student_id}</div>
                </td>
                <td className="px-4 py-3 font-semibold text-gray-900">{student.total_points}</td>
                <td className="px-4 py-3 text-gray-700">
                  总 {student.valid_days} / 连续 {student.consecutive_days}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  基础 {student.base_points} / 早起 {student.morning_bonus_count} / 听{" "}
                  {student.listening_count} / 读 {student.reading_count} / 写 {student.writing_count} /
                  词 {student.vocabulary_count} / 口 {student.speaking_count} / 跑 {student.running_count}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onOpenParticipant(student.student_id)}
                    className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800"
                  >
                    <Eye size={14} />
                    查看详情
                  </button>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  {normalizedQuery ? "没有匹配的同学" : "暂无参与同学"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RankingsView({ rankings, loading }: { rankings: Ranking[]; loading: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-[760px] divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">排名</th>
            <th className="px-4 py-3">学生</th>
            <th className="px-4 py-3">总积分</th>
            <th className="px-4 py-3">基础积分</th>
            <th className="px-4 py-3">早起</th>
            <th className="px-4 py-3">有效天数</th>
            <th className="px-4 py-3">项目次数</th>
            <th className="px-4 py-3">总完成量</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                加载中...
              </td>
            </tr>
          )}
          {!loading && rankings.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                暂无排名
              </td>
            </tr>
          )}
          {!loading &&
            rankings.map((row) => (
              <tr key={row.student_id}>
                <td className="px-4 py-3 font-semibold text-gray-900">#{row.rank}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{row.name}</div>
                  <div className="text-xs text-gray-500">{row.student_id}</div>
                </td>
                <td className="px-4 py-3 font-semibold text-gray-900">{row.total_points}</td>
                <td className="px-4 py-3 text-gray-700">{row.base_points}</td>
                <td className="px-4 py-3 text-gray-700">{row.morning_bonus_count}</td>
                <td className="px-4 py-3 text-gray-700">
                  {row.valid_days}
                  <div className="text-xs text-gray-500">连续 {row.consecutive_days}</div>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  听 {row.listening_count} / 读 {row.reading_count} / 写 {row.writing_count} /
                  词 {row.vocabulary_count} / 口 {row.speaking_count} / 跑 {row.running_count}
                </td>
                <td className="px-4 py-3 text-gray-700">{row.total_volume.toFixed(2)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function SettingsView({
  activity,
  message,
  onChange,
  onSave,
}: {
  activity: ActivitySettings;
  message: string;
  onChange: (value: ActivitySettings) => void;
  onSave: () => void;
}) {
  return (
    <div className="max-w-xl rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
      <div className="grid gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">活动名称</span>
          <input
            type="text"
            value={activity.name}
            onChange={(event) => onChange({ ...activity, name: event.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">开始日期</span>
          <input
            type="date"
            value={activity.start_date}
            onChange={(event) => onChange({ ...activity, start_date: event.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">持续天数</span>
          <input
            type="number"
            min="1"
            value={activity.duration_days}
            onChange={(event) =>
              onChange({ ...activity, duration_days: Number(event.target.value) })
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">每日打卡开始时间</span>
            <input
              type="time"
              value={activity.checkin_start_time}
              onChange={(event) =>
                onChange({ ...activity, checkin_start_time: event.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">每日打卡结束时间</span>
            <input
              type="time"
              value={activity.checkin_end_time}
              onChange={(event) =>
                onChange({ ...activity, checkin_end_time: event.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        </div>
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          如果结束时间早于开始时间，系统会自动跨天计算。例如 06:00 到 04:00 表示早上 6 点至次日凌晨 4 点都归入开始当天。
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">早起加分开始时间</span>
            <input
              type="time"
              value={activity.morning_bonus_start_time}
              onChange={(event) =>
                onChange({ ...activity, morning_bonus_start_time: event.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">早起加分结束时间</span>
            <input
              type="time"
              value={activity.morning_bonus_end_time}
              onChange={(event) =>
                onChange({ ...activity, morning_bonus_end_time: event.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        </div>
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800">
          保存后会按新的早起加分时间重算活动周期内已有记录。
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={activity.is_active}
            onChange={(event) => onChange({ ...activity, is_active: event.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-emerald-600"
          />
          启用活动
        </label>
        <div>
          <div className="mb-1 flex items-center justify-between text-sm text-gray-600">
            <span>当前进度</span>
            <span>
              第 {activity.current_day} / {activity.duration_days} 天
            </span>
          </div>
          <div className="h-2 rounded-lg bg-gray-100">
            <div
              className="h-2 rounded-lg bg-emerald-500"
              style={{ width: `${activity.progress_percent}%` }}
            />
          </div>
        </div>
        {message && <div className="text-sm text-emerald-700">{message}</div>}
        <button
          onClick={onSave}
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
        >
          <Save size={15} />
          保存设置
        </button>
      </div>
    </div>
  );
}

function AttachmentButtons({
  record,
  onDownload,
}: {
  record: DailyCheckin;
  onDownload: (id: string) => void;
}) {
  const attachments = record.items.flatMap((item) =>
    item.attachments.map((attachment) => ({
      ...attachment,
      label: ITEM_LABELS[item.item_type],
    }))
  );
  if (attachments.length === 0) return <span className="text-gray-400">无</span>;

  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <button
          key={attachment.id}
          onClick={() => onDownload(attachment.id)}
          className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
        >
          <Eye size={12} />
          {attachment.label}
        </button>
      ))}
    </div>
  );
}

function ParticipantDetailModal({
  detail,
  onClose,
  onOpenCheckin,
}: {
  detail: AdminParticipantDetail;
  onClose: () => void;
  onOpenCheckin: (id: string) => void;
}) {
  const summary = detail.summary;
  return (
    <Modal title={`${summary.name} 的打卡详情`} onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-5">
        <Stat label="总分" value={summary.total_points} />
        <Stat label="基础分" value={summary.base_points} />
        <Stat label="早起" value={summary.morning_bonus_count} />
        <Stat label="连续天数" value={summary.consecutive_days} />
        <Stat label="总打卡天数" value={summary.valid_days} />
      </div>
      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-[720px] divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">日期</th>
              <th className="px-4 py-3">积分</th>
              <th className="px-4 py-3">项目</th>
              <th className="px-4 py-3">更新时间</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {detail.checkins.map((checkin) => (
              <tr key={checkin.id}>
                <td className="px-4 py-3">{checkin.checkin_date}</td>
                <td className="px-4 py-3">
                  总 {checkin.total_points} / 基础 {checkin.base_points} / 早起{" "}
                  {checkin.earned_morning_bonus ? 1 : 0}
                </td>
                <td className="px-4 py-3">{describeItems(checkin)}</td>
                <td className="px-4 py-3">{formatDateTime(checkin.updated_at)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onOpenCheckin(checkin.id)}
                    className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800"
                  >
                    <Eye size={14} />
                    打卡详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function CheckinDetailModal({
  checkin,
  onClose,
  onPreviewAttachment,
}: {
  checkin: DailyCheckin;
  onClose: () => void;
  onPreviewAttachment: (attachment: CheckinAttachment) => void;
}) {
  return (
    <Modal title={`${checkin.name} ${checkin.checkin_date} 打卡详情`} onClose={onClose} wide>
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="总分" value={checkin.total_points} />
        <Stat label="基础分" value={checkin.base_points} />
        <Stat label="早起分" value={checkin.earned_morning_bonus ? 1 : 0} />
        <Stat label="完成量" value={checkin.total_volume.toFixed(2)} />
      </div>
      <div className="space-y-3">
        {checkin.items.map((item, index) => (
          <div key={item.id || `${item.item_type}-${index}`} className="rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-gray-900">{ITEM_LABELS[item.item_type]}</div>
                <div className="text-sm text-gray-500">
                  {item.is_valid ? "达标" : "未达标"} / {item.points} 分 / 完成量{" "}
                  {item.volume_score.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-600">{describeItemValues(item)}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.attachments.map((attachment) => (
                <button
                  key={attachment.id}
                  onClick={() => onPreviewAttachment(attachment)}
                  className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
                >
                  <Eye size={12} />
                  {attachment.file_name || attachment.display_name || "打卡附件"}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function ImagePreviewModal({
  title,
  url,
  onClose,
}: {
  title: string;
  url: string;
  onClose: () => void;
}) {
  return (
    <Modal title={title || "图片预览"} onClose={onClose} wide>
      <div className="flex max-h-[75vh] items-center justify-center overflow-auto rounded-lg bg-gray-100 p-2">
        <img src={url} alt={title || "打卡图片"} className="max-h-[72vh] max-w-full object-contain" />
      </div>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
      <div className={`w-full rounded-lg bg-white shadow-xl ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[82vh] overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function describeItemValues(item: DailyCheckin["items"][number]) {
  if (item.item_type === "listening") return `听力小题数：${item.listening_questions ?? 0}`;
  if (item.item_type === "reading") {
    return `阅读题数：${item.reading_articles ?? 0}，阅读小题数：${item.reading_questions ?? 0}`;
  }
  if (item.item_type === "writing") return `作文词数：${item.writing_words ?? 0}`;
  if (item.item_type === "vocabulary") return `新学单词数：${item.vocabulary_words ?? 0}`;
  if (item.item_type === "speaking") {
    return `口语练习：${item.speaking_minutes ?? 0} min，对话句数：${
      item.speaking_dialogue_sentences ?? 0
    }`;
  }
  return `距离：${item.running_distance_km ?? 0} km，配速：${item.running_pace_min_per_km ?? 0} min/km`;
}

function describeItems(record: DailyCheckin) {
  const valid = record.items
    .filter((item) => item.is_valid)
    .map((item) => ITEM_LABELS[item.item_type]);
  if (valid.length === 0) return "未达标";
  return valid.join("、");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
