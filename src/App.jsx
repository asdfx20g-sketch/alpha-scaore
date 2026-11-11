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

  // 회차를 바꾸면 시험지가 달라지므로 입력칸을 비웁니다
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
    // 점수만 비우고 시험범위는 유지 (같은 레벨 아이들을 연달아 입력하기 편하도록)
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
