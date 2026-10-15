import { createContext, useContext, useEffect, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, PREVIEW } from "../api";
import { useAuth } from "../auth";
import { Meter } from "../components/charts";
import { ErrorNotice, Field, Loading } from "../components/ui";
import { fmtDate, fmtNum, initials } from "../format";
import { useApi } from "../hooks";
import { isoToday } from "../format";
import { TzAbout, TzContact, TzDonate, TzGallery, TzHome, TzLayout, TzLogin, TzProgramme, TzVolunteer, TzWork } from "./CommunitySite";
import { BriefForm, CommunityArt, CottageArt, Count, Dining, Experiences, GarmentArt, Rooms, Shop, ShoeArt, StaySearch, Stores, TrackOrder, useReveal, Work } from "./SiteKits";

// The organization's public website. Content is edited in Website; numbers come live from verified records.
const Site = createContext(null);
const useSite = () => useContext(Site);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => "#" + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, "0")).join("");
const FONTS = { fraunces: '"Fraunces", Georgia, serif', bricolage: '"Bricolage Grotesque", system-ui, sans-serif', dmserif: '"DM Serif Display", Georgia, serif', space: '"Space Grotesk", system-ui, sans-serif' };
const brandPalette = (b) => [b.primary, mix(b.accent, b.deep, 0.25), mix(b.primary, "#FFFFFF", 0.3), b.deep, mix(b.primary, b.accent, 0.5), mix(b.accent, "#000000", 0.2)];
const ICONS = {
  outreach: "M3 11l18-8-8 18-2-8-8-2z", training: "M12 3l10 5-10 5L2 8l10-5zM6 10v5c3 2 9 2 12 0v-5",
  dialogue: "M4 5h12v8H8l-4 4V5zM20 9v8l-3-3h-5", research: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5",
  advocacy: "M3 11v3l12 5V6L3 11zM15 9h3a3 3 0 010 6h-3", environment: "M12 22V12M12 12C12 6 7 3 3 3c0 5 3 9 9 9zM12 14c0-5 4-8 9-8 0 5-4 8-9 8z",
};
const kes = (n) => `KES ${Math.round(n).toLocaleString()}`;
const H2 = ({ eyebrow, title, light }) => (
  <div className="stack-sm" style={{ gap: 4 }}>
    <span style={{ color: light ? "var(--s-accent)" : "var(--s-primary)", fontWeight: 800, fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase" }}>{eyebrow}</span>
    <h2 style={{ fontSize: "clamp(28px, 3.4vw, 42px)", lineHeight: 1.1, fontWeight: 800, letterSpacing: "-.8px", color: light ? "#fff" : "var(--s-ink)" }}>{title}</h2>
  </div>
);

export default function PublicSite({ slugOverride }) {
  const params = useParams();
  const slug = slugOverride || params.slug;
  const base = slugOverride ? "" : `/site/${slug}`;
  const { data, error, loading, reload } = useApi(`/public/${slug}`);
  const loc = useLocation();
  const [menu, setMenu] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); setMenu(false); }, [loc.pathname]);
  useEffect(() => { if (data) document.title = data.organization; }, [data]);
  useReveal([loc.pathname, !!data]);
  if (loading && !data) return <div style={{ padding: 40 }}><Loading rows={8} /></div>;
  if (error) return <div style={{ padding: 40 }}><ErrorNotice error={error} onRetry={reload} /></div>;
  const vars = { "--s-display": FONTS[data.heading_font] || FONTS.fraunces, "--s-primary": data.brand.primary, "--s-accent": data.brand.accent, "--s-deep": data.brand.deep || data.brand.primary, "--s-ink": "#24161C", "--s-sand": `color-mix(in srgb, ${data.brand.accent} 9%, #FFFBF8)` };
  const ind = data.industry;
  const links = ind === "retail" ? [["", "Home"], ["/shop", "Shop"], ["/stores", "Stores"], ["/track", "Track order"], ["/about", "Our story"], ["/contact", "Contact"]]
    : ind === "hospitality" ? [["", "Home"], ["/rooms", "Rooms"], ["/dining", "Dining"], ["/experiences", "Safaris and tours"], ["/about", "About"], ["/contact", "Contact"]]
      : ind === "agency" ? [["", "Studio"], ["/work", "Work"], ["/services", "Services"], ["/about", "About"], ["/contact", "Book a shoot"]]
        : [["", "Home"], ["/about", "About"], ["/programmes", "Programmes"], ["/services", "Services"], ["/stories", "Stories"], ["/gallery", "Gallery"], ["/impact", "Impact"], ["/contact", "Contact"]];
  const cta = ind === "retail" ? ["/shop", "Shop now"] : ind === "hospitality" ? ["/rooms", "Book a stay"] : ind === "agency" ? ["/contact", "Book a shoot"] : ["/donate", "Donate"];
  if (["community", "education", "health"].includes(data.industry)) {
    const ctx = { ...data, base, reload, palette: brandPalette(data.brand), today: isoToday() };
    const R = (to) => <Navigate to={`${base}${to}`} replace />;
    return (
      <Site.Provider value={ctx}>
        <div className="site" style={vars}>
          <TzLayout s={ctx}>
            <Routes>
              <Route index element={<TzHome s={ctx} />} />
              <Route path="about-us" element={<TzAbout s={ctx} />} />
              <Route path="our-work" element={<TzWork s={ctx} />} />
              <Route path="our-work/:slug" element={<TzProgramme s={ctx} />} />
              <Route path="contact-us" element={<TzContact s={ctx} SiteMap={SiteMap} />} />
              <Route path="gallery" element={<TzGallery s={ctx} />} />
              <Route path="donate" element={<TzDonate s={ctx} />} />
              <Route path="volunteer" element={<TzVolunteer s={ctx} />} />
              <Route path="login" element={<TzLogin s={ctx} demo={STAFF_DEMO[ctx.slug]} />} />
              <Route path="about" element={R("/about-us")} /><Route path="programmes" element={R("/our-work")} /><Route path="impact" element={R("/our-work")} />
              <Route path="contact" element={R("/contact-us")} /><Route path="get-involved" element={R("/volunteer")} /><Route path="services" element={R("/our-work")} /><Route path="stories" element={R("/our-work")} />
              <Route path="*" element={<TzHome s={ctx} />} />
            </Routes>
          </TzLayout>
        </div>
      </Site.Provider>
    );
  }
  return (
    <Site.Provider value={{ ...data, base, reload, palette: brandPalette(data.brand), today: isoToday() }}>
      <div className="site" style={{ ...vars, background: "#fff", color: "var(--s-ink)", minHeight: "100%" }}>
        <SiteHeader links={links} cta={cta} menu={menu} setMenu={setMenu} />
        <main>
          <Routes>
            <Route index element={ind === "retail" ? <ShopHome /> : ind === "hospitality" ? <StayHome /> : ind === "agency" ? <StudioHome /> : <Home />} />
            <Route path="shop" element={<><PageHead eyebrow="Shop" title="The collection" sub="Handmade in Nairobi. Stock updates live from the workshop." /><section className="container" style={{ padding: "48px 32px 80px" }}><ShopPage /></section></>} />
            <Route path="rooms" element={<><PageHead eyebrow="Stay" title="Rooms and venue" sub="Live availability. Hold your dates in a minute." /><RoomsPage /></>} />
            <Route path="stores" element={<><PageHead eyebrow="Stores" title="Find a Hatua store" sub="Five stores, open seven days. Free alterations at every branch." /><section className="container" style={{ padding: "48px 32px 80px" }}><StoresPage /></section></>} />
            <Route path="track" element={<><PageHead eyebrow="Delivery" title="Track your order" sub="Enter the reference from your confirmation message." /><section className="container" style={{ padding: "48px 32px 80px" }}><TrackPage /></section></>} />
            <Route path="dining" element={<><PageHead eyebrow="Dining" title="Three restaurants on the beach" sub="Reserve a table. Hotel guests and visitors welcome." /><section className="container" style={{ padding: "48px 32px 80px" }}><DiningPage /></section></>} />
            <Route path="experiences" element={<><PageHead eyebrow="Safaris and tours" title="From the reef to Tsavo" sub="Small groups, licensed guides, pick-up from the hotel." /><section className="container" style={{ padding: "48px 32px 80px" }}><ExperiencesPage /></section></>} />
            <Route path="work" element={<><PageHead eyebrow="Work" title="Selected work" /><section className="container" style={{ padding: "48px 32px 80px" }}><WorkPage /></section></>} />
            <Route path="about" element={<About />} />
            <Route path="programmes" element={<Programmes />} />
            <Route path="services" element={<Services />} />
            <Route path="stories" element={<Stories />} />
            <Route path="stories/:sid" element={<Story />} />
            <Route path="impact" element={<Impact />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="get-involved" element={<GetInvolved />} />
            <Route path="contact" element={<Contact />} />
            <Route path="donate" element={<Donate />} />
            <Route path="login" element={<StaffLogin />} />
            <Route path="*" element={ind === "retail" ? <ShopHome /> : ind === "hospitality" ? <StayHome /> : ind === "agency" ? <StudioHome /> : <Home />} />
          </Routes>
        </main>
        <Footer links={links} />
      </div>
    </Site.Provider>
  );
}

function Home() {
  const s = useSite();
  const imp = s.impact, d = s.donations;
  return (
    <>
      <section style={{ background: "radial-gradient(circle at 85% 20%, rgba(255,255,255,.12), transparent 40%), linear-gradient(135deg, var(--s-primary) 0%, var(--s-deep) 100%)", color: "#fff" }}>
        <div className="container" style={{ padding: "84px 32px 92px", display: "flex", flexWrap: "wrap", gap: 48, alignItems: "center" }}>
          <div className="stack" style={{ flex: "1 1 520px", gap: 22 }}>
            <span className="chip-tone" style={{ background: "rgba(255,255,255,.14)", color: "var(--s-accent)", alignSelf: "flex-start" }}>● {s.location}</span>
            <h1 style={{ fontSize: "clamp(42px, 5.6vw, 72px)", lineHeight: 1.02, fontWeight: 900, letterSpacing: "-2px", textTransform: "capitalize" }}>{s.tagline}</h1>
            <p style={{ fontSize: 19, lineHeight: "30px", color: "rgba(255,255,255,.9)", maxWidth: 580 }}>{s.intro}</p>
            <div className="row wrap">
              <Link to={`${s.base}/donate`} className="btn btn-lg" style={{ background: "var(--s-accent)", borderColor: "var(--s-accent)", color: "var(--s-ink)", fontWeight: 800 }}>♥ Donate now</Link>
              <Link to={`${s.base}/get-involved`} className="btn btn-lg" style={{ background: "transparent", borderColor: "rgba(255,255,255,.5)", color: "#fff" }}>Get involved</Link>
            </div>
          </div>
          <div style={{ flex: "1 1 340px", minWidth: 0 }} className="stack">
          <CommunityArt />
          {imp && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: -40 }}>
              {[[imp.people_reached, "young people reached", "#FFD7A8"], [imp.participants_registered, "participants registered", "#FFE3EA"], [imp.activities_done, "activities delivered", "#FFC9B3"], [imp.volunteer_hours, "volunteer hours", "#FFF0D6"]].map(([n, l, c]) => (
                <div key={l} style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.16)", borderRadius: 16, padding: 20 }}>
                  <Count n={n} style={{ fontSize: 34, lineHeight: "40px", color: c, display: "block" }} /><span style={{ color: "rgba(255,255,255,.9)", fontSize: 14 }}>{l}</span>
                </div>
              ))}
              <span className="small" style={{ gridColumn: "1 / -1", color: "rgba(255,255,255,.8)" }}>✓ Counted from {fmtNum(imp.evidence_items)} verified records · {fmtDate(imp.as_of, true)}</span>
            </div>
          )}
          </div>
        </div>
      </section>

      <section className="container stack" style={{ padding: "80px 32px", gap: 30 }}>
        <div className="spread" style={{ alignItems: "flex-end" }}><H2 eyebrow="What we do" title="Our programmes" /><Link to={`${s.base}/programmes`} className="btn">All programmes →</Link></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
          {s.programmes.map((p, i) => <ProgrammeCard key={p.id} p={p} color={s.palette[i % s.palette.length]} compact />)}
        </div>
      </section>

      {d.goal > 0 && <DonationBand />}

      <section className="container stack" style={{ padding: "80px 32px", gap: 30 }}>
        <div className="spread" style={{ alignItems: "flex-end" }}><H2 eyebrow="How we help" title="Services" /><Link to={`${s.base}/services`} className="btn">All services →</Link></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
          {s.services.slice(0, 3).map((x, i) => <ServiceCard key={x.title} x={x} color={s.palette[i % s.palette.length]} />)}
        </div>
      </section>

      {s.stories[0] && (
        <section style={{ background: "var(--s-sand)" }}>
          <div className="container" style={{ padding: "80px 32px", display: "flex", flexWrap: "wrap", gap: 40, alignItems: "center" }}>
            <div className="stack" style={{ flex: "1 1 420px" }}>
              <H2 eyebrow="Case study" title={s.stories[0].title} />
              <p style={{ fontSize: 18, lineHeight: "29px", color: "#57434D" }}>{s.stories[0].summary}</p>
              <Link to={`${s.base}/stories/${s.stories[0].id}`} className="btn btn-lg" style={{ background: "var(--s-primary)", borderColor: "var(--s-primary)", color: "#fff", alignSelf: "flex-start" }}>Read the story</Link>
            </div>
            <figure style={{ flex: "1 1 340px", margin: 0, background: "#fff", borderRadius: 20, padding: 32, border: "1px solid #F0E3DC" }}>
              <b style={{ fontSize: 64, lineHeight: 1, color: "var(--s-primary)" }}>{s.stories[0].stat_value}</b>
              <p style={{ color: "#7A6470", marginTop: 6 }}>{s.stories[0].stat_label}</p>
              {s.stories[0].quote && <blockquote style={{ margin: "20px 0 0", fontSize: 20, lineHeight: "30px", fontWeight: 600 }}>“{s.stories[0].quote}”<footer className="small" style={{ fontWeight: 400, color: "#7A6470", marginTop: 8 }}>{s.stories[0].quote_by}</footer></blockquote>}
            </figure>
          </div>
        </section>
      )}

      {s.gallery.length > 0 && (
        <section className="container stack" style={{ padding: "80px 32px", gap: 28 }}>
          <div className="spread" style={{ alignItems: "flex-end" }}><H2 eyebrow="Gallery" title="On the ground" /><Link to={`${s.base}/gallery`} className="btn">View gallery →</Link></div>
          <div className="gallery-grid">{s.gallery.slice(0, 5).map((g, i) => <Link key={g.id} to={`${s.base}/gallery`} style={{ display: "contents" }}><GalleryTile g={g} i={i} big={i === 0} onOpen={() => {}} /></Link>)}</div>
        </section>
      )}

      {s.stories.filter((x) => x.quote).length > 1 && (
        <section style={{ background: "var(--s-deep)", color: "#fff" }}>
          <div className="container" style={{ padding: "72px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 22 }}>
            {s.stories.filter((x) => x.quote).map((x) => (
              <figure key={x.id} style={{ margin: 0, padding: 26, borderRadius: 20, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)" }}>
                <span style={{ fontSize: 44, lineHeight: 1, color: "var(--s-accent)" }}>“</span>
                <blockquote style={{ margin: "4px 0 14px", fontSize: 19, lineHeight: "29px", fontWeight: 600 }}>{x.quote}</blockquote>
                <figcaption className="small" style={{ opacity: .8 }}>{x.quote_by} · {x.programme}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <Partners />
      <CallToAction />
    </>
  );
}

function ShopPage() { const s = useSite(); return <Shop s={s} />; }

function ShopHome() {
  const s = useSite();
  return (
    <>
      <section style={{ background: "var(--s-deep)", color: "#fff", overflow: "hidden" }}>
        <div className="container" style={{ padding: "72px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 40, alignItems: "center" }}>
          <div className="stack reveal" style={{ gap: 22 }}>
            <span style={{ color: "var(--s-accent)", fontWeight: 600 }}>New season: the coast linen edit</span>
            <h1 style={{ fontSize: "clamp(48px, 7vw, 92px)", lineHeight: .95, fontWeight: 800, letterSpacing: "-2.5px" }}>{s.tagline}</h1>
            <p style={{ fontSize: 19, lineHeight: "30px", opacity: .85, maxWidth: 520 }}>{s.intro}</p>
            <div className="row wrap"><Link to={`${s.base}/shop`} className="btn btn-lg" style={{ background: "var(--s-accent)", borderColor: "var(--s-accent)", color: "#111", fontWeight: 800 }}>Shop the collection</Link><Link to={`${s.base}/stores`} className="btn btn-lg" style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.35)" }}>Find a store</Link></div>
          </div>
          <div className="reveal" style={{ position: "relative" }}>
            <div style={{ position: "relative", width: "78%", transform: "rotate(-6deg)" }}><GarmentArt name="denim jacket" color={s.brand.accent} accent={s.brand.primary} /></div>
            <div style={{ position: "relative", width: "58%", marginLeft: "auto", marginTop: -70, transform: "rotate(5deg)" }}><GarmentArt name="wrap dress" color="#F2E9DC" accent={s.brand.accent} /></div>
          </div>
        </div>
      </section>
      <section className="container stack" style={{ padding: "80px 32px", gap: 28 }}>
        <div className="spread" style={{ alignItems: "flex-end" }}><H2 eyebrow="Bestsellers" title="Made in our Nairobi workshop" /><Link to={`${s.base}/shop`} className="btn">All products</Link></div>
        <Shop s={s} compact />
      </section>
      <section className="container stack" style={{ padding: "0 32px 80px", gap: 28 }}>
        <div className="spread" style={{ alignItems: "flex-end" }}><H2 eyebrow="Stores" title="Try it on in person" /><Link to={`${s.base}/stores`} className="btn">All stores</Link></div>
        <Stores s={s} />
      </section>
      <section style={{ background: "var(--s-sand)" }}>
        <div className="container" style={{ padding: "72px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {[["Made in Nairobi", "Cut and sewn in our own workshop by 60 tailors."], ["Five stores", "Nairobi, Mombasa, Kisumu and Eldoret, open seven days."], ["Free alterations", "Hems, sleeves and waists adjusted free within 30 days."], ["Delivered and tracked", "Same day in Nairobi, two days countrywide, with live tracking."]].map(([t, d]) => (
            <div key={t} className="stack-sm reveal" style={{ gap: 8, paddingTop: 18, borderTop: "1px solid #24161C" }}><b style={{ fontSize: 18 }}>{t}</b><span style={{ color: "#57434D" }}>{d}</span></div>
          ))}
        </div>
      </section>
      <CallToAction />
    </>
  );
}

function RoomsPage() { const s = useSite(); return <Rooms s={s} today={s.today} />; }
function StoresPage() { const s = useSite(); return <Stores s={s} />; }
function TrackPage() { const s = useSite(); return <TrackOrder s={s} />; }
function DiningPage() { const s = useSite(); return <Dining s={s} today={s.today} />; }
function ExperiencesPage() { const s = useSite(); return <Experiences s={s} today={s.today} />; }
function WorkPage() { const s = useSite(); return <Work s={s} />; }

function StayHome() {
  const s = useSite();
  return (
    <>
      <section style={{ background: "var(--s-deep)", color: "#fff" }}>
        <div className="container" style={{ padding: "64px 32px 120px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 40, alignItems: "center" }}>
          <div className="stack reveal" style={{ gap: 20 }}>
            <span style={{ color: "var(--s-accent)", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", fontSize: 13 }}>{s.location}</span>
            <h1 style={{ fontSize: "clamp(44px, 6vw, 80px)", lineHeight: 1, fontWeight: 400 }}>{s.tagline}</h1>
            <p style={{ fontSize: 19, lineHeight: "30px", opacity: .88, maxWidth: 520 }}>{s.intro}</p>
          </div>
          <div className="reveal"><CottageArt /></div>
        </div>
      </section>
      <div className="container" style={{ marginTop: -70, position: "relative" }}><StaySearch s={s} today={s.today} /></div>
      <section className="container stack" style={{ padding: "64px 32px", gap: 26 }}>
        <div className="spread" style={{ alignItems: "flex-end" }}><H2 eyebrow="Stay with us" title="Rooms and venue" /><Link to={`${s.base}/rooms`} className="btn">See availability →</Link></div>
        <Rooms s={s} today={s.today} bare />
      </section>
      <section style={{ background: "var(--s-sand)" }}>
        <div className="container stack" style={{ padding: "72px 32px", gap: 26 }}>
          <div className="spread" style={{ alignItems: "flex-end" }}><H2 eyebrow="Safaris and tours" title="From the reef to Tsavo" /><Link to={`${s.base}/experiences`} className="btn">All experiences</Link></div>
          <Experiences s={s} today={s.today} />
        </div>
      </section>
      <section className="container stack" style={{ padding: "72px 32px", gap: 26 }}>
        <div className="spread" style={{ alignItems: "flex-end" }}><H2 eyebrow="Dining" title="Three restaurants on the beach" /><Link to={`${s.base}/dining`} className="btn">Reserve a table</Link></div>
        <Dining s={s} today={s.today} />
      </section>
      <section style={{ background: "var(--s-sand)" }}>
        <div className="container" style={{ padding: "64px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 24, alignItems: "center" }}>
          <div className="stack reveal"><H2 eyebrow="Getting here" title="Ten minutes' walk to the beach" /><p style={{ color: "#57434D", fontSize: 17, lineHeight: "28px" }}>{s.about}</p></div>
          <div className="reveal"><SiteMap query={s.map_query || s.location} label={s.location} /></div>
        </div>
      </section>
    </>
  );
}

function StudioHome() {
  const s = useSite();
  return (
    <>
      <section style={{ background: "#0A0A0A", color: "#fff" }}>
        <div className="container stack" style={{ padding: "96px 32px 72px", gap: 28 }}>
          <span style={{ color: "var(--s-accent)", fontWeight: 600 }}>{s.location}. Taking projects for Q1.</span>
          <h1 className="reveal" style={{ fontSize: "clamp(52px, 9vw, 130px)", lineHeight: .9, fontWeight: 700, letterSpacing: "-4px" }}>
            {s.tagline.split(" ").map((w, i) => <span key={i} style={{ color: i === 1 ? "var(--s-accent)" : "#fff" }}>{w} </span>)}
          </h1>
          <div className="spread" style={{ alignItems: "flex-end" }}>
            <p style={{ fontSize: 20, lineHeight: "31px", opacity: .8, maxWidth: 560 }}>{s.intro}</p>
            <Link to={`${s.base}/contact`} className="btn btn-lg" style={{ background: "var(--s-accent)", borderColor: "var(--s-accent)", color: "#111", fontWeight: 800 }}>Book a shoot</Link>
          </div>
        </div>
      </section>
      <section className="container stack" style={{ padding: "80px 32px", gap: 28 }}>
        <div className="spread" style={{ alignItems: "flex-end" }}><H2 eyebrow="Selected work" title="Results, not just pretty pictures" /><Link to={`${s.base}/work`} className="btn">All work →</Link></div>
        <Work s={s} />
      </section>
      <section style={{ background: "#F4F1EA" }}>
        <div className="container" style={{ padding: "72px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
          {s.services.map((x, i) => (
            <div key={x.title} className="stack-sm reveal" style={{ padding: 24, borderRadius: 20, background: "#fff", gap: 10 }}>
              <b style={{ fontSize: 56, lineHeight: 1, color: i === 0 ? "#111" : "#C9C3B6", letterSpacing: "-2px" }}>0{i + 1}</b><b style={{ fontSize: 22 }}>{x.title}</b><span style={{ color: "#57534D" }}>{x.description}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="container" style={{ padding: "80px 32px" }}><BriefForm s={s} /></section>
    </>
  );
}

function ProgrammeCard({ p, color, compact }) {
  const s = useSite();
  return (
    <article className="stack" style={{ background: "#fff", borderRadius: 18, padding: 24, border: "1px solid #F3E0D8", boxShadow: "0 10px 30px rgba(20,38,42,.06)", position: "relative", overflow: "hidden" }}>
      <span style={{ position: "absolute", inset: "0 0 auto 0", height: 6, background: color }} />
      <span style={{ width: 48, height: 48, borderRadius: 14, background: `${color}1A`, color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18 }}>{initials(p.title)}</span>
      <h3 style={{ fontSize: 21, fontWeight: 800 }}>{p.title}</h3>
      <p style={{ color: "#57434D", lineHeight: "24px", fontSize: 15 }}>{p.summary}</p>
      {!compact && p.focus && <span className="small" style={{ color: "#7A6470" }}>Focus: {p.focus}</span>}
      {p.results.slice(0, compact ? 1 : 4).map((r) => (
        <div key={r.title} className="stack-sm" style={{ gap: 4 }}>
          <span className="small" style={{ fontWeight: 700 }}>{r.title}</span>
          <Meter value={r.actual} max={r.target} color={color} />
          <span className="small" style={{ color: "#7A6470" }}>{fmtNum(r.actual)} of {fmtNum(r.target)} {r.unit}</span>
        </div>
      ))}
      {!compact && <Link to={`${s.base}/donate?programme=${encodeURIComponent(p.title)}`} className="btn" style={{ borderColor: color, color, alignSelf: "flex-start" }}>Support this programme</Link>}
    </article>
  );
}

function ServiceCard({ x, color }) {
  return (
    <div className="stack" style={{ borderRadius: 18, padding: 24, background: `linear-gradient(160deg, ${color}12, #fff 60%)`, border: `1px solid ${color}33` }}>
      <span style={{ width: 52, height: 52, borderRadius: 16, background: color, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[x.icon] || ICONS.outreach} /></svg>
      </span>
      <h3 style={{ fontSize: 19, fontWeight: 800 }}>{x.title}</h3>
      <p style={{ color: "#57434D", lineHeight: "24px" }}>{x.description}</p>
    </div>
  );
}

function DonationBand() {
  const s = useSite(); const d = s.donations;
  return (
    <section style={{ background: "linear-gradient(120deg, color-mix(in srgb, var(--s-accent) 45%, #fff), var(--s-sand))" }}>
      <div className="container" style={{ padding: "56px 32px", display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center" }}>
        <div className="stack-sm" style={{ flex: "1 1 420px" }}>
          <b style={{ fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase" }}>Campaign</b>
          <h2 style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-.6px", marginBottom: 10 }}>{d.campaign}</h2>
          <Meter value={d.raised} max={d.goal} color="var(--s-ink)" height={14} />
          <span><b>{kes(d.raised)}</b> raised of {kes(d.goal)} · {d.donors} donors</span>
        </div>
        <Link to={`${s.base}/donate`} className="btn btn-lg" style={{ background: "var(--s-ink)", borderColor: "var(--s-ink)", color: "#fff", fontWeight: 800 }}>♥ Give with M-Pesa or card</Link>
      </div>
    </section>
  );
}

function Partners() {
  const s = useSite();
  return (
    <section className="container stack" style={{ padding: "64px 32px", gap: 22 }}>
      <H2 eyebrow="We are credible" title="Our partners" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {s.partners.map((p, i) => <div key={p} className="row" style={{ border: "1px solid #F3E0D8", borderRadius: 14, padding: "16px 18px", gap: 12, fontWeight: 700 }}><span style={{ width: 36, height: 36, borderRadius: 10, background: `${s.palette[i % s.palette.length]}1F`, color: s.palette[i % s.palette.length], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>{initials(p)}</span>{p}</div>)}
      </div>
    </section>
  );
}

function CallToAction() {
  const s = useSite();
  return (
    <section style={{ background: "var(--s-primary)", color: "#fff" }}>
      <div className="container spread" style={{ padding: "56px 32px" }}>
        <h2 style={{ fontSize: 32, fontWeight: 900, maxWidth: 620 }}>Join the young people changing Kilifi.</h2>
        <div className="row wrap"><Link to={`${s.base}/get-involved`} className="btn btn-lg" style={{ background: "#fff", color: "var(--s-primary)", borderColor: "#fff" }}>Volunteer</Link><Link to={`${s.base}/contact`} className="btn btn-lg" style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.5)" }}>Partner with us</Link></div>
      </div>
    </section>
  );
}

const PageHead = ({ eyebrow, title, sub }) => (
  <section style={{ background: "linear-gradient(135deg, var(--s-primary), var(--s-deep))", color: "#fff" }}>
    <div className="container stack-sm" style={{ padding: "64px 32px" }}>
      <span style={{ color: "var(--s-accent)", fontWeight: 800, fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase" }}>{eyebrow}</span>
      <h1 style={{ fontSize: "clamp(34px, 4.5vw, 54px)", fontWeight: 900, letterSpacing: "-1.2px", lineHeight: 1.05 }}>{title}</h1>
      {sub && <p style={{ fontSize: 18, color: "rgba(255,255,255,.9)", maxWidth: 680 }}>{sub}</p>}
    </div>
  </section>
);

function About() {
  const s = useSite();
  return (
    <>
      <PageHead eyebrow="About us" title={s.organization} sub={s.intro} />
      <section className="container" style={{ padding: "64px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        {[["Mission", s.mission, "#C93A63"], ["Vision", s.vision, "#E5734F"], ["How we work", s.about, "#B5838D"]].map(([t, x, c]) => x && (
          <div key={t} className="stack-sm" style={{ borderRadius: 18, padding: 26, background: `${c}10`, borderTop: `6px solid ${c}` }}><b style={{ color: c, fontSize: 14, textTransform: "uppercase", letterSpacing: ".06em" }}>{t}</b><p style={{ fontSize: 17, lineHeight: "28px" }}>{x}</p></div>
        ))}
      </section>
      <section style={{ background: "var(--s-sand)" }}>
        <div className="container stack" style={{ padding: "64px 32px", gap: 24 }}>
          <H2 eyebrow="Our team" title="Meet the team" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 18 }}>
            {s.team.map((t, i) => (
              <div key={t.name} className="stack-sm" style={{ background: "#fff", borderRadius: 18, padding: 24, alignItems: "center", textAlign: "center" }}>
                <span style={{ width: 88, height: 88, borderRadius: "50%", background: `linear-gradient(135deg, ${s.palette[i % s.palette.length]}, var(--s-accent))`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 28 }}>{initials(t.name)}</span>
                <b style={{ fontSize: 19 }}>{t.name}</b><span style={{ color: "#7A6470" }}>{t.role}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Partners />
    </>
  );
}

function Programmes() {
  const s = useSite();
  return (
    <>
      <PageHead eyebrow="Programmes" title="Four programmes, one Kilifi" sub="Live progress against every promise we have made to partners and funders." />
      <section className="container" style={{ padding: "64px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 22 }}>
        {s.programmes.map((p, i) => <ProgrammeCard key={p.id} p={p} color={s.palette[i % s.palette.length]} />)}
      </section>
    </>
  );
}

function Services() {
  const s = useSite();
  return (
    <>
      <PageHead eyebrow="Services" title="What we offer" sub="For schools, the county, partners and community groups." />
      <section className="container" style={{ padding: "64px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        {s.services.map((x, i) => <ServiceCard key={x.title} x={x} color={s.palette[i % s.palette.length]} />)}
      </section>
      <section style={{ background: "var(--s-sand)" }}>
        <div className="container stack" style={{ padding: "72px 32px", gap: 28 }}>
          <H2 eyebrow="How we work" title="From first call to results" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {[["Listen", "We meet the community, school or partner and agree what success looks like."], ["Plan", "Targets, dates and the proof we will collect are agreed in writing."],
              ["Deliver", "Trained young people run the work, recording attendance and photos as they go."], ["Report", "You get a clear report with numbers you can check against the evidence."]].map(([t, d], i) => (
              <div key={t} className="site-card stack-sm" style={{ gap: 10 }}><span className="site-ic">{i + 1}</span><b style={{ fontSize: 18 }}>{t}</b><span style={{ color: "#57434D" }}>{d}</span></div>
            ))}
          </div>
        </div>
      </section>
      <CallToAction />
    </>
  );
}

function Stories() {
  const s = useSite();
  return (
    <>
      <PageHead eyebrow="Case studies" title="Stories from the field" />
      <section className="container" style={{ padding: "64px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 22 }}>
        {s.stories.map((x, i) => (
          <Link key={x.id} to={`${s.base}/stories/${x.id}`} className="stack" style={{ textDecoration: "none", color: "inherit", borderRadius: 18, overflow: "hidden", border: "1px solid #F3E0D8" }}>
            <div style={{ background: `linear-gradient(135deg, ${s.palette[i % s.palette.length]}, var(--s-deep))`, color: "#fff", padding: 26 }}><b style={{ fontSize: 52, lineHeight: 1 }}>{x.stat_value}</b><div style={{ opacity: .9 }}>{x.stat_label}</div></div>
            <div className="stack-sm" style={{ padding: "0 24px 24px" }}><span className="small" style={{ color: s.palette[i % s.palette.length], fontWeight: 800 }}>{x.programme}</span><h3 style={{ fontSize: 20, fontWeight: 800 }}>{x.title}</h3><p style={{ color: "#57434D" }}>{x.summary}</p><span style={{ color: "var(--s-primary)", fontWeight: 700 }}>Read story →</span></div>
          </Link>
        ))}
      </section>
    </>
  );
}

function Story() {
  const s = useSite(); const { sid } = useParams();
  const x = s.stories.find((y) => y.id === sid) || s.stories[0];
  if (!x) return <Stories />;
  return (
    <>
      <PageHead eyebrow={x.programme || "Case study"} title={x.title} sub={x.summary} />
      <article className="container" style={{ padding: "56px 32px", maxWidth: 820 }}>
        <div className="row wrap" style={{ gap: 24, marginBottom: 24 }}><div style={{ background: "var(--s-sand)", borderRadius: 16, padding: "18px 24px" }}><b style={{ fontSize: 44, color: "var(--s-primary)" }}>{x.stat_value}</b><div>{x.stat_label}</div></div></div>
        <p style={{ fontSize: 19, lineHeight: "32px" }}>{x.body}</p>
        {x.quote && <blockquote style={{ margin: "32px 0", padding: "8px 0 8px 24px", borderLeft: "0", fontSize: 24, lineHeight: "34px", fontWeight: 700 }}>“{x.quote}”<footer className="small" style={{ fontWeight: 400, color: "#7A6470", marginTop: 8 }}>{x.quote_by}</footer></blockquote>}
        <Link to={`${s.base}/donate`} className="btn btn-lg" style={{ background: "var(--s-accent)", borderColor: "var(--s-accent)", color: "var(--s-ink)", fontWeight: 800 }}>♥ Fund more stories like this</Link>
      </article>
    </>
  );
}

function Impact() {
  const s = useSite(); const imp = s.impact;
  if (!imp) return <Home />;
  return (
    <>
      <PageHead eyebrow="Impact" title="Results you can check" sub="Counted automatically from attendance sheets, photos and reports recorded when the work happens." />
      <section className="container" style={{ padding: "56px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16 }}>
        {[[imp.people_reached, "young people reached"], [imp.activities_done, "activities delivered"], [imp.events_held, "community events"], [imp.volunteer_hours, "volunteer hours"], [imp.participants_registered, "participants registered"], [imp.evidence_items, "evidence records"]].map(([n, l], i) => (
          <div key={l} style={{ borderRadius: 18, padding: 22, background: `${s.palette[i % s.palette.length]}12`, borderBottom: `5px solid ${s.palette[i % s.palette.length]}` }}><b style={{ fontSize: 40, color: s.palette[i % s.palette.length] }}>{fmtNum(n)}</b><div>{l}</div></div>
        ))}
      </section>
      <section className="container" style={{ padding: "0 32px 64px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 22 }}>
        {s.programmes.map((p, i) => <ProgrammeCard key={p.id} p={p} color={s.palette[i % s.palette.length]} />)}
      </section>
    </>
  );
}

function GetInvolved() {
  const s = useSite();
  return (
    <>
      <PageHead eyebrow="Get involved" title="Give your time, skills or money" />
      <section className="container" style={{ padding: "56px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
        <VolunteerForm />
        <div className="stack">
          {[["♥", "Donate", "M-Pesa or card, from KES 50.", `${s.base}/donate`, "#E5734F"], ["🤝", "Partner with us", "Co-fund a programme or host an event.", `${s.base}/contact`, "#B5838D"], ["📣", "Spread the word", "Share our stories and impact.", `${s.base}/stories`, "#F59E3B"]].map(([i, t, d, to, c]) => (
            <Link key={t} to={to} className="row" style={{ textDecoration: "none", color: "inherit", gap: 16, borderRadius: 16, padding: 20, border: `1px solid ${c}44`, background: `${c}0D` }}>
              <span aria-hidden="true" style={{ fontSize: 28, width: 52, height: 52, borderRadius: 14, background: c, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>{i}</span>
              <span className="stack-sm" style={{ gap: 2 }}><b style={{ fontSize: 18 }}>{t}</b><span style={{ color: "#7A6470" }}>{d}</span></span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function Contact() {
  const s = useSite();
  const cards = [["✉", "Email", s.contact_email, s.contact_email && `mailto:${s.contact_email}`], ["☏", "Call", s.phone, s.phone && `tel:${s.phone.replace(/\s/g, "")}`],
    ["⌂", "Visit", s.address || s.location, null], ["@", "Social", Object.values(s.social).filter(Boolean).join(" · "), null]].filter((c) => c[2]);
  return (
    <>
      <PageHead eyebrow="Contact" title="Talk to us" sub="Questions, partnerships, media or a visit. We reply within three working days." />
      <section className="container" style={{ padding: "48px 32px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {cards.map(([ic, t, v, href]) => (
          <div key={t} className="site-card stack-sm" style={{ gap: 6 }}>
            <span className="site-ic">{ic}</span><b style={{ fontSize: 16 }}>{t}</b>
            {href ? <a href={href} style={{ color: "var(--s-deep)", fontWeight: 600, wordBreak: "break-word" }}>{v}</a> : <span style={{ color: "#57434D" }}>{v}</span>}
          </div>
        ))}
      </section>
      <section className="container" style={{ padding: "32px 32px 80px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 24, alignItems: "start" }}>
        <div className="stack" style={{ gap: 12 }}>
          <SiteMap query={s.map_query || s.address || s.location} label={s.address || s.location} />
          <span className="small" style={{ color: "#7A6470" }}>Office hours: Monday to Friday, 8:30 to 17:00</span>
        </div>
        {s.industry === "agency" ? <BriefForm s={s} /> : <InquiryForm />}
      </section>
    </>
  );
}

function Footer({ links }) {
  const s = useSite();
  const social = Object.entries(s.social).filter(([, v]) => v);
  return (
    <footer style={{ background: "var(--s-deep)", color: "rgba(255,255,255,.78)" }}>
      <div className="container" style={{ padding: "64px 32px 36px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 36 }}>
        <div className="stack-sm" style={{ gap: 14 }}>
          <span className="row" style={{ gap: 12, color: "#fff" }}><span className="site-logo" style={{ background: "#fff", color: "var(--s-deep)" }}>{initials(s.organization)}</span><b style={{ fontSize: 18, lineHeight: "22px" }}>{s.organization}</b></span>
          <span style={{ lineHeight: "24px" }}>{s.mission || s.intro}</span>
          <div className="row" style={{ gap: 8 }}>{social.map(([k, v]) => <span key={k} title={`${k}: ${v}`} className="site-social">{k[0].toUpperCase()}</span>)}</div>
        </div>
        <div className="stack-sm" style={{ gap: 10 }}><b className="site-foot-h">Explore</b>{links.map(([p, l]) => <Link key={l} to={`${s.base}${p}` || "/"} className="site-foot-link">{l}</Link>)}</div>
        <div className="stack-sm" style={{ gap: 10 }}><b className="site-foot-h">{s.programmes.length ? "Programmes" : "What we do"}</b>
          {s.programmes.length ? s.programmes.map((p) => <Link key={p.id} to={`${s.base}/programmes`} className="site-foot-link">{p.title}</Link>) : s.services.map((x) => <Link key={x.title} to={`${s.base}/services`} className="site-foot-link">{x.title}</Link>)}
          {s.programmes.length > 0 && <Link to={`${s.base}/get-involved`} className="site-foot-link">Volunteer</Link>}</div>
        <div className="stack-sm" style={{ gap: 10 }}>
          <b className="site-foot-h">Visit or call</b>
          {s.address && <span>{s.address}</span>}{s.phone && <a href={`tel:${s.phone.replace(/\s/g, "")}`} className="site-foot-link">{s.phone}</a>}
          {s.contact_email && <a href={`mailto:${s.contact_email}`} className="site-foot-link">{s.contact_email}</a>}
          {s.industry === "community" || s.industry === "education" || s.industry === "health" ? <Link to={`${s.base}/donate`} className="btn" style={{ background: "var(--s-accent)", borderColor: "var(--s-accent)", color: "#24161C", fontWeight: 800, alignSelf: "flex-start", marginTop: 6 }}>♥ Donate</Link> : null}
        </div>
      </div>
      <div className="container spread small" style={{ padding: "18px 32px 28px", borderTop: "1px solid rgba(255,255,255,.14)" }}>
        <span>© 2026 {s.organization}. All rights reserved.</span>
        <span className="row" style={{ gap: 16 }}><Link to={`${s.base}/login`} className="site-foot-link">Staff login</Link><Link to="/" className="site-foot-link">Powered by Kept</Link></span>
      </div>
    </footer>
  );
}

function SiteHeader({ links, cta, menu, setMenu }) {
  const s = useSite();
  const { user } = useAuth();
  return (
    <>
      <div className="no-print" style={{ background: "var(--s-deep)", color: "rgba(255,255,255,.85)", fontSize: 13 }}>
        <div className="container spread" style={{ padding: "7px 32px", flexWrap: "nowrap" }}>
          <span className="row hide-sm" style={{ gap: 18 }}>{s.contact_email && <a href={`mailto:${s.contact_email}`} style={{ color: "inherit", textDecoration: "none" }}>{s.contact_email}</a>}{s.phone && <span>{s.phone}</span>}</span>
          <span className="row" style={{ gap: 16, marginLeft: "auto" }}>
            {user && user.organization.name === s.organization ? <Link to="/app" style={{ color: "#fff", fontWeight: 700 }}>Go to dashboard →</Link> : <Link to={`${s.base}/login`} style={{ color: "#fff", fontWeight: 700 }}>Staff login →</Link>}
          </span>
        </div>
      </div>
      <header className="site-header">
        <div className="container" style={{ padding: "12px 32px", display: "flex", alignItems: "center", gap: 16 }}>
          <Link to={s.base || "/"} className="row" style={{ textDecoration: "none", color: "var(--s-ink)", gap: 12, minWidth: 0 }}>
            <span className="site-logo">{initials(s.organization)}</span>
            <span className="stack-sm" style={{ gap: 0, minWidth: 0 }}><b style={{ fontSize: 17, lineHeight: "20px", whiteSpace: "nowrap" }}>{s.organization}</b><span className="small" style={{ color: "#7A6470" }}>{s.location}</span></span>
          </Link>
          <nav className="site-nav" aria-label="Site">
            {links.map(([p, l]) => <NavLink key={l} to={`${s.base}${p}` || "/"} end={p === ""} className="site-link">{l}</NavLink>)}
          </nav>
          <Link to={`${s.base}${cta[0]}`} className="btn site-donate">{cta[1]}</Link>
          <button className="btn btn-icon site-menu" aria-label="Open menu" aria-expanded={menu} onClick={() => setMenu(true)}>☰</button>
        </div>
      </header>
      {menu && (
        <div className="site-drawer-wrap" onClick={() => setMenu(false)}>
          <nav className="site-drawer" aria-label="Site" onClick={(e) => e.stopPropagation()}>
            <div className="spread"><b>{s.organization}</b><button className="btn btn-icon" aria-label="Close menu" onClick={() => setMenu(false)}>✕</button></div>
            {links.map(([p, l]) => <NavLink key={l} to={`${s.base}${p}` || "/"} end={p === ""} className="site-link" onClick={() => setMenu(false)}>{l}</NavLink>)}
            <Link to={`${s.base}/get-involved`} className="site-link" onClick={() => setMenu(false)}>Get involved</Link>
            <Link to={`${s.base}${cta[0]}`} className="btn site-donate" style={{ justifyContent: "center", marginTop: 8 }} onClick={() => setMenu(false)}>{cta[1]}</Link>
          </nav>
        </div>
      )}
    </>
  );
}

const GALLERY_ICONS = { "Health Advocacy": "M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10z", "Gender, Peace and Security": "M4 5h12v8H8l-4 4V5zM20 9v8l-3-3h-5",
  "Disability Inclusion": "M12 4a2 2 0 100 4 2 2 0 000-4zM9 10h6l-1 5h3l2 5M11 15a4 4 0 104 4", "Climate Change": "M12 22V12M12 12C12 6 7 3 3 3c0 5 3 9 9 9zM12 14c0-5 4-8 9-8 0 5-4 8-9 8z" };

const STAFF_DEMO = {
  timiza: [["admin@timiza.example", "Amani Charo", "Administrator"], ["zawadi@timiza.example", "Zawadi Kahindi", "Programme manager"], ["baraka@timiza.example", "Baraka Katana", "Field officer"], ["viewer@timiza.example", "Partner Observer", "Board and partners, read only"]],
  tumaini: [["achieng@tumaini.example", "Achieng Otieno", "Manager"], ["admin@tumaini.example", "Grace Nduta", "Administrator"]],
  hatua: [["wanjiru@hatua.example", "Wanjiru Mbugua", "Owner and administrator"], ["otis@hatua.example", "Otis Kamau", "Operations manager"], ["achola@hatua.example", "Achola Were", "Store and dispatch staff"]],
  mwangaza: [["wairimu@mwangaza.example", "Wairimu Kamau", "Studio lead"]],
  pwani: [["rehema@pwani.example", "Rehema Salim", "General manager"], ["omar@pwani.example", "Omar Abdalla", "Front office manager"], ["neema@pwani.example", "Neema Charo", "Reservations"]],
};

function StaffLogin() {
  const s = useSite();
  const { user, signIn } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  if (user && user.organization.name === s.organization) return <Navigate to="/app" replace />;
  const go2 = async (body) => {
    setBusy(true); setError(null);
    try { signIn(await api("/auth/login", { method: "POST", body: { ...body, site_slug: s.slug } })); nav("/app"); }
    catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <section style={{ minHeight: "70vh", background: "linear-gradient(135deg, var(--s-deep), var(--s-primary))", padding: "64px 16px" }}>
      <div style={{ maxWidth: 940, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", borderRadius: 24, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,.3)", background: "#fff" }}>
        <div className="stack" style={{ padding: 36, color: "#fff", background: "radial-gradient(300px 200px at 100% 0%, color-mix(in srgb, var(--s-accent) 55%, transparent), transparent 70%), var(--s-deep)", gap: 18 }}>
          <span className="site-logo" style={{ background: "#fff", color: "var(--s-deep)" }}>{initials(s.organization)}</span>
          <h1 style={{ fontSize: 30, lineHeight: "36px", fontWeight: 900 }}>{s.organization}<br /><span style={{ opacity: .8, fontWeight: 600, fontSize: 20 }}>Staff dashboard</span></h1>
          <span style={{ opacity: .85, lineHeight: "24px" }}>Programmes, finance, volunteers, events, data collection and this website, all in one place.</span>
          <Link to={s.base || "/"} style={{ color: "#fff", fontWeight: 700 }}>← Back to the website</Link>
        </div>
        <form className="stack" style={{ padding: 36, gap: 16 }} onSubmit={(e) => { e.preventDefault(); go2(f); }} noValidate>
          <h2 style={{ fontSize: 24, fontWeight: 800 }}>Sign in</h2>
          <ErrorNotice error={error} />
          <Field label="Work email"><input className="input" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Password"><input className="input" type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <button className="btn btn-lg site-donate" style={{ justifyContent: "center" }} disabled={busy}>{busy ? "Signing in…" : "Sign in to dashboard"}</button>
          {PREVIEW && STAFF_DEMO[s.slug] && (
            <div className="stack-sm" style={{ borderTop: "1px solid #F0E3DC", paddingTop: 14 }}>
              <span className="small" style={{ color: "#7A6470", fontWeight: 700 }}>Demo: sign in as</span>
              {STAFF_DEMO[s.slug].map(([email, name, role]) => (
                <button type="button" key={email} className="btn" style={{ justifyContent: "space-between", height: 46 }} disabled={busy} onClick={() => go2({ email, password: "kept-demo-2026" })}>
                  <span>{name}</span><span className="small" style={{ color: "#7A6470", fontWeight: 500 }}>{role}</span>
                </button>
              ))}
            </div>
          )}
        </form>
      </div>
    </section>
  );
}

function GalleryTile({ g, i, onOpen, big }) {
  const hasPhoto = g.photo?.url;
  return (
    <button onClick={onOpen} className="gallery-tile" style={{ gridRow: big ? "span 2" : undefined, background: hasPhoto ? `#000 url(${g.photo.url}) center/cover` : `radial-gradient(260px 180px at ${20 + (i * 37) % 60}% 0%, color-mix(in srgb, var(--s-accent) 70%, transparent), transparent 70%), linear-gradient(${120 + i * 25}deg, var(--s-deep), var(--s-primary))` }} aria-label={`Open photo: ${g.caption}`}>
      {!hasPhoto && <svg className="gallery-art" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={GALLERY_ICONS[g.programme] || GALLERY_ICONS["Climate Change"]} /></svg>}
      <span className="gallery-cap"><b>{g.caption}</b><span>{[g.place, g.taken_on && fmtDate(g.taken_on, true)].filter(Boolean).join(" · ")}</span></span>
    </button>
  );
}

function Gallery() {
  const s = useSite();
  const [prog, setProg] = useState("All");
  const [open, setOpen] = useState(null);
  const progs = ["All", ...new Set(s.gallery.map((g) => g.programme).filter(Boolean))];
  const items = s.gallery.filter((g) => prog === "All" || g.programme === prog);
  useEffect(() => {
    if (open === null) return undefined;
    const k = (e) => { if (e.key === "Escape") setOpen(null); if (e.key === "ArrowRight") setOpen((open + 1) % items.length); if (e.key === "ArrowLeft") setOpen((open - 1 + items.length) % items.length); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open, items.length]);
  return (
    <>
      <PageHead eyebrow="Gallery" title="Moments from the field" sub="Outreach days, dialogues, plantings and trainings across Kilifi County." />
      <section className="container stack" style={{ padding: "48px 32px 80px", gap: 24 }}>
        <div className="row wrap" style={{ gap: 8 }}>{progs.map((p) => <button key={p} className="site-pill" aria-pressed={prog === p} onClick={() => setProg(p)}>{p}</button>)}</div>
        {items.length === 0 ? <p className="muted">No photos yet.</p> : (
          <div className="gallery-grid">{items.map((g, i) => <GalleryTile key={g.id} g={g} i={i} big={i % 5 === 0} onOpen={() => setOpen(i)} />)}</div>
        )}
        <p className="small" style={{ color: "#7A6470" }}>Photos are added by the team in the workspace (Website → Gallery). Illustrated tiles show where a photo has not been uploaded yet.</p>
      </section>
      {open !== null && items[open] && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={items[open].caption} onClick={() => setOpen(null)}>
          <div style={{ width: "min(960px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <GalleryTile g={items[open]} i={open} onOpen={() => {}} />
            <div className="spread" style={{ color: "#fff", marginTop: 12 }}>
              <button className="btn" onClick={() => setOpen((open - 1 + items.length) % items.length)}>← Previous</button>
              <span className="small">{open + 1} of {items.length}</span>
              <button className="btn" onClick={() => setOpen((open + 1) % items.length)}>Next →</button>
            </div>
          </div>
          <button className="btn btn-icon" style={{ position: "absolute", top: 16, right: 16 }} aria-label="Close" onClick={() => setOpen(null)}>✕</button>
        </div>
      )}
    </>
  );
}

function SiteMap({ query, label }) {
  const q = encodeURIComponent(query || label || "");
  const link = `https://www.google.com/maps/search/?api=1&query=${q}`;
  if (!PREVIEW) {
    return <iframe title={`Map: ${label}`} src={`https://www.google.com/maps?q=${q}&output=embed`} loading="lazy" referrerPolicy="no-referrer" style={{ width: "100%", height: 380, border: 0, borderRadius: 20 }} />;
  }
  // The hosted preview cannot load map tiles, so it draws a simple map; the live site embeds Google Maps.
  return (
    <a href={link} target="_blank" rel="noreferrer" className="site-map" aria-label={`Open ${label} in Google Maps`}>
      <svg viewBox="0 0 600 380" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%" }} aria-hidden="true">
        <rect width="600" height="380" fill="#F3EEE6" />
        <path d="M430 0 C410 80 470 140 440 220 C420 280 470 330 450 380 L600 380 L600 0 Z" fill="#BFDDF0" />
        <path d="M455 150 C500 160 540 140 600 150" stroke="#BFDDF0" strokeWidth="18" fill="none" />
        <g stroke="#fff" strokeWidth="10" fill="none" strokeLinecap="round"><path d="M0 250 C120 230 240 260 420 200" /><path d="M200 0 C220 120 210 240 240 380" /><path d="M60 60 C160 110 300 120 420 90" /></g>
        <g stroke="#E4D8C8" strokeWidth="4" fill="none"><path d="M90 300 L300 330" /><path d="M300 160 L380 300" /><path d="M120 150 L260 190" /></g>
        <circle cx="320" cy="205" r="60" fill="var(--s-primary)" opacity=".12" />
        <path d="M320 205 c-18 -24 -28 -38 -28 -52 a28 28 0 0 1 56 0 c0 14 -10 28 -28 52z" fill="var(--s-primary)" stroke="#fff" strokeWidth="3" />
        <circle cx="320" cy="153" r="9" fill="#fff" />
        <text x="470" y="60" fontSize="16" fill="#5C8DB0" fontStyle="italic">Indian Ocean</text>
        <text x="250" y="245" fontSize="15" fontWeight="700" fill="#24161C">{label}</text>
      </svg>
      <span className="site-map-cta">Open in Google Maps ↗</span>
    </a>
  );
}

// ---------- forms ----------
function useSubmit(path) {
  const [state, setState] = useState({ busy: false, error: null, ok: null });
  const send = async (body, reset) => {
    setState({ busy: true, error: null, ok: null });
    try { const r = await api(path, { method: "POST", body: { ...body, website: "" } }); setState({ busy: false, error: null, ok: r.message }); reset(); }
    catch (e) { setState({ busy: false, error: e, ok: null }); }
  };
  return [state, send];
}

function VolunteerForm() {
  const s = useSite();
  const empty = { name: "", phone: "", email: "", ward: "", interest: "any", skills: "" };
  const [f, setF] = useState(empty);
  const [state, send] = useSubmit(`/public/${s.slug}/volunteer`);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); send({ ...f, email: f.email || null }, () => setF(empty)); }} className="stack" style={{ background: "var(--s-sand)", borderRadius: 20, padding: 28 }} noValidate>
      <h2 style={{ fontSize: 26, fontWeight: 900 }}>Volunteer with us</h2>
      {state.ok && <div className="notice notice-ok" role="status">✓ {state.ok}</div>}
      <ErrorNotice error={state.error} />
      <div className="form-grid">
        <Field label="Name"><input className="input" value={f.name} onChange={set("name")} autoComplete="name" /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={set("phone")} inputMode="tel" /></Field>
        <Field label="Ward"><input className="input" value={f.ward} onChange={set("ward")} /></Field>
        <Field label="Programme"><select className="select" value={f.interest} onChange={set("interest")}><option value="any">Any</option><option value="health">Health Advocacy</option><option value="gps">Gender, Peace and Security</option><option value="disability">Disability Inclusion</option><option value="climate">Climate Change</option></select></Field>
      </div>
      <Field label="Skills" hint="Optional"><input className="input" value={f.skills} onChange={set("skills")} /></Field>
      <button className="btn btn-lg" style={{ background: "var(--s-primary)", borderColor: "var(--s-primary)", color: "#fff", alignSelf: "flex-start" }} disabled={state.busy}>{state.busy ? "Sending…" : "Apply to volunteer"}</button>
    </form>
  );
}

function InquiryForm() {
  const s = useSite();
  const empty = { name: "", contact: "", kind: "partner", message: "" };
  const [f, setF] = useState(empty);
  const [state, send] = useSubmit(`/public/${s.slug}/inquiry`);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); send(f, () => setF(empty)); }} className="stack" style={{ border: "1px solid #F3E0D8", borderRadius: 20, padding: 28 }} noValidate>
      <h2 style={{ fontSize: 26, fontWeight: 900 }}>Send a message</h2>
      {state.ok && <div className="notice notice-ok" role="status">✓ {state.ok}</div>}
      <ErrorNotice error={state.error} />
      <div className="form-grid">
        <Field label="Name or organization"><input className="input" value={f.name} onChange={set("name")} /></Field>
        <Field label="Email or phone"><input className="input" value={f.contact} onChange={set("contact")} /></Field>
      </div>
      <Field label="About"><select className="select" value={f.kind} onChange={set("kind")}><option value="partner">Partnership</option><option value="donate">Donation or sponsorship</option><option value="media">Media</option><option value="other">Something else</option></select></Field>
      <Field label="Message"><textarea className="textarea" rows={4} value={f.message} onChange={set("message")} /></Field>
      <button className="btn btn-lg" style={{ background: "var(--s-ink)", borderColor: "var(--s-ink)", color: "#fff", alignSelf: "flex-start" }} disabled={state.busy}>{state.busy ? "Sending…" : "Send message"}</button>
    </form>
  );
}

// ---------- donate ----------
const PRESETS = [500, 1000, 2500, 5000, 10000];

function Donate() {
  const s = useSite();
  const [sp] = useSearchParams();
  const initialProg = s.projects.find((p) => p.name === sp.get("programme"))?.id || "";
  const [f, setF] = useState({ amount: 1000, custom: "", project_id: initialProg, method: "mpesa", name: "", contact: "", anonymous: false, message: "" });
  const [stage, setStage] = useState("form"); // form | pending | done | failed
  const [don, setDon] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const amount = f.custom ? Number(f.custom) : f.amount;
  const d = s.donations;

  useEffect(() => {
    if (stage !== "pending" || !don) return undefined;
    const t = setInterval(async () => {
      try {
        const st = await api(`/public/${s.slug}/donations/${don.id}`, { params: { ref: don.reference } });
        if (st.status === "confirmed") { setStage("done"); s.reload(); }
        if (st.status === "failed") setStage("failed");
      } catch { /* keep polling */ }
    }, 2500);
    return () => clearInterval(t);
  }, [stage, don, s]);

  const start = async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const r = await api(`/public/${s.slug}/donations`, { method: "POST", body: { name: f.name, contact: f.contact, amount, method: f.method, project_id: f.project_id || null, anonymous: f.anonymous, message: f.message, website: "" } });
      setDon({ ...r, amount }); setStage("pending");
    } catch (er) { setError(er); } finally { setBusy(false); }
  };
  const simulate = async (outcome) => {
    setBusy(true);
    try { const st = await api(`/public/${s.slug}/donations/${don.id}/simulate`, { method: "POST", body: { ref: don.reference, outcome } }); setStage(st.status === "confirmed" ? "done" : "failed"); s.reload(); }
    catch (er) { setError(er); } finally { setBusy(false); }
  };

  return (
    <>
      <section style={{ background: "linear-gradient(135deg, var(--s-primary), var(--s-deep))", color: "#fff" }}>
        <div className="container" style={{ padding: "56px 32px", display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center" }}>
          <div className="stack-sm" style={{ flex: "1 1 420px" }}>
            <span style={{ color: "var(--s-accent)", fontWeight: 800, fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase" }}>Donate</span>
            <h1 style={{ fontSize: "clamp(32px, 4vw, 50px)", fontWeight: 900, letterSpacing: "-1px" }}>{d.campaign || "Support our work"}</h1>
          </div>
          {d.goal > 0 && (
            <div className="stack-sm" style={{ flex: "1 1 320px", background: "rgba(255,255,255,.1)", borderRadius: 18, padding: 22 }}>
              <span><b style={{ fontSize: 30, color: "var(--s-accent)" }}>{kes(d.raised)}</b> <span style={{ opacity: .85 }}>of {kes(d.goal)}</span></span>
              <Meter value={d.raised} max={d.goal} color="var(--s-accent)" height={14} />
              <span className="small" style={{ opacity: .85 }}>{d.donors} donors · {Math.round((d.raised / d.goal) * 100)}% funded</span>
            </div>
          )}
        </div>
      </section>
      <section className="container" style={{ padding: "48px 32px 72px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 28, alignItems: "start" }}>
        <div className="stack" style={{ background: "#fff", border: "1px solid #F3E0D8", borderRadius: 22, padding: 28, boxShadow: "0 18px 40px rgba(20,38,42,.08)" }}>
          {stage === "form" && (
            <form className="stack" onSubmit={start} noValidate>
              <b style={{ fontSize: 18 }}>Choose an amount</b>
              <div className="row wrap">{PRESETS.map((a) => <button type="button" key={a} className="chip" style={{ height: 46, padding: "0 18px", fontSize: 16, fontWeight: 700 }} aria-pressed={!f.custom && f.amount === a} onClick={() => setF({ ...f, amount: a, custom: "" })}>KES {a.toLocaleString()}</button>)}</div>
              <Field label="Or enter another amount (KES)"><input className="input" inputMode="numeric" value={f.custom} onChange={(e) => setF({ ...f, custom: e.target.value.replace(/\D/g, "") })} placeholder="e.g. 750" /></Field>
              <Field label="Where should it go?"><select className="select" value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}><option value="">Where it is needed most</option>{s.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
              <div className="seg" role="group" aria-label="Payment method" style={{ alignSelf: "flex-start" }}>
                <button type="button" aria-pressed={f.method === "mpesa"} onClick={() => setF({ ...f, method: "mpesa", contact: "" })}>M-Pesa</button>
                <button type="button" aria-pressed={f.method === "card"} onClick={() => setF({ ...f, method: "card", contact: "" })}>Card</button>
              </div>
              <div className="form-grid">
                <Field label="Your name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></Field>
                <Field label={f.method === "mpesa" ? "M-Pesa number" : "Email for your receipt"}><input className="input" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} inputMode={f.method === "mpesa" ? "tel" : "email"} placeholder={f.method === "mpesa" ? "0712 345 678" : "you@example.com"} /></Field>
              </div>
              <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={f.anonymous} onChange={(e) => setF({ ...f, anonymous: e.target.checked })} />Give anonymously</label>
              <ErrorNotice error={error} />
              <button className="btn btn-lg" style={{ background: "var(--s-accent)", borderColor: "var(--s-accent)", color: "var(--s-ink)", fontWeight: 900, height: 56, fontSize: 18 }} disabled={busy || !amount}>{busy ? "Starting…" : `♥ Donate KES ${(amount || 0).toLocaleString()}`}</button>
              <span className="small muted">🔒 Secure. We never see your M-Pesa PIN or card details.</span>
            </form>
          )}
          {stage === "pending" && (
            <div className="stack" style={{ textAlign: "center", alignItems: "center" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", border: "6px solid var(--s-sand)", borderTopColor: "var(--s-primary)", animation: "spin 1s linear infinite" }} aria-hidden="true" />
              <h2 style={{ fontSize: 24, fontWeight: 900 }}>{f.method === "mpesa" ? `Check your phone` : "Complete your card payment"}</h2>
              <p className="muted">{f.method === "mpesa" ? `We sent a request for KES ${amount.toLocaleString()} to ${f.contact}. Enter your M-Pesa PIN to finish.` : `KES ${amount.toLocaleString()} · reference ${don.reference}`}</p>
              {don.mode === "sandbox" && (
                <div className="stack-sm" style={{ background: "var(--accent-tint, #FCEFD3)", borderRadius: 14, padding: 16, width: "100%" }}>
                  <b className="small">Sandbox: no real money moves</b>
                  <div className="row wrap" style={{ justifyContent: "center" }}>
                    <button className="btn btn-primary" disabled={busy} onClick={() => simulate("success")}>{f.method === "mpesa" ? "Simulate PIN entered" : "Simulate card approved"}</button>
                    <button className="btn" disabled={busy} onClick={() => simulate("cancel")}>Simulate cancel</button>
                  </div>
                </div>
              )}
              <ErrorNotice error={error} />
            </div>
          )}
          {stage === "done" && (
            <div className="stack" style={{ textAlign: "center", alignItems: "center" }}>
              <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--s-primary)", color: "#fff", fontSize: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</div>
              <h2 style={{ fontSize: 28, fontWeight: 900 }}>Asante sana{f.anonymous ? "" : `, ${f.name.split(" ")[0]}`}!</h2>
              <p>Your gift of <b>KES {amount.toLocaleString()}</b> was received.</p>
              <div style={{ background: "var(--s-sand)", borderRadius: 12, padding: "12px 18px" }}>Receipt reference <b>{don.reference}</b></div>
              <div className="row wrap" style={{ justifyContent: "center" }}><button className="btn" onClick={() => window.print()}>Print receipt</button><button className="btn btn-primary" onClick={() => { setStage("form"); setDon(null); }}>Give again</button></div>
            </div>
          )}
          {stage === "failed" && (
            <div className="stack" style={{ textAlign: "center", alignItems: "center" }}>
              <h2 style={{ fontSize: 24, fontWeight: 900 }}>Payment not completed</h2><p className="muted">Nothing was charged. You can try again.</p>
              <button className="btn btn-primary" onClick={() => { setStage("form"); setDon(null); }}>Try again</button>
            </div>
          )}
        </div>
        <aside className="stack">
          <b style={{ fontSize: 18 }}>What your gift does</b>
          {[["KES 500", "Prints SRH flyers for 50 young people", "#C93A63"], ["KES 2,500", "Trains one peer educator for a day", "#E5734F"], ["KES 5,000", "Plants and protects 150 indigenous trees", "#F59E3B"], ["KES 10,000", "Runs a full ward dialogue on GBV", "#B5838D"]].map(([a, t, c]) => (
            <div key={a} className="row" style={{ gap: 14, borderRadius: 14, padding: 16, background: `${c}0F` }}><b style={{ color: c, minWidth: 92 }}>{a}</b><span>{t}</span></div>
          ))}
          {d.recent.length > 0 && <><b style={{ fontSize: 18, marginTop: 8 }}>Recent supporters</b>
            {d.recent.map((r, i) => <div key={i} className="spread" style={{ borderBottom: "1px solid #F3E0D8", padding: "8px 0" }}><span>♥ {r.name}</span><b>{kes(r.amount)}</b></div>)}</>}
        </aside>
      </section>
    </>
  );
}
