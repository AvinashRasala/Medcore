import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  FileText,
  Receipt,
  Stethoscope,
  LogOut,
  Activity,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getInitials } from "../utils/format";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN"] },
  { to: "/patients", label: "Patients", icon: Users, roles: ["ADMIN", "RECEPTIONIST", "DOCTOR"] },
  { to: "/appointments", label: "Appointments", icon: CalendarClock, roles: ["ADMIN", "RECEPTIONIST", "DOCTOR"] },
  { to: "/doctors", label: "Doctors", icon: Stethoscope, roles: ["ADMIN", "RECEPTIONIST"] },
  { to: "/medical-records", label: "Medical Records", icon: FileText, roles: ["ADMIN", "RECEPTIONIST", "DOCTOR"] },
  { to: "/billing", label: "Billing", icon: Receipt, roles: ["ADMIN", "RECEPTIONIST"] },
];

export default function MainLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user?.role));

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function handleNavClick() {
    setMobileOpen(false);
  }

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between gap-2.5 px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-coral-500 flex items-center justify-center shrink-0">
            <Activity size={18} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-display font-semibold text-lg leading-tight tracking-tight">MedCore</div>
            <div className="text-[11px] text-teal-300 tracking-wide uppercase">Hospital System</div>
          </div>
        </div>
        {/* Close button, mobile drawer only */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden text-teal-300 hover:text-white p-1.5 -mr-1.5"
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={handleNavClick}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-teal-200 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <item.icon size={18} strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <NavLink
          to="/profile"
          onClick={handleNavClick}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 mb-1 rounded-lg transition-colors ${
              isActive ? "bg-white/10" : "hover:bg-white/5"
            }`
          }
        >
          <div className="h-9 w-9 rounded-full bg-coral-500/90 flex items-center justify-center text-xs font-semibold shrink-0 overflow-hidden">
            {user?.profilePhoto ? (
              <img src={user.profilePhoto} alt="" className="h-full w-full object-cover" />
            ) : (
              getInitials(user?.name)
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate">{user?.name}</div>
            <div className="text-[11px] text-teal-300 capitalize">{user?.role?.toLowerCase()}</div>
          </div>
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-teal-200 hover:bg-white/5 hover:text-white transition-colors"
        >
          <LogOut size={18} strokeWidth={2} />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-cream lg:flex">
      {/* Mobile top bar — hamburger + logo, only below lg breakpoint */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 bg-teal-950 text-cream px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-coral-500 flex items-center justify-center shrink-0">
            <Activity size={16} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="font-display font-semibold text-base tracking-tight">MedCore</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-teal-200 hover:text-white p-1.5"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-ink-900/60 z-40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — slide-in drawer on mobile/tablet, fixed permanent on desktop (lg+) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 lg:w-64 bg-teal-950 text-cream flex flex-col
          transform transition-transform duration-200 ease-out
          lg:translate-x-0 lg:z-20
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:ml-64 min-h-screen w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
