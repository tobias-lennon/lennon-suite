import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Logo from './Logo'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )},
  { to: '/customers', label: 'Customers', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )},
  { to: '/jobs', label: 'Jobs', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  )},
]

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)

  async function handleLogout() {
    setProfileOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <div className="h-screen overflow-hidden flex bg-gray-50">

      {/* Desktop sidebar */}
      <aside className="w-64 bg-[#0F3714] flex-col hidden md:flex flex-shrink-0">
        <div className="p-6 border-b border-white/10">
          <Link to="/dashboard"><Logo variant="light" size="sm" /></Link>
        </div>

        <nav className="flex-1 p-4 flex flex-col gap-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#97B545] text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-[#97B545] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 select-none">
              {user?.name?.charAt(0) ?? 'T'}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-medium truncate">{user?.name}</p>
              <p className="text-white/40 text-xs truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{ touchAction: 'manipulation' }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 text-sm transition-colors cursor-pointer select-none"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[#0F3714] flex items-center justify-between px-4 h-14 border-b border-white/10 select-none">
        <Link to="/dashboard"><Logo variant="light" size="sm" /></Link>

        {/* Profile button + dropdown */}
        <div className="relative">
          <button
            onPointerDown={(e) => { e.preventDefault(); setProfileOpen(o => !o) }}
            className="w-8 h-8 rounded-full bg-[#97B545] flex items-center justify-center text-white text-xs font-bold cursor-pointer select-none"
          >
            {user?.name?.charAt(0) ?? 'T'}
          </button>

          {/* Always rendered — CSS handles show/hide so pointer-events-none closes instantly */}
          <div className={`absolute right-0 top-11 w-52 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50 transition-[opacity,transform] ease-out origin-top-right ${
            profileOpen
              ? 'opacity-100 scale-100 duration-150'
              : 'opacity-0 scale-95 pointer-events-none duration-0'
          }`}>
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              style={{ touchAction: 'manipulation' }}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors cursor-pointer select-none"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/*
        Transparent overlay — sits below the header (z-40) and bottom nav (z-40)
        but above all page content. Clicking anywhere on the page closes the dropdown.
        The header elements are z-40 > overlay z-[39] so they still receive clicks normally.
      */}
      {profileOpen && (
        <div
          className="md:hidden fixed inset-0 z-[39]"
          aria-hidden="true"
          onPointerDown={() => setProfileOpen(false)}
        />
      )}

      {/* Main content — scrolls independently */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0 pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom tab nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0F3714] border-t border-white/10 flex select-none">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            style={{ touchAction: 'manipulation' }}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                isActive ? 'text-[#97B545]' : 'text-white/50'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

    </div>
  )
}
