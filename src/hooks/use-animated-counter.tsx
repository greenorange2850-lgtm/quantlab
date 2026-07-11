import { useEffect, useRef, useState } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'

interface AnimatedCounterProps {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  duration?: number
  className?: string
}

export function AnimatedCounter({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 1.2,
  className,
}: AnimatedCounterProps) {
  const spring = useSpring(0, { duration: duration * 1000, bounce: 0 })
  const display = useTransform(spring, (v) =>
    `${prefix}${v.toFixed(decimals)}${suffix}`,
  )
  const [text, setText] = useState(`${prefix}0${suffix}`)
  const prevValue = useRef(0)

  useEffect(() => {
    spring.set(value)
    const unsubscribe = display.on('change', (v) => setText(v))
    prevValue.current = value
    return unsubscribe
  }, [value, spring, display, prefix, suffix, decimals])

  return (
    <motion.span className={className} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {text}
    </motion.span>
  )
}
