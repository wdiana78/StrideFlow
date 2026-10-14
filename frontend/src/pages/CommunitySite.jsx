// Community-organization website. Modelled on Timiza Youth Initiative's own site (timiza.vercel.app):
// dark contact bar, white header with centred navigation and a red Donate button, Inter headings,
// blue eyebrows, photo page headers with a title card, white cards on light grey, dark "Connect with Us" footer.
// Every organization on this template keeps that structure in its own colours and photos.
import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, fileUrl, PREVIEW } from "../api";
import { useAuth } from "../auth";
import { ErrorNotice } from "../components/ui";
import { fmtDate, fmtNum } from "../format";

const img = (f) => (f?.url ? fileUrl(f.url) : null);
const kes = (n) => `KES ${Math.round(n).toLocaleString()}`;

// ---------- icons (line, single colour) ----------
const P = {
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  home: "M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  arrow: "M5 12h14M13 6l6 6-6 6",
};
const Ico = ({ d, size = 18, color = "currentColor", sw = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const Social = ({ kind, size = 20 }) => {
  const paths = {
    facebook: <path d="M14 8h3V4h-3a4 4 0 00-4 4v2H8v4h2v8h4v-8h3l1-4h-4V8z" fill="currentColor" />,
    twitter: <path d="M4 4l16 16M20 4L4 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />,
    instagram: <g fill="none" stroke="currentColor" strokeWidth="2"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r=".8" fill="currentColor" /></g>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{paths[kind]}</svg>;
};

// ---------- layout ----------
export function TzLayout({ s, children }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const links = [["", "Home"], ["/about-us", "About Us"], ["/our-work", "Our Work"], ["/contact-us", "Contact Us"], ["/gallery", "Gallery"]];
  const social = Object.entries(s.social || {}).filter(([, v]) => v);
  const mine = user && user.organization.name === s.organization;
  return (
    <div className="tz">
      <div className="tz-topbar">
        <div className="tz-wrap tz-topbar-in">
          <span className="tz-row" style={{ gap: 14 }}>
            <Ico d={P.phone} size={16} />
            {[s.phone, s.phone2].filter(Boolean).map((p) => <a key={p} href={`tel:${p.replace(/\s/g, "")}`}>{p}</a>)}
          </span>
          {s.contact_email && <a className="tz-row tz-hide-sm" href={`mailto:${s.contact_email}`} style={{ gap: 8 }}><Ico d={P.mail} size={16} />{s.contact_email}</a>}
          <span className="tz-row" style={{ gap: 16 }}>
            {social.map(([k, v]) => <a key={k} className="tz-hide-sm" href="#" title={`${k}: ${v}`} aria-label={k} onClick={(e) => e.preventDefault()}><Social kind={k} size={18} /></a>)}
            {mine ? <Link to="/app" className="tz-staff">Dashboard</Link> : <Link to={`${s.base}/login`} className="tz-staff">Staff login</Link>}
          </span>
        </div>
      </div>
      <header className="tz-header">
        <div className="tz-wrap tz-header-in">
          <Link to={s.base || "/"} className="tz-logo" aria-label={`${s.organization} home`}>
            {img(s.logo) ? <img src={img(s.logo)} alt={s.organization} /> : <b>{s.organization}</b>}
          </Link>
          <nav className="tz-nav" aria-label="Main">
            {links.map(([p, l]) => <NavLink key={l} to={`${s.base}${p}` || "/"} end={p === ""}>{l}</NavLink>)}
          </nav>
          <Link to={`${s.base}/donate`} className="tz-btn tz-btn-red tz-donate">Donate</Link>
          <button className="tz-menu" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}><Ico d={P.menu} size={24} /></button>
        </div>
      </header>
      {open && (
        <div className="tz-drawer-wrap" onClick={() => setOpen(false)}>
          <nav className="tz-drawer" aria-label="Main" onClick={(e) => e.stopPropagation()}>
            <button className="tz-menu" style={{ display: "inline-flex", alignSelf: "flex-end" }} aria-label="Close menu" onClick={() => setOpen(false)}><Ico d={P.close} size={24} /></button>
            {links.map(([p, l]) => <NavLink key={l} to={`${s.base}${p}` || "/"} end={p === ""} onClick={() => setOpen(false)}>{l}</NavLink>)}
            <Link to={`${s.base}/donate`} className="tz-btn tz-btn-red" onClick={() => setOpen(false)}>Donate</Link>
          </nav>
        </div>
      )}
      <main>{children}</main>
      <footer className="tz-footer">
        <div className="tz-wrap" style={{ textAlign: "center" }}>
          <h2>Connect with Us</h2>
          <p>Follow us on social media and stay updated with our latest news and events.</p>
          <div className="tz-row" style={{ justifyContent: "center", gap: 22, margin: "22px 0 28px" }}>
            {social.map(([k, v]) => <a key={k} href="#" aria-label={`${k}: ${v}`} onClick={(e) => e.preventDefault()}><Social kind={k} size={22} /></a>)}
          </div>
          <div className="tz-footer-links">
            {links.map(([p, l]) => <Link key={l} to={`${s.base}${p}` || "/"}>{l}</Link>)}
            <Link to={`${s.base}/volunteer`}>Volunteer</Link>
            <Link to={`${s.base}/login`}>Staff login</Link>
          </div>
          <p className="tz-copy">© 2026 {s.organization}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function PageHero({ image, title }) {
  return (
    <section className="tz-pagehero" style={image ? { backgroundImage: `url(${image})` } : undefined}>
      <h1 className="tz-pagehero-title">{title}</h1>
    </section>
  );
}
const Heading = ({ title, eyebrow, align = "center", as: H = "h2" }) => (
  <div className="tz-heading" style={{ textAlign: align }}>
    <H>{title}</H>
    {eyebrow && <p className="tz-eyebrow">{eyebrow}</p>}
  </div>
);

// ---------- sections ----------
function Programmes({ s, withProgress }) {
  return (
    <div className="tz-grid4">
      {s.programmes.map((p) => (
        <Link key={p.id} to={`${s.base}/our-work/${p.slug}`} className="tz-card tz-prog">
          <div className="tz-prog-img">{img(p.photo) ? <img src={img(p.photo)} alt="" loading="lazy" /> : null}</div>
          <div className="tz-prog-body">
            <h3>{p.title}</h3>
            {withProgress && p.results[0] && (
              <div className="tz-progress" aria-label={`${p.results[0].title}: ${p.results[0].actual} of ${p.results[0].target}`}>
                <span style={{ width: `${Math.min(100, (p.results[0].actual / Math.max(p.results[0].target, 1)) * 100)}%` }} />
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

function Team({ s }) {
  return (
    <section className="tz-section">
      <div className="tz-wrap">
        <Heading title="Our Team" eyebrow="MEET THE TEAM" />
        <div className="tz-team">
          {s.team.map((t) => (
            <div key={t.name} className="tz-card tz-member">
              <div className="tz-member-img">{img(t.photo) ? <img src={img(t.photo)} alt={t.name} loading="lazy" /> : <span>{t.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>}</div>
              <b>{t.name}</b><span>{t.role}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Partners({ s }) {
  const list = s.partner_logos?.length ? s.partner_logos : s.partners.map((n) => ({ name: n }));
  return (
    <section className="tz-section">
      <div className="tz-wrap">
        <Heading title="We are Credible" eyebrow="OUR PARTNERS" />
        <div className="tz-partners">
          {list.map((p) => (
            <div key={p.name} className="tz-card tz-partner">
              {img(p.logo) ? <img src={img(p.logo)} alt="" loading="lazy" /> : null}
              <span>{p.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Impact({ s }) {
  const i = s.impact;
  if (!i) return null;
  const items = [[i.people_reached, "Young people reached"], [i.activities_done, "Activities delivered"], [i.events_held, "Community events"], [i.volunteer_hours, "Volunteer hours"]];
  return (
    <section className="tz-section">
      <div className="tz-wrap">
        <Heading title="Our Impact" eyebrow="COUNTED FROM OUR RECORDS" />
        <div className="tz-grid4">
          {items.map(([n, l]) => <div key={l} className="tz-card tz-stat"><b>{fmtNum(n)}</b><span>{l}</span></div>)}
        </div>
        <p className="tz-note">Figures update automatically from attendance sheets and reports. Last updated {fmtDate(i.as_of, true)}.</p>
      </div>
    </section>
  );
}

// ---------- pages ----------
export function TzHome({ s }) {
  const [first, ...rest] = (s.tagline || "").split(" ");
  const d = s.donations;
  return (
    <>
      <section className="tz-hero">
        <div className="tz-wrap tz-hero-in">
          <div className="tz-hero-copy">
            <h1><span className="tz-blue">{first}</span> {rest.join(" ")}</h1>
            <p>{s.intro}</p>
            <a href="#how" className="tz-btn tz-btn-blue tz-btn-wide" onClick={(e) => { e.preventDefault(); document.getElementById("how")?.scrollIntoView({ behavior: "smooth" }); }}>Learn More</a>
          </div>
          {img(s.images?.hero_image) && <img className="tz-hero-img" src={img(s.images.hero_image)} alt="" />}
        </div>
      </section>

      <section id="how" className="tz-section" style={{ scrollMarginTop: 120 }}>
        <div className="tz-wrap tz-split">
          {img(s.images?.about_image) && <img className="tz-split-img" src={img(s.images.about_image)} alt={`${s.organization} team`} loading="lazy" />}
          <div className="tz-split-copy">
            <h2 className="tz-h2-left">All Communities Deserve a Chance to Live in Tranquility</h2>
            <p className="tz-eyebrow">HOW {s.organization.toUpperCase()} WORKS.</p>
            <p>{s.about}</p>
            <Link to={`${s.base}/volunteer`} className="tz-btn tz-btn-blue tz-btn-wide">Volunteer with us</Link>
          </div>
        </div>
      </section>

      <section className="tz-section">
        <div className="tz-wrap">
          <Heading title="Our programs" eyebrow="WHAT WE FOCUS ON." />
          <Programmes s={s} />
        </div>
      </section>

      <Impact s={s} />
      <Team s={s} />
      <Partners s={s} />

      {d.goal > 0 && (
        <section className="tz-section">
          <div className="tz-wrap">
            <div className="tz-card tz-appeal">
              <div>
                <p className="tz-eyebrow" style={{ margin: 0 }}>SUPPORT OUR WORK</p>
                <h2>{d.campaign}</h2>
                <div className="tz-progress tz-progress-lg"><span style={{ width: `${Math.min(100, (d.raised / d.goal) * 100)}%` }} /></div>
                <p className="tz-muted">{kes(d.raised)} raised of {kes(d.goal)} from {d.donors} donors</p>
              </div>
              <Link to={`${s.base}/donate`} className="tz-btn tz-btn-red">Donate</Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

export function TzAbout({ s }) {
  const img3 = [["Goal", s.goal, s.images?.goal_icon], ["Mission", s.mission, s.images?.mission_icon], ["Vision", s.vision, s.images?.vision_icon]];
  return (
    <>
      <PageHero image={img(s.images?.about_hero)} title="ABOUT US" />
      <section className="tz-section">
        <div className="tz-wrap">
          <Heading title="Our Story" eyebrow="Who We Are" />
          <div className="tz-split">
            {img(s.images?.story_image) && <img className="tz-split-img" src={img(s.images.story_image)} alt="" loading="lazy" />}
            <p className="tz-lead">{s.story || s.intro}</p>
          </div>
        </div>
      </section>
      <section className="tz-section">
        <div className="tz-wrap">
          <Heading title="The Why" eyebrow="Our Goal, Mission & Vision" />
          <div className="tz-grid3">
            {img3.filter(([, t]) => t).map(([t, text, icon]) => (
              <div key={t} className="tz-card tz-why">
                {img(icon) && <img src={img(icon)} alt="" />}
                <h3>{t}</h3><p>{text}</p>
              </div>
            ))}
          </div>
          {s.values?.length > 0 && (
            <div className="tz-card tz-values">
              <h3>Our Core Values</h3>
              <ul>{s.values.map((v) => <li key={v}>{v}</li>)}</ul>
            </div>
          )}
        </div>
      </section>
      {s.objectives?.length > 0 && (
        <section className="tz-section">
          <div className="tz-wrap">
            <div className="tz-card tz-objectives">
              {img(s.images?.objectives_image) && <img src={img(s.images.objectives_image)} alt="" loading="lazy" />}
              <div>
                <h3>Our Objectives</h3>
                <ol>{s.objectives.map((o) => <li key={o}>{o}</li>)}</ol>
              </div>
            </div>
          </div>
        </section>
      )}
      <Team s={s} />
    </>
  );
}

export function TzWork({ s }) {
  return (
    <>
      <PageHero image={img(s.images?.hero_work)} title="OUR WORK" />
      <section className="tz-section">
        <div className="tz-wrap">
          <Heading title="Our programs" eyebrow="WHAT WE FOCUS ON." />
          {s.work_intro && <p className="tz-lead" style={{ marginBottom: 40 }}>{s.work_intro}</p>}
          <Programmes s={s} withProgress />
        </div>
      </section>
      <Impact s={s} />
    </>
  );
}

export function TzProgramme({ s }) {
  const { slug } = useParams();
  const p = s.programmes.find((x) => x.slug === slug || x.id === slug);
  if (!p) return <TzWork s={s} />;
  const stories = s.stories.filter((x) => x.programme === p.title);
  const photos = s.gallery.filter((g) => g.programme === p.title && g.photo?.url).slice(0, 4);
  return (
    <>
      <PageHero image={img(p.photo)} title={p.title.toUpperCase()} />
      <section className="tz-section">
        <div className="tz-wrap tz-programme">
          <div>
            <p className="tz-eyebrow" style={{ marginTop: 0 }}>OUR WORK</p>
            <h2 className="tz-h2-left">{p.title}</h2>
            <p className="tz-lead">{p.summary}</p>
            {p.focus && <p className="tz-muted" style={{ marginTop: 12 }}>Focus: {p.focus}</p>}
            {stories.map((x) => (
              <blockquote key={x.id} className="tz-quote">
                <p>{x.summary}</p>
                {x.quote && <footer>“{x.quote}” <span>{x.quote_by}</span></footer>}
              </blockquote>
            ))}
          </div>
          <aside className="tz-card tz-results">
            <h3>Progress this year</h3>
            {p.results.map((r) => (
              <div key={r.title} className="tz-result">
                <div className="tz-result-head"><span>{r.title}</span><b>{fmtNum(r.actual)} / {fmtNum(r.target)}</b></div>
                <div className="tz-progress"><span style={{ width: `${Math.min(100, (r.actual / Math.max(r.target, 1)) * 100)}%` }} /></div>
              </div>
            ))}
            <p className="tz-note" style={{ textAlign: "left" }}>Counted from verified records.</p>
            <Link to={`${s.base}/donate?programme=${encodeURIComponent(p.title)}`} className="tz-btn tz-btn-red tz-btn-full">Support this program</Link>
            <Link to={`${s.base}/volunteer`} className="tz-btn tz-btn-outline tz-btn-full">Volunteer</Link>
          </aside>
        </div>
        {photos.length > 0 && <div className="tz-wrap tz-grid4" style={{ marginTop: 40 }}>{photos.map((g) => <img key={g.id} src={img(g.photo)} alt={g.caption} className="tz-thumb" loading="lazy" />)}</div>}
      </section>
    </>
  );
}

export function TzGallery({ s }) {
  const [open, setOpen] = useState(null);
  const items = s.gallery.filter((g) => g.photo?.url);
  useEffect(() => {
    if (open === null) return undefined;
    const k = (e) => { if (e.key === "Escape") setOpen(null); if (e.key === "ArrowRight") setOpen((open + 1) % items.length); if (e.key === "ArrowLeft") setOpen((open - 1 + items.length) % items.length); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open, items.length]);
  return (
    <>
      <PageHero image={img(s.images?.hero_gallery)} title="GALLERY" />
      <section className="tz-section">
        <div className="tz-wrap tz-grid4">
          {items.map((g, i) => (
            <button key={g.id} className="tz-photo" onClick={() => setOpen(i)} aria-label={`View photo: ${g.caption}`}>
              <img src={img(g.photo)} alt="" loading="lazy" />
              <span>{g.caption}</span>
            </button>
          ))}
        </div>
      </section>
      {open !== null && items[open] && (
        <div className="tz-lightbox" role="dialog" aria-modal="true" aria-label={items[open].caption} onClick={() => setOpen(null)}>
          <figure onClick={(e) => e.stopPropagation()}>
            <img src={img(items[open].photo)} alt={items[open].caption} />
            <figcaption>
              <button onClick={() => setOpen((open - 1 + items.length) % items.length)} aria-label="Previous photo">Previous</button>
              <span>{items[open].caption} · {open + 1} of {items.length}</span>
              <button onClick={() => setOpen((open + 1) % items.length)} aria-label="Next photo">Next</button>
            </figcaption>
          </figure>
          <button className="tz-lightbox-close" aria-label="Close" onClick={() => setOpen(null)}><Ico d={P.close} size={26} /></button>
        </div>
      )}
    </>
  );
}

function Underline({ label, ...props }) {
  return <label className="tz-underline"><span className="sr-only">{label}</span>{props.as === "textarea" ? <textarea placeholder={label} rows={3} {...props} /> : <input placeholder={label} {...props} />}</label>;
}

export function TzContact({ s, SiteMap }) {
  const empty = { name: "", contact: "", subject: "", message: "" };
  const [f, setF] = useState(empty);
  const [st, setSt] = useState({ busy: false, error: null, ok: null });
  const send = async (e) => {
    e.preventDefault(); setSt({ busy: true, error: null, ok: null });
    try { const r = await api(`/public/${s.slug}/inquiry`, { method: "POST", body: { name: f.name, contact: f.contact, kind: "other", message: f.subject ? `${f.subject}\n\n${f.message}` : f.message, website: "" } }); setSt({ busy: false, error: null, ok: r.message }); setF(empty); }
    catch (er) { setSt({ busy: false, error: er, ok: null }); }
  };
  const rows = [[P.home, "Address", s.address || s.location, null, "#2563EB"], [P.phone, "Call Us", [s.phone, s.phone2].filter(Boolean).join("  ·  "), s.phone && `tel:${s.phone}`, "#16A34A"], [P.mail, "Email Us", s.contact_email, s.contact_email && `mailto:${s.contact_email}`, "#EF4444"]];
  return (
    <>
      <PageHero image={img(s.images?.hero_contact)} title="CONTACT US" />
      <section className="tz-section">
        <div className="tz-wrap">
          <h2 className="tz-contact-title">Contact Us</h2>
          <p className="tz-lead" style={{ maxWidth: 1080 }}>If you have any questions or inquiries, feel free to reach out to us. Our team is here to assist you with anything you need. Whether it's about our services, collaborations, or just to say hello, we'd love to hear from you!</p>
          <div className="tz-contact">
            <div className="tz-contact-list">
              {rows.filter((r) => r[2]).map(([d, t, v, href, c]) => (
                <div key={t} className="tz-contact-row">
                  <span className="tz-ring"><Ico d={d} size={22} color={c} /></span>
                  <div><b>{t}</b>{href ? <a href={href}>{v}</a> : <span>{v}</span>}</div>
                </div>
              ))}
            </div>
            <form id="form" className="tz-card tz-form" onSubmit={send} noValidate>
              <h3>Send Message</h3>
              {st.ok && <p className="tz-ok" role="status">{st.ok}</p>}
              <ErrorNotice error={st.error} />
              <Underline label="Enter your Full Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" />
              <Underline label="Enter your Email or Phone" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} autoComplete="email" />
              <Underline label="Subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
              <Underline label="Type your message" as="textarea" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
              <button className="tz-btn tz-btn-blue tz-btn-full" disabled={st.busy}>{st.busy ? "Sending..." : "Send Message"}</button>
            </form>
          </div>
          <div style={{ marginTop: 48 }}><SiteMap query={s.map_query || s.address} label={s.address || s.location} /></div>
        </div>
      </section>
    </>
  );
}

export function TzVolunteer({ s }) {
  const empty = { name: "", phone: "", email: "", ward: "", interest: "any", skills: "" };
  const [f, setF] = useState(empty);
  const [st, setSt] = useState({ busy: false, error: null, ok: null });
  const send = async (e) => {
    e.preventDefault(); setSt({ busy: true, error: null, ok: null });
    try { const r = await api(`/public/${s.slug}/volunteer`, { method: "POST", body: { ...f, email: f.email || null, website: "" } }); setSt({ busy: false, error: null, ok: r.message }); setF(empty); }
    catch (er) { setSt({ busy: false, error: er, ok: null }); }
  };
  return (
    <>
      <PageHero image={img(s.images?.about_image)} title="VOLUNTEER" />
      <section className="tz-section">
        <div className="tz-wrap tz-contact">
          <div>
            <h2 className="tz-h2-left">Volunteer with us</h2>
            <p className="tz-lead">Give a few hours a month to outreach days, dialogues, tree planting or accessibility audits. We train every volunteer and match you to a program near you.</p>
          </div>
          <form className="tz-card tz-form" onSubmit={send} noValidate>
            <h3>Apply to volunteer</h3>
            {st.ok && <p className="tz-ok" role="status">{st.ok}</p>}
            <ErrorNotice error={st.error} />
            <Underline label="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" />
            <Underline label="Phone number" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" />
            <Underline label="Email (optional)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <Underline label="Ward" value={f.ward} onChange={(e) => setF({ ...f, ward: e.target.value })} />
            <label className="tz-underline"><span className="sr-only">Program</span>
              <select value={f.interest} onChange={(e) => setF({ ...f, interest: e.target.value })}>
                <option value="any">Any program</option><option value="health">Health Advocacy</option><option value="gps">Gender, Peace and Security</option><option value="disability">Disability Inclusion</option><option value="climate">Climate Change</option>
              </select>
            </label>
            <Underline label="Skills (optional)" value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} />
            <button className="tz-btn tz-btn-blue tz-btn-full" disabled={st.busy}>{st.busy ? "Sending..." : "Apply"}</button>
          </form>
        </div>
      </section>
    </>
  );
}

const PRESETS = [500, 1000, 2500, 5000, 10000];
export function TzDonate({ s }) {
  const [sp] = useSearchParams();
  const pre = s.projects.find((p) => p.name === sp.get("programme"))?.id || "";
  const [f, setF] = useState({ amount: 1000, custom: "", project_id: pre, method: "mpesa", name: "", contact: "", anonymous: false });
  const [stage, setStage] = useState("form");
  const [don, setDon] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const amount = f.custom ? Number(f.custom) : f.amount;
  const d = s.donations;
  useEffect(() => {
    if (stage !== "pending" || !don) return undefined;
    const t = setInterval(async () => {
      try { const r = await api(`/public/${s.slug}/donations/${don.id}`, { params: { ref: don.reference } }); if (r.status === "confirmed") { setStage("done"); s.reload(); } if (r.status === "failed") setStage("failed"); } catch { /* retry */ }
    }, 2500);
    return () => clearInterval(t);
  }, [stage, don, s]);
  const start = async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { setDon(await api(`/public/${s.slug}/donations`, { method: "POST", body: { name: f.name, contact: f.contact, amount, method: f.method, project_id: f.project_id || null, anonymous: f.anonymous, website: "" } })); setStage("pending"); }
    catch (er) { setError(er); } finally { setBusy(false); }
  };
  const simulate = async (outcome) => {
    setBusy(true);
    try { const r = await api(`/public/${s.slug}/donations/${don.id}/simulate`, { method: "POST", body: { ref: don.reference, outcome } }); setStage(r.status === "confirmed" ? "done" : "failed"); s.reload(); }
    catch (er) { setError(er); } finally { setBusy(false); }
  };
  return (
    <section className="tz-section">
      <div className="tz-wrap tz-contact">
        <div>
          <p className="tz-eyebrow" style={{ marginTop: 0 }}>DONATE</p>
          <h1 className="tz-h2-left">{d.campaign || "Support our work"}</h1>
          {d.goal > 0 && <>
            <div className="tz-progress tz-progress-lg" style={{ marginTop: 20 }}><span style={{ width: `${Math.min(100, (d.raised / d.goal) * 100)}%` }} /></div>
            <p className="tz-muted">{kes(d.raised)} raised of {kes(d.goal)} from {d.donors} donors</p>
          </>}
          <ul className="tz-uses">
            <li><b>KES 500</b> prints health information for 50 young people</li>
            <li><b>KES 2,500</b> trains one peer educator for a day</li>
            <li><b>KES 5,000</b> plants and protects 150 indigenous trees</li>
            <li><b>KES 10,000</b> runs a full ward dialogue on gender-based violence</li>
          </ul>
        </div>
        <div className="tz-card tz-form">
          {stage === "form" && (
            <form onSubmit={start} noValidate className="tz-stack">
              <h3>Choose an amount</h3>
              <div className="tz-amounts" role="radiogroup" aria-label="Amount">
                {PRESETS.map((a) => <button type="button" key={a} role="radio" aria-checked={!f.custom && f.amount === a} onClick={() => setF({ ...f, amount: a, custom: "" })}>{a.toLocaleString()}</button>)}
              </div>
              <Underline label="Other amount (KES)" inputMode="numeric" value={f.custom} onChange={(e) => setF({ ...f, custom: e.target.value.replace(/\D/g, "") })} />
              <label className="tz-underline"><span className="sr-only">Program</span>
                <select value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}><option value="">Where it is needed most</option>{s.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              </label>
              <div className="tz-tabs" role="tablist" aria-label="Payment method">
                {[["mpesa", "M-Pesa"], ["card", "Card"]].map(([k, l]) => <button type="button" role="tab" key={k} aria-selected={f.method === k} onClick={() => setF({ ...f, method: k, contact: "" })}>{l}</button>)}
              </div>
              <Underline label="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" />
              <Underline label={f.method === "mpesa" ? "M-Pesa number, e.g. 0712 345 678" : "Email for your receipt"} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} />
              <label className="tz-check"><input type="checkbox" checked={f.anonymous} onChange={(e) => setF({ ...f, anonymous: e.target.checked })} />Give anonymously</label>
              <ErrorNotice error={error} />
              <button className="tz-btn tz-btn-red tz-btn-full" disabled={busy || !amount}>{busy ? "Starting..." : `Donate KES ${(amount || 0).toLocaleString()}`}</button>
              <p className="tz-note" style={{ textAlign: "left" }}>We never see your M-Pesa PIN or card details.</p>
            </form>
          )}
          {stage === "pending" && (
            <div className="tz-stack">
              <h3>{f.method === "mpesa" ? "Check your phone" : "Complete your payment"}</h3>
              <p className="tz-muted">{f.method === "mpesa" ? `We sent a request for KES ${amount.toLocaleString()} to ${f.contact}. Enter your M-Pesa PIN to finish.` : `KES ${amount.toLocaleString()}, reference ${don.reference}.`}</p>
              {don.mode === "sandbox" && (
                <div className="tz-sandbox">
                  <p>Test mode. No money will move.</p>
                  <div className="tz-row" style={{ gap: 10, flexWrap: "wrap" }}>
                    <button className="tz-btn tz-btn-blue" disabled={busy} onClick={() => simulate("success")}>{f.method === "mpesa" ? "Simulate PIN entered" : "Simulate card approved"}</button>
                    <button className="tz-btn tz-btn-outline" disabled={busy} onClick={() => simulate("cancel")}>Simulate cancel</button>
                  </div>
                </div>
              )}
              <ErrorNotice error={error} />
            </div>
          )}
          {stage === "done" && (
            <div className="tz-stack">
              <h3>Asante sana{f.anonymous ? "" : `, ${f.name.split(" ")[0]}`}.</h3>
              <p>Your gift of <b>KES {amount.toLocaleString()}</b> was received.</p>
              <p className="tz-muted">Receipt reference <b>{don.reference}</b></p>
              <div className="tz-row" style={{ gap: 10 }}><button className="tz-btn tz-btn-outline" onClick={() => window.print()}>Print receipt</button><button className="tz-btn tz-btn-blue" onClick={() => { setStage("form"); setDon(null); }}>Give again</button></div>
            </div>
          )}
          {stage === "failed" && (
            <div className="tz-stack"><h3>Payment not completed</h3><p className="tz-muted">Nothing was charged.</p><button className="tz-btn tz-btn-blue" onClick={() => { setStage("form"); setDon(null); }}>Try again</button></div>
          )}
        </div>
      </div>
    </section>
  );
}

export function TzLogin({ s, demo }) {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const go = async (body) => {
    setBusy(true); setError(null);
    try { signIn(await api("/auth/login", { method: "POST", body: { ...body, site_slug: s.slug } })); nav("/app"); }
    catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <section className="tz-section">
      <div className="tz-wrap" style={{ maxWidth: 460 }}>
        <form className="tz-card tz-form" onSubmit={(e) => { e.preventDefault(); go(f); }} noValidate>
          <h3 style={{ fontSize: 26 }}>Staff sign in</h3>
          <p className="tz-muted" style={{ marginTop: -8 }}>Access the {s.organization} dashboard.</p>
          <ErrorNotice error={error} />
          <Underline label="Work email" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <Underline label="Password" type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <button className="tz-btn tz-btn-blue tz-btn-full" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
          {PREVIEW && demo?.length > 0 && (
            <div className="tz-demo">
              <p>Demo accounts</p>
              {demo.map(([email, name, role]) => <button type="button" key={email} disabled={busy} onClick={() => go({ email, password: "kept-demo-2026" })}><span>{name}</span><span>{role}</span></button>)}
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
