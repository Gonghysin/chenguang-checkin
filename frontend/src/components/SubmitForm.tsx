import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle,
  Eye,
  Image,
  Megaphone,
  Moon,
  Send,
  Sunrise,
  Trophy,
  X,
} from "lucide-react";
import {
  getActivity,
  getMyAttachmentDownloadUrl,
  getMyStats,
  getTodayCheckin,
  listPublicRankings,
  submitForm,
} from "../api/client";
import type {
  ActivitySettings,
  CheckinAttachment,
  CheckinItem,
  CheckinItemType,
  PublicRanking,
  PublicUserStats,
  SubmissionResult,
} from "../types";

type ItemValues = {
  selected: boolean;
  listening_questions: string;
  reading_articles: string;
  reading_questions: string;
  writing_words: string;
  vocabulary_words: string;
  speaking_minutes: string;
  speaking_dialogue_sentences: string;
  running_distance_km: string;
  running_pace_min_per_km: string;
};

type CheckinTarget = "today" | "makeup";

const ITEM_META: Array<{
  type: CheckinItemType;
  label: string;
  target: string;
}> = [
  { type: "listening", label: "听力", target: "不少于 10 小题" },
  { type: "reading", label: "阅读", target: "2 道阅读且不少于 10 小题" },
  { type: "writing", label: "英语作文", target: "不少于 100 词" },
  { type: "vocabulary", label: "背单词", target: "App 新学 20 个以上单词" },
  { type: "speaking", label: "口语", target: "不少于 10 min 或不少于 15 句对话" },
  { type: "running", label: "跑步", target: "2 公里及以上，配速 <= 10 min/km" },
];

const MAKEUP_CHECKIN_DATE = "2026-05-15";
const MAKEUP_WINDOW_START = "2026-05-16";
const MAKEUP_WINDOW_END = "2026-05-17";

const EMPTY_ITEM: ItemValues = {
  selected: false,
  listening_questions: "",
  reading_articles: "",
  reading_questions: "",
  writing_words: "",
  vocabulary_words: "",
  speaking_minutes: "",
  speaking_dialogue_sentences: "",
  running_distance_km: "",
  running_pace_min_per_km: "",
};

const initialItems = (): Record<CheckinItemType, ItemValues> => ({
  listening: { ...EMPTY_ITEM },
  reading: { ...EMPTY_ITEM },
  writing: { ...EMPTY_ITEM },
  vocabulary: { ...EMPTY_ITEM },
  speaking: { ...EMPTY_ITEM },
  running: { ...EMPTY_ITEM },
});

const initialFiles = (): Record<CheckinItemType, File[]> => ({
  listening: [],
  reading: [],
  writing: [],
  vocabulary: [],
  speaking: [],
  running: [],
});

const initialAttachments = (): Record<CheckinItemType, CheckinAttachment[]> => ({
  listening: [],
  reading: [],
  writing: [],
  vocabulary: [],
  speaking: [],
  running: [],
});

export default function SubmitForm() {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [items, setItems] = useState<Record<CheckinItemType, ItemValues>>(initialItems);
  const [files, setFiles] = useState<Record<CheckinItemType, File[]>>(initialFiles);
  const [existingAttachments, setExistingAttachments] =
    useState<Record<CheckinItemType, CheckinAttachment[]>>(initialAttachments);
  const [activity, setActivity] = useState<ActivitySettings | null>(null);
  const [rankings, setRankings] = useState<PublicRanking[]>([]);
  const [myStats, setMyStats] = useState<PublicUserStats | null>(null);
  const [checkinTarget, setCheckinTarget] = useState<CheckinTarget>("today");
  const [targetCheckin, setTargetCheckin] = useState<SubmissionResult["checkin"] | null>(null);
  const [lockedItemTypes, setLockedItemTypes] = useState<CheckinItemType[]>([]);
  const [submittedValidity, setSubmittedValidity] = useState<Record<CheckinItemType, boolean>>(
    initialSubmittedValidity
  );
  const [showRules, setShowRules] = useState(false);
  const [showRankings, setShowRankings] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<SubmissionResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedName = localStorage.getItem("morning_checkin_name");
    const savedStudentId = localStorage.getItem("morning_checkin_student_id");
    if (savedName) setName(savedName);
    if (savedStudentId) setStudentId(savedStudentId);

    getActivity()
      .then(setActivity)
      .catch(() => setActivity(null));
    listPublicRankings()
      .then(setRankings)
      .catch(() => setRankings([]));
  }, []);

  useEffect(() => {
    const trimmedName = name.trim();
    if (trimmedName) {
      localStorage.setItem("morning_checkin_name", trimmedName);
    }
  }, [name]);

  useEffect(() => {
    const trimmedStudentId = studentId.trim();
    if (trimmedStudentId) {
      localStorage.setItem("morning_checkin_student_id", trimmedStudentId);
    }
  }, [studentId]);

  useEffect(() => {
    const trimmedStudentId = studentId.trim();
    if (!trimmedStudentId) {
      setLockedItemTypes([]);
      setSubmittedValidity(initialSubmittedValidity());
      setExistingAttachments(initialAttachments());
      setTargetCheckin(null);
      return;
    }

    const timer = window.setTimeout(() => {
      getTodayCheckin(trimmedStudentId, checkinTarget === "makeup" ? MAKEUP_CHECKIN_DATE : undefined)
        .then((checkin) => {
          if (!checkin) {
            setLockedItemTypes([]);
            setSubmittedValidity(initialSubmittedValidity());
            setItems(initialItems());
            setExistingAttachments(initialAttachments());
            setTargetCheckin(null);
            return;
          }

          setTargetCheckin(checkin);
          const submittedTypes = checkin.items.map((item) => item.item_type);
          setLockedItemTypes(submittedTypes);
          setSubmittedValidity(validityFromItems(checkin.items));
          setItems((prev) => applyExistingCheckin(prev, checkin.items));
          setExistingAttachments(attachmentsFromItems(checkin.items));
        })
        .catch(() => {
          setLockedItemTypes([]);
          setSubmittedValidity(initialSubmittedValidity());
          setExistingAttachments(initialAttachments());
          setTargetCheckin(null);
        });

      getMyStats(trimmedStudentId)
        .then(setMyStats)
        .catch(() => setMyStats(null));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [checkinTarget, studentId]);

  useEffect(() => {
    setSuccess(null);
    setError("");
  }, [checkinTarget]);

  const selectedCount = useMemo(
    () => ITEM_META.filter((item) => items[item.type].selected).length,
    [items]
  );
  const todayCheckin = success?.checkin ?? targetCheckin ?? myStats?.latest_checkin ?? null;
  const targetLabel = checkinTarget === "makeup" ? "补打卡" : "今日";
  const makeupWindowOpen = isDateInRange(
    formatLocalDate(new Date()),
    MAKEUP_WINDOW_START,
    MAKEUP_WINDOW_END
  );
  const successHasEffectivePoints = (success?.checkin.base_points ?? 0) > 0;
  const earnedMorningBonus = Boolean(
    todayCheckin?.earned_morning_bonus && (todayCheckin?.base_points ?? 0) > 0
  );
  const firstValidTime = todayCheckin?.first_valid_at
    ? formatTime(todayCheckin.first_valid_at)
    : "暂无有效打卡";

  const setSelected = useCallback((type: CheckinItemType, selected: boolean) => {
    if (!selected && lockedItemTypes.includes(type)) {
      setError(`${targetLabel}已提交过该项目，可以修改完成量或继续上传新截图，不能取消该项目`);
      return;
    }
    setItems((prev) => ({
      ...prev,
      [type]: { ...prev[type], selected },
    }));
    setError("");
  }, [lockedItemTypes, targetLabel]);

  const setValue = useCallback((type: CheckinItemType, key: keyof ItemValues, value: string) => {
    setItems((prev) => ({
      ...prev,
      [type]: { ...prev[type], [key]: value },
    }));
  }, []);

  const handleFileChange = useCallback(
    (type: CheckinItemType, event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event.target.files) return;
      const selectedFiles = Array.from(event.target.files);
      setFiles((prev) => ({
        ...prev,
        [type]: [...prev[type], ...selectedFiles],
      }));
      event.target.value = "";
      setError("");
    },
    []
  );

  const removeFile = useCallback((type: CheckinItemType, fileKey: string) => {
    setFiles((prev) => ({
      ...prev,
      [type]: prev[type].filter((file) => `${file.name}-${file.lastModified}` !== fileKey),
    }));
  }, []);

  const handleViewAttachment = useCallback(
    async (attachment: CheckinAttachment) => {
      const trimmedStudentId = studentId.trim();
      if (!trimmedStudentId) {
        setError("请先填写学号");
        return;
      }
      try {
        const res = await getMyAttachmentDownloadUrl(
          attachment.id,
          trimmedStudentId,
          checkinTarget === "makeup" ? MAKEUP_CHECKIN_DATE : undefined
        );
        setPreviewUrl(res.download_url);
        setPreviewTitle(attachment.display_name || attachment.file_name || "打卡截图");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "附件打开失败");
      }
    },
    [checkinTarget, studentId]
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError("");
      setSuccess(null);

      if (!name.trim() || !studentId.trim()) {
        setError("请填写姓名和学号");
        return;
      }
      if (selectedCount === 0) {
        setError("请至少选择一个打卡项目");
        return;
      }

      const payload: Record<string, Record<string, string>> = {};
      for (const meta of ITEM_META) {
        const item = items[meta.type];
        if (!item.selected) continue;
        if (!lockedItemTypes.includes(meta.type) && files[meta.type].length === 0) {
          setError(`请为${meta.label}上传对应截图`);
          return;
        }
        payload[meta.type] = buildItemPayload(meta.type, item);
      }

      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("student_id", studentId.trim());
      formData.append("items_payload", JSON.stringify(payload));
      if (checkinTarget === "makeup") {
        formData.append("checkin_date", MAKEUP_CHECKIN_DATE);
      }

      for (const meta of ITEM_META) {
        for (const file of files[meta.type]) {
          formData.append("attachment_item_types", meta.type);
          formData.append("attachments", file);
        }
      }

      setLoading(true);
      try {
        const result = await submitForm(formData);
        setSuccess(result);
        setTargetCheckin(result.checkin);
        setFiles(initialFiles());
        const submittedTypes = result.checkin.items.map((item) => item.item_type);
        setLockedItemTypes(submittedTypes);
        setSubmittedValidity(validityFromItems(result.checkin.items));
        setItems((prev) => applyExistingCheckin(prev, result.checkin.items));
        setExistingAttachments(attachmentsFromItems(result.checkin.items));
        listPublicRankings()
          .then(setRankings)
          .catch(() => setRankings([]));
        getMyStats(studentId.trim())
          .then(setMyStats)
          .catch(() => setMyStats(null));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "提交失败");
      } finally {
        setLoading(false);
      }
    },
    [checkinTarget, files, items, lockedItemTypes, name, selectedCount, studentId]
  );

  return (
    <div className="w-full max-w-4xl bg-white border-gray-200 shadow-sm sm:rounded-lg sm:border">
      <div className="border-b border-gray-200 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-[1.7rem] font-semibold leading-tight text-gray-900 sm:text-2xl">
              晨光打卡
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              06:30-07:40 首次有效打卡可获得早起加分
            </p>
          </div>
          <div className="w-full md:w-64">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>{activity?.name ?? "活动进度"}</span>
              <span>
                第 {activity?.current_day ?? 0} / {activity?.duration_days ?? 21} 天
              </span>
            </div>
            <div className="mt-2 h-2 rounded-lg bg-gray-100">
              <div
                className="h-2 rounded-lg bg-emerald-500"
                style={{ width: `${activity?.progress_percent ?? 0}%` }}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-200"
          >
            <Megaphone size={16} />
            积分规则
          </button>
          <button
            type="button"
            onClick={() => setShowRankings(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-200"
          >
            <Trophy size={16} />
            查看排行榜
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 px-4 py-5 sm:px-6">
        {success && (
          <div
            className={`flex items-start gap-2 rounded-lg px-3 py-3 text-sm sm:px-4 ${
              successHasEffectivePoints
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-800"
            }`}
          >
            {successHasEffectivePoints ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span>
              {successHasEffectivePoints
                ? `已保存：基础 ${success.checkin.base_points} 分，早起加分 ${
                    success.checkin.earned_morning_bonus ? 1 : 0
                  } 分，${targetLabel}共 ${success.checkin.total_points} 分`
                : "已提交，但当前完成量未达到有效打卡要求，暂未加分。可修改完成量后重新保存。"}
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-3 text-sm text-red-700 sm:px-4">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="姓名">
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              placeholder="请输入姓名"
              required
            />
          </Field>
          <Field label="学号">
            <input
              type="text"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              placeholder="请输入学号"
              required
            />
          </Field>
        </div>

        <MyStatsCard stats={myStats} />

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">打卡日期</label>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setCheckinTarget("today")}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${
                checkinTarget === "today"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              今日打卡
            </button>
            {makeupWindowOpen && (
              <button
                type="button"
                onClick={() => setCheckinTarget("makeup")}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${
                  checkinTarget === "makeup"
                    ? "border-amber-500 bg-amber-50 text-amber-900"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                补打 2026-05-15
              </button>
            )}
          </div>
          {checkinTarget === "makeup" && (
            <p className="mt-2 text-xs leading-5 text-amber-700">
              2026-05-15 补打卡入口仅在 2026-05-16 至 2026-05-17 开放。
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">{targetLabel}项目</label>
            <span className="text-xs text-gray-500">已选 {selectedCount} 项</span>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
            <div
              className={`min-h-24 rounded-lg border px-3 py-2 text-left text-sm transition sm:min-h-0 ${
                earnedMorningBonus
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              <span className="flex items-center justify-between gap-2 font-medium">
                早起
                {earnedMorningBonus && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] text-emerald-700">
                    已计入
                  </span>
                )}
              </span>
              <span className="mt-1 block text-xs text-gray-500">
                最早有效：{firstValidTime}
              </span>
              <span className="mt-1 block text-xs text-gray-500">
                {earnedMorningBonus ? `${targetLabel}有早起加分` : `${targetLabel}暂无早起加分`}
              </span>
            </div>
            {ITEM_META.map((meta) => (
              <ProjectCard
                key={meta.type}
                meta={meta}
                selected={items[meta.type].selected}
                locked={lockedItemTypes.includes(meta.type)}
                valid={submittedValidity[meta.type]}
                onClick={() => setSelected(meta.type, !items[meta.type].selected)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {ITEM_META.map((meta) =>
            items[meta.type].selected ? (
              <ItemSection
                key={meta.type}
                meta={meta}
                values={items[meta.type]}
                files={files[meta.type]}
                existingAttachments={existingAttachments[meta.type]}
                onValueChange={setValue}
                onFileChange={handleFileChange}
                onRemoveFile={removeFile}
                onViewAttachment={handleViewAttachment}
              />
            ) : null
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-3 text-base font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send size={18} />
          {loading ? "提交中..." : checkinTarget === "makeup" ? "保存补打卡" : "保存今日打卡"}
        </button>
      </form>

      {showRules && <RulesModal activity={activity} onClose={() => setShowRules(false)} />}
      {showRankings && (
        <RankingsModal rankings={rankings} onClose={() => setShowRankings(false)} />
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

function ProjectCard({
  meta,
  selected,
  locked,
  valid,
  onClick,
}: {
  meta: (typeof ITEM_META)[number];
  selected: boolean;
  locked: boolean;
  valid: boolean;
  onClick: () => void;
}) {
  const lockedClass = valid
    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
    : "border-amber-300 bg-amber-50 text-amber-900";
  const selectedClass = "border-emerald-500 bg-emerald-50 text-emerald-800";
  const idleClass = "border-gray-200 bg-white text-gray-700 hover:border-gray-300";

  return (
    <button
      type="button"
      disabled={locked}
      onClick={onClick}
      className={`min-h-24 rounded-lg border px-3 py-2 text-left text-sm transition sm:min-h-0 ${
        locked ? lockedClass : selected ? selectedClass : idleClass
      } ${locked ? "cursor-not-allowed opacity-90" : ""}`}
    >
      <span className="flex items-center justify-between gap-2 font-medium">
        {meta.label}
        {locked && (
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] ${
              valid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
            }`}
          >
            {valid ? "已加分" : "未加分"}
          </span>
        )}
      </span>
      <span className="mt-1 block text-xs text-gray-500">{meta.target}</span>
    </button>
  );
}

function buildItemPayload(type: CheckinItemType, item: ItemValues): Record<string, string> {
  if (type === "listening") return { listening_questions: item.listening_questions };
  if (type === "reading") {
    return {
      reading_articles: item.reading_articles,
      reading_questions: item.reading_questions,
    };
  }
  if (type === "writing") return { writing_words: item.writing_words };
  if (type === "vocabulary") return { vocabulary_words: item.vocabulary_words };
  if (type === "speaking") {
    return {
      speaking_minutes: item.speaking_minutes,
      speaking_dialogue_sentences: item.speaking_dialogue_sentences,
    };
  }
  return {
    running_distance_km: item.running_distance_km,
    running_pace_min_per_km: item.running_pace_min_per_km,
  };
}

function applyExistingCheckin(
  current: Record<CheckinItemType, ItemValues>,
  existingItems: CheckinItem[]
): Record<CheckinItemType, ItemValues> {
  const next = { ...current };
  for (const item of existingItems) {
    next[item.item_type] = {
      ...next[item.item_type],
      selected: true,
      listening_questions: valueToString(item.listening_questions),
      reading_articles: valueToString(item.reading_articles),
      reading_questions: valueToString(item.reading_questions),
      writing_words: valueToString(item.writing_words),
      vocabulary_words: valueToString(item.vocabulary_words),
      speaking_minutes: valueToString(item.speaking_minutes),
      speaking_dialogue_sentences: valueToString(item.speaking_dialogue_sentences),
      running_distance_km: valueToString(item.running_distance_km),
      running_pace_min_per_km: valueToString(item.running_pace_min_per_km),
    };
  }
  return next;
}

function valueToString(value: number | null) {
  return value === null ? "" : String(value);
}

function formatLocalDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDateInRange(value: string, start: string, end: string) {
  return value >= start && value <= end;
}

function attachmentsFromItems(items: CheckinItem[]): Record<CheckinItemType, CheckinAttachment[]> {
  const next = initialAttachments();
  for (const item of items) {
    next[item.item_type] = item.attachments;
  }
  return next;
}

function initialSubmittedValidity(): Record<CheckinItemType, boolean> {
  return {
    listening: false,
    reading: false,
    writing: false,
    vocabulary: false,
    speaking: false,
    running: false,
  };
}

function validityFromItems(items: CheckinItem[]): Record<CheckinItemType, boolean> {
  const next = initialSubmittedValidity();
  for (const item of items) {
    next[item.item_type] = item.is_valid;
  }
  return next;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function ItemSection({
  meta,
  values,
  files,
  existingAttachments,
  onValueChange,
  onFileChange,
  onRemoveFile,
  onViewAttachment,
}: {
  meta: (typeof ITEM_META)[number];
  values: ItemValues;
  files: File[];
  existingAttachments: CheckinAttachment[];
  onValueChange: (type: CheckinItemType, key: keyof ItemValues, value: string) => void;
  onFileChange: (type: CheckinItemType, event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (type: CheckinItemType, fileKey: string) => void;
  onViewAttachment: (attachment: CheckinAttachment) => void;
}) {
  return (
    <section className="rounded-lg border border-gray-200 p-3 sm:p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{meta.label}</h2>
          <p className="mt-0.5 text-sm text-gray-500">{meta.target}</p>
        </div>
        {meta.type === "running" ? (
          <Moon className="shrink-0 text-sky-600" size={20} />
        ) : (
          <Sunrise className="shrink-0 text-amber-500" size={20} />
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {meta.type === "listening" && (
          <NumberInput
            label="听力小题数"
            value={values.listening_questions}
            onChange={(value) => onValueChange(meta.type, "listening_questions", value)}
          />
        )}
        {meta.type === "reading" && (
          <>
            <NumberInput
              label="阅读题数"
              value={values.reading_articles}
              onChange={(value) => onValueChange(meta.type, "reading_articles", value)}
            />
            <NumberInput
              label="阅读小题数"
              value={values.reading_questions}
              onChange={(value) => onValueChange(meta.type, "reading_questions", value)}
            />
          </>
        )}
        {meta.type === "writing" && (
          <NumberInput
            label="作文词数"
            value={values.writing_words}
            onChange={(value) => onValueChange(meta.type, "writing_words", value)}
          />
        )}
        {meta.type === "vocabulary" && (
          <NumberInput
            label="新学单词数"
            value={values.vocabulary_words}
            onChange={(value) => onValueChange(meta.type, "vocabulary_words", value)}
          />
        )}
        {meta.type === "speaking" && (
          <>
            <NumberInput
              label="口语练习分钟数"
              step="0.1"
              required={false}
              value={values.speaking_minutes}
              onChange={(value) => onValueChange(meta.type, "speaking_minutes", value)}
            />
            <NumberInput
              label="对话句数"
              required={false}
              value={values.speaking_dialogue_sentences}
              onChange={(value) => onValueChange(meta.type, "speaking_dialogue_sentences", value)}
            />
          </>
        )}
        {meta.type === "running" && (
          <>
            <NumberInput
              label="距离 km"
              step="0.01"
              value={values.running_distance_km}
              onChange={(value) => onValueChange(meta.type, "running_distance_km", value)}
            />
            <NumberInput
              label="配速 min/km"
              step="0.01"
              value={values.running_pace_min_per_km}
              onChange={(value) => onValueChange(meta.type, "running_pace_min_per_km", value)}
            />
          </>
        )}
      </div>

      <div className="mt-4">
        {existingAttachments.length > 0 && (
          <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2">
            <div className="mb-2 text-xs font-medium text-emerald-800">已提交截图</div>
            <div className="flex flex-wrap gap-2">
              {existingAttachments.map((attachment, index) => (
                <button
                  key={attachment.id}
                  type="button"
                  onClick={() => onViewAttachment(attachment)}
                  className="inline-flex max-w-full items-center gap-1 rounded bg-white px-2 py-1 text-xs text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                >
                  <Eye size={12} />
                  <span className="truncate">
                    {ITEM_META.find((item) => item.type === attachment.item_type)?.label}
                    {index + 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="flex min-h-24 cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-center hover:border-emerald-500 hover:bg-emerald-50">
          <div className="text-gray-500">
            <Image size={22} className="mx-auto mb-1" />
            <span className="text-sm">上传{meta.label}截图</span>
          </div>
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(event) => onFileChange(meta.type, event)}
          />
        </label>

        {files.length > 0 && (
          <div className="mt-3 space-y-2">
            {files.map((file) => {
              const fileKey = `${file.name}-${file.lastModified}`;
              return (
                <div
                  key={fileKey}
                  className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate text-gray-700">{file.name}</span>
                  <div className="flex shrink-0 items-center gap-1 text-gray-400 sm:gap-2">
                    <span>{formatSize(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveFile(meta.type, fileKey)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function MyStatsCard({ stats }: { stats: PublicUserStats | null }) {
  const cells = [
    ["总分", stats?.total_points ?? 0],
    ["基础分", stats?.base_points ?? 0],
    ["早起", stats?.morning_bonus_count ?? 0],
    ["连续天数", stats?.consecutive_days ?? 0],
    ["总打卡天数", stats?.valid_days ?? 0],
  ];

  return (
    <section className="rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4">
      <div className="mb-3 text-sm font-semibold text-gray-900">我的打卡数据</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {cells.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-white px-3 py-2">
            <div className="text-xs text-gray-500">{label}</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-xs leading-5 text-gray-500">
        听 {stats?.listening_count ?? 0} / 读 {stats?.reading_count ?? 0} / 写{" "}
        {stats?.writing_count ?? 0} / 词 {stats?.vocabulary_count ?? 0} / 口{" "}
        {stats?.speaking_count ?? 0} / 跑 {stats?.running_count ?? 0}
      </div>
    </section>
  );
}

function RulesModal({
  activity,
  onClose,
}: {
  activity: ActivitySettings | null;
  onClose: () => void;
}) {
  const checkinWindow =
    activity?.checkin_start_time && activity?.checkin_end_time
      ? `${activity.checkin_start_time} 至 ${activity.checkin_end_time}`
      : "06:00 至 04:00";

  return (
    <Modal title="活动公告与积分规则" onClose={onClose}>
      <ul className="list-disc space-y-3 pl-5 text-sm leading-6 text-gray-700">
        <li>当前打卡有效时间为 {checkinWindow}；若结束时间早于开始时间，则自动跨天计算。</li>
        <li>每天可提交听力、阅读、英语作文、背单词、口语、跑步六类项目，每个达标项目记 1 分。</li>
        <li>未达到打卡指标的项目可以保存提交记录，但不会有效加分。</li>
        <li>当天 06:30:00 至 07:40:00 内首次有效打卡可额外获得 1 分早起加分。</li>
        <li>每日最高 7 分，其中基础项目最高 6 分，早起加分最高 1 分。</li>
        <li>同一项目提交后不能取消，可以修改完成量，也可以继续追加新的截图。</li>
        <li>听力不少于 10 小题；阅读为 2 道阅读且不少于 10 小题；作文不少于 100 词。</li>
        <li>背单词需 App 新学 20 个以上；口语不少于 10 min 或不少于 15 句对话。</li>
        <li>跑步需 2 公里及以上，配速不慢于 10 min/km。</li>
      </ul>
    </Modal>
  );
}

function RankingsModal({ rankings, onClose }: { rankings: PublicRanking[]; onClose: () => void }) {
  const scoreRows = rankings.slice(0, 10);
  const dayRows = [...rankings]
    .sort(
      (a, b) =>
        b.valid_days - a.valid_days ||
        b.consecutive_days - a.consecutive_days ||
        b.total_points - a.total_points ||
        a.name.localeCompare(b.name, "zh-CN")
    )
    .slice(0, 10);

  return (
    <Modal title="排行榜" onClose={onClose} wide>
      <div className="grid gap-4 lg:grid-cols-2">
        <RankingPanel
          title="打卡分数排行榜"
          icon={<Trophy size={18} />}
          rows={scoreRows}
          primary={(row) => `${row.total_points} 分`}
        />
        <RankingPanel
          title="累计天数排行榜"
          icon={<CalendarCheck size={18} />}
          rows={dayRows}
          primary={(row) => `${row.valid_days} 天`}
        />
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

function RankingPanel({
  title,
  icon,
  rows,
  primary,
}: {
  title: string;
  icon: React.ReactNode;
  rows: PublicRanking[];
  primary: (row: PublicRanking) => string;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-gray-900">
        {icon}
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-lg bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
          暂无排行数据
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={`${title}-${row.name}-${index}`} className="rounded-lg bg-gray-50 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="mr-2 text-sm font-semibold text-gray-400">#{index + 1}</span>
                  <span className="font-medium text-gray-900">{row.name}</span>
                </div>
                <div className="shrink-0 text-sm font-semibold text-gray-900">{primary(row)}</div>
              </div>
              <div className="mt-1 text-xs leading-5 text-gray-500">
                总分 {row.total_points} / 基础 {row.base_points} / 早起 {row.morning_bonus_count}
                次 / 连续 {row.consecutive_days} 天 / 总打卡 {row.valid_days} 天
              </div>
              <div className="text-xs leading-5 text-gray-500">
                听 {row.listening_count} / 读 {row.reading_count} / 写 {row.writing_count} / 词{" "}
                {row.vocabulary_count} / 口 {row.speaking_count} / 跑 {row.running_count}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function NumberInput({
  label,
  value,
  step = "1",
  required = true,
  onChange,
}: {
  label: string;
  value: string;
  step?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        required={required}
      />
    </label>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
