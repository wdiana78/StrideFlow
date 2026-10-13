import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import Shell from "./components/Shell";
import { Loading } from "./components/ui";
import Activity from "./pages/Activity";
import Attention from "./pages/Attention";
import Landing from "./pages/Landing";
import { Login, Register } from "./pages/Auth";
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
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/site/:slug" element={<PublicSite />} />
      <Route path="/app" element={<RequireAuth><Shell /></RequireAuth>}>
        <Route index element={<Overview />} />
        <Route path="attention" element={<Attention />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="finance" element={<Finance />} />
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
