// Color-coded initials avatar — rotates through the brand palette by name

import { useEffect, useState } from 'react'

const PALETTE = [
  { bg: '#97B545', text: '#0F3714' }, // lime on forest
  { bg: '#DDB01D', text: '#0F3714' }, // gold on forest
  { bg: '#1D5823', text: '#FFF48D' }, // forest on pale
  { bg: '#F4BE29', text: '#0F3714' }, // amber on forest
  { bg: '#0F3714', text: '#97B545' }, // forest on lime
]

function pickColor(name: string) {
  const code = (name.charCodeAt(0) ?? 65) + (name.charCodeAt(1) ?? 0)
  return PALETTE[code % PALETTE.length]
}

interface AvatarProps {
  name: string
  src?: string | null
  size?: 'xs' | 'sm' | 'md' | 'mdlg' | 'lg' | 'xl' | '2xl'
  className?: string
}

const SIZE_CLASSES = {
  xs:   'w-6 h-6 text-[9px]',
  sm:   'w-8 h-8 text-xs',
  md:   'w-10 h-10 text-sm',
  mdlg: 'w-12 h-12 text-sm',
  lg:   'w-14 h-14 text-lg',
  xl:   'w-20 h-20 text-2xl',
  '2xl': 'w-28 h-28 text-4xl',
}

export default function Avatar({ name, src, size = 'sm', className = '' }: AvatarProps) {
  const { bg, text } = pickColor(name)
  const sizeClass = SIZE_CLASSES[size]
  const initials = name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
  const [imgFailed, setImgFailed] = useState(false)

  // Reset failure flag whenever a new src comes in (fresh upload attempt)
  useEffect(() => {
    setImgFailed(false)
  }, [src])

  if (src && !imgFailed) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
        onError={() => setImgFailed(true)}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold flex-shrink-0 select-none ${className}`}
      style={{ backgroundColor: bg, color: text }}
    >
      {initials}
    </div>
  )
}
