import { useState, useEffect } from "react";

const API = "https://api.anthropic.com/v1/messages";
const STEPS = ["📖 Read", "🔍 Clues", "🎯 Goal", "⚙️ Op", "🧮 Solve"];
const OPS = {
  add:      { s: "+", l: "Add",      c: "#16a34a" },
  subtract: { s: "−", l: "Subtract", c: "#dc2626" },
  multiply: { s: "×", l: "Multiply", c: "#2563eb" },
  divide:   { s: "÷", l: "Divide",   c: "#d97706" },
};

// A wide pool of everyday topics — rotated randomly each call
const TOPIC_POOL = [
  // Time & scheduling
  "a school timetable or daily routine (e.g. minutes in class, travel time to school, how long homework takes)",
  "planning a birthday party schedule (e.g. activities lasting different durations, start and end times)",
  "a family road trip (e.g. hours driven each day, total km, rest stops)",
  "gardening and growing plants (e.g. watering schedule, days until harvest, plant heights in cm)",
  // Length & distance
  "measuring things around the house (e.g. lengths of shelves, width of rooms in metres or cm)",
  "a running or swimming training plan (e.g. laps, distances in metres, personal best times)",
  "building or craft projects (e.g. cutting wood or ribbon to length, leftover pieces)",
  "walking or cycling trails on the Gold Coast or Brisbane (e.g. total distance, sections of a trail)",
  // Weight & capacity
  "cooking or baking at home (e.g. grams of flour, litres of milk, portions per recipe)",
  "grocery shopping and comparing pack sizes (e.g. kg of fruit, price per 100g)",
  "a school science experiment (e.g. mass of objects in grams, volume of liquid in mL)",
  "pets and animals (e.g. daily food in grams for a dog, weight gain of a puppy over weeks)",
  // Quantity & grouping
  "planting a vegetable garden (e.g. seeds per row, rows per bed, total seedlings)",
  "organising books or stationery (e.g. books per shelf, pencils per box)",
  "a school fundraiser or charity drive (e.g. tins collected per class, total across school)",
  "arranging chairs or tables for an event (e.g. seats per table, total guests)",
  // Money (non-sport)
  "saving pocket money to buy something (e.g. weekly savings, weeks needed)",
  "comparing electricity or water usage at home (e.g. kWh per day, litres per shower)",
  "a school canteen selling healthy food items (e.g. wraps, fruit cups, water bottles)",
  // Nature & environment
  "rainfall and water tanks (e.g. mm of rain, litres collected, days of supply)",
  "a nature walk counting wildlife (e.g. birds spotted per hour, total over a day)",
  "recycling at school (e.g. kg of cans, plastic bottles collected per week)",
];

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5); }
function pickTopics(n) { return shuffle(TOPIC_POOL).slice(0, n); }

async function callAI(prompt, maxTokens = 500) {
  const r = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const d = await r.json();
  const raw = (d.content.find(b => b.type === "text")?.text || "").replace(/```json|```/g, "").trim();
  return JSON.parse(raw);
}

async function fetchProblem(diff) {
  const topics = pickTopics(3);
  return callAI(`Create a Year 5 Australian math word problem. Return ONLY valid JSON, no markdown fences:
{"problem":"Full problem text","all_options":["fact needed 1","fact needed 2","distractor fact in problem but NOT needed"],"correct_indices":[0,1],"goal":"what problem asks (must exactly match goal_options[0])","goal_options":["correct goal phrase","plausible wrong A","plausible wrong B"],"equation":"12 x 5 = ?","answer":60,"answer_unit":"stickers"}

Rules:
- Difficulty: ${diff}
- Choose ONE of these topic ideas and build a realistic, everyday scenario around it:
  ${topics.map((t, i) => `  ${i + 1}. ${t}`).join("\n")}
- Use real-world units that match the topic: metres, cm, km, kg, grams, mL, litres, minutes, hours, days, items, people — NOT always dollars
- answer_unit must match (e.g. "metres", "grams", "minutes", "litres")
- Whole numbers only, 1-2 operations max
- all_options: EXACTLY 3 items — 2 facts truly needed to solve + 1 distractor that appears in the problem text but is NOT needed for the calculation
- correct_indices: 0-based indices of the 2 needed facts
- goal_options[0] is the correct answer phrase; the other 2 are plausible but wrong
- Make it feel like something a 10-year-old in Australia would actually encounter in real life
- NO AFL/cricket/food stalls/card collecting unless it fits naturally into a non-sport scenario`, 1000);
}

async function checkClues(problem, allOptions, correctIndices, selectedIndices) {
  return callAI(`Word problem: "${problem}"
Options: ${allOptions.map((o, i) => `${i}: "${o}"`).join(", ")}
Correct indices: ${JSON.stringify(correctIndices)}
Student selected: ${JSON.stringify(selectedIndices)}
Are the selected indices exactly the correct ones (order doesn't matter)?
Return ONLY valid JSON: {"correct":true or false,"feedback":"1-2 sentences for a 10-year-old. If wrong, hint at what's missing or unnecessary without giving away the answer."}`);
}

async function checkOperations(problem, selectedOps) {
  return callAI(`Word problem: "${problem}"
A Year 5 student chose these operations to solve it: ${selectedOps.join(", ")}
Are these exactly the right operations needed — no more, no less?
Return ONLY valid JSON: {"correct":true or false,"feedback":"1-2 sentences for a 10-year-old. If wrong, gently hint which operation is missing or not needed, without giving the full solution away."}`);
}

async function checkEquation(problem, goal, correctEq, studentEq) {
  return callAI(`Word problem: "${problem}"
Goal: ${goal}
Correct equation: ${correctEq}
Student's equation: "${studentEq}"
Is this a correct mathematical approach? Accept equivalent forms (swapped order, * for x, / for ÷, etc.).
Return ONLY valid JSON: {"reasonable":true or false,"feedback":"1-2 sentences for a 10-year-old. If wrong, give a gentle hint. If right, praise warmly."}`);
}

const F = { fontFamily: "'Nunito', sans-serif" };
const st = {
  wrap: { minHeight: "100vh", background: "linear-gradient(160deg,#fff8ee 0%,#fff3e0 50%,#fce7cc 100%)", ...F, padding: "16px 12px", display: "flex", flexDirection: "column", alignItems: "center" },
  card: { background: "white", borderRadius: 20, padding: "22px 20px", boxShadow: "0 4px 24px rgba(0,0,0,0.07)", width: "100%", maxWidth: 560, marginBottom: 14 },
  btn: (bg, mt = 0, dis = false) => ({ background: bg, color: "white", border: "none", borderRadius: 14, padding: "13px 22px", fontSize: 15, fontWeight: 800, cursor: dis ? "default" : "pointer", ...F, width: "100%", marginTop: mt, opacity: dis ? 0.5 : 1 }),
  pill: (sel, bc = "#f97316", bg = "#fff7ed") => ({ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12, border: `2px solid ${sel ? bc : "#e5e7eb"}`, background: sel ? bg : "white", cursor: "pointer", marginBottom: 8, fontWeight: sel ? 700 : 500, fontSize: 14 }),
  box:  sel => ({ width: 20, height: 20, borderRadius: 5, border: `2px solid ${sel ? "#f97316" : "#d1d5db"}`, background: sel ? "#f97316" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "white", fontSize: 12, fontWeight: 900 }),
  circ: sel => ({ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${sel ? "#3b82f6" : "#d1d5db"}`, background: sel ? "#3b82f6" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }),
  fb:   ok  => ({ padding: "12px 14px", borderRadius: 12, background: ok ? "#f0fdf4" : "#fef2f2", border: `2px solid ${ok ? "#86efac" : "#fecaca"}`, color: ok ? "#166534" : "#991b1b", fontWeight: 700, marginTop: 12, fontSize: 14, lineHeight: 1.6 }),
};

export default function App() {
  const [screen, setScreen] = useState("home");
  const [diff, setDiff] = useState("easy");
  const [prob, setProb] = useState(null);
  const [step, setStep] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [goalOpts, setGoalOpts] = useState([]);
  const [selIndices, setSelIndices] = useState([]);
  const [s2Checking, setS2Checking] = useState(false);
  const [s2Fb, setS2Fb] = useState(null);
  const [selGoal, setSelGoal] = useState(null);
  const [s3Fb, setS3Fb] = useState(null);
  const [selOps, setSelOps] = useState([]);
  const [s4Checking, setS4Checking] = useState(false);
  const [s4Fb, setS4Fb] = useState(null);
  const [eqInput, setEqInput] = useState("");
  const [eqFb, setEqFb] = useState(null);
  const [eqChecking, setEqChecking] = useState(false);
  const [eqApproved, setEqApproved] = useState(false);
  const [ans, setAns] = useState("");
  const [s5Fb, setS5Fb] = useState(null);

  useEffect(() => {
    const l = document.createElement("link");
    l.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&family=Fredoka+One&display=swap";
    l.rel = "stylesheet";
    document.head.appendChild(l);
  }, []);

  const start = async () => {
    setScreen("loading"); setStep(1);
    setSelIndices([]); setS2Fb(null); setS2Checking(false);
    setSelGoal(null); setS3Fb(null);
    setSelOps([]); setS4Fb(null); setS4Checking(false);
    setEqInput(""); setEqFb(null); setEqChecking(false); setEqApproved(false);
    setAns(""); setS5Fb(null);
    try {
      const p = await fetchProblem(diff);
      setGoalOpts(shuffle(p.goal_options));
      setProb(p);
      setScreen("step");
    } catch {
      alert("Couldn't load a problem — please try again!");
      setScreen("home");
    }
  };

  const toggleIndex = i => { setS2Fb(null); setSelIndices(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i]); };
  const handleCheck2 = async () => {
    setS2Checking(true); setS2Fb(null);
    try {
      const r = await checkClues(prob.problem, prob.all_options, prob.correct_indices, selIndices);
      setS2Fb({ ok: r.correct, msg: r.feedback });
      if (r.correct) setScore(s => s + 10);
    } catch { setS2Fb({ ok: false, msg: "Couldn't check — please try again." }); }
    finally { setS2Checking(false); }
  };

  const handleCheck3 = () => {
    const ok = selGoal === prob.goal_options[0];
    setS3Fb({ ok, msg: ok ? "Exactly right! You know what we're trying to find! 🎯" : "Look at the last sentence again — what exactly is it asking you to find?" });
    if (ok) setScore(s => s + 10);
  };

  const toggleOp = o => { setS4Fb(null); setSelOps(p => p.includes(o) ? p.filter(x => x !== o) : [...p, o]); };
  const handleCheck4 = async () => {
    setS4Checking(true); setS4Fb(null);
    try {
      const r = await checkOperations(prob.problem, selOps);
      setS4Fb({ ok: r.correct, msg: r.feedback });
      if (r.correct) setScore(s => s + 10);
    } catch { setS4Fb({ ok: false, msg: "Couldn't check — please try again." }); }
    finally { setS4Checking(false); }
  };

  const handleCheckEquation = async () => {
    setEqChecking(true); setEqFb(null);
    try {
      const r = await checkEquation(prob.problem, prob.goal, prob.equation, eqInput);
      setEqFb({ ok: r.reasonable, msg: r.feedback });
      if (r.reasonable) { setScore(s => s + 15); setEqApproved(true); }
    } catch { setEqFb({ ok: false, msg: "Couldn't check — please try again." }); }
    finally { setEqChecking(false); }
  };

  const handleCheck5 = () => {
    if (Number(ans) === prob.answer) {
      setScore(s => s + 20); setStreak(s => s + 1);
      setS5Fb({ ok: true, msg: `🌟 Brilliant! The answer is ${prob.answer} ${prob.answer_unit}!` });
      setTimeout(() => setScreen("done"), 1800);
    } else {
      setS5Fb({ ok: false, msg: "Not quite. Double-check your calculation using the equation you wrote." });
    }
  };

  const next = (clearFn) => { clearFn && clearFn(); setStep(s => s + 1); };
  const progColor = i => step > i + 1 ? "#f97316" : step === i + 1 ? "#fdba74" : "#fed7aa";

  if (screen === "home") return (
    <div style={st.wrap}>
      <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}`}</style>
      <div style={{ ...st.card, textAlign: "center", marginTop: 32, padding: "36px 28px" }}>
        <div style={{ fontSize: 64, marginBottom: 4, animation: "pulse 2s ease-in-out infinite" }}>🔍</div>
        <h1 style={{ fontFamily: "'Fredoka One',cursive", fontSize: 34, color: "#c2410c", margin: "0 0 6px" }}>Math Detective</h1>
        <p style={{ color: "#78716c", fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>Solve word problems step by step — just like a real detective!</p>
        <p style={{ fontWeight: 800, color: "#44403c", marginBottom: 10, fontSize: 14 }}>CHOOSE DIFFICULTY</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 28 }}>
          {[["easy","🌱"],["medium","⚡"],["hard","🔥"]].map(([d, icon]) => (
            <button key={d} onClick={() => setDiff(d)} style={{ padding: "10px 18px", borderRadius: 12, border: `2px solid ${diff === d ? "#f97316" : "#e5e7eb"}`, background: diff === d ? "#fff7ed" : "white", color: diff === d ? "#c2410c" : "#6b7280", fontWeight: 700, cursor: "pointer", ...F, fontSize: 14 }}>
              {icon} {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
        <button style={st.btn("#f97316")} onClick={start}>Start a Problem! 🚀</button>
        {score > 0 && <p style={{ marginTop: 16, color: "#9a3412", fontWeight: 800, fontSize: 15 }}>⭐ Score: {score} &nbsp; 🔥 Streak: {streak}</p>}
      </div>
    </div>
  );

  if (screen === "loading") return (
    <div style={{ ...st.wrap, justifyContent: "center" }}>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 64, display: "inline-block", animation: "spin 1s linear infinite" }}>🔍</div>
        <p style={{ fontFamily: "'Fredoka One',cursive", fontSize: 22, color: "#c2410c", marginTop: 16 }}>Finding a problem...</p>
      </div>
    </div>
  );

  if (screen === "done") return (
    <div style={{ ...st.wrap, justifyContent: "center" }}>
      <div style={{ ...st.card, textAlign: "center", padding: "36px 28px", marginTop: 32 }}>
        <div style={{ fontSize: 72 }}>🎉</div>
        <h2 style={{ fontFamily: "'Fredoka One',cursive", fontSize: 30, color: "#15803d", margin: "8px 0" }}>Problem Solved!</h2>
        <p style={{ color: "#166534", fontWeight: 800, fontSize: 17, margin: "4px 0" }}>✅ {prob.answer} {prob.answer_unit}</p>
        <p style={{ color: "#78716c", marginBottom: 8 }}>{prob.equation}</p>
        <p style={{ fontWeight: 900, color: "#c2410c", fontSize: 18, marginBottom: 24 }}>⭐ Total score: {score} &nbsp; 🔥 Streak: {streak}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={st.btn("#9ca3af")} onClick={() => setScreen("home")}>🏠 Home</button>
          <button style={st.btn("#f97316")} onClick={start}>Next Problem →</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={st.wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", maxWidth: 560, marginBottom: 12 }}>
        <h1 style={{ fontFamily: "'Fredoka One',cursive", fontSize: 24, color: "#c2410c", margin: 0 }}>🔍 Math Detective</h1>
        <div style={{ background: "#fed7aa", border: "2px solid #fb923c", borderRadius: 20, padding: "5px 14px", fontWeight: 800, color: "#c2410c", fontSize: 15 }}>⭐ {score}</div>
      </div>
      <div style={{ display: "flex", gap: 5, width: "100%", maxWidth: 560, marginBottom: 5 }}>
        {STEPS.map((_, i) => <div key={i} style={{ flex: 1, height: 8, borderRadius: 4, background: progColor(i), transition: "background .3s" }} />)}
      </div>
      <div style={{ display: "flex", gap: 5, width: "100%", maxWidth: 560, marginBottom: 16 }}>
        {STEPS.map((l, i) => <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 10, fontWeight: 700, color: step >= i + 1 ? "#c2410c" : "#d1d5db" }}>{l}</div>)}
      </div>

      <div style={st.card}>
        <p style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1, color: "#9a3412", margin: "0 0 8px" }}>📄 The Problem</p>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.8, color: "#1c1917", background: "#fffbf5", border: "2px solid #fed7aa", borderRadius: 14, padding: "14px 16px" }}>{prob.problem}</p>
      </div>

      {step === 1 && (
        <div style={st.card}>
          <h2 style={{ fontFamily: "'Fredoka One',cursive", fontSize: 21, color: "#9a3412", margin: "0 0 14px" }}>Step 1: Read the Problem 📖</h2>
          <p style={{ color: "#57534e", lineHeight: 1.7, marginBottom: 12 }}>Read the whole problem carefully. Don't try to solve it yet — just understand what's happening in the story.</p>
          <p style={{ color: "#57534e", lineHeight: 1.7, marginBottom: 20 }}>💡 <strong>Tip:</strong> Try reading it twice — quickly first, then slowly.</p>
          <button style={st.btn("#f97316")} onClick={() => next()}>I've read it! Find the clues →</button>
        </div>
      )}

      {step === 2 && (
        <div style={st.card}>
          <h2 style={{ fontFamily: "'Fredoka One',cursive", fontSize: 21, color: "#9a3412", margin: "0 0 14px" }}>Step 2: Find the Clues 🔍</h2>
          <p style={{ color: "#57534e", marginBottom: 14, fontSize: 14 }}>Tick the facts you <strong>actually need</strong> to solve this problem. Watch out — one is a red herring! 🚩</p>
          {prob.all_options.map((opt, i) => {
            const sel = selIndices.includes(i);
            return (
              <div key={i} style={st.pill(sel)} onClick={() => !s2Fb?.ok && toggleIndex(i)}>
                <div style={st.box(sel)}>{sel && "✓"}</div>
                <span>{opt}</span>
              </div>
            );
          })}
          {s2Fb && <div style={st.fb(s2Fb.ok)}>{s2Fb.msg}</div>}
          {s2Fb?.ok
            ? <button style={st.btn("#f97316", 12)} onClick={() => next(() => setS2Fb(null))}>Next Step →</button>
            : <button style={st.btn("#f97316", 12, selIndices.length === 0 || s2Checking)} onClick={handleCheck2} disabled={selIndices.length === 0 || s2Checking}>
                {s2Checking ? "⏳ Checking with AI..." : "Check My Clues ✓"}
              </button>}
        </div>
      )}

      {step === 3 && (
        <div style={st.card}>
          <h2 style={{ fontFamily: "'Fredoka One',cursive", fontSize: 21, color: "#1d4ed8", margin: "0 0 14px" }}>Step 3: What's the Goal? 🎯</h2>
          <p style={{ color: "#57534e", marginBottom: 14, fontSize: 14 }}>What is the problem asking you to find?</p>
          {goalOpts.map((g, i) => (
            <div key={i} style={st.pill(selGoal === g, "#3b82f6", "#eff6ff")} onClick={() => { if (!s3Fb?.ok) { setSelGoal(g); setS3Fb(null); } }}>
              <div style={st.circ(selGoal === g)}>{selGoal === g && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />}</div>
              <span>{g}</span>
            </div>
          ))}
          {s3Fb && <div style={st.fb(s3Fb.ok)}>{s3Fb.msg}</div>}
          {s3Fb?.ok
            ? <button style={st.btn("#2563eb", 12)} onClick={() => next(() => setS3Fb(null))}>Next Step →</button>
            : <button style={st.btn("#2563eb", 12, !selGoal)} onClick={handleCheck3} disabled={!selGoal}>Check My Answer ✓</button>}
        </div>
      )}

      {step === 4 && (
        <div style={st.card}>
          <h2 style={{ fontFamily: "'Fredoka One',cursive", fontSize: 21, color: "#7c3aed", margin: "0 0 14px" }}>Step 4: Which Operation? ⚙️</h2>
          <p style={{ color: "#57534e", marginBottom: 14, fontSize: 14 }}>What maths do you need to solve this problem? Pick all that apply — but only what's actually needed!</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {Object.entries(OPS).map(([k, v]) => {
              const sel = selOps.includes(k);
              const locked = s4Fb?.ok;
              return (
                <button key={k} onClick={() => !locked && toggleOp(k)} style={{ flex: 1, padding: "14px 0", borderRadius: 14, border: `2px solid ${sel ? v.c : "#e5e7eb"}`, background: sel ? v.c : "white", color: sel ? "white" : "#374151", cursor: locked ? "default" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, ...F, opacity: locked && !sel ? 0.4 : 1 }}>
                  <span style={{ fontFamily: "'Fredoka One',cursive", fontSize: 24 }}>{v.s}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: .5 }}>{v.l}</span>
                </button>
              );
            })}
          </div>
          {s4Fb && <div style={st.fb(s4Fb.ok)}>{s4Fb.msg}</div>}
          {s4Fb?.ok
            ? <button style={st.btn("#7c3aed", 8)} onClick={() => next(() => setS4Fb(null))}>Write My Equation →</button>
            : <button style={st.btn("#7c3aed", 8, selOps.length === 0 || s4Checking)} onClick={handleCheck4} disabled={selOps.length === 0 || s4Checking}>
                {s4Checking ? "⏳ Checking with AI..." : "Check My Choice ✓"}
              </button>}
        </div>
      )}

      {step === 5 && (
        <div style={st.card}>
          <h2 style={{ fontFamily: "'Fredoka One',cursive", fontSize: 21, color: "#15803d", margin: "0 0 18px" }}>Step 5: Solve It! 🧮</h2>
          <div style={{ marginBottom: eqApproved ? 20 : 0 }}>
            <p style={{ color: "#374151", fontSize: 14, marginBottom: 4, fontWeight: 800 }}>5a — Write your equation</p>
            <p style={{ color: "#78716c", fontSize: 13, marginBottom: 10, lineHeight: 1.6 }}>
              Using the clues and operations you found, write out the maths equation.<br />
              You can use: <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4, fontSize: 13 }}>+  −  x  ÷  ( )</code>
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
              <input
                type="text"
                value={eqInput}
                onChange={e => { setEqInput(e.target.value); setEqFb(null); if (eqApproved) setEqApproved(false); }}
                onKeyDown={e => e.key === "Enter" && !eqApproved && eqInput.trim() && !eqChecking && handleCheckEquation()}
                placeholder="e.g.  3 x 15 + 20"
                disabled={eqApproved}
                style={{ flex: 1, border: `2px solid ${eqApproved ? "#86efac" : "#e5e7eb"}`, borderRadius: 12, padding: "11px 14px", fontSize: 18, fontWeight: 800, ...F, outline: "none", background: eqApproved ? "#f0fdf4" : "white", color: eqApproved ? "#166534" : "#1c1917" }}
              />
              {!eqApproved && (
                <button onClick={handleCheckEquation} disabled={!eqInput.trim() || eqChecking} style={{ background: !eqInput.trim() || eqChecking ? "#d1fae5" : "#15803d", color: !eqInput.trim() || eqChecking ? "#6ee7b7" : "white", border: "none", borderRadius: 12, padding: "0 18px", fontSize: 14, fontWeight: 800, cursor: !eqInput.trim() || eqChecking ? "default" : "pointer", ...F, flexShrink: 0, minWidth: 100 }}>
                  {eqChecking ? "⏳" : "Check ✓"}
                </button>
              )}
            </div>
            {eqFb && <div style={st.fb(eqFb.ok)}>{eqFb.msg}</div>}
          </div>
          {eqApproved && (
            <div style={{ borderTop: "2px dashed #bbf7d0", paddingTop: 18 }}>
              <p style={{ color: "#374151", fontSize: 14, marginBottom: 4, fontWeight: 800 }}>5b — Calculate the answer</p>
              <p style={{ color: "#78716c", fontSize: 13, marginBottom: 12 }}>Great equation! Now work it out on paper and type your answer below.</p>
              <input
                type="number"
                value={ans}
                onChange={e => { setAns(e.target.value); setS5Fb(null); }}
                onKeyDown={e => e.key === "Enter" && ans && !s5Fb?.ok && handleCheck5()}
                placeholder="Type your answer..."
                style={{ border: "2px solid #e5e7eb", borderRadius: 12, padding: "12px 14px", fontSize: 22, fontWeight: 800, ...F, width: "100%", boxSizing: "border-box", outline: "none", marginBottom: 6 }}
              />
              <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 10 }}>Unit: {prob.answer_unit}</p>
              {s5Fb && <div style={st.fb(s5Fb.ok)}>{s5Fb.msg}</div>}
              {!s5Fb?.ok && <button style={st.btn("#15803d", 6, !ans)} onClick={handleCheck5} disabled={!ans}>Submit Answer 🎯</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
