import { useRef } from 'react'

export function OtpDigitInput({
  digits,
  onChange,
  length,
}: {
  digits: string[]
  onChange: (digits: string[]) => void
  length: number
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  function setDigit(index: number, raw: string) {
    const v = raw.replace(/[^0-9]/g, '').slice(-1)
    const next = [...digits]
    next[index] = v
    onChange(next)
    if (v && index < length - 1) inputRefs.current[index + 1]?.focus()
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  // Coller le code entier d'un coup (copié depuis l'email par ex.) — pas
  // besoin de cliquer précisément sur la première case, ça marche depuis
  // n'importe laquelle.
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '')
    if (!pasted) return
    e.preventDefault()
    const next = Array(length).fill('')
    for (let i = 0; i < length; i++) next[i] = pasted[i] ?? ''
    onChange(next)
    const lastFilledIdx = Math.min(pasted.length, length) - 1
    inputRefs.current[Math.max(lastFilledIdx, 0)]?.focus()
  }

  const firstEmptyIdx = digits.findIndex((d) => d === '')

  return (
    <div className="flex justify-between gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el
          }}
          value={d}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          maxLength={1}
          inputMode="numeric"
          className={`squircle h-14 w-[46px] rounded-xl bg-otp-bg text-center text-[22px] leading-none font-extrabold text-ink outline-none transition ${
            i === firstEmptyIdx ? 'border-2 border-aregie-blue' : 'border-2 border-transparent'
          }`}
          style={{ fontFamily: 'var(--font-display)' }}
        />
      ))}
    </div>
  )
}
