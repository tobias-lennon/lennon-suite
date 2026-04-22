import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Avatar from './Avatar'
import Logo from './Logo'

const navItems = [
  { to: '/dashboard', label: 'Home', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )},
  { to: '/customers', label: 'Clients', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )},
  { to: '/jobs', label: 'Jobs', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )},
  { to: '/invoices', label: 'Invoices', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )},
  { to: '/leads', label: 'Leads', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  )},
]

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    setMenuOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <div className="h-screen overflow-hidden flex bg-cream">

      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className="w-64 hidden md:flex flex-col flex-shrink-0 bg-brand-dark">

        {/* Logo */}
        <div className="px-6 pt-8 pb-6">
          <Link to="/dashboard"><Logo variant="light" size="sm" /></Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 flex flex-col gap-0.5">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-lime text-brand-dark'
                    : 'text-white/55 hover:text-white hover:bg-white/8'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="p-4 mt-4">
          <div className="rounded-2xl bg-white/6 p-3">
            <Link
              to="/profile"
              className="flex items-center gap-3 mb-3 group"
            >
              <Avatar name={user?.name ?? 'U'} src={user?.avatar} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-white text-xs font-semibold truncate group-hover:text-brand-lime transition-colors">
                  {user?.name}
                </p>
                <p className="text-white/40 text-[10px] truncate">{user?.email}</p>
              </div>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8 text-xs transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile top header ───────────────────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-brand-dark/95 backdrop-blur-sm flex items-center justify-between px-4 h-14">
        <Link to="/dashboard"><Logo variant="light" size="sm" /></Link>

        <button
          onPointerDown={e => { e.preventDefault(); setMenuOpen(o => !o) }}
          className="cursor-pointer"
        >
          <Avatar name={user?.name ?? 'U'} src={user?.avatar} size="mdlg" />
        </button>

        {/* Dropdown */}
        <div className={`absolute right-4 top-[60px] w-56 bg-[#FDFAF5] rounded-2xl shadow-2xl border border-black/6 overflow-hidden z-50 transition-[opacity,transform] ease-out origin-top-right ${
          menuOpen
            ? 'opacity-100 scale-100 duration-150'
            : 'opacity-0 scale-95 pointer-events-none duration-0'
        }`}>
          <Link
            to="/profile"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-3.5 border-b border-black/6 hover:bg-black/4 transition-colors"
          >
            <Avatar name={user?.name ?? 'U'} src={user?.avatar} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brand-dark truncate">{user?.name}</p>
              <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
            </div>
          </Link>
          <Link
            to="/profile"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2.5 px-4 py-3 text-sm text-gray-600 hover:bg-black/4 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            My Profile
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-danger hover:bg-brand-terra/5 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </header>

      {/* Overlay to close dropdown */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 z-[39]"
          aria-hidden="true"
          onPointerDown={() => setMenuOpen(false)}
        />
      )}

      {/* ── Main content ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto overscroll-contain pt-14 pb-28 md:pt-0 md:pb-0">
        <Outlet />
      </main>

      {/* ── Mobile floating bottom nav ──────────────────────────────── */}
      <nav className="md:hidden fixed bottom-4 left-3 right-3 z-40 select-none">
        <div
          className="flex rounded-[28px] overflow-hidden px-1.5 py-1.5 gap-1"
          style={{
            background: '#0F3714',
            boxShadow: '0 8px 32px rgba(15,55,20,0.45), 0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              style={{ touchAction: 'manipulation' }}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-[22px] text-[10px] font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-lime text-brand-dark'
                    : 'text-white/50'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

    </div>
  )
}
