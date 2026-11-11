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
          <select
