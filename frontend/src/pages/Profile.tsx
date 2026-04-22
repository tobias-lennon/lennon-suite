import { useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import Avatar from '../components/Avatar'
import Spinner from '../components/Spinner'

export default function Profile() {
  const { user, updateUser } = useAuth()
  useRegisterSW()

  // ── Password form ────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword]   = useState('')
  const [newPassword,     setNewPassword]       = useState('')
  const [confirmPassword, setConfirmPassword]   = useState('')
  const [pwLoading,       setPwLoading]         = useState(false)
  const [pwError,         setPwError]           = useState<string | null>(null)
  const [pwSuccess,       setPwSuccess]         = useState(false)

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.')
      return
    }
    setPwError(null)
    setPwLoading(true)
    try {
      await api.patch('/users/me/password', {
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      })
      setPwSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPwSuccess(false), 3000)
    } catch (err: any) {
      const msg = err.response?.data?.errors?.current_password?.[0]
               ?? err.response?.data?.message
               ?? 'Something went wrong.'
      setPwError(msg)
    } finally {
      setPwLoading(false)
    }
  }

  // ── App update ──────────────────────────────────────────────────
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'up-to-date'>('idle')

  async function handleCheckUpdate() {
    setUpdateStatus('checking')
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      if (!reg) throw new Error('no sw')
      const registration = reg

      function applyWaiting() {
        const sw = registration.waiting as ServiceWorker
        sw.postMessage({ type: 'SKIP_WAITING' })
        window.location.reload()
      }

      // Already waiting — apply immediately
      if (reg.waiting) { applyWaiting(); return }

      // Wait for updatefound → installing → installed, then apply
      await new Promise<void>(resolve => {
        const detectTimeout = setTimeout(resolve, 6000) // give up if no new SW found within 6s

        reg.addEventListener('updatefound', () => {
          clearTimeout(detectTimeout) // new SW detected — wait as long as needed for install
          const sw = reg.installing
          if (!sw) { resolve(); return }
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' || sw.state === 'redundant') resolve()
          })
        }, { once: true })

        reg.update().catch(resolve)
      })

      if (reg.waiting) { applyWaiting(); return }
    } catch { /* no SW in dev */ }

    setUpdateStatus('up-to-date')
    setTimeout(() => setUpdateStatus('idle'), 3000)
  }

  // ── Avatar upload ────────────────────────────────────────────────
  const fileInput = useRef<HTMLInputElement>(null)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarLoading(true)
    setAvatarError(null)
    try {
      const form = new FormData()
      form.append('avatar', file)
      // Delete the default 'application/json' header so Axios auto-sets multipart/form-data with boundary
      const { data } = await api.post('/users/me/avatar', form, {
        headers: { 'Content-Type': undefined },
      })
      updateUser({ avatar: data.avatar })
    } catch (err: any) {
      const msg = err.response?.data?.errors?.avatar?.[0]
               ?? err.response?.data?.message
               ?? 'Photo upload failed.'
      setAvatarError(msg)
    } finally {
      setAvatarLoading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function handleRemoveAvatar() {
    setAvatarLoading(true)
    try {
      await api.delete('/users/me/avatar')
      updateUser({ avatar: null })
    } finally {
      setAvatarLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto">

      {/* ── Profile card ───────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 mb-5 text-center"
        style={{
          background: 'linear-gradient(135deg, #0F3714 0%, #1D5823 100%)',
          boxShadow: '0 12px 40px rgba(15,55,20,0.35)',
        }}
      >
        {/* Ghost LL */}
        <div
          className="absolute right-2 bottom-0 leading-none font-black select-none pointer-events-none"
          style={{ fontSize: '120px', color: 'rgba(255,255,255,0.04)' }}
        >LL</div>

        {/* Avatar */}
        <div className="relative inline-block mb-4">
          <Avatar name={user?.name ?? 'U'} src={user?.avatar} size="2xl" />
          {avatarLoading && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <Spinner className="w-6 h-6 text-white" />
            </div>
          )}
          <button
            onClick={() => fileInput.current?.click()}
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
            style={{ background: '#97B545' }}
            title="Change photo"
          >
            <svg className="w-4 h-4 text-brand-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        <h1 className="text-xl font-bold text-white">{user?.name}</h1>
        <p className="text-white/50 text-sm mt-0.5">{user?.email}</p>
        <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
             style={{ background: 'rgba(151,181,69,0.2)', color: '#97B545' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-brand-lime inline-block" />
          {user?.role}
        </div>

        {avatarError && (
          <p className="mt-2 text-xs text-danger">{avatarError}</p>
        )}

        {user?.avatar && !avatarError && (
          <div className="mt-3">
            <button
              onClick={handleRemoveAvatar}
              className="text-white/30 hover:text-white/60 text-xs transition-colors cursor-pointer"
            >
              Remove photo
            </button>
          </div>
        )}
      </div>

      {/* ── App update ─────────────────────────────────────────────── */}
      <div
        className="rounded-3xl p-6 mb-5"
        style={{ background: '#FDFAF5', boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="text-base font-bold text-brand-dark">App Update</h2>
          <span className="text-xs font-mono font-semibold" style={{ color: 'rgba(15,55,20,0.35)' }}>v{__APP_VERSION__}</span>
        </div>
        <p className="text-xs mb-4" style={{ color: 'rgba(15,55,20,0.45)' }}>
          Check for the latest version of the app.
        </p>
        <button
          onClick={handleCheckUpdate}
          disabled={updateStatus === 'checking'}
          className="w-full py-3 rounded-lg text-sm font-bold transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 hover:brightness-95"
          style={{ background: '#0F3714', color: 'white' }}
        >
          {updateStatus === 'checking' && <Spinner className="w-4 h-4 text-white" />}
          {updateStatus === 'checking' ? 'Checking…' : 'Check for Update'}
        </button>
        {updateStatus === 'up-to-date' && (
          <p className="text-sm font-semibold text-center mt-3" style={{ color: '#97B545' }}>
            ✓ You're up to date
          </p>
        )}
      </div>

      {/* ── Change password ────────────────────────────────────────── */}
      <div
        className="rounded-3xl p-6"
        style={{ background: '#FDFAF5', boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.05)' }}
      >
        <h2 className="text-base font-bold text-brand-dark mb-5">Change Password</h2>

        <form onSubmit={handlePasswordSubmit} noValidate className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg border border-black/8 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-lime/50 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              minLength={8}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg border border-black/8 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-lime/50 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg border border-black/8 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-lime/50 transition"
            />
          </div>

          {pwError && (
            <p className="text-sm text-danger font-medium">{pwError}</p>
          )}

          {pwSuccess && (
            <p className="text-sm font-semibold" style={{ color: '#97B545' }}>
              ✓ Password updated successfully
            </p>
          )}

          <button
            type="submit"
            disabled={pwLoading}
            className="w-full py-3 rounded-lg text-sm font-bold text-brand-dark transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 hover:brightness-95"
            style={{ background: '#97B545' }}
          >
            {pwLoading && <Spinner className="w-4 h-4 text-brand-dark" />}
            Update Password
          </button>
        </form>
      </div>

    </div>
  )
}
