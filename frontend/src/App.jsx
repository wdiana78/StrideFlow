import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import Shell from "./components/Shell";
import { Loading } from "./components/ui";
import Activity from "./pages/Activity";
import Attention from "./pages/Attention";
import Landing, { ContactPage, CustomersPage, PricingPage, ProductPage, SolutionsPage } from "./pages/Landing";
import { AcceptInvitation, ForgotPassword, Login, Register, ResetPassword, Welcome } from "./pages/Auth";
import Project from "./pages/Project";
import Projects from "./pages/Projects";
import ReportView from "./pages/ReportView";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Work from "./pages/Work";
import Overview from "./pages/Overview";
import Approvals from "./pages/Approvals";
import Finance from "./pages/Finance";
import Calendar from "./pages/Calendar";
import ModulePage from "./pages/Module";
import PublicSite from "./pages/PublicSite";
import Analytics from "./pages/Analytics";
import Apps from "./pages/Apps";
import Account from "./pages/Account";
import { FormBuilder, FormDetail, FormsList, PublicForm } from "./pages/Forms";

// When VITE_SITE_SLUG is set, the organization's public website is the home page and the ERP sits behind Staff login.
const SITE = import.meta.env.VITE_SITE_SLUG;

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div style={{ padding: 40 }}><Loading /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={SITE ? <PublicSite slugOverride={SITE} /> : <Landing />} />
      <Route path="/kept" element={<Landing />} />
      <Route path="/product" element={<ProductPage />} />
      <Route path="/solutions" element={<SolutionsPage />} />
      <Route path="/customers" element={<CustomersPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/f/:id" element={<PublicForm />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/accept-invitation" element={<AcceptInvitation />} />
      <Route path="/app/welcome" element={<RequireAuth><Welcome /></RequireAuth>} />
      <Route path="/site/:slug/*" element={<PublicSite />} />
      <Route path="/app" element={<RequireAuth><Shell /></RequireAuth>}>
        <Route index element={<Overview />} />
        <Route path="attention" element={<Attention />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="finance" element={<Finance />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="apps" element={<Apps />} />
        <Route path="account" element={<Account />} />
        <Route path="forms" element={<FormsList />} />
        <Route path="forms/new" element={<FormBuilder />} />
        <Route path="forms/:id" element={<FormDetail />} />
        <Route path="forms/:id/edit" element={<FormBuilder />} />
        <Route path="m/:key" element={<ModulePage />} />
        <Route path="m/:key/:id" element={<ModulePage />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<Project />} />
        <Route path="activities/:id" element={<Activity />} />
        <Route path="work" element={<Work />} />
        <Route path="reports" element={<Reports />} />
        <Route path="reports/:id" element={<ReportView />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={SITE ? <PublicSite slugOverride={SITE} /> : <Navigate to="/" replace />} />
    </Routes>
  );
}
