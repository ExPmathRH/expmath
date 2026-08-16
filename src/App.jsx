import React, { useState, useEffect, useRef, useCallback } from "react";
import { loadKey, saveKey } from "./firebase.js";
import {
  Users, CalendarCheck, Video, Stethoscope, FolderOpen, Settings as SettingsIcon,
  LogOut, Plus, Trash2, Play, ChevronLeft, Link2, Check, X, Pencil, MessageSquare, Copy,
  ListChecks, BookOpen
} from "lucide-react";

/* ---------------------------------- 색/타이포 토큰 ---------------------------------- */
const COLORS = {
  bg: "#EEF2F6",
  surface: "#FFFFFF",
  ink: "#1B2A4A",
  ink2: "#33456B",
  teal: "#1F8A70",
  amber: "#D98C2B",
  coral: "#D64545",
  blue: "#3B6EA5",
  cyan: "#2E9BB0",
  muted: "#5B6472",
  border: "#DCE2E8",
};
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const SANS = "'Pretendard', -apple-system, 'Malgun Gothic', sans-serif";
const BRAND_NAME = "ExP 박래혁T 수학";
const ACADEMIES = [
  { id: "daechi-s", label: "대치에스", defaultAcademyLabel: "대치에스학원" },
  { id: "injaeuichang", label: "인재의 창", defaultAcademyLabel: "인재의창학원" },
];
const GRADES = ["25기", "24기", "23기"];
// 예전 고1/고2/고3 명칭으로 저장된 기존 데이터(대치에스)를 기수 명칭으로 옮기기 위한 매핑
const GRADE_MIGRATION = { 고1: "25기", 고2: "24기", 고3: "23기" };
const DEPARTMENTS = ["영어", "중어", "일어", "스어"];
const STATUS_OPTS = [
  { key: "출석", color: COLORS.teal },
  { key: "실시간 온라인 참여", color: COLORS.cyan },
  { key: "지각", color: COLORS.amber },
  { key: "현장수업 결석", color: COLORS.coral },
];

/* ---------------------------------- 유틸 ---------------------------------- */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
// toISOString()은 UTC로 변환되어 한국시간 자정~오전9시 사이에 날짜가 하루 밀리는 버그가 있어,
// 반드시 이 함수로 로컬 날짜 문자열을 만듭니다.
function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayStr() {
  return toLocalDateStr(new Date());
}
function formatSeconds(sec) {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function extractYoutubeId(input) {
  if (!input) return "";
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1);
    if (url.searchParams.get("v")) return url.searchParams.get("v");
    const parts = url.pathname.split("/").filter(Boolean);
    const embedIdx = parts.indexOf("embed");
    if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
    const shortsIdx = parts.indexOf("shorts");
    if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
  } catch (e) {}
  return trimmed;
}
function formatOnlinePeriods(periods) {
  const list = periods || [];
  return [1, 2, 3].map((p) => (list.includes(p) ? `${p}교시` : `${p}교시X`)).join("/");
}
function formatDateSlash(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return `${m}/${day}`;
}
function calcClinicStats(list, records) {
  const values = (list || [])
    .map((s) => records?.[s.name]?.correct)
    .filter((v) => v !== undefined && v !== "" && !isNaN(v))
    .map(Number);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const max = values.length ? Math.max(...values) : null;
  return { avg, max };
}
// 한 학생의 모든 테스트 회차를 모아 유형별/난이도별 정답률을 계산 (정답률 낮은 순으로 정렬)
function computeStudentAnalysis(grade, name, tests) {
  const byType = {};
  const byDifficulty = {};
  Object.entries(tests || {}).forEach(([k, session]) => {
    if (!k.startsWith(grade + "|")) return;
    const answers = session?.results?.[name]?.answers;
    if (!Array.isArray(answers)) return;
    (session.questions || []).forEach((q, idx) => {
      const got = answers[idx];
      if (got !== true && got !== false) return;
      const t = (q.type || "").trim() || "미분류";
      const d = (q.difficulty || "").trim() || "미분류";
      byType[t] = byType[t] || { correct: 0, total: 0 };
      byType[t].total++;
      if (got) byType[t].correct++;
      byDifficulty[d] = byDifficulty[d] || { correct: 0, total: 0 };
      byDifficulty[d].total++;
      if (got) byDifficulty[d].correct++;
    });
  });
  const toArr = (obj) =>
    Object.entries(obj)
      .map(([label, v]) => ({ label, correct: v.correct, total: v.total, rate: v.total ? Math.round((v.correct / v.total) * 100) : 0 }))
      .sort((a, b) => a.rate - b.rate);
  return { byType: toArr(byType), byDifficulty: toArr(byDifficulty) };
}
function formatKoreanArrivalTime(time) {
  if (!time) return "";
  const [hh, mm] = time.split(":");
  return `${parseInt(hh, 10)}시 ${mm}분 등원`;
}
function attendanceStatusText(rec) {
  if (!rec) return "미체크";
  const status = typeof rec === "string" ? rec : rec.status;
  if (status === "지각") {
    const t = typeof rec === "object" ? rec.arrivalTime : "";
    return t ? `지각(${formatKoreanArrivalTime(t)})` : "지각";
  }
  if (status === "실시간 온라인 참여") {
    const periods = (typeof rec === "object" && rec.onlinePeriods) || [1, 2, 3];
    if (periods.length >= 3) return "실시간 온라인 참여";
    if (periods.length === 0) return "실시간 온라인 참여(불참)";
    const sorted = [...periods].sort((a, b) => a - b);
    const maxP = sorted[sorted.length - 1];
    const isPrefix = sorted.length === maxP && sorted.every((p, i) => p === i + 1);
    return isPrefix ? `실시간 온라인 참여(${maxP}교시까지)` : `실시간 온라인 참여(${sorted.map((p) => p + "교시").join(",")})`;
  }
  return status; // 출석, 현장수업 결석 등은 그대로 표기
}
function enumerateDates(start, end) {
  if (!start || !end) return [];
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  if (isNaN(s) || isNaN(e) || s > e) return [];
  const days = [];
  let cur = new Date(s);
  let guard = 0;
  while (cur <= e && guard < 31) {
    days.push(toLocalDateStr(cur));
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return days;
}
// 문자 리포트 형식이 바뀔 수 있어 이 함수만 수정하면 전체 문자 형식이 바뀝니다.
function generateReportMessage({ academyLabel, teacherSignature, name, attendanceEntries, testTotal, correct, avg, max, homeworkBook, homeworkPrint, absent, lesson, homeworkAssignment, note }) {
  const attendanceLine = attendanceEntries.length
    ? attendanceEntries.map(({ date, rec }) => `${formatDateSlash(date)} (${attendanceStatusText(rec)})`).join(", ")
    : "기록 없음";
  const total = testTotal || "?";
  const isAbsentTest = correct === "미응시";
  const correctStr = isAbsentTest ? "미응시" : correct !== undefined && correct !== "" ? `${correct} / ${total}` : "미입력";
  const avgStr = avg !== null && avg !== undefined ? `${avg.toFixed(1)} / ${total}` : "미입력";
  const maxStr = max !== null && max !== undefined ? `${max} / ${total}` : "미입력";
  const testBlock = isAbsentTest
    ? `주간테스트 점수 : ${correctStr}`
    : `주간테스트 점수 : ${correctStr}\n주간테스트 반 평균 : ${avgStr}\n주간테스트 반 최고점 : ${maxStr}`;
  const bookStr = homeworkBook === "미제출" ? "미제출" : homeworkBook !== undefined && homeworkBook !== "" ? `${homeworkBook}%` : "미입력";
  const printStr = homeworkPrint === "미제출" ? "미제출" : homeworkPrint !== undefined && homeworkPrint !== "" ? `${homeworkPrint}%` : "미입력";
  const homeworkBlock = absent ? `숙제 완성도 : 결석` : `숙제 완성도\n책 : ${bookStr}\n프린트 : ${printStr}`;
  const hasClassInfo = (lesson && lesson.trim()) || (homeworkAssignment && homeworkAssignment.trim());
  const classBlock = hasClassInfo
    ? `\n\n이번주 수업 : ${lesson && lesson.trim() ? lesson.trim() : "미입력"}\n이번주 과제 : ${homeworkAssignment && homeworkAssignment.trim() ? homeworkAssignment.trim() : "미입력"}`
    : "";
  const noteBlock = note && note.trim() ? `\n\n${note.trim()}` : "";
  let msg = `<${academyLabel || "학원"} ${teacherSignature || "선생님"} 수업 Report>

학생 : ${name}

출석 : ${attendanceLine}

${testBlock}

${homeworkBlock}${classBlock}${noteBlock}

감사합니다.`;
  return msg;
}

/* ---------------------------------- storage 헬퍼 (Firebase Firestore 사용) ---------------------------------- */
// 대치에스는 기존에 쓰던 키를 그대로 사용(데이터 보존), 새 학원은 별도 키 사용
function storageKey(base, academyId) {
  return academyId === "daechi-s" ? base : `${base}__${academyId}`;
}
// 대치에스에 예전 고1/고2/고3 명칭으로 저장된 데이터를 25기/24기/23기로 옮김 (변경 없으면 changed:false)
function migrateLegacyGrades({ roster, videos, watchLogs, attendance, clinics, materials }) {
  let changed = false;
  const newRoster = {};
  Object.entries(roster || {}).forEach(([k, v]) => {
    const nk = GRADE_MIGRATION[k] || k;
    if (nk !== k) changed = true;
    newRoster[nk] = v;
  });
  const remapArr = (arr) =>
    (arr || []).map((item) => {
      if (item.grade && GRADE_MIGRATION[item.grade]) {
        changed = true;
        return { ...item, grade: GRADE_MIGRATION[item.grade] };
      }
      return item;
    });
  const remapPrefixed = (obj) => {
    const out = {};
    Object.entries(obj || {}).forEach(([k, v]) => {
      const idx = k.indexOf("|");
      if (idx === -1) { out[k] = v; return; }
      const gradePart = k.slice(0, idx);
      const rest = k.slice(idx);
      if (GRADE_MIGRATION[gradePart]) {
        changed = true;
        out[GRADE_MIGRATION[gradePart] + rest] = v;
      } else out[k] = v;
    });
    return out;
  };
  const newWatchLogs = {};
  Object.entries(watchLogs || {}).forEach(([k, v]) => {
    const parts = k.split("|");
    if (parts.length >= 2 && GRADE_MIGRATION[parts[1]]) {
      changed = true;
      parts[1] = GRADE_MIGRATION[parts[1]];
      newWatchLogs[parts.join("|")] = v;
    } else newWatchLogs[k] = v;
  });
  return {
    changed,
    roster: newRoster,
    videos: remapArr(videos),
    watchLogs: newWatchLogs,
    attendance: remapPrefixed(attendance),
    clinics: remapPrefixed(clinics),
    materials: remapArr(materials),
  };
}

/* ---------------------------------- 작은 UI 조각 ---------------------------------- */
function ProgressRing({ percent, size = 46, stroke = 5 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const p = Math.min(100, Math.max(0, percent || 0));
  const offset = circumference - (p / 100) * circumference;
  const color = p >= 90 ? COLORS.teal : p >= 50 ? COLORS.amber : COLORS.coral;
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} stroke={COLORS.border} strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.4s" }}
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.32em" fontSize={size * 0.3} fontFamily={MONO} fill={COLORS.ink} fontWeight="600">
        {Math.round(p)}
      </text>
    </svg>
  );
}

function Chip({ active, color, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-2.5 py-1.5 rounded-full font-medium transition"
      style={{
        background: active ? color : COLORS.bg,
        color: active ? "#fff" : COLORS.muted,
        border: `1px solid ${active ? color : COLORS.border}`,
      }}
    >
      {children}
    </button>
  );
}

// 숫자 입력 또는 특수 상태값(미제출/결석/미응시 등)을 함께 다루는 클리닉 입력 필드
function ClinicFieldInput({ value, onChange, specials, unit, width = "w-14", max }) {
  const isSpecial = specials.includes(value);
  const specialColor = (label) => (label === "결석" ? COLORS.coral : COLORS.amber);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {!isSpecial && (
        <>
          <input
            type="number" min="0" max={max} value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={`${width} px-2 py-1 rounded-lg text-sm outline-none`}
            style={{ border: `1px solid ${COLORS.border}`, fontFamily: MONO }}
          />
          {unit && <span className="text-xs" style={{ color: COLORS.muted }}>{unit}</span>}
        </>
      )}
      {specials.map((sp) => (
        <Chip key={sp} active={value === sp} color={specialColor(sp)} onClick={() => onChange(value === sp ? "" : sp)}>
          {sp}
        </Chip>
      ))}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="text-center py-10 text-sm" style={{ color: COLORS.muted }}>
      {text}
    </div>
  );
}

/* ---------------------------------- 유튜브 재생 트래킹 ----------------------------------
   실제 웹사이트에서는 외부 스크립트 로딩 제한이 없으므로 공식 유튜브 IFrame Player API를 사용합니다.
   시청률은 '도달한 재생바 위치'가 아니라 '실제로 재생 상태였던 누적 시간'(배속 반영)을 기준으로
   계산하여, 재생바를 끝으로 당기기만 하는 방식으로는 시청률이 채워지지 않도록 합니다.
------------------------------------------------------------------------------- */
function useYoutubeApiReady() {
  const [ready, setReady] = useState(!!(window.YT && window.YT.Player));
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setReady(true);
      return;
    }
    if (!document.getElementById("yt-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      setReady(true);
    };
    const interval = setInterval(() => {
      if (window.YT && window.YT.Player) {
        setReady(true);
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);
  return ready;
}

function VideoPlayer({ video, onSave }) {
  const ytReady = useYoutubeApiReady();
  const containerId = `ytplayer-${video.id}`;
  const playerRef = useRef(null);
  const watchedSecondsRef = useRef(0); // 실제 재생 상태였던 시간만 누적 (배속 반영) — 재생바 이동으로는 안 늘어남
  const durationRef = useRef(0);
  const intervalRef = useRef(null);
  const lastTickRef = useRef(null);
  const lastSaveRef = useRef(0);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const [localPercent, setLocalPercent] = useState(0);

  const doSave = useCallback((force) => {
    const now = Date.now();
    if (!force && now - lastSaveRef.current < 8000) return;
    lastSaveRef.current = now;
    const dur = durationRef.current;
    const percent = dur ? Math.min(100, (watchedSecondsRef.current / dur) * 100) : 0;
    onSaveRef.current({ percent, watchedSeconds: Math.round(watchedSecondsRef.current), duration: Math.round(dur) });
  }, []);

  const tick = useCallback(() => {
    if (!playerRef.current || !lastTickRef.current) return;
    const now = Date.now();
    const rate = (typeof playerRef.current.getPlaybackRate === "function" && playerRef.current.getPlaybackRate()) || 1;
    const deltaSec = (now - lastTickRef.current) / 1000;
    lastTickRef.current = now;
    const safeDelta = Math.min(Math.max(deltaSec, 0), 5); // 탭이 백그라운드에 있다 돌아온 경우 등 큰 튐 방지
    watchedSecondsRef.current += safeDelta * rate;
    const dur = playerRef.current.getDuration() || durationRef.current;
    durationRef.current = dur;
    setLocalPercent(dur ? Math.min(100, (watchedSecondsRef.current / dur) * 100) : 0);
    doSave(false);
  }, [doSave]);

  useEffect(() => {
    if (!ytReady) return;
    playerRef.current = new window.YT.Player(containerId, {
      videoId: video.youtubeId,
      playerVars: { rel: 0 },
      events: {
        onReady: (e) => {
          durationRef.current = e.target.getDuration();
        },
        onStateChange: (e) => {
          const PS = window.YT.PlayerState;
          if (e.data === PS.PLAYING) {
            lastTickRef.current = Date.now();
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(tick, 1000);
          } else {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            if (lastTickRef.current) {
              tick();
              lastTickRef.current = null;
            }
            doSave(true);
          }
        },
      },
    });
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      doSave(true);
      if (playerRef.current && playerRef.current.destroy) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytReady, video.id]);

  return (
    <div>
      <div id={containerId} className="w-full aspect-video rounded-lg overflow-hidden bg-black" />
      <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: COLORS.muted }}>
        <span>재생바를 건너뛰어도 실제로 재생된 시간만큼만 시청률에 반영됩니다</span>
        <span className="ml-auto font-semibold" style={{ fontFamily: MONO, color: COLORS.ink }}>
          {Math.round(localPercent)}%
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------- 헤더 ---------------------------------- */
function Header({ academyLabel, role, studentSession, onLogout }) {
  return (
    <div
      className="px-4 sm:px-6 flex items-center gap-3"
      style={{
        background: `${COLORS.ink} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M40 0H0v40' fill='none' stroke='%232A3C5F' stroke-width='1'/%3E%3C/svg%3E")`,
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "1rem",
      }}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden shrink-0" style={{ background: "#fff" }}>
        <img src="/logo-mark.png" alt="로고" className="w-full h-full object-contain p-0.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-base leading-tight truncate">{BRAND_NAME}</p>
        <p className="text-xs leading-tight truncate" style={{ color: "#9DAFC9" }}>
          {academyLabel ? `${academyLabel} · ` : ""}
          {role === "teacher" ? "선생님 모드" : role === "student" ? `${studentSession?.grade} · ${studentSession?.name}` : role === "parent" ? `${studentSession?.name} 학부모님` : "학생 관리"}
        </p>
      </div>
      {role && (
        <button onClick={onLogout} className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg shrink-0" style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}>
          <LogOut size={14} /> 나가기
        </button>
      )}
    </div>
  );
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto px-3 sm:px-6 py-2 border-b" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap shrink-0"
          style={{
            background: active === t.key ? COLORS.ink : "transparent",
            color: active === t.key ? "#fff" : COLORS.muted,
          }}
        >
          <t.icon size={15} /> {t.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------- 랜딩 / 로그인 ---------------------------------- */
function AcademySelectScreen({ onSelect }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5 overflow-hidden" style={{ background: "#fff", border: `1px solid ${COLORS.border}` }}>
        <img src="/logo-mark.png" alt="로고" className="w-full h-full object-contain p-2" />
      </div>
      <h1 className="text-2xl font-bold" style={{ color: COLORS.ink, fontFamily: SANS }}>{BRAND_NAME}</h1>
      <p className="text-sm mt-2 mb-10" style={{ color: COLORS.muted }}>어느 학원으로 들어가시나요?</p>
      <div className="w-full max-w-xs space-y-3">
        {ACADEMIES.map((a) => (
          <button
            key={a.id}
            onClick={() => onSelect(a.id)}
            className="w-full py-4 rounded-xl font-semibold"
            style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.border}` }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LandingScreen({ academyLabel, onSelectRole, onChangeAcademy, isStaffMode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5 overflow-hidden" style={{ background: "#fff", border: `1px solid ${COLORS.border}` }}>
        <img src="/logo-mark.png" alt="로고" className="w-full h-full object-contain p-2" />
      </div>
      <h1 className="text-2xl font-bold" style={{ color: COLORS.ink, fontFamily: SANS }}>
        {BRAND_NAME}
      </h1>
      <p className="text-sm font-semibold mt-1" style={{ color: COLORS.teal }}>{academyLabel}</p>
      <p className="text-sm mt-2 mb-10" style={{ color: COLORS.muted }}>
        출결 · 영상 시청 · 클리닉 · 자료를 한 곳에서
      </p>
      <div className="w-full max-w-xs space-y-3">
        {isStaffMode && (
          <button
            onClick={() => onSelectRole("teacher")}
            className="w-full py-4 rounded-xl font-semibold text-white"
            style={{ background: COLORS.ink }}
          >
            선생님으로 입장
          </button>
        )}
        <button
          onClick={() => onSelectRole("student")}
          className="w-full py-4 rounded-xl font-semibold"
          style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.border}` }}
        >
          학생으로 입장
        </button>
        <button
          onClick={() => onSelectRole("parent")}
          className="w-full py-4 rounded-xl font-semibold"
          style={{ background: COLORS.surface, color: COLORS.ink, border: `1.5px solid ${COLORS.border}` }}
        >
          학부모로 입장
        </button>
      </div>
      {isStaffMode && (
        <button onClick={onChangeAcademy} className="mt-8 text-xs underline" style={{ color: COLORS.muted }}>
          다른 학원 선택하기
        </button>
      )}
    </div>
  );
}

function TeacherPinGate({ settings, onSuccess, onBack }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const submit = () => {
    if (pin === (settings.teacherPin || "0000")) {
      onSuccess();
    } else {
      setError("코드가 올바르지 않습니다");
    }
  };
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <button onClick={onBack} className="self-start flex items-center gap-1 text-sm mb-8" style={{ color: COLORS.muted }}>
        <ChevronLeft size={16} /> 뒤로
      </button>
      <p className="text-sm mb-3" style={{ color: COLORS.muted }}>관리자 코드를 입력하세요</p>
      <input
        type="password"
        value={pin}
        onChange={(e) => { setPin(e.target.value); setError(""); }}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="w-40 text-center text-xl tracking-[0.3em] py-3 rounded-xl outline-none mb-2"
        style={{ border: `1.5px solid ${COLORS.border}`, fontFamily: MONO }}
        maxLength={8}
        autoFocus
      />
      {error && <p className="text-xs mb-2" style={{ color: COLORS.coral }}>{error}</p>}
      <p className="text-xs mb-6" style={{ color: COLORS.muted }}>기본 코드: 0000 (설정 탭에서 변경 가능)</p>
      <button onClick={submit} className="px-8 py-3 rounded-xl font-semibold text-white" style={{ background: COLORS.ink }}>
        입장하기
      </button>
    </div>
  );
}

function StudentLoginFlow({ roster, onLogin, onBack }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    const uInput = username.trim();
    const pInput = password.trim();
    if (!uInput || !pInput) {
      setError("아이디와 비밀번호를 입력해주세요");
      return;
    }
    for (const grade of GRADES) {
      const found = (roster[grade] || []).find(
        (s) => (s.username || s.name).trim() === uInput && (s.password || "").trim() === pInput
      );
      if (found) {
        onLogin({ grade, name: found.name });
        return;
      }
    }
    setError("아이디 또는 비밀번호가 올바르지 않습니다");
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <button onClick={onBack} className="self-start flex items-center gap-1 text-sm mb-8" style={{ color: COLORS.muted }}>
        <ChevronLeft size={16} /> 뒤로
      </button>
      <p className="text-sm mb-4" style={{ color: COLORS.muted }}>아이디와 비밀번호를 입력하세요</p>
      <div className="w-full max-w-xs space-y-3">
        <input
          value={username}
          onChange={(e) => { setUsername(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="아이디"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none"
          style={{ border: `1.5px solid ${COLORS.border}` }}
          autoFocus
        />
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="비밀번호"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none"
          style={{ border: `1.5px solid ${COLORS.border}` }}
        />
        {error && <p className="text-xs" style={{ color: COLORS.coral }}>{error}</p>}
        <button onClick={submit} className="w-full py-3 rounded-xl font-semibold text-white" style={{ background: COLORS.ink }}>
          로그인
        </button>
      </div>
      <p className="text-xs mt-6" style={{ color: COLORS.muted }}>아이디·비밀번호를 모르면 선생님께 문의해주세요.</p>
    </div>
  );
}

function ParentLoginFlow({ roster, onLogin, onBack }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    const uInput = username.trim();
    const pInput = password.trim();
    if (!uInput || !pInput) {
      setError("아이디와 비밀번호를 입력해주세요");
      return;
    }
    for (const grade of GRADES) {
      const found = (roster[grade] || []).find(
        (s) => (s.username || s.name).trim() === uInput && (s.parentPassword || "").trim() === pInput
      );
      if (found) {
        onLogin({ grade, name: found.name });
        return;
      }
    }
    setError("아이디 또는 비밀번호가 올바르지 않습니다");
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <button onClick={onBack} className="self-start flex items-center gap-1 text-sm mb-8" style={{ color: COLORS.muted }}>
        <ChevronLeft size={16} /> 뒤로
      </button>
      <p className="text-sm mb-4" style={{ color: COLORS.muted }}>자녀의 아이디와 학부모 비밀번호를 입력하세요</p>
      <div className="w-full max-w-xs space-y-3">
        <input
          value={username}
          onChange={(e) => { setUsername(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="자녀 아이디"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none"
          style={{ border: `1.5px solid ${COLORS.border}` }}
          autoFocus
        />
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="학부모 비밀번호"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none"
          style={{ border: `1.5px solid ${COLORS.border}` }}
        />
        {error && <p className="text-xs" style={{ color: COLORS.coral }}>{error}</p>}
        <button onClick={submit} className="w-full py-3 rounded-xl font-semibold text-white" style={{ background: COLORS.ink }}>
          로그인
        </button>
      </div>
      <p className="text-xs mt-6" style={{ color: COLORS.muted }}>아이디·비밀번호를 모르면 선생님께 문의해주세요.</p>
    </div>
  );
}

/* ---------------------------------- 선생님: 학생 관리 ---------------------------------- */
function RosterView({ roster, onUpdate }) {
  const [inputs, setInputs] = useState({ "25기": "", "24기": "", "23기": "" });
  const [expanded, setExpanded] = useState(null); // 열려있는 학생 id
  const byName = (a, b) => a.name.localeCompare(b.name, "ko");
  const addStudent = (grade) => {
    const name = inputs[grade].trim();
    if (!name) return;
    const password = String(Math.floor(1000 + Math.random() * 9000));
    const next = [...(roster[grade] || []), { id: uid(), name, username: name, password }].sort(byName);
    onUpdate({ ...roster, [grade]: next });
    setInputs({ ...inputs, [grade]: "" });
  };
  const removeStudent = (grade, id) => {
    onUpdate({ ...roster, [grade]: roster[grade].filter((s) => s.id !== id) });
  };
  const updateStudentField = (grade, id, field, value) => {
    onUpdate({ ...roster, [grade]: roster[grade].map((s) => (s.id === id ? { ...s, [field]: value } : s)) });
  };
  const genPassword = (grade, id) => {
    updateStudentField(grade, id, "password", String(Math.floor(1000 + Math.random() * 9000)));
  };
  const genParentPassword = (grade, id) => {
    updateStudentField(grade, id, "parentPassword", String(Math.floor(1000 + Math.random() * 9000)));
  };
  const fillMissingPasswords = (grade) => {
    const next = (roster[grade] || []).map((s) => ({
      ...s,
      username: s.username || s.name,
      password: s.password || String(Math.floor(1000 + Math.random() * 9000)),
      parentPassword: s.parentPassword || String(Math.floor(1000 + Math.random() * 9000)),
    }));
    onUpdate({ ...roster, [grade]: next });
  };
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {GRADES.map((grade) => (
        <div key={grade} className="rounded-xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-lg" style={{ color: COLORS.ink }}>{grade}</h3>
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: COLORS.bg, color: COLORS.muted, fontFamily: MONO }}>
              {(roster[grade] || []).length}명
            </span>
          </div>
          <div className="flex gap-2 mb-3">
            <input
              value={inputs[grade]}
              onChange={(e) => setInputs({ ...inputs, [grade]: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && addStudent(grade)}
              placeholder="이름 입력 후 Enter"
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none min-w-0"
              style={{ border: `1px solid ${COLORS.border}` }}
            />
            <button onClick={() => addStudent(grade)} className="px-3 rounded-lg shrink-0" style={{ background: COLORS.ink, color: "#fff" }}>
              <Plus size={16} />
            </button>
          </div>
          {(roster[grade] || []).some((s) => !s.password || !s.parentPassword) && (
            <button onClick={() => fillMissingPasswords(grade)} className="w-full mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: "#EAF6F2", color: COLORS.teal }}>
              비밀번호(학생/학부모) 없는 학생에게 자동으로 만들어주기
            </button>
          )}
          <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
            {(roster[grade] || []).length === 0 && <EmptyState text="등록된 학생이 없습니다" />}
            {[...(roster[grade] || [])].sort(byName).map((s) => {
              const isOpen = expanded === s.id;
              return (
                <div key={s.id} className="rounded-lg overflow-hidden" style={{ background: COLORS.bg }}>
                  <div className="flex items-center justify-between px-3 py-2 cursor-pointer" onClick={() => setExpanded(isOpen ? null : s.id)}>
                    <span className="text-sm" style={{ color: COLORS.ink }}>
                      {s.name}
                      {s.department && <span className="ml-1.5 text-xs" style={{ color: COLORS.muted }}>({s.department})</span>}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); removeStudent(grade, s.id); }} style={{ color: COLORS.coral }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-2" style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: 2 }}>
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {DEPARTMENTS.map((d) => (
                          <Chip key={d} active={s.department === d} color={COLORS.ink} onClick={() => updateStudentField(grade, s.id, "department", s.department === d ? "" : d)}>
                            {d}
                          </Chip>
                        ))}
                      </div>
                      <input
                        placeholder="학교명 (예: 고양외고, 선택)" value={s.school || ""} onChange={(e) => updateStudentField(grade, s.id, "school", e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.border}` }}
                      />
                      <input
                        placeholder="학생 전화번호" value={s.phone || ""} onChange={(e) => updateStudentField(grade, s.id, "phone", e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.border}`, fontFamily: MONO }}
                      />
                      <input
                        placeholder="학부모 전화번호" value={s.parentPhone || ""} onChange={(e) => updateStudentField(grade, s.id, "parentPhone", e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.border}`, fontFamily: MONO }}
                      />
                      <div className="pt-1 mt-1" style={{ borderTop: `1px dashed ${COLORS.border}` }}>
                        <p className="text-xs pt-2 pb-1" style={{ color: COLORS.muted }}>로그인 아이디·비밀번호 (학생에게 알려주세요)</p>
                        <div className="flex gap-1.5">
                          <input
                            placeholder="아이디" value={s.username || ""} onChange={(e) => updateStudentField(grade, s.id, "username", e.target.value)}
                            className="flex-1 min-w-0 px-3 py-1.5 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.border}`, fontFamily: MONO }}
                          />
                          <input
                            placeholder="비밀번호" value={s.password || ""} onChange={(e) => updateStudentField(grade, s.id, "password", e.target.value)}
                            className="flex-1 min-w-0 px-3 py-1.5 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.border}`, fontFamily: MONO }}
                          />
                          <button onClick={() => genPassword(grade, s.id)} className="text-xs px-2.5 rounded-lg shrink-0" style={{ background: COLORS.bg, color: COLORS.ink, border: `1px solid ${COLORS.border}` }}>
                            생성
                          </button>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs pt-1 pb-1" style={{ color: COLORS.muted }}>학부모 리포트 비밀번호 (아이디는 학생과 동일, 학부모께 알려주세요)</p>
                        <div className="flex gap-1.5">
                          <input
                            placeholder="학부모 비밀번호" value={s.parentPassword || ""} onChange={(e) => updateStudentField(grade, s.id, "parentPassword", e.target.value)}
                            className="flex-1 min-w-0 px-3 py-1.5 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.border}`, fontFamily: MONO }}
                          />
                          <button onClick={() => genParentPassword(grade, s.id)} className="text-xs px-2.5 rounded-lg shrink-0" style={{ background: COLORS.bg, color: COLORS.ink, border: `1px solid ${COLORS.border}` }}>
                            생성
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------- 선생님: 출결 관리 ---------------------------------- */
function MonthlyAttendanceCalendar({ grade, name, attendance }) {
  const [monthStr, setMonthStr] = useState(() => todayStr().slice(0, 7)); // "2026-08"
  const [year, month] = monthStr.split("-").map(Number);

  const getStatus = (day) => {
    if (!day) return null;
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const rec = attendance[`${grade}|${dateStr}`]?.[name];
    if (!rec) return null;
    return typeof rec === "string" ? rec : rec.status;
  };
  const changeMonth = (delta) => {
    const d = new Date(year, month - 1 + delta, 1);
    setMonthStr(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const startWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const counts = {};
  cells.filter(Boolean).forEach((d) => {
    const s = getStatus(d);
    if (s) counts[s] = (counts[s] || 0) + 1;
  });
  const isToday = (d) => d && `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}` === todayStr();

  return (
    <div className="px-3 pb-3 pt-2 max-w-xs">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => changeMonth(-1)} className="text-xs px-2 py-1 rounded-lg font-bold" style={{ background: COLORS.bg, color: COLORS.muted }}>‹</button>
        <span className="text-xs font-semibold" style={{ color: COLORS.ink, fontFamily: MONO }}>{year}년 {month}월</span>
        <button onClick={() => changeMonth(1)} className="text-xs px-2 py-1 rounded-lg font-bold" style={{ background: COLORS.bg, color: COLORS.muted }}>›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <div key={d} className="text-center text-[10px]" style={{ color: COLORS.muted }}>{d}</div>
        ))}
        {cells.map((day, idx) => {
          const status = getStatus(day);
          const opt = STATUS_OPTS.find((o) => o.key === status);
          return (
            <div
              key={idx}
              className="aspect-square flex items-center justify-center rounded-md text-[11px]"
              style={{
                background: opt ? opt.color : "transparent",
                color: opt ? "#fff" : day ? COLORS.muted : "transparent",
                fontFamily: MONO,
                boxShadow: isToday(day) ? `inset 0 0 0 1.5px ${COLORS.ink}` : "none",
              }}
            >
              {day || ""}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {STATUS_OPTS.map((opt) => (
          <span key={opt.key} className="flex items-center gap-1 text-[10px]" style={{ color: COLORS.muted }}>
            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: opt.color }} />
            {opt.key} {counts[opt.key] || 0}
          </span>
        ))}
      </div>
    </div>
  );
}

function TeacherAttendanceView({ roster, attendance, videos, watchLogs, onUpdate }) {
  const [grade, setGrade] = useState("25기");
  const [date, setDate] = useState(todayStr());
  const [expandedStudent, setExpandedStudent] = useState(null);
  const key = `${grade}|${date}`;
  const [local, setLocal] = useState(attendance[key] || {});

  useEffect(() => {
    setLocal(attendance[key] || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, date]);

  const setStatus = (name, status) => {
    setLocal((prev) => {
      const cur = prev[name];
      const curStatus = typeof cur === "string" ? cur : cur?.status;
      if (curStatus === status) {
        const next = { ...prev };
        delete next[name];
        return next;
      }
      const rec = { status };
      if (status === "지각") rec.arrivalTime = (typeof cur === "object" && cur?.arrivalTime) || "";
      if (status === "실시간 온라인 참여") rec.onlinePeriods = (typeof cur === "object" && cur?.onlinePeriods) || [1, 2, 3];
      if (status === "현장수업 결석") {
        const mVideo = videos.find((v) => v.grade === grade && v.date === date);
        const wl = mVideo ? watchLogs[`${mVideo.id}|${grade}|${name}`] : null;
        rec.makeupWatched = (typeof cur === "object" && cur?.makeupWatched) || !!wl;
        rec.makeupPercent = (typeof cur === "object" && cur?.makeupPercent) || (wl ? Math.round(wl.percent) : "");
      }
      return { ...prev, [name]: rec };
    });
  };
  const setArrivalTime = (name, time) => {
    setLocal((prev) => ({ ...prev, [name]: { ...prev[name], arrivalTime: time } }));
  };
  const togglePeriod = (name, period) => {
    setLocal((prev) => {
      const rec = prev[name];
      if (!rec) return prev;
      const periods = rec.onlinePeriods || [1, 2, 3];
      const next = periods.includes(period) ? periods.filter((p) => p !== period) : [...periods, period].sort();
      return { ...prev, [name]: { ...rec, onlinePeriods: next } };
    });
  };
  const setMakeup = (name, field, value) => {
    setLocal((prev) => ({ ...prev, [name]: { ...prev[name], [field]: value } }));
  };
  const [saved, setSaved] = useState(false);
  const save = () => {
    onUpdate({ ...attendance, [key]: local });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  const history = Object.keys(attendance)
    .filter((k) => k.startsWith(grade + "|"))
    .map((k) => k.split("|")[1])
    .sort((a, b) => (a < b ? 1 : -1))
    .slice(0, 10);

  const matchingVideo = videos.find((v) => v.grade === grade && v.date === date);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {GRADES.map((g) => (
          <Chip key={g} active={grade === g} color={COLORS.ink} onClick={() => setGrade(g)}>{g}</Chip>
        ))}
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-1.5 rounded-lg text-sm outline-none ml-auto" style={{ border: `1px solid ${COLORS.border}`, fontFamily: MONO }} />
      </div>

      <button
        onClick={save}
        className="px-6 py-2.5 rounded-xl font-semibold text-white flex items-center gap-1.5 transition-transform"
        style={{ background: saved ? COLORS.ink : COLORS.teal, transform: saved ? "scale(1.04)" : "scale(1)" }}
      >
        {saved ? <Check size={16} /> : null} {saved ? "저장되었습니다" : "저장하기"}
      </button>

      {matchingVideo && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "#EAF6F2", color: COLORS.teal }}>
          이 날짜에 등록된 영상이 있습니다: {matchingVideo.title} — 시청률을 참고해 출결을 체크하세요
        </p>
      )}

      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
        {(roster[grade] || []).length === 0 ? (
          <div className="bg-white"><EmptyState text="학생 관리 탭에서 먼저 학생을 등록해주세요" /></div>
        ) : (
          (roster[grade] || []).map((s, i) => {
            const wl = matchingVideo ? watchLogs[`${matchingVideo.id}|${grade}|${s.name}`] : null;
            const rec = local[s.name];
            const curStatus = typeof rec === "string" ? rec : rec?.status;
            return (
              <div key={s.id} className="flex flex-col gap-2 px-4 py-3" style={{ background: i % 2 === 0 ? COLORS.surface : COLORS.bg }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setExpandedStudent(expandedStudent === s.id ? null : s.id)}
                    className="text-sm font-medium w-16 shrink-0 text-left underline decoration-dotted"
                    style={{ color: COLORS.ink }}
                  >
                    {s.name}
                  </button>
                  {wl && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#EAF6F2", color: COLORS.teal, fontFamily: MONO }}>
                      시청 {Math.round(wl.percent)}%
                    </span>
                  )}
                  <div className="flex gap-1.5 ml-auto flex-wrap">
                    {STATUS_OPTS.map((opt) => (
                      <Chip key={opt.key} active={curStatus === opt.key} color={opt.color} onClick={() => setStatus(s.name, opt.key)}>
                        {opt.key}
                      </Chip>
                    ))}
                  </div>
                </div>

                {expandedStudent === s.id && (
                  <div className="rounded-lg" style={{ background: COLORS.bg }}>
                    <MonthlyAttendanceCalendar grade={grade} name={s.name} attendance={attendance} />
                  </div>
                )}

                {curStatus === "지각" && (
                  <div className="flex items-center gap-2 pl-16 flex-wrap">
                    <span className="text-xs" style={{ color: COLORS.muted }}>등원 시간</span>
                    <input
                      type="time"
                      value={rec?.arrivalTime || ""}
                      onChange={(e) => setArrivalTime(s.name, e.target.value)}
                      className="px-2 py-1 rounded-lg text-xs outline-none"
                      style={{ border: `1px solid ${COLORS.border}`, fontFamily: MONO }}
                    />
                  </div>
                )}

                {curStatus === "실시간 온라인 참여" && (
                  <div className="flex items-center gap-1.5 pl-16 flex-wrap">
                    <span className="text-xs" style={{ color: COLORS.muted }}>참여 교시</span>
                    {[1, 2, 3].map((p) => (
                      <Chip key={p} active={(rec.onlinePeriods || [1, 2, 3]).includes(p)} color={COLORS.cyan} onClick={() => togglePeriod(s.name, p)}>
                        {p}교시
                      </Chip>
                    ))}
                  </div>
                )}

                {curStatus === "현장수업 결석" && (
                  <div className="flex items-center gap-2 pl-16 flex-wrap">
                    <Chip active={!!rec.makeupWatched} color={COLORS.blue} onClick={() => setMakeup(s.name, "makeupWatched", !rec.makeupWatched)}>
                      영상 시청 {rec.makeupWatched ? "함" : "안함"}
                    </Chip>
                    <span className="text-xs" style={{ color: COLORS.muted }}>진도율</span>
                    <input
                      type="number" min="0" max="100" value={rec.makeupPercent ?? ""}
                      onChange={(e) => setMakeup(s.name, "makeupPercent", e.target.value)}
                      className="w-16 px-2 py-1 rounded-lg text-xs outline-none" placeholder="%"
                      style={{ border: `1px solid ${COLORS.border}`, fontFamily: MONO }}
                    />
                    <span className="text-xs" style={{ color: COLORS.muted }}>%</span>
                    {wl && (
                      <button
                        onClick={() => { setMakeup(s.name, "makeupWatched", true); setMakeup(s.name, "makeupPercent", Math.round(wl.percent)); }}
                        className="text-xs px-2 py-1 rounded-lg"
                        style={{ background: COLORS.bg, color: COLORS.ink }}
                      >
                        시청기록 불러오기({Math.round(wl.percent)}%)
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {history.length > 0 && (
        <div>
          <p className="text-xs mb-2" style={{ color: COLORS.muted }}>최근 기록된 날짜</p>
          <div className="flex flex-wrap gap-1.5">
            {history.map((d) => (
              <button key={d} onClick={() => setDate(d)} className="text-xs px-2.5 py-1 rounded-full" style={{ background: d === date ? COLORS.ink : COLORS.bg, color: d === date ? "#fff" : COLORS.muted, fontFamily: MONO }}>
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StudentAttendanceView({ grade, name, attendance, videos, watchLogs }) {
  const rows = Object.entries(attendance)
    .filter(([k]) => k.startsWith(grade + "|"))
    .map(([k, v]) => {
      const rec = v[name];
      if (!rec) return null;
      const status = typeof rec === "string" ? rec : rec.status;
      const detail = typeof rec === "object" ? rec : {};
      return { date: k.split("|")[1], status, detail };
    })
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  if (rows.length === 0) return <EmptyState text="아직 출결 기록이 없습니다" />;
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const opt = STATUS_OPTS.find((o) => o.key === r.status) || { color: COLORS.muted };
        let detailText = "";
        if (r.status === "지각" && r.detail.arrivalTime) {
          detailText = `${r.detail.arrivalTime} 등원`;
        } else if (r.status === "실시간 온라인 참여") {
          detailText = formatOnlinePeriods(r.detail.onlinePeriods);
        } else if (r.status === "현장수업 결석") {
          const mVideo = (videos || []).find((v) => v.grade === grade && v.date === r.date);
          const wl = mVideo ? (watchLogs || {})[`${mVideo.id}|${grade}|${name}`] : null;
          const percent = wl ? Math.round(wl.percent) : r.detail.makeupWatched ? Math.round(r.detail.makeupPercent || 0) : null;
          detailText = percent !== null ? `영상 ${percent}% 시청` : "영상 미시청";
        }
        return (
          <div key={r.date} className="flex items-center justify-between px-4 py-3 rounded-xl flex-wrap gap-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <span className="text-sm" style={{ fontFamily: MONO, color: COLORS.ink }}>{r.date}</span>
            <span className="flex items-center gap-1.5 flex-wrap justify-end">
              <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: opt.color, color: "#fff" }}>{r.status}</span>
              {detailText && <span className="text-xs" style={{ color: COLORS.muted }}>({detailText})</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------- 선생님: 영상 관리 ---------------------------------- */
function TeacherVideoView({ videos, roster, watchLogs, onAdd, onDelete }) {
  const [form, setForm] = useState({ grade: "25기", title: "", url: "", date: todayStr(), memo: "" });
  const [expanded, setExpanded] = useState(null);

  const submit = () => {
    if (!form.title.trim() || !form.url.trim()) return;
    const youtubeId = extractYoutubeId(form.url);
    onAdd({ id: uid(), grade: form.grade, title: form.title.trim(), youtubeId, date: form.date, memo: form.memo.trim() });
    setForm({ grade: form.grade, title: "", url: "", date: todayStr(), memo: "" });
  };

  const sorted = [...videos].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="space-y-5">
      <div className="rounded-xl p-4 space-y-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <h3 className="font-semibold" style={{ color: COLORS.ink }}>영상 등록</h3>
        <div className="flex flex-wrap gap-2">
          {GRADES.map((g) => (
            <Chip key={g} active={form.grade === g} color={COLORS.ink} onClick={() => setForm({ ...form, grade: g })}>{g}</Chip>
          ))}
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="px-3 py-1.5 rounded-lg text-sm outline-none ml-auto" style={{ border: `1px solid ${COLORS.border}`, fontFamily: MONO }} />
        </div>
        <input placeholder="영상 제목 (예: 3/2 수업 - 수열의 극한)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.border}` }} />
        <input placeholder="유튜브 링크 또는 영상 ID 붙여넣기" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.border}`, fontFamily: MONO }} />
        <input placeholder="메모 (선택)" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.border}` }} />
        <button onClick={submit} className="px-5 py-2.5 rounded-xl font-semibold text-white flex items-center gap-1.5" style={{ background: COLORS.ink }}>
          <Plus size={16} /> 등록
        </button>
      </div>

      <div className="space-y-2">
        {sorted.length === 0 && <EmptyState text="등록된 영상이 없습니다" />}
        {sorted.map((v) => {
          const isOpen = expanded === v.id;
          const list = roster[v.grade] || [];
          return (
            <div key={v.id} className="rounded-xl overflow-hidden" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(isOpen ? null : v.id)}>
                <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: COLORS.bg, color: COLORS.muted }}>{v.grade}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" style={{ color: COLORS.ink }}>{v.title}</p>
                  <p className="text-xs" style={{ color: COLORS.muted, fontFamily: MONO }}>{v.date}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onDelete(v.id); }} style={{ color: COLORS.coral }}>
                  <Trash2 size={15} />
                </button>
              </div>
              {isOpen && (
                <div className="border-t px-4 py-3 space-y-1.5" style={{ borderColor: COLORS.border, background: COLORS.bg }}>
                  <p className="text-xs mb-2" style={{ color: COLORS.muted }}>{v.grade} 학생별 시청 현황</p>
                  {list.length === 0 && <EmptyState text="등록된 학생이 없습니다" />}
                  {list.map((s) => {
                    const wl = watchLogs[`${v.id}|${v.grade}|${s.name}`];
                    return (
                      <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: COLORS.surface }}>
                        <ProgressRing percent={wl?.percent || 0} size={34} stroke={4} />
                        <span className="text-sm flex-1" style={{ color: COLORS.ink }}>{s.name}</span>
                        <span className="text-xs" style={{ color: COLORS.muted, fontFamily: MONO }}>
                          {wl ? `${formatSeconds(wl.watchedSeconds)} / ${formatSeconds(wl.duration)}` : "미시청"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StudentVideosView({ grade, name, videos, watchLogs, onSaveProgress }) {
  const [playing, setPlaying] = useState(null);
  const list = videos.filter((v) => v.grade === grade).sort((a, b) => (a.date < b.date ? 1 : -1));
  if (list.length === 0) return <EmptyState text="아직 등록된 영상이 없습니다" />;
  return (
    <div className="space-y-2">
      {list.map((v) => {
        const wl = watchLogs[`${v.id}|${grade}|${name}`];
        const isPlaying = playing === v.id;
        return (
          <div key={v.id} className="rounded-xl overflow-hidden" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <div className="flex items-center gap-3 px-4 py-3">
              <ProgressRing percent={wl?.percent || 0} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: COLORS.ink }}>{v.title}</p>
                <p className="text-xs" style={{ color: COLORS.muted, fontFamily: MONO }}>{v.date}</p>
                {v.memo && <p className="text-xs mt-0.5" style={{ color: COLORS.muted }}>{v.memo}</p>}
              </div>
              <button
                onClick={() => setPlaying(isPlaying ? null : v.id)}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg shrink-0"
                style={{ background: isPlaying ? COLORS.bg : COLORS.ink, color: isPlaying ? COLORS.ink : "#fff" }}
              >
                <Play size={13} /> {isPlaying ? "닫기" : "시청하기"}
              </button>
            </div>
            {isPlaying && (
              <div className="px-4 pb-4">
                <VideoPlayer
                  video={v}
                  onSave={(data) => onSaveProgress(`${v.id}|${grade}|${name}`, data)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------- 클리닉 관리 ----------------------------------
   클리닉 데이터 구조: clinics["학년|날짜"] = { testTotal: "10", records: { 학생이름: { homeworkBook: "100", homeworkPrint: "50", correct: "7" } } }
------------------------------------------------------------------------------- */
// 출결관리에서 '현장수업 결석'인 학생은 아직 클리닉 기록이 없을 때 자동으로 결석 처리(변경 가능)
function buildClinicSession(grade, date, clinics, roster, attendance) {
  const s = clinics[`${grade}|${date}`] || { testTotal: "", records: {} };
  const merged = { ...(s.records || {}) };
  const attMap = attendance?.[`${grade}|${date}`] || {};
  (roster[grade] || []).forEach((stu) => {
    if (merged[stu.name]) return;
    const attRec = attMap[stu.name];
    const attStatus = typeof attRec === "string" ? attRec : attRec?.status;
    if (attStatus === "현장수업 결석") merged[stu.name] = { absent: true };
  });
  return { testTotal: s.testTotal || "", records: merged };
}

function TeacherClinicView({ roster, clinics, attendance, onUpdate }) {
  const [grade, setGrade] = useState("25기");
  const [date, setDate] = useState(todayStr());
  const key = `${grade}|${date}`;
  const [testTotal, setTestTotal] = useState(() => buildClinicSession(grade, date, clinics, roster, attendance).testTotal);
  const [records, setRecords] = useState(() => buildClinicSession(grade, date, clinics, roster, attendance).records);

  useEffect(() => {
    const built = buildClinicSession(grade, date, clinics, roster, attendance);
    setTestTotal(built.testTotal);
    setRecords(built.records);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, date]);

  const setField = (name, field, value) => {
    setRecords((prev) => ({ ...prev, [name]: { ...prev[name], [field]: value } }));
  };
  const [saved, setSaved] = useState(false);
  const save = () => {
    onUpdate({ ...clinics, [key]: { testTotal, records } });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const list = roster[grade] || [];
  const { avg, max } = calcClinicStats(list, records);

  const history = Object.keys(clinics)
    .filter((k) => k.startsWith(grade + "|"))
    .map((k) => k.split("|")[1])
    .sort((a, b) => (a < b ? 1 : -1))
    .slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {GRADES.map((g) => (
          <Chip key={g} active={grade === g} color={COLORS.ink} onClick={() => setGrade(g)}>{g}</Chip>
        ))}
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-1.5 rounded-lg text-sm outline-none ml-auto" style={{ border: `1px solid ${COLORS.border}`, fontFamily: MONO }} />
      </div>

      <button
        onClick={save}
        className="px-6 py-2.5 rounded-xl font-semibold text-white flex items-center gap-1.5 transition-transform"
        style={{ background: saved ? COLORS.ink : COLORS.teal, transform: saved ? "scale(1.04)" : "scale(1)" }}
      >
        {saved ? <Check size={16} /> : null} {saved ? "저장되었습니다" : "저장하기"}
      </button>

      <div className="flex items-center gap-2">
        <label className="text-sm" style={{ color: COLORS.muted }}>이번 테스트 총 문항수</label>
        <input
          type="number" min="0" value={testTotal} onChange={(e) => setTestTotal(e.target.value)}
          placeholder="예: 15" className="w-20 px-2 py-1.5 rounded-lg text-sm outline-none"
          style={{ border: `1px solid ${COLORS.border}`, fontFamily: MONO }}
        />
      </div>

      {avg !== null && (
        <div className="flex gap-3">
          <div className="px-4 py-2.5 rounded-xl" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <p className="text-xs" style={{ color: COLORS.muted }}>{grade} 테스트 평균</p>
            <p className="text-lg font-bold" style={{ color: COLORS.ink, fontFamily: MONO }}>{avg.toFixed(1)}개</p>
          </div>
          <div className="px-4 py-2.5 rounded-xl" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <p className="text-xs" style={{ color: COLORS.muted }}>{grade} 최고점</p>
            <p className="text-lg font-bold" style={{ color: COLORS.teal, fontFamily: MONO }}>{max}개</p>
          </div>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
        {list.length === 0 ? (
          <div className="bg-white"><EmptyState text="학생 관리 탭에서 먼저 학생을 등록해주세요" /></div>
        ) : (
          list.map((s, i) => {
            const rec = records[s.name] || {};
            return (
              <div key={s.id} className="flex flex-col gap-2 px-4 py-3" style={{ background: i % 2 === 0 ? COLORS.surface : COLORS.bg }}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium w-16 shrink-0" style={{ color: COLORS.ink }}>{s.name}</span>
                  <Chip active={!!rec.absent} color={COLORS.coral} onClick={() => setField(s.name, "absent", !rec.absent)}>결석</Chip>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs" style={{ color: COLORS.muted }}>책</span>
                    {rec.absent ? (
                      <span className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: COLORS.bg, color: COLORS.coral }}>결석</span>
                    ) : (
                      <ClinicFieldInput value={rec.homeworkBook} onChange={(v) => setField(s.name, "homeworkBook", v)} specials={["미제출"]} unit="%" width="w-14" max="100" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs" style={{ color: COLORS.muted }}>프린트</span>
                    {rec.absent ? (
                      <span className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: COLORS.bg, color: COLORS.coral }}>결석</span>
                    ) : (
                      <ClinicFieldInput value={rec.homeworkPrint} onChange={(v) => setField(s.name, "homeworkPrint", v)} specials={["미제출"]} unit="%" width="w-14" max="100" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-xs" style={{ color: COLORS.muted }}>테스트</span>
                    <ClinicFieldInput value={rec.correct} onChange={(v) => setField(s.name, "correct", v)} specials={["미응시"]} unit="" width="w-16" />
                    {rec.correct !== "미응시" && <span className="text-xs" style={{ color: COLORS.muted }}>/ {testTotal || "?"}개</span>}
                  </div>
                </div>
                <input
                  placeholder="학부모 리포트용 코멘트 (선택, 비워두면 리포트에 안 보임)"
                  value={rec.comment || ""}
                  onChange={(e) => setField(s.name, "comment", e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs outline-none"
                  style={{ border: `1px solid ${COLORS.border}` }}
                />
              </div>
            );
          })
        )}
      </div>

      {history.length > 0 && (
        <div>
          <p className="text-xs mb-2" style={{ color: COLORS.muted }}>최근 기록된 날짜</p>
          <div className="flex flex-wrap gap-1.5">
            {history.map((d) => (
              <button key={d} onClick={() => setDate(d)} className="text-xs px-2.5 py-1 rounded-full" style={{ background: d === date ? COLORS.ink : COLORS.bg, color: d === date ? "#fff" : COLORS.muted, fontFamily: MONO }}>
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StudentClinicView({ grade, name, clinics }) {
  const rows = Object.entries(clinics)
    .filter(([k]) => k.startsWith(grade + "|"))
    .map(([k, v]) => {
      const rec = v.records ? v.records[name] : null;
      if (!rec) return null;
      return { date: k.split("|")[1], homeworkBook: rec.homeworkBook, homeworkPrint: rec.homeworkPrint, correct: rec.correct, absent: rec.absent, total: v.testTotal };
    })
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  if (rows.length === 0) return <EmptyState text="클리닉 기록이 없습니다" />;
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.date} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <div className="min-w-0 flex-1">
            <p className="text-xs mb-1" style={{ color: COLORS.muted, fontFamily: MONO }}>{r.date}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" style={{ color: COLORS.ink }}>
              <span>책 {r.absent ? "결석" : r.homeworkBook === "미제출" ? "미제출" : r.homeworkBook !== undefined && r.homeworkBook !== "" ? `${r.homeworkBook}%` : "미입력"}</span>
              <span>프린트 {r.absent ? "결석" : r.homeworkPrint === "미제출" ? "미제출" : r.homeworkPrint !== undefined && r.homeworkPrint !== "" ? `${r.homeworkPrint}%` : "미입력"}</span>
              <span>테스트 {r.correct === "미응시" ? "미응시" : r.correct !== undefined && r.correct !== "" ? `${r.correct} / ${r.total || "?"}개` : "미입력"}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------- 테스트 관리 ----------------------------------
   tests["학년|날짜"] = { questionCount, questions: [{num, type, difficulty}], results: { 학생이름: { answers: [true|false|null,...] } } }
------------------------------------------------------------------------------- */
function TeacherTestView({ roster, tests, onUpdate }) {
  const [grade, setGrade] = useState("25기");
  const [date, setDate] = useState(todayStr());
  const [mode, setMode] = useState("questions"); // questions | grading | analysis
  const key = `${grade}|${date}`;

  const buildSession = () => {
    const s = tests[key];
    if (s) return s;
    return { questionCount: 15, questions: Array.from({ length: 15 }, (_, i) => ({ num: i + 1, type: "", difficulty: "" })), results: {} };
  };

  const [questionCount, setQuestionCount] = useState(() => buildSession().questionCount);
  const [questions, setQuestions] = useState(() => buildSession().questions);
  const [results, setResults] = useState(() => buildSession().results);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = buildSession();
    setQuestionCount(s.questionCount);
    setQuestions(s.questions);
    setResults(s.results);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, date]);

  const changeQuestionCount = (val) => {
    const count = Math.max(0, Math.min(60, parseInt(val) || 0));
    setQuestionCount(count);
    setQuestions((prev) => {
      const next = [...prev];
      while (next.length < count) next.push({ num: next.length + 1, type: "", difficulty: "" });
      next.length = count;
      return next;
    });
    setResults((prev) => {
      const out = {};
      Object.entries(prev).forEach(([name, r]) => {
        const arr = [...(r.answers || [])];
        while (arr.length < count) arr.push(null);
        arr.length = count;
        out[name] = { answers: arr };
      });
      return out;
    });
  };
  const updateQuestionField = (idx, field, value) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q)));
  };
  const toggleAnswer = (name, idx) => {
    setResults((prev) => {
      const arr = [...(prev[name]?.answers || Array(questionCount).fill(null))];
      const cur = arr[idx];
      arr[idx] = cur === true ? false : cur === false ? null : true;
      return { ...prev, [name]: { answers: arr } };
    });
  };
  const save = () => {
    onUpdate({ ...tests, [key]: { questionCount, questions, results } });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const list = roster[grade] || [];
  const history = Object.keys(tests)
    .filter((k) => k.startsWith(grade + "|"))
    .map((k) => k.split("|")[1])
    .sort((a, b) => (a < b ? 1 : -1))
    .slice(0, 10);
  const diffColor = (d) => (d === "상" ? COLORS.coral : d === "중" ? COLORS.amber : d === "하" ? COLORS.teal : COLORS.muted);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {GRADES.map((g) => (
          <Chip key={g} active={grade === g} color={COLORS.ink} onClick={() => setGrade(g)}>{g}</Chip>
        ))}
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-1.5 rounded-lg text-sm outline-none ml-auto" style={{ border: `1px solid ${COLORS.border}`, fontFamily: MONO }} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip active={mode === "questions"} color={COLORS.ink} onClick={() => setMode("questions")}>문항 입력</Chip>
        <Chip active={mode === "grading"} color={COLORS.ink} onClick={() => setMode("grading")}>학생 채점</Chip>
        <Chip active={mode === "analysis"} color={COLORS.ink} onClick={() => setMode("analysis")}>학생별 분석</Chip>
      </div>

      {mode !== "analysis" && (
        <button
          onClick={save}
          className="px-6 py-2.5 rounded-xl font-semibold text-white flex items-center gap-1.5 transition-transform"
          style={{ background: saved ? COLORS.ink : COLORS.teal, transform: saved ? "scale(1.04)" : "scale(1)" }}
        >
          {saved ? <Check size={16} /> : null} {saved ? "저장되었습니다" : "저장하기"}
        </button>
      )}

      {mode === "questions" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm" style={{ color: COLORS.muted }}>총 문항수</label>
            <input type="number" min="0" max="60" value={questionCount} onChange={(e) => changeQuestionCount(e.target.value)} className="w-20 px-2 py-1.5 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.border}`, fontFamily: MONO }} />
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
            {questions.length === 0 && <div className="bg-white"><EmptyState text="총 문항수를 입력해주세요" /></div>}
            {questions.map((q, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 px-4 py-2" style={{ background: idx % 2 === 0 ? COLORS.surface : COLORS.bg }}>
                <span className="text-xs w-9 shrink-0" style={{ color: COLORS.muted, fontFamily: MONO }}>{q.num}번</span>
                <input
                  placeholder="문제 유형 (예: 수열의 극한)" value={q.type} onChange={(e) => updateQuestionField(idx, "type", e.target.value)}
                  className="flex-1 min-w-[120px] px-2 py-1 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.border}` }}
                />
                <div className="flex gap-1">
                  {["상", "중", "하"].map((d) => (
                    <Chip key={d} active={q.difficulty === d} color={diffColor(d)} onClick={() => updateQuestionField(idx, "difficulty", q.difficulty === d ? "" : d)}>{d}</Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === "grading" && (
        <>
          {list.length === 0 ? (
            <EmptyState text="학생 관리 탭에서 먼저 학생을 등록해주세요" />
          ) : questionCount === 0 ? (
            <EmptyState text="먼저 '문항 입력'에서 총 문항수를 입력해주세요" />
          ) : (
            <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${COLORS.border}` }}>
              <table className="text-sm" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left sticky left-0" style={{ background: COLORS.bg, color: COLORS.muted, minWidth: 84 }}>이름</th>
                    {questions.map((q, idx) => (
                      <th key={idx} className="px-1 py-2 text-center" style={{ background: COLORS.bg, color: diffColor(q.difficulty), fontFamily: MONO, minWidth: 34 }}>{q.num}</th>
                    ))}
                    <th className="px-3 py-2 text-center" style={{ background: COLORS.bg, color: COLORS.muted, minWidth: 70 }}>맞은 개수</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((s, i) => {
                    const answers = results[s.name]?.answers || Array(questionCount).fill(null);
                    const correctCount = answers.filter((a) => a === true).length;
                    const gradedCount = answers.filter((a) => a === true || a === false).length;
                    const rowBg = i % 2 === 0 ? COLORS.surface : COLORS.bg;
                    return (
                      <tr key={s.id}>
                        <td className="px-3 py-1.5 sticky left-0 text-sm font-medium" style={{ background: rowBg, color: COLORS.ink }}>{s.name}</td>
                        {answers.map((a, idx) => (
                          <td key={idx} className="px-1 py-1.5 text-center" style={{ background: rowBg }}>
                            <button
                              onClick={() => toggleAnswer(s.name, idx)}
                              className="w-7 h-7 rounded-md text-xs font-bold"
                              style={{
                                background: a === true ? COLORS.teal : a === false ? COLORS.coral : COLORS.bg,
                                color: a === true || a === false ? "#fff" : COLORS.muted,
                                border: `1px solid ${COLORS.border}`,
                              }}
                            >
                              {a === true ? "O" : a === false ? "X" : "-"}
                            </button>
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-center" style={{ background: rowBg, color: COLORS.ink, fontFamily: MONO }}>
                          {correctCount}{gradedCount < questionCount ? ` (${gradedCount}/${questionCount} 채점)` : `/${questionCount}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {mode === "analysis" && <TestAnalysisView grade={grade} roster={roster} tests={tests} />}

      {mode !== "analysis" && history.length > 0 && (
        <div>
          <p className="text-xs mb-2" style={{ color: COLORS.muted }}>최근 기록된 날짜</p>
          <div className="flex flex-wrap gap-1.5">
            {history.map((d) => (
              <button key={d} onClick={() => setDate(d)} className="text-xs px-2.5 py-1 rounded-full" style={{ background: d === date ? COLORS.ink : COLORS.bg, color: d === date ? "#fff" : COLORS.muted, fontFamily: MONO }}>
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AccuracyDonut({ correct, total, size = 128 }) {
  const rate = total ? Math.round((correct / total) * 100) : 0;
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (rate / 100) * circumference;
  const color = rate < 50 ? COLORS.coral : rate < 80 ? COLORS.amber : COLORS.teal;
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={radius} stroke={COLORS.border} strokeWidth={14} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={14} fill="none"
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 0.5s" }}
      />
      <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.22} fontWeight="700" fontFamily={MONO} fill={COLORS.ink}>
        {rate}%
      </text>
      <text x="50%" y="66%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.1} fontFamily={MONO} fill={COLORS.muted}>
        {correct}/{total}
      </text>
    </svg>
  );
}

function AccuracyHistogram({ items, title }) {
  const barColor = (rate) => (rate < 50 ? COLORS.coral : rate < 80 ? COLORS.amber : COLORS.teal);
  return (
    <div>
      <p className="text-sm font-semibold mb-3" style={{ color: COLORS.ink }}>{title}</p>
      <div className="flex items-end gap-3 overflow-x-auto pb-1" style={{ minHeight: 150 }}>
        {items.map((t) => (
          <div key={t.label} className="flex flex-col items-center shrink-0 justify-end" style={{ width: 60, height: 150 }}>
            <span className="text-[10px] mb-1 font-semibold" style={{ color: COLORS.ink, fontFamily: MONO }}>{t.rate}%</span>
            <div className="w-8 rounded-t-md" style={{ height: `${Math.max(4, t.rate * 1.1)}px`, background: barColor(t.rate), transition: "height 0.4s" }} />
            <span className="text-[10px] mt-1.5 text-center leading-tight break-keep" style={{ color: COLORS.ink, maxWidth: 60 }}>{t.label}</span>
            <span className="text-[9px]" style={{ color: COLORS.muted, fontFamily: MONO }}>{t.correct}/{t.total}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TestAnalysisView({ grade, roster, tests }) {
  const list = roster[grade] || [];
  const [studentName, setStudentName] = useState(list[0]?.name || "");

  useEffect(() => {
    if (!list.find((s) => s.name === studentName)) setStudentName(list[0]?.name || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade]);

  if (list.length === 0) return <EmptyState text="학생 관리 탭에서 먼저 학생을 등록해주세요" />;

  const { byType, byDifficulty } = computeStudentAnalysis(grade, studentName, tests);
  const totalGraded = byType.reduce((sum, t) => sum + t.total, 0);
  const totalCorrect = byType.reduce((sum, t) => sum + t.correct, 0);
  const weakest = byType[0];

  return (
    <div className="space-y-6">
      <select value={studentName} onChange={(e) => setStudentName(e.target.value)} className="px-3 py-2 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.border}` }}>
        {list.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
      </select>
      {totalGraded === 0 ? (
        <EmptyState text="아직 채점된 테스트 데이터가 없습니다. 회차가 쌓이면 강점·취약점이 나타납니다" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-6 rounded-xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <AccuracyDonut correct={totalCorrect} total={totalGraded} />
            <div>
              <p className="text-xs" style={{ color: COLORS.muted }}>누적 전체 정답률</p>
              <p className="text-sm mt-1" style={{ color: COLORS.ink }}>총 {totalGraded}문항 중 {totalCorrect}개 정답</p>
              {weakest && (
                <p className="text-sm mt-2 px-2.5 py-1.5 rounded-lg inline-block" style={{ background: "#FDEEEC", color: COLORS.coral }}>
                  가장 취약한 유형: {weakest.label} ({weakest.rate}%)
                </p>
              )}
            </div>
          </div>
          <AccuracyHistogram items={byType} title="유형별 정답률 (취약한 순)" />
          <AccuracyHistogram items={byDifficulty} title="난이도별 정답률" />
        </>
      )}
    </div>
  );
}

/* ---------------------------------- 수업 관리 ----------------------------------
   classNotes["학년|날짜"] = { lesson, homework }
------------------------------------------------------------------------------- */
function TeacherClassView({ classNotes, onUpdate }) {
  const [grade, setGrade] = useState("25기");
  const [date, setDate] = useState(todayStr());
  const key = `${grade}|${date}`;
  const [lesson, setLesson] = useState(classNotes[key]?.lesson || "");
  const [homework, setHomework] = useState(classNotes[key]?.homework || "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLesson(classNotes[key]?.lesson || "");
    setHomework(classNotes[key]?.homework || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, date]);

  const save = () => {
    onUpdate({ ...classNotes, [key]: { lesson, homework } });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const history = Object.keys(classNotes)
    .filter((k) => k.startsWith(grade + "|"))
    .map((k) => k.split("|")[1])
    .sort((a, b) => (a < b ? 1 : -1))
    .slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {GRADES.map((g) => (
          <Chip key={g} active={grade === g} color={COLORS.ink} onClick={() => setGrade(g)}>{g}</Chip>
        ))}
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-1.5 rounded-lg text-sm outline-none ml-auto" style={{ border: `1px solid ${COLORS.border}`, fontFamily: MONO }} />
      </div>
      <button
        onClick={save}
        className="px-6 py-2.5 rounded-xl font-semibold text-white flex items-center gap-1.5 transition-transform"
        style={{ background: saved ? COLORS.ink : COLORS.teal, transform: saved ? "scale(1.04)" : "scale(1)" }}
      >
        {saved ? <Check size={16} /> : null} {saved ? "저장되었습니다" : "저장하기"}
      </button>
      <div className="rounded-xl p-4 space-y-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <div>
          <label className="text-xs" style={{ color: COLORS.muted }}>이번주 수업 내용</label>
          <textarea value={lesson} onChange={(e) => setLesson(e.target.value)} rows={3} placeholder="예: 수열의 극한 개념 및 연습문제 풀이" className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none resize-none" style={{ border: `1px solid ${COLORS.border}` }} />
        </div>
        <div>
          <label className="text-xs" style={{ color: COLORS.muted }}>이번주 과제</label>
          <textarea value={homework} onChange={(e) => setHomework(e.target.value)} rows={3} placeholder="예: 교재 p.40~45, 프린트 3회차" className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none resize-none" style={{ border: `1px solid ${COLORS.border}` }} />
        </div>
        <p className="text-xs" style={{ color: COLORS.muted }}>이 반+날짜와 같은 날짜를 문자의 '테스트 날짜'로 선택하면, 문자의 숙제 완성도 아래에 자동으로 포함됩니다.</p>
      </div>
      {history.length > 0 && (
        <div>
          <p className="text-xs mb-2" style={{ color: COLORS.muted }}>최근 기록된 날짜</p>
          <div className="flex flex-wrap gap-1.5">
            {history.map((d) => (
              <button key={d} onClick={() => setDate(d)} className="text-xs px-2.5 py-1 rounded-full" style={{ background: d === date ? COLORS.ink : COLORS.bg, color: d === date ? "#fff" : COLORS.muted, fontFamily: MONO }}>
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- 학부모 리포트 ---------------------------------- */
function findNextClassNote(classNotes, grade, afterDate) {
  const dates = Object.keys(classNotes || {})
    .filter((k) => k.startsWith(grade + "|"))
    .map((k) => k.split("|")[1])
    .filter((d) => d > afterDate)
    .sort();
  if (!dates.length) return null;
  return { date: dates[0], ...classNotes[`${grade}|${dates[0]}`] };
}
function formatDateKoreanWeekday(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdays[d.getDay()]})`;
}

function ParentReportView({ session, roster, attendance, clinics, tests, classNotes, videos, watchLogs, settings }) {
  const { grade, name } = session;
  const [fontScale, setFontScale] = useState(1);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const fs = (px) => `${Math.round(px * fontScale)}px`;

  const student = (roster[grade] || []).find((s) => s.name === name);
  const sessionDates = Object.keys(clinics || {})
    .filter((k) => k.startsWith(grade + "|"))
    .map((k) => k.split("|")[1])
    .sort((a, b) => (a < b ? 1 : -1));
  const [testDate, setTestDate] = useState(sessionDates[0] || todayStr());

  const session1 = clinics?.[`${grade}|${testDate}`];
  const rec = session1?.records?.[name] || {};
  const list = roster[grade] || [];
  const { avg, max } = calcClinicStats(list, session1?.records || {});
  const classNote = classNotes?.[`${grade}|${testDate}`];
  const nextNote = findNextClassNote(classNotes, grade, testDate);

  // 최근 2주간 출석 내역 (테스트 날짜 기준 앞뒤 포함, 간단히 최근 14일)
  const rangeDates = enumerateDates((() => {
    const d = new Date(testDate + "T00:00:00");
    d.setDate(d.getDate() - 6);
    return toLocalDateStr(d);
  })(), testDate);
  const attendanceEntries = rangeDates
    .map((d) => ({ date: d, rec: attendance?.[`${grade}|${d}`]?.[name] }))
    .filter((e) => e.rec);

  const { byType, byDifficulty } = computeStudentAnalysis(grade, name, tests || {});
  const totalGraded = byType.reduce((sum, t) => sum + t.total, 0);
  const totalCorrect = byType.reduce((sum, t) => sum + t.correct, 0);

  const bookStr = rec.absent ? "결석" : rec.homeworkBook === "미제출" ? "미제출" : rec.homeworkBook !== undefined && rec.homeworkBook !== "" ? `${rec.homeworkBook}%` : "미입력";
  const printStr = rec.absent ? "결석" : rec.homeworkPrint === "미제출" ? "미제출" : rec.homeworkPrint !== undefined && rec.homeworkPrint !== "" ? `${rec.homeworkPrint}%` : "미입력";
  const isAbsentTest = rec.correct === "미응시";
  const scoreStr = isAbsentTest ? "미응시" : rec.correct !== undefined && rec.correct !== "" ? `${rec.correct} / ${session1?.testTotal || "?"}` : "미입력";

  const SectionTitle = ({ children }) => (
    <p className="font-bold mb-2" style={{ color: COLORS.ink, fontSize: fs(15) }}>{children}</p>
  );

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-10">
      {/* 글자 크기 조절 */}
      <div className="flex items-center justify-end gap-1.5">
        <span style={{ fontSize: fs(11), color: COLORS.muted }}>글자 크기</span>
        <button onClick={() => setFontScale((v) => Math.max(0.85, +(v - 0.15).toFixed(2)))} className="w-7 h-7 rounded-lg font-bold" style={{ background: COLORS.bg, color: COLORS.ink, fontSize: fs(12) }}>가-</button>
        <button onClick={() => setFontScale(1)} className="w-7 h-7 rounded-lg font-bold" style={{ background: COLORS.bg, color: COLORS.ink, fontSize: fs(12) }}>가</button>
        <button onClick={() => setFontScale((v) => Math.min(1.6, +(v + 0.15).toFixed(2)))} className="w-7 h-7 rounded-lg font-bold" style={{ background: COLORS.bg, color: COLORS.ink, fontSize: fs(15) }}>가+</button>
      </div>

      {/* 인사말 헤더 */}
      <div className="rounded-2xl p-5" style={{ background: COLORS.ink }}>
        <p style={{ color: "#9DAFC9", fontSize: fs(11), letterSpacing: 1 }}>WEEKLY REPORT</p>
        <h1 className="font-bold mt-1" style={{ color: "#fff", fontSize: fs(20) }}>{name} 학생 학부모님, 안녕하세요 👋</h1>
        <p className="mt-2" style={{ color: "#C7D2E0", fontSize: fs(13) }}>{formatDateKoreanWeekday(testDate)} · 수업 리포트</p>
        {sessionDates.length > 1 && (
          <select
            value={testDate} onChange={(e) => setTestDate(e.target.value)}
            className="mt-3 px-3 py-1.5 rounded-lg outline-none"
            style={{ fontSize: fs(12), border: "none", fontFamily: MONO }}
          >
            {sessionDates.map((d) => <option key={d} value={d}>{d} 리포트 보기</option>)}
          </select>
        )}
      </div>

      {/* 학생 기본 정보 */}
      <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold shrink-0" style={{ background: COLORS.teal, color: "#fff", fontSize: fs(16) }}>
          {name.slice(0, 1)}
        </div>
        <div>
          <p className="font-bold" style={{ color: COLORS.ink, fontSize: fs(15) }}>{name} 학생</p>
          <p style={{ color: COLORS.muted, fontSize: fs(12) }}>{student?.school ? `${student.school} · ` : ""}{grade}{student?.department ? ` · ${student.department}` : ""}</p>
        </div>
      </div>

      {/* 요약 뱃지 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl p-3 text-center" style={{ background: "#EAF6F2" }}>
          <p style={{ color: COLORS.muted, fontSize: fs(10) }}>주간테스트</p>
          <p className="font-bold mt-0.5" style={{ color: COLORS.teal, fontSize: fs(16), fontFamily: MONO }}>{scoreStr}</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: "#FFF6E9" }}>
          <p style={{ color: COLORS.muted, fontSize: fs(10) }}>책 / 프린트</p>
          <p className="font-bold mt-0.5" style={{ color: COLORS.amber, fontSize: fs(13), fontFamily: MONO }}>{bookStr} / {printStr}</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: "#EAF1FB" }}>
          <p style={{ color: COLORS.muted, fontSize: fs(10) }}>최근 7일 출석</p>
          <p className="font-bold mt-0.5" style={{ color: COLORS.blue, fontSize: fs(16), fontFamily: MONO }}>{attendanceEntries.length}일</p>
        </div>
      </div>

      {/* (1) 출석 현황 */}
      <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <SectionTitle>① 출석 현황</SectionTitle>
        <p style={{ color: COLORS.ink, fontSize: fs(12.5), lineHeight: 1.7 }}>
          {attendanceEntries.length
            ? attendanceEntries.map(({ date, rec: r }) => `${formatDateSlash(date)} ${attendanceStatusText(r)}`).join(", ")
            : "최근 7일간 출결 기록이 없습니다"}
        </p>
        <div className="mt-3">
          <MonthlyAttendanceCalendar grade={grade} name={name} attendance={attendance || {}} />
        </div>
      </div>

      {/* (2) 숙제 완성도 */}
      <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <SectionTitle>② 숙제 완성도</SectionTitle>
        <div className="flex gap-4">
          <p style={{ color: COLORS.ink, fontSize: fs(13) }}>책 <span className="font-bold" style={{ fontFamily: MONO }}>{bookStr}</span></p>
          <p style={{ color: COLORS.ink, fontSize: fs(13) }}>프린트 <span className="font-bold" style={{ fontFamily: MONO }}>{printStr}</span></p>
        </div>
      </div>

      {/* (3) 클리닉 현황 */}
      <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <SectionTitle>③ 클리닉 현황</SectionTitle>
        <div className="space-y-1" style={{ fontSize: fs(13), color: COLORS.ink }}>
          <p>주간테스트 점수 : <span className="font-bold" style={{ fontFamily: MONO }}>{scoreStr}</span></p>
          {!isAbsentTest && (
            <>
              <p>{grade} 반 평균 : <span className="font-bold" style={{ fontFamily: MONO }}>{avg !== null ? `${avg.toFixed(1)} / ${session1?.testTotal || "?"}` : "미입력"}</span></p>
              <p>{grade} 반 최고점 : <span className="font-bold" style={{ fontFamily: MONO }}>{max !== null ? `${max} / ${session1?.testTotal || "?"}` : "미입력"}</span></p>
            </>
          )}
        </div>
        <button
          onClick={() => setShowAnalysis((v) => !v)}
          className="mt-3 px-3 py-2 rounded-lg font-medium"
          style={{ background: COLORS.bg, color: COLORS.ink, fontSize: fs(12) }}
        >
          {showAnalysis ? "상세분석 닫기" : "상세분석 보기 (유형·난이도별 정답률)"}
        </button>
        {showAnalysis && (
          totalGraded === 0 ? (
            <p className="mt-3" style={{ color: COLORS.muted, fontSize: fs(12) }}>아직 채점된 테스트 데이터가 쌓이지 않았습니다</p>
          ) : (
            <div className="mt-4 space-y-5">
              <div className="flex items-center gap-4">
                <AccuracyDonut correct={totalCorrect} total={totalGraded} size={Math.round(110 * fontScale)} />
                <p style={{ color: COLORS.muted, fontSize: fs(12) }}>누적 {totalGraded}문항 중 {totalCorrect}개 정답</p>
              </div>
              <AccuracyHistogram items={byType} title="유형별 정답률" />
              <AccuracyHistogram items={byDifficulty} title="난이도별 정답률" />
            </div>
          )
        )}
      </div>

      {/* (4) 수업 안내 */}
      <div className="rounded-2xl p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <SectionTitle>④ 수업 안내</SectionTitle>
        <div style={{ fontSize: fs(13), color: COLORS.ink, lineHeight: 1.6 }}>
          <p><span style={{ color: COLORS.muted }}>이번 수업 내용 : </span>{classNote?.lesson?.trim() || "미입력"}</p>
          <p className="mt-1"><span style={{ color: COLORS.muted }}>이번 과제 : </span>{classNote?.homework?.trim() || "미입력"}</p>
          {nextNote && (
            <p className="mt-3 px-3 py-2 rounded-lg" style={{ background: COLORS.bg }}>
              <span style={{ color: COLORS.muted }}>다음 수업 ({formatDateSlash(nextNote.date)}) : </span>{nextNote.lesson?.trim() || "안내 예정"}
            </p>
          )}
        </div>
      </div>

      {/* (5) 선생님 코멘트 - 있을 때만 표시 */}
      {rec.comment && rec.comment.trim() && (
        <div className="rounded-2xl p-4" style={{ background: "#FFF9EC", border: `1px solid #F3E3BC` }}>
          <SectionTitle>⑤ 선생님 코멘트</SectionTitle>
          <p style={{ color: COLORS.ink, fontSize: fs(13), lineHeight: 1.6 }}>{rec.comment.trim()}</p>
          {settings?.teacherSignature && (
            <p className="mt-2" style={{ color: COLORS.muted, fontSize: fs(11) }}>— {settings.teacherSignature}</p>
          )}
        </div>
      )}

      <p className="text-center" style={{ color: COLORS.muted, fontSize: fs(10.5) }}>{BRAND_NAME} · 이 리포트는 선생님이 입력한 정보로 자동 생성됩니다</p>
    </div>
  );
}

/* ---------------------------------- 문자 (클리닉 결과 안내) ---------------------------------- */
function MessageView({ roster, clinics, attendance, classNotes, settings }) {
  const [grade, setGrade] = useState("25기");
  const clinicDatesFor = (g) =>
    Object.keys(clinics)
      .filter((k) => k.startsWith(g + "|"))
      .map((k) => k.split("|")[1])
      .sort((a, b) => (a < b ? 1 : -1));

  const initialTestDate = clinicDatesFor("25기")[0] || todayStr();
  const [testDate, setTestDate] = useState(initialTestDate);
  const [rangeEnd, setRangeEnd] = useState(initialTestDate);
  const [rangeStart, setRangeStart] = useState(initialTestDate);
  const [note, setNote] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const ds = clinicDatesFor(grade);
    const d = ds[0] || todayStr();
    setTestDate(d);
    const dateObj = new Date(d + "T00:00:00");
    const dow = dateObj.getDay(); // 0=일요일, 6=토요일
    const startObj = new Date(dateObj);
    const endObj = new Date(dateObj);
    if (dow === 6) {
      endObj.setDate(endObj.getDate() + 1); // 토요일이면 다음날(일)까지
    } else {
      startObj.setDate(startObj.getDate() - 1); // 일요일이나 평일이면 전날부터
    }
    setRangeStart(toLocalDateStr(startObj));
    setRangeEnd(toLocalDateStr(endObj));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade]);

  const testDates = clinicDatesFor(grade);
  const session = clinics[`${grade}|${testDate}`];
  const classNote = classNotes?.[`${grade}|${testDate}`];
  const list = roster[grade] || [];
  const { avg, max } = calcClinicStats(list, session?.records || {});
  const rangeDates = enumerateDates(rangeStart, rangeEnd);

  const copy = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (e) {}
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {GRADES.map((g) => (
          <Chip key={g} active={grade === g} color={COLORS.ink} onClick={() => setGrade(g)}>{g}</Chip>
        ))}
      </div>

      <div className="rounded-xl p-4 space-y-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs w-24 shrink-0" style={{ color: COLORS.muted }}>출석 기간</span>
          <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="px-2 py-1.5 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.border}`, fontFamily: MONO }} />
          <span className="text-xs" style={{ color: COLORS.muted }}>~</span>
          <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="px-2 py-1.5 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.border}`, fontFamily: MONO }} />
          <span className="text-xs" style={{ color: COLORS.muted }}>(기록이 있는 날짜만 문자에 표시됩니다)</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs w-24 shrink-0" style={{ color: COLORS.muted }}>테스트 날짜</span>
          <select value={testDate} onChange={(e) => setTestDate(e.target.value)} className="px-2 py-1.5 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.border}`, fontFamily: MONO }}>
            {testDates.length === 0 && <option value={todayStr()}>{todayStr()}</option>}
            {testDates.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <span className="text-xs" style={{ color: COLORS.muted }}>클리닉 관리 탭에 입력된 테스트/숙제 데이터를 가져옵니다</span>
        </div>
        <div>
          <span className="text-xs" style={{ color: COLORS.muted }}>학부모 안내사항 (선택, 문자 맨 아래에 공통으로 붙습니다)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="예: 다음주 토요일은 특강으로 대체됩니다" className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none resize-none" style={{ border: `1px solid ${COLORS.border}` }} />
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState text="학생 관리 탭에서 먼저 학생을 등록해주세요" />
      ) : (
        <div className="space-y-2">
          {list.map((s) => {
            const rec = session?.records?.[s.name] || {};
            const attendanceEntries = rangeDates
              .map((d) => ({ date: d, rec: attendance[`${grade}|${d}`]?.[s.name] }))
              .filter((e) => e.rec);
            const msg = generateReportMessage({
              academyLabel: settings?.academyLabel,
              teacherSignature: settings?.teacherSignature,
              name: s.name,
              attendanceEntries,
              testTotal: session?.testTotal,
              correct: rec.correct,
              avg, max,
              homeworkBook: rec.homeworkBook,
              homeworkPrint: rec.homeworkPrint,
              absent: rec.absent,
              lesson: classNote?.lesson,
              homeworkAssignment: classNote?.homework,
              note,
            });
            const isOpen = expanded === s.id;
            return (
              <div key={s.id} className="rounded-xl overflow-hidden" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(isOpen ? null : s.id)}>
                  <span className="text-sm font-medium flex-1" style={{ color: COLORS.ink }}>{s.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); copy(s.id, msg); }}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium"
                    style={{ background: copiedId === s.id ? COLORS.teal : COLORS.ink, color: "#fff" }}
                  >
                    <Copy size={12} /> {copiedId === s.id ? "복사됨" : "복사"}
                  </button>
                </div>
                {isOpen && (
                  <div className="px-4 pb-4">
                    <pre className="text-xs whitespace-pre-wrap p-3 rounded-lg" style={{ background: COLORS.bg, color: COLORS.ink, fontFamily: SANS }}>{msg}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- 자료실 ---------------------------------- */
function TeacherMaterialsView({ materials, onAdd, onDelete }) {
  const [form, setForm] = useState({ grade: "전체", title: "", url: "", date: todayStr(), memo: "" });
  const [fileData, setFileData] = useState(null);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError("");
    if (file.type !== "application/pdf") {
      setFileError("PDF 파일만 업로드할 수 있습니다");
      e.target.value = "";
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setFileError("파일이 너무 큽니다 (3MB까지 가능). 더 큰 파일은 구글드라이브 링크를 이용해주세요");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileData(reader.result);
      setFileName(file.name);
    };
    reader.readAsDataURL(file);
  };
  const clearFile = () => { setFileData(null); setFileName(""); setFileError(""); };

  const submit = () => {
    if (!form.title.trim()) return;
    if (!form.url.trim() && !fileData) return;
    onAdd({
      id: uid(), ...form, title: form.title.trim(), url: form.url.trim(), memo: form.memo.trim(),
      fileData: fileData || undefined, fileName: fileName || undefined,
    });
    setForm({ grade: form.grade, title: "", url: "", date: todayStr(), memo: "" });
    clearFile();
  };
  const sorted = [...materials].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <div className="space-y-5">
      <div className="rounded-xl p-4 space-y-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <h3 className="font-semibold" style={{ color: COLORS.ink }}>자료 등록</h3>
        <div className="flex flex-wrap gap-2">
          {["전체", ...GRADES].map((g) => (
            <Chip key={g} active={form.grade === g} color={COLORS.ink} onClick={() => setForm({ ...form, grade: g })}>{g}</Chip>
          ))}
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="px-3 py-1.5 rounded-lg text-sm outline-none ml-auto" style={{ border: `1px solid ${COLORS.border}`, fontFamily: MONO }} />
        </div>
        <input placeholder="자료 제목 (예: 수열 극한 개념 정리 프린트)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.border}` }} />
        <input placeholder="구글드라이브 등 링크 (파일을 올리면 생략 가능)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.border}`, fontFamily: MONO }} />
        <div>
          <p className="text-xs mb-1" style={{ color: COLORS.muted }}>또는 PDF 파일 직접 업로드 (3MB까지)</p>
          {fileData ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: COLORS.bg }}>
              <span className="text-xs flex-1 truncate" style={{ color: COLORS.ink }}>{fileName}</span>
              <button onClick={clearFile} className="text-xs" style={{ color: COLORS.coral }}>제거</button>
            </div>
          ) : (
            <input type="file" accept="application/pdf" onChange={handleFile} className="text-sm" style={{ color: COLORS.ink }} />
          )}
          {fileError && <p className="text-xs mt-1" style={{ color: COLORS.coral }}>{fileError}</p>}
        </div>
        <input placeholder="메모 (선택)" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.border}` }} />
        <button onClick={submit} className="px-5 py-2.5 rounded-xl font-semibold text-white flex items-center gap-1.5" style={{ background: COLORS.ink }}>
          <Plus size={16} /> 등록
        </button>
      </div>
      <div className="space-y-1.5">
        {sorted.length === 0 && <EmptyState text="등록된 자료가 없습니다" />}
        {sorted.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: COLORS.bg, color: COLORS.muted }}>{m.grade}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" style={{ color: COLORS.ink }}>{m.title}</p>
              <p className="text-xs" style={{ color: COLORS.muted, fontFamily: MONO }}>{m.date}{m.fileData ? " · PDF 업로드" : ""}</p>
            </div>
            {m.fileData ? (
              <a href={m.fileData} download={m.fileName || `${m.title}.pdf`} className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 shrink-0" style={{ background: COLORS.bg, color: COLORS.ink }}>
                <Link2 size={12} /> 다운로드
              </a>
            ) : (
              <a href={m.url} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 shrink-0" style={{ background: COLORS.bg, color: COLORS.ink }}>
                <Link2 size={12} /> 열기
              </a>
            )}
            <button onClick={() => onDelete(m.id)} style={{ color: COLORS.coral }}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StudentMaterialsView({ grade, materials }) {
  const rows = materials.filter((m) => m.grade === grade || m.grade === "전체").sort((a, b) => (a.date < b.date ? 1 : -1));
  if (rows.length === 0) return <EmptyState text="등록된 자료가 없습니다" />;
  return (
    <div className="space-y-1.5">
      {rows.map((m) => (
        <a
          key={m.id}
          href={m.fileData || m.url}
          {...(m.fileData ? { download: m.fileName || `${m.title}.pdf` } : { target: "_blank", rel: "noreferrer" })}
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate" style={{ color: COLORS.ink }}>{m.title}</p>
            <p className="text-xs" style={{ color: COLORS.muted, fontFamily: MONO }}>{m.date}</p>
            {m.memo && <p className="text-xs mt-0.5" style={{ color: COLORS.muted }}>{m.memo}</p>}
          </div>
          <Link2 size={15} style={{ color: COLORS.ink }} />
        </a>
      ))}
    </div>
  );
}

/* ---------------------------------- 설정 ---------------------------------- */
function SettingsView({ settings, onUpdate, onExport, onImport }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState("");
  const [academyLabel, setAcademyLabel] = useState(settings.academyLabel || "");
  const [signature, setSignature] = useState(settings.teacherSignature || "");
  const [sigMsg, setSigMsg] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const submit = () => {
    if (cur !== (settings.teacherPin || "0000")) { setMsg("현재 코드가 올바르지 않습니다"); return; }
    if (!next.trim()) { setMsg("새 코드를 입력해주세요"); return; }
    onUpdate({ ...settings, teacherPin: next.trim() });
    setMsg("변경되었습니다");
    setCur(""); setNext("");
  };
  const saveMessageSettings = () => {
    onUpdate({ ...settings, teacherSignature: signature.trim(), academyLabel: academyLabel.trim() });
    setSigMsg("저장되었습니다");
    setTimeout(() => setSigMsg(""), 1500);
  };
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file || !onImport) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        onImport(payload);
        setImportMsg("가져오기 완료되었습니다");
      } catch (err) {
        setImportMsg("파일을 읽을 수 없습니다");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };
  return (
    <div className="max-w-sm space-y-4">
      <div className="rounded-xl p-4 space-y-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <h3 className="font-semibold" style={{ color: COLORS.ink }}>문자 Report 설정</h3>
        <div>
          <label className="text-xs" style={{ color: COLORS.muted }}>학원 표기 (Report 맨 앞)</label>
          <input placeholder="예: 대치에스학원" value={academyLabel} onChange={(e) => setAcademyLabel(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.border}` }} />
        </div>
        <div>
          <label className="text-xs" style={{ color: COLORS.muted }}>문자 서명</label>
          <input placeholder="예: 박래혁T" value={signature} onChange={(e) => setSignature(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.border}` }} />
        </div>
        {sigMsg && <p className="text-xs" style={{ color: COLORS.teal }}>{sigMsg}</p>}
        <button onClick={saveMessageSettings} className="px-5 py-2.5 rounded-xl font-semibold text-white" style={{ background: COLORS.ink }}>저장하기</button>
      </div>
      <div className="rounded-xl p-4 space-y-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <h3 className="font-semibold" style={{ color: COLORS.ink }}>데이터 내보내기</h3>
        <p className="text-xs" style={{ color: COLORS.muted }}>현재 학원의 학생·출결·클리닉·테스트·자료 데이터를 파일 하나로 내려받습니다. 다른 곳으로 옮기거나 백업할 때 사용하세요.</p>
        <button onClick={onExport} className="px-5 py-2.5 rounded-xl font-semibold text-white" style={{ background: COLORS.ink }}>JSON 파일로 내려받기</button>
      </div>
      {onImport && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <h3 className="font-semibold" style={{ color: COLORS.ink }}>데이터 가져오기</h3>
          <p className="text-xs" style={{ color: COLORS.muted }}>이전에 내보낸 JSON 파일을 선택하면 현재 학원 데이터로 불러옵니다. (기존 데이터는 덮어씌워집니다)</p>
          <input type="file" accept="application/json" onChange={handleFile} className="text-sm" style={{ color: COLORS.ink }} />
          {importMsg && <p className="text-xs" style={{ color: importMsg.includes("완료") ? COLORS.teal : COLORS.coral }}>{importMsg}</p>}
        </div>
      )}
      <div className="rounded-xl p-4 space-y-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <h3 className="font-semibold" style={{ color: COLORS.ink }}>관리자 코드 변경</h3>
        <input type="password" placeholder="현재 코드" value={cur} onChange={(e) => setCur(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.border}` }} />
        <input type="password" placeholder="새 코드" value={next} onChange={(e) => setNext(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: `1px solid ${COLORS.border}` }} />
        {msg && <p className="text-xs" style={{ color: msg === "변경되었습니다" ? COLORS.teal : COLORS.coral }}>{msg}</p>}
        <button onClick={submit} className="px-5 py-2.5 rounded-xl font-semibold text-white" style={{ background: COLORS.ink }}>변경하기</button>
      </div>
      <p className="text-xs leading-relaxed px-1" style={{ color: COLORS.muted }}>
        이 페이지의 데이터는 공유 링크를 가진 사람이라면 누구나 접근할 수 있습니다. 학생·학부모 등 신뢰할 수 있는 대상에게만 링크를 전달해주세요.
      </p>
    </div>
  );
}

/* ---------------------------------- 선생님 / 학생 앱 ---------------------------------- */
const TEACHER_TABS = [
  { key: "roster", label: "학생 관리", icon: Users },
  { key: "attendance", label: "출결 관리", icon: CalendarCheck },
  { key: "videos", label: "영상 관리", icon: Video },
  { key: "clinic", label: "클리닉 관리", icon: Stethoscope },
  { key: "tests", label: "테스트 관리", icon: ListChecks },
  { key: "class", label: "수업 관리", icon: BookOpen },
  { key: "message", label: "문자", icon: MessageSquare },
  { key: "materials", label: "자료실", icon: FolderOpen },
  { key: "settings", label: "설정", icon: SettingsIcon },
];
const STUDENT_TABS = [
  { key: "videos", label: "영상 보기", icon: Video },
  { key: "attendance", label: "내 출결", icon: CalendarCheck },
  { key: "clinic", label: "클리닉 안내", icon: Stethoscope },
  { key: "materials", label: "자료실", icon: FolderOpen },
];

function TeacherApp(props) {
  const [tab, setTab] = useState("roster");
  return (
    <>
      <TabBar tabs={TEACHER_TABS} active={tab} onChange={setTab} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {tab === "roster" && <RosterView roster={props.roster} onUpdate={props.updateRoster} />}
        {tab === "attendance" && <TeacherAttendanceView roster={props.roster} attendance={props.attendance} videos={props.videos} watchLogs={props.watchLogs} onUpdate={props.updateAttendance} />}
        {tab === "videos" && <TeacherVideoView videos={props.videos} roster={props.roster} watchLogs={props.watchLogs} onAdd={(v) => props.updateVideos([...props.videos, v])} onDelete={(id) => props.updateVideos(props.videos.filter((v) => v.id !== id))} />}
        {tab === "clinic" && (
          <TeacherClinicView roster={props.roster} clinics={props.clinics} attendance={props.attendance} onUpdate={props.updateClinics} />
        )}
        {tab === "tests" && <TeacherTestView roster={props.roster} tests={props.tests} onUpdate={props.updateTests} />}
        {tab === "class" && <TeacherClassView classNotes={props.classNotes} onUpdate={props.updateClassNotes} />}
        {tab === "message" && <MessageView roster={props.roster} clinics={props.clinics} attendance={props.attendance} classNotes={props.classNotes} settings={props.settings} />}
        {tab === "materials" && <TeacherMaterialsView materials={props.materials} onAdd={(m) => props.updateMaterials([...props.materials, m])} onDelete={(id) => props.updateMaterials(props.materials.filter((m) => m.id !== id))} />}
        {tab === "settings" && <SettingsView settings={props.settings} onUpdate={props.updateSettings} onExport={props.onExport} onImport={props.onImport} />}
      </div>
    </>
  );
}

function StudentApp(props) {
  const [tab, setTab] = useState("videos");
  const { grade, name } = props.session;
  return (
    <>
      <TabBar tabs={STUDENT_TABS} active={tab} onChange={setTab} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {tab === "videos" && (
          <StudentVideosView
            grade={grade} name={name} videos={props.videos} watchLogs={props.watchLogs}
            onSaveProgress={(key, data) => props.updateWatchLogs({ ...props.watchLogs, [key]: { ...data, updatedAt: Date.now() } })}
          />
        )}
        {tab === "attendance" && <StudentAttendanceView grade={grade} name={name} attendance={props.attendance} videos={props.videos} watchLogs={props.watchLogs} />}
        {tab === "clinic" && <StudentClinicView grade={grade} name={name} clinics={props.clinics} />}
        {tab === "materials" && <StudentMaterialsView grade={grade} materials={props.materials} />}
      </div>
    </>
  );
}

/* ---------------------------------- 메인 App ---------------------------------- */
export default function App() {
  // ?staff=1 이 붙은 링크(교무실용)에서만 선생님 모드/학원 전환이 보이고,
  // 그 외(학생·학부모에게 공유하는 기본 링크)는 특정 학원 하나로 고정되고 학생/학부모 모드만 보입니다.
  const urlParams = new URLSearchParams(window.location.search);
  const isStaffMode = urlParams.get("staff") === "1";
  const urlAcademy = urlParams.get("academy");
  const defaultLockedAcademy = ACADEMIES.some((a) => a.id === urlAcademy) ? urlAcademy : "daechi-s";

  const [academy, setAcademy] = useState(isStaffMode ? null : defaultLockedAcademy); // null | 'daechi-s' | 'injaeuichang'
  const [loading, setLoading] = useState(false);
  const [roster, setRoster] = useState({ "25기": [], "24기": [], "23기": [] });
  const [videos, setVideos] = useState([]);
  const [watchLogs, setWatchLogs] = useState({});
  const [attendance, setAttendance] = useState({});
  const [clinics, setClinics] = useState({});
  const [tests, setTests] = useState({});
  const [classNotes, setClassNotes] = useState({});
  const [materials, setMaterials] = useState([]);
  const [settings, setSettings] = useState({ teacherPin: "0000", teacherSignature: "박래혁T", academyLabel: "" });

  const [role, setRole] = useState(null); // null | 'teacher-gate' | 'teacher' | 'student-login' | 'student'
  const [studentSession, setStudentSession] = useState(null);

  const academyInfo = ACADEMIES.find((a) => a.id === academy);
  const academyLabel = academyInfo?.label || "";

  useEffect(() => {
    if (!document.getElementById("pretendard-font")) {
      const link = document.createElement("link");
      link.id = "pretendard-font";
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css";
      document.head.appendChild(link);
    }
    if (!document.getElementById("plexmono-font")) {
      const link2 = document.createElement("link");
      link2.id = "plexmono-font";
      link2.rel = "stylesheet";
      link2.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&display=swap";
      document.head.appendChild(link2);
    }
  }, []);

  useEffect(() => {
    if (!academy) return;
    setLoading(true);
    (async () => {
      const info = ACADEMIES.find((a) => a.id === academy);
      const defaultSettings = { teacherPin: "0000", teacherSignature: "박래혁T", academyLabel: info?.defaultAcademyLabel || "" };
      const [r, v, w, a, c, m, s, te, cn] = await Promise.all([
        loadKey(storageKey("roster", academy), { "25기": [], "24기": [], "23기": [] }),
        loadKey(storageKey("videos", academy), []),
        loadKey(storageKey("watchLogs", academy), {}),
        loadKey(storageKey("attendance", academy), {}),
        loadKey(storageKey("clinics", academy), {}),
        loadKey(storageKey("materials", academy), []),
        loadKey(storageKey("settings", academy), defaultSettings),
        loadKey(storageKey("tests", academy), {}),
        loadKey(storageKey("classNotes", academy), {}),
      ]);
      let rosterData = r, videosData = v, watchLogsData = w, attendanceData = a;
      let clinicsData = Array.isArray(c) ? {} : c, materialsData = m;
      let testsData = Array.isArray(te) ? {} : te;
      let classNotesData = Array.isArray(cn) ? {} : cn;
      // 대치에스: 예전 고1/고2/고3 데이터를 25기/24기/23기로 자동 이전 (한 번만)
      if (academy === "daechi-s") {
        const migrated = migrateLegacyGrades({ roster: r, videos: v, watchLogs: w, attendance: a, clinics: clinicsData, materials: m });
        if (migrated.changed) {
          rosterData = migrated.roster; videosData = migrated.videos; watchLogsData = migrated.watchLogs;
          attendanceData = migrated.attendance; clinicsData = migrated.clinics; materialsData = migrated.materials;
          saveKey(storageKey("roster", academy), rosterData);
          saveKey(storageKey("videos", academy), videosData);
          saveKey(storageKey("watchLogs", academy), watchLogsData);
          saveKey(storageKey("attendance", academy), attendanceData);
          saveKey(storageKey("clinics", academy), clinicsData);
          saveKey(storageKey("materials", academy), materialsData);
        }
      }
      setRoster(rosterData); setVideos(videosData); setWatchLogs(watchLogsData); setAttendance(attendanceData);
      setClinics(clinicsData); setMaterials(materialsData);
      setTests(testsData); setClassNotes(classNotesData);
      setSettings({ ...defaultSettings, ...s });
      setLoading(false);
    })();
  }, [academy]);

  const updateRoster = (next) => { setRoster(next); saveKey(storageKey("roster", academy), next); };
  const updateVideos = (next) => { setVideos(next); saveKey(storageKey("videos", academy), next); };
  const updateWatchLogs = (next) => { setWatchLogs(next); saveKey(storageKey("watchLogs", academy), next); };
  const updateAttendance = (next) => { setAttendance(next); saveKey(storageKey("attendance", academy), next); };
  const updateClinics = (next) => { setClinics(next); saveKey(storageKey("clinics", academy), next); };
  const updateTests = (next) => { setTests(next); saveKey(storageKey("tests", academy), next); };
  const updateClassNotes = (next) => { setClassNotes(next); saveKey(storageKey("classNotes", academy), next); };
  const updateMaterials = (next) => { setMaterials(next); saveKey(storageKey("materials", academy), next); };
  const updateSettings = (next) => { setSettings(next); saveKey(storageKey("settings", academy), next); };

  const handleLogout = () => { setRole(null); setStudentSession(null); };
  const handleChangeAcademy = () => { setAcademy(null); setRole(null); setStudentSession(null); };
  const handleExport = () => {
    const payload = { academy, exportedAt: new Date().toISOString(), roster, videos, watchLogs, attendance, clinics, tests, classNotes, materials, settings };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${academy || "academy"}-data-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const handleImport = (payload) => {
    if (!payload || typeof payload !== "object") return;
    if (payload.roster) updateRoster(payload.roster);
    if (payload.videos) updateVideos(payload.videos);
    if (payload.watchLogs) updateWatchLogs(payload.watchLogs);
    if (payload.attendance) updateAttendance(payload.attendance);
    if (payload.clinics) updateClinics(payload.clinics);
    if (payload.tests) updateTests(payload.tests);
    if (payload.classNotes) updateClassNotes(payload.classNotes);
    if (payload.materials) updateMaterials(payload.materials);
    if (payload.settings) updateSettings({ ...settings, ...payload.settings });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: COLORS.bg, fontFamily: SANS }}>
      <Header
        academyLabel={academyLabel}
        role={role === "teacher" ? "teacher" : role === "student" ? "student" : role === "parent" ? "parent" : null}
        studentSession={studentSession}
        onLogout={handleLogout}
      />
      {!academy ? (
        <AcademySelectScreen onSelect={setAcademy} />
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: COLORS.muted }}>불러오는 중...</div>
      ) : !role ? (
        <LandingScreen academyLabel={academyLabel} onSelectRole={(r) => setRole(r === "teacher" ? "teacher-gate" : r === "parent" ? "parent-login" : "student-login")} onChangeAcademy={handleChangeAcademy} isStaffMode={isStaffMode} />
      ) : role === "teacher-gate" ? (
        <TeacherPinGate settings={settings} onSuccess={() => setRole("teacher")} onBack={() => setRole(null)} />
      ) : role === "student-login" ? (
        <StudentLoginFlow roster={roster} onLogin={(sess) => { setStudentSession(sess); setRole("student"); }} onBack={() => setRole(null)} />
      ) : role === "parent-login" ? (
        <ParentLoginFlow roster={roster} onLogin={(sess) => { setStudentSession(sess); setRole("parent"); }} onBack={() => setRole(null)} />
      ) : role === "teacher" ? (
        <TeacherApp
          roster={roster} videos={videos} watchLogs={watchLogs} attendance={attendance} clinics={clinics} tests={tests} classNotes={classNotes} materials={materials} settings={settings}
          updateRoster={updateRoster} updateVideos={updateVideos} updateWatchLogs={updateWatchLogs} updateAttendance={updateAttendance} updateClinics={updateClinics} updateTests={updateTests} updateClassNotes={updateClassNotes} updateMaterials={updateMaterials} updateSettings={updateSettings}
          onExport={handleExport}
          onImport={handleImport}
        />
      ) : role === "parent" ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <ParentReportView
            session={studentSession} roster={roster} attendance={attendance} clinics={clinics} tests={tests}
            classNotes={classNotes} videos={videos} watchLogs={watchLogs} settings={settings}
          />
        </div>
      ) : (
        <StudentApp
          session={studentSession}
          videos={videos} watchLogs={watchLogs} attendance={attendance} clinics={clinics} materials={materials}
          updateWatchLogs={updateWatchLogs}
        />
      )}
    </div>
  );
}
