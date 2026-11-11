import { useState, useEffect, useMemo } from "react";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDtrC9EA9QuhScv5o7ffwXNIwwZH_dLnwg",
  authDomain: "alpha-score-db.firebaseapp.com",
  projectId: "alpha-score-db",
  storageBucket: "alpha-score-db.firebasestorage.app",
  messagingSenderId: "450498607778",
  appId: "1:450498607778:web:614426e5efabd93e7635fb",
};

const ADMIN_PIN = "0000";

/*
  회차별 시험지 구성 (문항 수 = 만점, 문항 1개 = 1점)
  시험지가 바뀌면 아래 max 숫자만 고치면 돼요.
*/
const TESTS = {
  "1차": {
    grammar: [
      { key: "phonics", label: "Alpha Phonics", max: 10 },
      { key: "nuance", label: "Alpha Nuance", max: 4 },
      { key: "structureQ1", label: "Alpha Structure Q1", max: 6 },
      { key: "structureQ2", label: "Alpha Structure Q2", max: 6 },
      { key: "essay1", label: "Essay 1", max: 9 },
      { key: "essay2", label: "Essay 2", max: 10 },
      { key: "essay3", label: "Essay 3", max: 17 },
      { key: "essay4", label: "Essay 4", max: 9 },
    ],
    comp: [
      { key: "essay1", label: "Essay 1", max: 10 },
      { key: "essay2", label: "Essay 2", max: 14 },
      { key: "essay3", label: "Essay 3", max: 16 },
    ],
  },
  "2차": {
    grammar: [
      { key: "nuance", label: "Alpha Nuance", max: 8 },
      { key: "structureQ1", label: "Alpha Structure Q1", max: 7 },
      { key: "structureQ2", label: "Alpha Structure Q2", max: 6 },
      { key: "essay1", label: "Essay 1", max: 9 },
      { key: "essay2", label: "Essay 2", max: 10 },
      { key: "essay3", label: "Essay 3", max: 17 },
      { key: "essay4", label: "Essay 4", max: 9 },
    ],
    comp: [
      { key: "essay1", label: "Essay 1", max: 20 },
      { key: "essay2", label: "Essay 2", max: 20 },
      { key: "essay3", label: "Essay 3", max: 20 },
      { key: "essay4", label: "Essay 4", max: 20 },
    ],
  },
};
const ROUNDS = Object.keys(TESTS);

function sumMax(items) {
  return items.reduce((s, i) => s + i.max, 0);
}

function getTest(round) {
  const t = TESTS[round] || TESTS["1차"];
  const gMax = sumMax(t.grammar);
  const cMax = sumMax(t.comp);
  return { grammar: t.grammar, comp: t.comp, gMax, cMax, max: gMax + cMax };
}

// 기록 하나에 대해 "실제로 응시한 문항"만 반영한 시험 구성
// (gTaken/cTaken이 없는 예전 기록은 전부 응시한 것으로 봐요)
function getTestFor(rec) {
  const base = getTest(rec.round);
  const g = rec.gTaken ? base.grammar.filter((i) => rec.gTaken.includes(i.key)) : base.grammar;
  const c = rec.cTaken ? base.comp.filter((i) => rec.cTaken.includes(i.key)) : base.comp;
  const gMax = sumMax(g);
  const cMax = sumMax(c);
  return { grammar: g, comp: c, gMax, cMax, max: gMax + cMax };
}

// 엑셀 내보내기용: 1차·2차 항목을 모두 합친 열 목록
const CSV_GRAMMAR = [
  ["phonics", "Alpha Phonics"],
  ["nuance", "Alpha Nuance"],
  ["structureQ1", "Alpha Structure Q1"],
  ["structureQ2", "Alpha Structure Q2"],
  ["essay1", "Essay 1"],
  ["essay2", "Essay 2"],
  ["essay3", "Essay 3"],
  ["essay4", "Essay 4"],
];
const CSV_COMP = [
  ["essay1", "Essay 1"],
  ["essay2", "Essay 2"],
  ["essay3", "Essay 3"],
  ["essay4", "Essay 4"],
];

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const GRADES = ["초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3"];

// 시험범위: 선택한 항목까지만 응시한 것으로 계산
const RANGES = [
  { value: "nuance", label: "Nuance" },
  { value: "structure", label: "Structure" },
  { value: "essay1", label: "Essay 1" },
  { value: "essay2", label: "Essay 2" },
  { value: "essay3", label: "Essay 3" },
  { value: "essay4", label: "Essay 4" },
];
function levelOf(key) {
  if (key === "phonics" || key === "nuance") return 0;
  if (key.startsWith("structure")) return 1;
  const m = key.match(/^essay(\d)$/);
  return m ? parseInt(m[1]) + 1 : 0;
}

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
    const { getAuth, signInAnonymously, onAuthStateChanged } = await import(
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"
    );
    const app = initializeApp(FIREBASE_CONFIG);
    const db = getFirestore(app);
    const auth = getAuth(app);

    await new Promise((resolve, reject) => {
      const unsub = onAuthStateChanged(auth, (user) => {
        unsub();
        if (user) {
          resolve(user);
        } else {
          signInAnonymously(auth).then(resolve).catch(reject);
        }
      });
    });

    return { db, collection, doc, getDocs, setDoc, deleteDoc, onSnapshot };
  })().catch((e) => {
    firebaseAppPromise = null;
    throw e;
  });
  return firebaseAppPromise;
}

function explainFirebaseError(e) {
  const code = (e && e.code) || "";
  const msg = (e && e.message) || String(e);
  let hint = "";
  if (code === "auth/operation-not-allowed" || code === "auth/admin-restricted-operation") {
    hint = "익명 로그인이 꺼져 있어요. Firebase 콘솔 → Authentication → 로그인 방법(Sign-in method)에서 '익명'을 사용 설정하고 저장해 주세요.";
  } else if (code === "auth/configuration-not-found") {
    hint = "Firebase 콘솔 → Authentication에서 '시작하기' 버튼을 먼저 눌러 주세요.";
  } else if (code === "auth/network-request-failed") {
    hint = "인터넷 연결 문제이거나 네트워크가 막혀 있어요. 연결을 확인하고 새로고침해 주세요.";
  } else if (code === "auth/invalid-api-key" || code === "auth/api-key-not-valid" || /api.?key/i.test(msg)) {
    hint = "firebaseConfig의 apiKey 값이 올바른지 확인해 주세요.";
  } else if (code === "auth/unauthorized-domain") {
    hint = "Firebase 콘솔 → Authentication → 설정 → 승인된 도메인에 이 사이트 주소를 추가해 주세요.";
  } else if (code === "permission-denied") {
    hint = "Firestore 규칙이 접근을 막고 있어요. 규칙 탭에서 'allow read, write: if request.auth != null;' 로 게시했는지 확인해 주세요.";
  } else {
    hint = "아래 오류 코드를 Claude에게 알려주세요.";
  }
  return `Firebase 연결에 실패했어요. ${hint} (오류 코드: ${code || msg})`;
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
        unsubStudents = lib.onSnapshot(
          studentsCol,
          (snap) => {
            setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          },
          (err) => setFbError(explainFirebaseError(err))
        );
        unsubScores = lib.onSnapshot(
          scoresCol,
          (snap) => {
            setScores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          },
          (err) => setFbError(explainFirebaseError(err))
        );
        setLoading(false);
      } catch (e) {
        setFbError(explainFirebaseError(e));
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

  async function addStudent(name, cls, grade) {
    if (!fb) return;
    const id = genId();
    try {
      await fb.setDoc(fb.doc(fb.db, "students", id), { name, class: cls, grade });
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
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 12, background: "#222", color: "white", border: "none", padding: "8px 16px", borderRadius: 8, fontSize: 14, cursor: "pointer" }}
        >
          다시 시도
        </button>
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

function FieldRow({ label, value, max, onChange, taken }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "8px 0",
        borderBottom: "1px solid #efefec",
        opacity: taken ? 1 : 0.4,
      }}
    >
      <span style={{ fontSize: 14 }}>
        {label} {!taken && <span style={{ fontSize: 11, color: "#aaa" }}>(범위 밖)</span>}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="number"
          min={0}
          max={max}
          value={taken ? value : ""}
          disabled={!taken}
          onChange={(e) => {
            let v = e.target.value === "" ? "" : parseInt(e.target.value);
            if (v !== "" && v > max) v = max;
            if (v !== "" && v < 0) v = 0;
            onChange(v);
          }}
          placeholder={taken ? "0" : "-"}
          style={{
            width: 64,
            textAlign: "right",
            padding: "6px 8px",
            border: "1px solid #ddd",
            borderRadius: 6,
            fontSize: 14,
            background: taken ? "white" : "#f0f0ee",
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
  const [round, setRound] = useState(ROUNDS[0]);
  const [range, setRange] = useState("essay4");
  const [grammar, setGrammar] = useState({});
  const [comp, setComp] = useState({});

  const baseTest = getTest(round);
  const rangeIdx = RANGES.findIndex((r) => r.value === range);
  const gItems = baseTest.grammar.filter((it) => levelOf(it.key) <= rangeIdx);
  const cItems = baseTest.comp.filter((it) => levelOf(it.key) <= rangeIdx);
  const gMax = sumMax(gItems);
  const cMax = sumMax(cItems);

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

  useEffect(() => {
    setGrammar({});
    setComp({});
  }, [round]);

  const gSum = gItems.reduce((s, it) => s + (parseInt(grammar[it.key]) || 0), 0);
  const cSum = cItems.reduce((s, it) => s + (parseInt(comp[it.key]) || 0), 0);

  function handleSave() {
    if (!studentId) {
      return;
    }
    const grammarDetail = {};
    gItems.forEach((it) => {
      grammarDetail[it.key] = parseInt(grammar[it.key]) || 0;
    });
    const compDetail = {};
    cItems.forEach((it) => {
      compDetail[it.key] = parseInt(comp[it.key]) || 0;
    });
    onSave({
      studentId,
      year: parseInt(year),
      month: parseInt(month),
      round,
      grammarDetail,
      compDetail,
      gTaken: gItems.map((it) => it.key),
      cTaken: cItems.map((it) => it.key),
      grammar: gSum,
      comp: cSum,
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
                  {s.name} {s.grade ? `· ${s.grade}` : ""} {cls === "__all__" ? `(${s.class})` : ""}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
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
            {ROUNDS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 13, color: "#888", display: "block", marginBottom: 4 }}>
          시험범위 (선택한 항목까지 응시)
        </label>
        <select value={range} onChange={(e) => setRange(e.target.value)} style={selectStyle}>
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}까지
            </option>
          ))}
        </select>
      </div>
      <p style={{ fontSize: 12, color: "#888", margin: "0 0 20px" }}>
        {round} 진단평가 · Grammar {gMax}점 / Composition {cMax}점 (시험범위 기준)
      </p>

      <div style={{ background: "#993C1D", borderRadius: "10px 10px 0 0", padding: "10px 14px" }}>
        <span style={{ color: "#FAECE7", fontSize: 14, fontWeight: 500 }}>Grammar Assessment</span>
      </div>
      <div style={{ border: "1px solid #e5e5e3", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "0 1rem", marginBottom: 16 }}>
        {baseTest.grammar.map((it) => (
          <FieldRow
            key={round + "-g-" + it.key}
            label={it.label}
            max={it.max}
            value={grammar[it.key] ?? ""}
            taken={levelOf(it.key) <= rangeIdx}
            onChange={(v) => setGrammar((g) => ({ ...g, [it.key]: v }))}
          />
        ))}
      </div>

      <div style={{ background: "#185FA5", borderRadius: "10px 10px 0 0", padding: "10px 14px" }}>
        <span style={{ color: "#E6F1FB", fontSize: 14, fontWeight: 500 }}>Composition Assessment</span>
      </div>
      <div style={{ border: "1px solid #e5e5e3", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "0 1rem", marginBottom: 16 }}>
        {baseTest.comp.map((it) => (
          <FieldRow
            key={round + "-c-" + it.key}
            label={it.label}
            max={it.max}
            value={comp[it.key] ?? ""}
            taken={levelOf(it.key) <= rangeIdx}
            onChange={(v) => setComp((c) => ({ ...c, [it.key]: v }))}
          />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <MetricCard label="Grammar 점수" value={`${gSum} / ${gMax}`} />
        <MetricCard label="Composition 점수" value={`${cSum} / ${cMax}`} />
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
      "반", "학년", "이름", "연도", "월", "회차",
      ...CSV_GRAMMAR.map(([, label]) => `Grammar ${label}`),
      "Grammar 소계",
      ...CSV_COMP.map(([, label]) => `Composition ${label}`),
      "Composition 소계",
      "Grammar 만점", "Composition 만점",
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
        const t = getTestFor(r);
        const gKeys = new Set(t.grammar.map((i) => i.key));
        const cKeys = new Set(t.comp.map((i) => i.key));
        const gd = r.grammarDetail || {};
        const cd = r.compDetail || {};
        return [
          s ? s.class : "", s ? s.grade || "" : "", s ? s.name : "(삭제된 학생)", r.year, r.month, r.round,
          ...CSV_GRAMMAR.map(([key]) => (gKeys.has(key) ? gd[key] ?? 0 : "")),
          r.grammar ?? 0,
          ...CSV_COMP.map(([key]) => (cKeys.has(key) ? cd[key] ?? 0 : "")),
          r.comp ?? 0,
          t.gMax, t.cMax,
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
          const lt = latest ? getTestFor(latest) : null;
          return (
            <div
              key={s.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #efefec" }}
            >
              <div>
                <p style={{ fontWeight: 500, fontSize: 14, margin: 0 }}>
                  {s.name} {s.grade && <span style={{ color: "#888", fontWeight: 400 }}>· {s.grade}</span>}
                </p>
                <p style={{ fontSize: 12, color: "#888", margin: "2px 0 0" }}>
                  {latest ? `${latest.year}년 ${latest.month}월 ${latest.round}` : "기록 없음"}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                {latest ? (
                  <>
                    <p style={{ fontSize: 14, margin: 0 }}>
                      <span style={{ color: "#993C1D" }}>Grammar</span>{" "}
                      <span style={{ fontWeight: 500 }}>{latest.grammar}</span>
                      <span style={{ fontSize: 12, color: "#888" }}> / {lt.gMax}</span>
                    </p>
                    <p style={{ fontSize: 14, margin: "2px 0 0" }}>
                      <span style={{ color: "#185FA5" }}>Composition</span>{" "}
                      <span style={{ fontWeight: 500 }}>{latest.comp}</span>
                      <span style={{ fontSize: 12, color: "#888" }}> / {lt.cMax}</span>
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

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: "#888", display: "block", marginBottom: 4 }}>학생 선택</label>
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)} style={{ ...selectStyle, maxWidth: 200 }}>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.class}{s.grade ? ` · ${s.grade}` : ""})
            </option>
          ))}
        </select>
      </div>

      {studentScores.length === 0 ? (
        <p style={{ fontSize: 14, color: "#888", padding: "2rem 0", textAlign: "center" }}>아직 기록된 점수가 없어요.</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 16, marginBottom: 8, fontSize: 12, color: "#888" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "#993C1D", display: "inline-block" }} />
              Grammar
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "#185FA5", display: "inline-block" }} />
              Composition
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 210, marginBottom: 8, borderBottom: "1px solid #e5e5e3", paddingBottom: 4 }}>
            {studentScores.map((r, i) => {
              const t = getTestFor(r);
              const gRatio = t.gMax ? r.grammar / t.gMax : 0;
              const cRatio = t.cMax ? r.comp / t.cMax : 0;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 4, width: "100%", justifyContent: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <span style={{ fontSize: 10, color: "#993C1D" }}>
                        {r.grammar}/{t.gMax}
                      </span>
                      <div style={{ width: 22, background: "#993C1D", borderRadius: "4px 4px 0 0", height: `${Math.round(gRatio * 140)}px` }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <span style={{ fontSize: 10, color: "#185FA5" }}>
                        {r.comp}/{t.cMax}
                      </span>
                      <div style={{ width: 22, background: "#185FA5", borderRadius: "4px 4px 0 0", height: `${Math.round(cRatio * 140)}px` }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: "#888", textAlign: "center" }}>
                    {r.year}.{String(r.month).padStart(2, "0")}
                    <br />
                    {r.round}
                  </span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: "#aaa", margin: "0 0 24px" }}>
            막대 높이는 응시한 범위 만점 대비 비율이에요 (회차·시험범위별 만점이 달라서 비율로 비교해요).
          </p>

          {studentScores
            .slice()
            .reverse()
            .map((r, i) => {
              const t = getTestFor(r);
              const gd = r.grammarDetail || {};
              const cd = r.compDetail || {};
              return (
                <details key={i} style={{ borderBottom: "1px solid #efefec", padding: "8px 0" }}>
                  <summary style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", fontSize: 13, listStyle: "none" }}>
                    <span style={{ color: "#888" }}>
                      {r.year}년 {r.month}월 · {r.round}
                    </span>
                    <span>
                      Grammar <strong style={{ fontWeight: 500 }}>{r.grammar}/{t.gMax}</strong> · Composition <strong style={{ fontWeight: 500 }}>{r.comp}/{t.cMax}</strong>
                    </span>
                  </summary>
                  <div style={{ fontSize: 12, color: "#888", padding: "8px 0 0 4px", lineHeight: 1.6 }}>
                    <p style={{ margin: "0 0 4px" }}>
                      <strong style={{ fontWeight: 500, color: "#222" }}>Grammar:</strong>{" "}
                      {t.grammar.map((it) => `${it.label} ${gd[it.key] ?? 0}/${it.max}`).join(", ")}
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong style={{ fontWeight: 500, color: "#222" }}>Composition:</strong>{" "}
                      {t.comp.map((it) => `${it.label} ${cd[it.key] ?? 0}/${it.max}`).join(", ")}
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
  const [grade, setGrade] = useState(GRADES[0]);

  const byClass = useMemo(() => {
    const map = {};
    students.forEach((s) => {
      (map[s.class] = map[s.class] || []).push(s);
    });
    return map;
  }, [students]);

  function handleAdd() {
    if (!name.trim() || !cls.trim()) return;
    onAdd(name.trim(), cls.trim(), grade);
    setName("");
    setCls("");
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="학생 이름" style={{ ...selectStyle, flex: 1, minWidth: 100 }} />
        <select value={grade} onChange={(e) => setGrade(e.target.value)} style={{ ...selectStyle, width: 90 }}>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <input value={cls} onChange={(e) => setCls(e.target.value)} placeholder="반 이름" style={{ ...selectStyle, flex: 1, minWidth: 100 }} />
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
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #efefec", gap: 4 }}>
                  <input
                    defaultValue={s.name}
                    onBlur={(e) => {
                      if (e.target.value.trim() && e.target.value !== s.name) onUpdate(s.id, "name", e.target.value.trim());
                    }}
                    style={{ border: "none", background: "none", fontSize: 14, flex: 1, padding: 4, minWidth: 0 }}
                  />
                  <select
                    defaultValue={s.grade || GRADES[0]}
                    onChange={(e) => onUpdate(s.id, "grade", e.target.value)}
                    style={{ border: "none", background: "none", fontSize: 13, color: "#888", padding: 4 }}
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                  <input
                    defaultValue={s.class}
                    onBlur={(e) => {
                      if (e.target.value.trim() && e.target.value !== s.class) onUpdate(s.id, "class", e.target.value.trim());
                    }}
                    style={{ border: "none", background: "none", fontSize: 13, color: "#888", width: 90, padding: 4 }}
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
