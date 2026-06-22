import { useState, useEffect, useMemo } from "react";

/*
  ===================================================================
  설정 안내
  ===================================================================
  1. Firebase 콘솔(console.firebase.google.com)에서 새 프로젝트 생성
  2. Firestore Database 활성화 (서울 리전, 테스트 모드로 시작)
  3. 웹 앱(</>) 등록 후 나오는 firebaseConfig 값을 아래 FIREBASE_CONFIG에 붙여넣기
  4. 선생님 대표 PIN을 ADMIN_PIN에 원하는 숫자로 설정 (기본값: 0000)
  ===================================================================
*/

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDtrC9EA9QuhScv5o7ffwXNIwwZH_dLnwg",
  authDomain: "alpha-score-db.firebaseapp.com",
  projectId: "alpha-score-db",
  storageBucket: "alpha-score-db.firebasestorage.app",
  messagingSenderId: "450498607778",
  appId: "1:450498607778:web:614426e5efabd93e7635fb",
};

const ADMIN_PIN = "0000";

const GRAMMAR_ITEMS = [
  { key: "phonics", label: "Alpha Phonics", max: 10 },
  { key: "nuance", label: "Alpha Nuance", max: 4 },
  { key: "structureQ1", label: "Alpha Structure Q1", max: 6 },
  { key: "structureQ2", label: "Alpha Structure Q2", max: 6 },
  { key: "essay1", label: "Essay 1", max: 9 },
  { key: "essay2", label: "Essay 2", max: 10 },
  { key: "essay3", label: "Essay 3", max: 17 },
  { key: "essay4", label: "Essay 4", max: 9 },
];
const COMP_ITEMS = [
  { key: "essay1", label: "Essay 1", max: 10 },
  { key: "essay2", label: "Essay 2", max: 14 },
  { key: "essay3", label: "Essay 3", max: 16 },
];
const GRAMMAR_MAX = GRAMMAR_ITEMS.reduce((s, i) => s + i.max, 0);
const COMP_MAX = COMP_ITEMS.reduce((s, i) => s + i.max, 0);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

let firebaseAppPromise = null;
function loadFirebase() {
  if (firebaseAppPromise) return firebaseAppPromise;
  firebaseAppPromise = (async () => {
    const { initializeApp } = await import(
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"
    );
    const {
      getFirestore,
      collection,
      doc,
      getDocs,
      setDoc,
      deleteDoc,
      onSnapshot,
    } = await import(
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"
    );
    const app = initializeApp(FIREBASE_CONFIG);
    const db = getFirestore(app);
    return { db, collection, doc, getDocs, setDoc, deleteDoc, onSnapshot };
  })();
  return firebaseAppPromise;
}

function genId() {
  return "id" + Date.now() + Math.random().toString(36).slice(2, 8);
}

function escapeForCsv(str) {
  const s = String(str);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export default function App() {
  const [fb, setFb] = useState(null);
  const [fbError, setFbError] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  const [students, setStudents] = useState([]);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState("input");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let unsubStudents = () => {};
    let unsubScores = () => {};
    (async () => {
      try {
        const lib = await loadFirebase();
        setFb(lib);
        const studentsCol = lib.collection(lib.db, "students");
        const scoresCol = lib.collection(lib.db, "scores");
        unsubStudents = lib.onSnapshot(studentsCol, (snap) => {
          setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
        unsubScores = lib.onSnapshot(scoresCol, (snap) => {
          setScores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
        setLoading(false);
      } catch (e) {
        setFbError(
          "Firebase 연결에 실패했어요. firebaseConfig 값이 올바르게 입력되었는지 확인해주세요."
        );
        setLoading(false);
      }
    })();
    return () => {
      unsubStudents();
      unsubScores();
    };
  }, []);

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2200);
  }

  function handlePinSubmit() {
    if (pinInput === ADMIN_PIN) {
      setLoggedIn(true);
      setPinError("");
    } else {
      setPinError("PIN이 일치하지 않아요.");
      setPinInput("");
    }
  }

  if (!loggedIn) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f5f3",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: "2.5rem 2rem",
            width: 320,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>
            알파 진단평가 점수관리
          </h1>
          <p style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>
            선생님 PIN을 입력해주세요
          </p>
          <input
            type="password"
            inputMode="numeric"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handlePinSubmit();
            }}
            autoFocus
            style={{
              width: "100%",
              fontSize: 20,
              padding: "10px 12px",
              textAlign: "center",
              letterSpacing: 4,
              border: "1px solid #ddd",
              borderRadius: 8,
              marginBottom: 12,
              boxSizing: "border-box",
            }}
            placeholder="••••"
          />
          {pinError && (
            <p style={{ color: "#c0392b", fontSize: 13, marginBottom: 12 }}>
              {pinError}
            </p>
          )}
          <button
            onClick={handlePinSubmit}
            style={{
              width: "100%",
              background: "#222",
              color: "white",
              border: "none",
              padding: "10px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            입장하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <MainApp
      fb={fb}
      fbError={fbError}
      loading={loading}
      students={students}
      scores={scores}
      tab={tab}
      setTab={setTab}
      toast={toast}
      showToast={showToast}
    />
  );
}

function MainApp({ fb, fbError, loading, students, scores, tab, setTab, toast, showToast }) {
  const classes = useMemo(
    () => Array.from(new Set(students.map((s) => s.class))).sort(),
    [students]
  );

  async function addStudent(name, cls) {
    if (!fb) return;
    const id = genId();
    try {
      await fb.setDoc(fb.doc(fb.db, "students", id), { name, class: cls });
      showToast("학생이 추가되었습니다", true);
    } catch (e) {
      showToast("저장 실패: " + e.message, false);
    }
  }

  async function updateStudent(id, field, value) {
    if (!fb) return;
    const student = students.find((s) => s.id === id);
    if (!student) return;
    try {
      await fb.setDoc(
        fb.doc(fb.db, "students", id),
        { ...student, [field]: value },
        { merge: true }
      );
      showToast("수정되었습니다", true);
    } catch (e) {
      showToast("수정 실패: " + e.message, false);
    }
  }

  async function deleteStudent(id) {
    if (!fb) return;
    try {
      await fb.deleteDoc(fb.doc(fb.db, "students", id));
      const related = scores.filter((r) => r.studentId === id);
      for (const r of related) {
        await fb.deleteDoc(fb.doc(fb.db, "scores", r.id));
      }
      showToast("삭제되었습니다", true);
    } catch (e) {
      showToast("삭제 실패: " + e.message, false);
    }
  }

  async function saveScore(record) {
    if (!fb) return;
    const existing = scores.find(
      (r) =>
        r.studentId === record.studentId &&
        r.year === record.year &&
        r.month === record.month &&
        r.round === record.round
    );
    const id = existing ? existing.id : genId();
    try {
      await fb.setDoc(fb.doc(fb.db, "scores", id), {
        ...record,
        updatedAt: new Date().toISOString(),
      });
      showToast("저장되었습니다", true);
    } catch (e) {
      showToast("저장 실패: " + e.message, false);
    }
  }

  if (fbError) {
    return (
      <div style={{ padding: "3rem 1.5rem", maxWidth: 480, margin: "0 auto", fontFamily: "sans-serif" }}>
        <p style={{ color: "#c0392b", fontSize: 14, lineHeight: 1.6 }}>{fbError}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "#888", fontFamily: "sans-serif" }}>
        불러오는 중...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "1.5rem 1rem 3rem", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 16 }}>알파 진단평가 점수관리</h1>

      {toast && (
        <div
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            background: toast.ok ? "#27ae60" : "#c0392b",
            color: "white",
            padding: "10px 16px",
            borderRadius: 8,
            fontSize: 13,
            zIndex: 1000,
          }}
        >
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #e5e5e3", marginBottom: 20, overflowX: "auto" }}>
        {[
          ["input", "점수 입력"],
          ["class", "반별 보기"],
          ["trend", "점수 변화"],
          ["manage", "학생 관리"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              border: "none",
              background: "none",
              padding: "10px 6px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
              color: tab === key ? "#222" : "#888",
              borderBottom: tab === key ? "2px solid #222" : "2px solid transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "input" && (
        <InputPanel students={students} classes={classes} onSave={saveScore} />
      )}
      {tab === "class" && <ClassPanel students={students} scores={scores} classes={classes} />}
      {tab === "trend" && <TrendPanel students={students} scores={scores} />}
      {tab === "manage" && (
        <ManagePanel
          students={students}
          onAdd={addStudent}
          onUpdate={updateStudent}
          onDelete={deleteStudent}
        />
      )}
    </div>
  );
}

function FieldRow({ label, value, max, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "8px 0",
        borderBottom: "1px solid #efefec",
      }}
    >
      <span style={{ fontSize: 14 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="number"
          min={0}
          max={max}
          value={value}
          onChange={(e) => {
            let v = e.target.value === "" ? "" : parseInt(e.target.value);
            if (v !== "" && v > max) v = max;
            if (v !== "" && v < 0) v = 0;
            onChange(v);
          }}
          placeholder="0"
          style={{
            width: 64,
            textAlign: "right",
            padding: "6px 8px",
            border: "1px solid #ddd",
            borderRadius: 6,
            fontSize: 14,
          }}
        />
        <span style={{ fontSize: 13, color: "#888", minWidth: 32 }}>/ {max}</span>
      </div>
    </div>
  );
}

function InputPanel({ students, classes, onSave }) {
  const [cls, setCls] = useState("__all__");
  const [studentId, setStudentId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [round, setRound] = useState("1차");
  const [grammar, setGrammar] = useState({});
  const [comp, setComp] = useState({});

  const filteredStudents = useMemo(
    () => (cls === "__all__" ? students : students.filter((s) => s.class === cls)),
    [students, cls]
  );

  useEffect(() => {
    if (filteredStudents.length > 0 && !filteredStudents.find((s) => s.id === studentId)) {
      setStudentId(filteredStudents[0].id);
    } else if (filteredStudents.length === 0) {
      setStudentId("");
    }
  }, [filteredStudents]);

  const gSum = GRAMMAR_ITEMS.reduce((s, it) => s + (parseInt(grammar[it.key]) || 0), 0);
  const cSum = COMP_ITEMS.reduce((s, it) => s + (parseInt(comp[it.key]) || 0), 0);

  function handleSave() {
    if (!studentId) {
      return;
    }
    onSave({
      studentId,
      year: parseInt(year),
      month: parseInt(month),
      round,
      grammarDetail: grammar,
      compDetail: comp,
      grammar: gSum,
      comp: cSum,
      total: gSum + cSum,
    });
    setGrammar({});
    setComp({});
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 13, color: "#888", display: "block", marginBottom: 4 }}>반</label>
          <select value={cls} onChange={(e) => setCls(e.target.value)} style={selectStyle}>
            <option value="__all__">전체</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 13, color: "#888", display: "block", marginBottom: 4 }}>학생</label>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} style={selectStyle}>
            {filteredStudents.length === 0 ? (
              <option value="">(학생 없음)</option>
            ) : (
              filteredStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {cls === "__all__" ? `(${s.class})` : ""}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        <div>
          <label style={{ fontSize: 13, color: "#888", display: "block", marginBottom: 4 }}>연도</label>
          <input type="number" value={year} onChange={(e) => setYear(e.target.value)} style={selectStyle} />
        </div>
        <div>
          <label style={{ fontSize: 13, color: "#888", display: "block", marginBottom: 4 }}>월</label>
          <select value={month} onChange={(e) => setMonth(e.target.value)} style={selectStyle}>
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 13, color: "#888", display: "block", marginBottom: 4 }}>회차</label>
          <select value={round} onChange={(e) => setRound(e.target.value)} style={selectStyle}>
            <option value="1차">1차</option>
            <option value="2차">2차</option>
          </select>
        </div>
      </div>

      <div style={{ background: "#993C1D", borderRadius: "10px 10px 0 0", padding: "10px 14px" }}>
        <span style={{ color: "#FAECE7", fontSize: 14, fontWeight: 500 }}>Grammar Assessment</span>
      </div>
      <div style={{ border: "1px solid #e5e5e3", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "0 1rem", marginBottom: 16 }}>
        {GRAMMAR_ITEMS.map((it) => (
          <FieldRow
            key={it.key}
            label={it.label}
            max={it.max}
            value={grammar[it.key] ?? ""}
            onChange={(v) => setGrammar((g) => ({ ...g, [it.key]: v }))}
          />
        ))}
      </div>

      <div style={{ background: "#185FA5", borderRadius: "10px 10px 0 0", padding: "10px 14px" }}>
        <span style={{ color: "#E6F1FB", fontSize: 14, fontWeight: 500 }}>Composition Assessment</span>
      </div>
      <div style={{ border: "1px solid #e5e5e3", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "0 1rem", marginBottom: 16 }}>
        {COMP_ITEMS.map((it) => (
          <FieldRow
            key={it.key}
            label={it.label}
            max={it.max}
            value={comp[it.key] ?? ""}
            onChange={(v) => setComp((c) => ({ ...c, [it.key]: v }))}
          />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        <MetricCard label="Grammar 소계" value={`${gSum} / ${GRAMMAR_MAX}`} />
        <MetricCard label="Composition 소계" value={`${cSum} / ${COMP_MAX}`} />
        <MetricCard label="전체 총합" value={`${gSum + cSum} / ${GRAMMAR_MAX + COMP_MAX}`} />
      </div>

      <button
        onClick={handleSave}
        disabled={!studentId}
        style={{
          width: "100%",
          background: studentId ? "#222" : "#ccc",
          color: "white",
          border: "none",
          padding: 10,
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          cursor: studentId ? "pointer" : "not-allowed",
        }}
      >
        저장
      </button>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div style={{ background: "#f5f5f3", borderRadius: 8, padding: "0.75rem 1rem" }}>
      <p style={{ fontSize: 12, color: "#888", margin: "0 0 4px" }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>{value}</p>
    </div>
  );
}

function ClassPanel({ students, scores, classes }) {
  const [cls, setCls] = useState(classes[0] || "");

  useEffect(() => {
    if (classes.length > 0 && !classes.includes(cls)) setCls(classes[0]);
  }, [classes]);

  const list = students.filter((s) => s.class === cls);

  function downloadCsv() {
    const header = [
      "반", "이름", "연도", "월", "회차",
      "Alpha Phonics(/10)", "Alpha Nuance(/4)", "Alpha Structure Q1(/6)", "Alpha Structure Q2(/6)",
      "Essay1-G(/9)", "Essay2-G(/10)", "Essay3-G(/17)", "Essay4-G(/9)", "Grammar 소계(/71)",
      "Essay1-C(/10)", "Essay2-C(/14)", "Essay3-C(/16)", "Composition 소계(/40)", "전체 총합(/111)",
    ];
    const rows = scores
      .slice()
      .sort((a, b) => {
        const sa = students.find((s) => s.id === a.studentId);
        const sb = students.find((s) => s.id === b.studentId);
        return (
          (sa?.class || "").localeCompare(sb?.class || "") ||
          a.year - b.year ||
          a.month - b.month ||
          (a.round > b.round ? 1 : -1)
        );
      })
      .map((r) => {
        const s = students.find((st) => st.id === r.studentId);
        const gd = r.grammarDetail || {};
        const cd = r.compDetail || {};
        return [
          s ? s.class : "", s ? s.name : "(삭제된 학생)", r.year, r.month, r.round,
          gd.phonics ?? 0, gd.nuance ?? 0, gd.structureQ1 ?? 0, gd.structureQ2 ?? 0,
          gd.essay1 ?? 0, gd.essay2 ?? 0, gd.essay3 ?? 0, gd.essay4 ?? 0, r.grammar ?? 0,
          cd.essay1 ?? 0, cd.essay2 ?? 0, cd.essay3 ?? 0, r.comp ?? 0, r.total ?? 0,
        ];
      });
    if (rows.length === 0) return;
    const csv = [header, ...rows].map((row) => row.map(escapeForCsv).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    a.href = url;
    a.download = `진단평가_점수_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 13, color: "#888", display: "block", marginBottom: 4 }}>반 선택</label>
          <select value={cls} onChange={(e) => setCls(e.target.value)} style={{ ...selectStyle, maxWidth: 200 }}>
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={downloadCsv}
          style={{
            background: "none",
            border: "1px solid #ccc",
            padding: "0 14px",
            height: 36,
            borderRadius: 8,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          엑셀 내보내기
        </button>
      </div>
      {list.length === 0 ? (
        <p style={{ fontSize: 14, color: "#888", padding: "1rem 0" }}>이 반에는 학생이 없어요.</p>
      ) : (
        list.map((s) => {
          const studentScores = scores
            .filter((r) => r.studentId === s.id)
            .sort((a, b) => b.year - a.year || b.month - a.month || (b.round > a.round ? 1 : -1));
          const latest = studentScores[0];
          return (
            <div
              key={s.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #efefec" }}
            >
              <div>
                <p style={{ fontWeight: 500, fontSize: 14, margin: 0 }}>{s.name}</p>
                <p style={{ fontSize: 12, color: "#888", margin: "2px 0 0" }}>
                  {latest ? `${latest.year}년 ${latest.month}월 ${latest.round}` : "기록 없음"}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                {latest ? (
                  <>
                    <span style={{ fontSize: 18, fontWeight: 500 }}>{latest.total}</span>
                    <p style={{ fontSize: 11, color: "#888", margin: 0 }}>
                      G {latest.grammar}/71 · C {latest.comp}/40
                    </p>
                  </>
                ) : (
                  <span style={{ fontSize: 13, color: "#bbb" }}>—</span>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function TrendPanel({ students, scores }) {
  const [studentId, setStudentId] = useState(students[0]?.id || "");

  useEffect(() => {
    if (students.length > 0 && !students.find((s) => s.id === studentId)) {
      setStudentId(students[0].id);
    }
  }, [students]);

  const studentScores = scores
    .filter((r) => r.studentId === studentId)
    .sort((a, b) => a.year - b.year || a.month - b.month || (a.round > b.round ? 1 : -1));

  const maxTotal = GRAMMAR_MAX + COMP_MAX;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: "#888", display: "block", marginBottom: 4 }}>학생 선택</label>
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)} style={{ ...selectStyle, maxWidth: 200 }}>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.class})
            </option>
          ))}
        </select>
      </div>

      {studentScores.length === 0 ? (
        <p style={{ fontSize: 14, color: "#888", padding: "2rem 0", textAlign: "center" }}>아직 기록된 점수가 없어요.</p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 200, marginBottom: 24, borderBottom: "1px solid #e5e5e3", paddingBottom: 4 }}>
            {studentScores.map((r, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 11, color: "#888" }}>{r.total}</span>
                <div
                  style={{
                    width: "100%",
                    maxWidth: 32,
                    background: "#185FA5",
                    borderRadius: "4px 4px 0 0",
                    height: `${(r.total / maxTotal) * 160}px`,
                  }}
                />
                <span style={{ fontSize: 10, color: "#888", textAlign: "center" }}>
                  {r.year}.{String(r.month).padStart(2, "0")}
                  <br />
                  {r.round}
                </span>
              </div>
            ))}
          </div>

          {studentScores
            .slice()
            .reverse()
            .map((r, i) => {
              const gd = r.grammarDetail || {};
              const cd = r.compDetail || {};
              return (
                <details key={i} style={{ borderBottom: "1px solid #efefec", padding: "8px 0" }}>
                  <summary style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", fontSize: 13, listStyle: "none" }}>
                    <span style={{ color: "#888" }}>
                      {r.year}년 {r.month}월 · {r.round}
                    </span>
                    <span>
                      G {r.grammar} / C {r.comp} = <strong style={{ fontWeight: 500 }}>{r.total}</strong>
                    </span>
                  </summary>
                  <div style={{ fontSize: 12, color: "#888", padding: "8px 0 0 4px", lineHeight: 1.6 }}>
                    <p style={{ margin: "0 0 4px" }}>
                      <strong style={{ fontWeight: 500, color: "#222" }}>Grammar:</strong>{" "}
                      {GRAMMAR_ITEMS.map((it) => `${it.label} ${gd[it.key] ?? 0}/${it.max}`).join(", ")}
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong style={{ fontWeight: 500, color: "#222" }}>Composition:</strong>{" "}
                      {COMP_ITEMS.map((it) => `${it.label} ${cd[it.key] ?? 0}/${it.max}`).join(", ")}
                    </p>
                  </div>
                </details>
              );
            })}
        </>
      )}
    </div>
  );
}

function ManagePanel({ students, onAdd, onUpdate, onDelete }) {
  const [name, setName] = useState("");
  const [cls, setCls] = useState("");

  const byClass = useMemo(() => {
    const map = {};
    students.forEach((s) => {
      (map[s.class] = map[s.class] || []).push(s);
    });
    return map;
  }, [students]);

  function handleAdd() {
    if (!name.trim() || !cls.trim()) return;
    onAdd(name.trim(), cls.trim());
    setName("");
    setCls("");
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="학생 이름" style={{ ...selectStyle, flex: 1 }} />
        <input value={cls} onChange={(e) => setCls(e.target.value)} placeholder="반 이름" style={{ ...selectStyle, flex: 1 }} />
        <button
          onClick={handleAdd}
          style={{ background: "#222", color: "white", border: "none", padding: "0 16px", borderRadius: 8, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          학생 추가
        </button>
      </div>

      {students.length === 0 ? (
        <p style={{ fontSize: 14, color: "#888" }}>등록된 학생이 없어요.</p>
      ) : (
        Object.keys(byClass)
          .sort()
          .map((c) => (
            <div key={c} style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: "#888", margin: "0 0 6px" }}>{c}</p>
              {byClass[c].map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #efefec" }}>
                  <input
                    defaultValue={s.name}
                    onBlur={(e) => {
                      if (e.target.value.trim() && e.target.value !== s.name) onUpdate(s.id, "name", e.target.value.trim());
                    }}
                    style={{ border: "none", background: "none", fontSize: 14, flex: 1, padding: 4 }}
                  />
                  <input
                    defaultValue={s.class}
                    onBlur={(e) => {
                      if (e.target.value.trim() && e.target.value !== s.class) onUpdate(s.id, "class", e.target.value.trim());
                    }}
                    style={{ border: "none", background: "none", fontSize: 13, color: "#888", width: 100, padding: 4 }}
                  />
                  <button
                    onClick={() => {
                      if (window.confirm("이 학생을 삭제할까요? 관련 점수 기록도 함께 삭제됩니다.")) onDelete(s.id);
                    }}
                    style={{ border: "none", background: "none", cursor: "pointer", color: "#888", padding: 4 }}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          ))
      )}
    </div>
  );
}

const selectStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #ddd",
  borderRadius: 8,
  fontSize: 14,
  boxSizing: "border-box",
};
