import { Fragment } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { Shape } from "../components/ui";
import { useAuth } from "../auth";
import { Logo } from "../components/Shell";

const STEPS = [
  ["Commit", "Write down what you owe, to whom, how it is measured, and by when."],
  ["Plan", "Break each promise into activities with an owner, a date and the proof it needs."],
  ["Prove", "Completing work means attaching its proof. No proof, not done."],
  ["Flag", "Overdue, blocked, unproven or behind-pace work lands on one list, with an owner."],
  ["Report", "Pick a period. Planned against actual, issues and evidence, written from the record."],
];
const EXAMPLES = [
  ["Community programme", "A community network reporting to a grantor", [["Promise", "Train 120 women in agribusiness by 6 Nov"], ["Work", "Training sessions in four groups"], ["Proof", "Attendance count and signed sheet"], ["Report", "Interim report to the funder"]]],
  ["Client engagement", "A creative studio reporting to a client", [["Promise", "Deliver 12 campaign assets by 30 Nov"], ["Work", "Design, review and delivery rounds"], ["Proof", "Approved file and client sign-off"], ["Report", "Monthly status report"]]],
];

const CASE = [
  ["Health Advocacy", [["Reach 1,500 young people with SRH information", "990 reached", "on_track"], ["Train 40 peer educators", "22 trained, 30 points behind", "at_risk"]]],
  ["Gender, Peace and Security", [["Hold 12 community dialogues on GBV", "6 held", "on_track"], ["Next dialogue, Ganze ward", "Blocked: guides not printed", "blocked"]]],
  ["Disability Inclusion", [["Assess 20 public facilities", "12 assessed", "on_track"], ["Train 30 youth leaders", "14 trained, behind pace", "at_risk"]]],
  ["Climate Change", [["Plant 5,000 indigenous seedlings", "3,450 planted", "on_track"], ["Launch 8 school climate clubs", "3 launched, behind pace", "at_risk"]]],
];
const STATUS_COLOR = { on_track: "var(--ok)", at_risk: "var(--risk)", blocked: "var(--slate)" };

export default function Landing() {
  const { user, signIn } = useAuth();
  const nav = useNavigate();
  const openCase = async () => {
    try {
      signIn(await api("/auth/login", { method: "POST", body: { email: "zawadi@timiza.example", password: "kept-demo-2026" } }));
      nav("/app");
    } catch {
      nav("/login");
    }
  };
  const primary = user ? <Link className="btn btn-primary btn-lg" to="/app">Open Kept</Link> : <Link className="btn btn-primary btn-lg" to="/register">Create your organization</Link>;
  return (
    <div className="landing">
      <header className="container spread" style={{ padding: "22px 32px" }}>
        <Link to="/" className="brand" style={{ padding: 0 }}><Logo size={24} />Kept</Link>
        <nav className="row wrap" style={{ gap: 20 }} aria-label="Site">
          <a href="#how" onClick={(e) => { e.preventDefault(); document.getElementById("how")?.scrollIntoView({ behavior: "smooth" }); }} style={{ color: "var(--ink-2)", textDecoration: "none" }}>How it works</a>
          <a href="#case-study" onClick={(e) => { e.preventDefault(); document.getElementById("case-study")?.scrollIntoView({ behavior: "smooth" }); }} style={{ color: "var(--ink-2)", textDecoration: "none" }}>Case study</a>
          <a href="#examples" onClick={(e) => { e.preventDefault(); document.getElementById("examples")?.scrollIntoView({ behavior: "smooth" }); }} style={{ color: "var(--ink-2)", textDecoration: "none" }}>Examples</a>
          {!user && <Link to="/login" style={{ color: "var(--ink-2)", textDecoration: "none" }}>Sign in</Link>}
          {user ? <Link className="btn btn-primary" to="/app">Open Kept</Link> : <Link className="btn btn-primary" to="/register">Create your organization</Link>}
        </nav>
      </header>

      <section className="container" style={{ padding: "56px 32px 72px", display: "flex", flexWrap: "wrap", gap: 56, alignItems: "center" }}>
        <div style={{ flex: "1 1 440px" }} className="stack">
          <h1 style={{ fontSize: "clamp(40px, 5vw, 64px)", lineHeight: 1.04, fontWeight: 800, letterSpacing: "-1.5px" }}>You promised it. Kept shows whether it is happening.</h1>
          <p style={{ fontSize: 20, lineHeight: "31px", color: "var(--ink-2)", maxWidth: 520 }}>Record what you owe funders and clients, plan the work behind it, and collect proof as the work is done. When reporting time comes, the report is already written from your records.</p>
          <div className="row wrap">{primary}<Link className="btn btn-lg" to="/login">Try the demo</Link></div>
        </div>
        <div style={{ flex: "1 1 460px", minWidth: 0, background: "#fff", border: "1px solid var(--rule)", borderRadius: 10, boxShadow: "0 20px 48px rgba(30,40,38,.10)", padding: 26 }} className="stack">
          <div className="spread"><div className="stack-sm" style={{ gap: 2 }}><span className="small muted">Owed to a funder</span><b style={{ fontSize: 19 }}>Train 120 women in agribusiness</b></div><span className="status" style={{ color: "var(--ok)" }}>Back on track</span></div>
          <div className="pace" style={{ height: 28 }}>
            <div className="track" style={{ top: 10, height: 8 }} /><div className="gap" style={{ left: "71%", width: "4%", top: 10, height: 8 }} />
            <div className="fill" style={{ width: "71%", top: 10, height: 8, background: "var(--cobalt)" }} /><div className="tick" style={{ left: "75%", height: 28 }} />
          </div>
          <div className="spread small muted"><span><b style={{ color: "var(--ink)" }}>85</b> trained</span><span>90 expected today</span></div>
          <div className="stack-sm" style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: 14, fontSize: 14 }}>
            <div className="history-item" style={{ fontSize: 14 }}><span className="muted">16:42</span><span><b>Brian</b> attached the signed sheet for Session 9. <span style={{ color: "var(--ok)" }}>+21 counted.</span></span></div>
            <div className="history-item" style={{ fontSize: 14 }}><span className="muted">16:42</span><span>Behind pace flag closed itself: gap 22 to 4 points.</span></div>
            <div className="history-item" style={{ fontSize: 14 }}><span className="muted">11 Oct</span><span style={{ color: "var(--risk)" }}>Completion refused: sheet missing.</span></div>
          </div>
        </div>
      </section>

      <section style={{ background: "#fff", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)" }}>
        <div className="container" style={{ padding: "64px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 40 }}>
          {[["Reports take days", "Photos in one phone, receipts in an envelope, numbers in three spreadsheets. Someone rebuilds the quarter from memory."],
            ["Slippage shows up late", "A task list cannot tell you that a target is drifting. By the time it is obvious, there is no time left to recover."],
            ["Proof goes missing", "Work gets done but nobody kept the sign-in sheet. Funders and clients only count what you can show."]].map(([h, p]) => (
            <div key={h} className="stack-sm"><h2 style={{ fontSize: 22, fontWeight: 700 }}>{h}</h2><p style={{ color: "var(--ink-2)", fontSize: 16, lineHeight: "25px" }}>{p}</p></div>
          ))}
        </div>
      </section>

      <section id="how" className="container stack" style={{ padding: "80px 32px", gap: 36 }}>
        <h2 style={{ fontSize: 40, lineHeight: "46px", fontWeight: 800, letterSpacing: "-0.8px" }}>Five steps, one record</h2>
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", borderTop: "2px solid var(--ink)" }}>
          {STEPS.map(([t, d], i) => <li key={t} className="stack-sm" style={{ padding: "20px 20px 20px 0" }}><span style={{ color: "var(--cobalt)", fontWeight: 700 }}>{i + 1}</span><b style={{ fontSize: 20 }}>{t}</b><span style={{ color: "var(--ink-2)" }}>{d}</span></li>)}
        </ol>
      </section>

      <section id="case-study" style={{ background: "#fff", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)" }}>
        <div className="container stack" style={{ padding: "80px 32px", gap: 32 }}>
          <div className="spread" style={{ alignItems: "flex-end" }}>
            <div className="stack-sm" style={{ maxWidth: 760 }}>
              <span style={{ color: "var(--cobalt)", fontWeight: 700 }}>Case study</span>
              <h2 style={{ fontSize: 40, lineHeight: "46px", fontWeight: 800, letterSpacing: "-0.8px" }}>Timiza Youth Initiative, Kilifi</h2>
              <p style={{ fontSize: 18, lineHeight: "28px", color: "var(--ink-2)" }}>A youth-led community-based organization running four programmes at once: health advocacy, gender peace and security, disability inclusion and climate change. Each answers to partners and funders. Work like this usually lives in separate spreadsheets, phones and WhatsApp groups; this workspace shows it in one place.</p>
            </div>
            <button className="btn btn-primary btn-lg" onClick={openCase}>Open the Timiza workspace</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
            {CASE.map(([prog, rows]) => (
              <div key={prog} className="stack-sm" style={{ border: "1px solid var(--rule)", borderRadius: 8, padding: 20, gap: 14 }}>
                <b style={{ fontSize: 17 }}>{prog}</b>
                {rows.map(([what, where, st]) => (
                  <div key={what} className="stack-sm" style={{ gap: 2, borderTop: "1px solid var(--rule-soft)", paddingTop: 12 }}>
                    <span style={{ fontSize: 14 }}>{what}</span>
                    <span className="status" style={{ color: STATUS_COLOR[st], fontSize: 13 }}><Shape kind={st} size={10} />{where}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 32, borderTop: "2px solid var(--ink)", paddingTop: 24 }}>
            {[["One view across four programmes", "The coordinator opens Attention and sees nine items that need someone today, from an overdue facilitation guide to a training target 30 points behind, each with an owner."],
              ["Proof captured on the day", "Attendance lists, planting photos, audit forms and referral logs are attached when the work is done. Referral logs record counts and partner summaries, never survivors' names."],
              ["Reports for every partner in a click", "Planned against actual, issues and evidence for any programme and period, ready for the funder, the county or the board."]].map(([h, p]) => (
              <div key={h} className="stack-sm"><b style={{ fontSize: 18 }}>{h}</b><p style={{ color: "var(--ink-2)" }}>{p}</p></div>
            ))}
          </div>
          <p className="small muted">The organization, its programmes and partners are from Timiza's public website. Staff names, targets and figures in the workspace are illustrative.</p>
        </div>
      </section>
      <section id="examples" style={{ background: "var(--ink)", color: "#F5F6F3" }}>
        <div className="container stack" style={{ padding: "80px 32px", gap: 36 }}>
          <div className="stack-sm" style={{ maxWidth: 720 }}>
            <h2 style={{ fontSize: 40, lineHeight: "46px", fontWeight: 800, letterSpacing: "-0.8px" }}>Same engine, your words</h2>
            <p style={{ fontSize: 18, lineHeight: "28px", color: "#C9D0CC" }}>Templates change the vocabulary and the proof each kind of work needs. The tracking, rules and reports underneath stay the same.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
            {EXAMPLES.map(([name, who, rows]) => (
              <div key={name} className="stack" style={{ border: "1px solid #3E4A47", borderRadius: 8, padding: 26 }}>
                <div className="stack-sm" style={{ gap: 4 }}><b style={{ fontSize: 20 }}>{name}</b><span className="small" style={{ color: "#A9B3AE" }}>{who}</span></div>
                <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "120px 1fr", gap: "10px 16px" }}>
                  {rows.map(([k, v]) => <Fragment key={k}><dt style={{ color: "#A9B3AE" }}>{k}</dt><dd style={{ margin: 0 }}>{v}</dd></Fragment>)}
                </dl>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container spread" style={{ padding: "88px 32px" }}>
        <div className="stack-sm" style={{ maxWidth: 640 }}>
          <h2 style={{ fontSize: 36, lineHeight: "42px", fontWeight: 800, letterSpacing: "-0.6px" }}>Start with one project and one promise.</h2>
          <p style={{ fontSize: 18, lineHeight: "28px", color: "var(--ink-2)" }}>Setup takes about ten minutes. Bring a target you owe someone and the people doing the work.</p>
        </div>
        {primary}
      </section>
      <footer style={{ borderTop: "1px solid var(--rule)" }}>
        <div className="container spread small muted" style={{ padding: "24px 32px" }}><span>Kept, a Moringa School capstone, Nairobi 2026</span><span>Organizations and people in the demo are fictional</span></div>
      </footer>
    </div>
  );
}
