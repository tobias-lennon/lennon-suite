interface LogoProps {
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function Logo({ variant = 'light', size = 'md', className = '' }: LogoProps) {
  const isLight = variant === 'light'

  const textPrimary = isLight ? '#ffffff' : '#0F3714'
  const textMuted   = isLight ? 'rgba(255,255,255,0.45)' : 'rgba(15,55,20,0.45)'

  const nameSize = size === 'sm' ? 'text-lg'
                 : size === 'lg' ? 'text-3xl'
                 : 'text-2xl'

  const subSize  = size === 'sm' ? 'text-[9px]'
                 : size === 'lg' ? 'text-[11px]'
                 : 'text-[10px]'

  return (
    <div className={`flex flex-col ${className}`}>
      <p
        className={`${nameSize} font-black tracking-tight leading-none mb-1`}
        style={{ color: textPrimary }}
      >
        Lennon Landscaping
      </p>
      <p
        className={`${subSize} font-medium tracking-[0.25em] uppercase leading-none`}
        style={{ color: textMuted }}
      >
        Company Suite
      </p>
    </div>
  )
}
