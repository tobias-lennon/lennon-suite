import { useEffect, useRef, useState } from 'react'

export function useCountUp(target: number | null, duration = 700): number | null {
  const [count, setCount] = useState<number | null>(null)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    if (target === null) return
    const finalTarget = target
    const start = performance.now()
    function step(now: number) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(finalTarget * eased))
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step)
      }
    }
    frameRef.current = requestAnimationFrame(step)
    return () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current) }
  }, [target, duration])

  return count
}
