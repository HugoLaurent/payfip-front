// Export CSV client-side des lignes déjà chargées (page courante) — pas
// d'endpoint d'export côté API, on sérialise ce que l'agent voit à l'écran.
// Délimiteur `;` + BOM UTF-8 pour un import direct correct dans Excel FR.
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    let s = String(v)
    // Neutralise l'injection de formule (Excel/LibreOffice interprètent les
    // cellules commençant par ces caractères comme des formules).
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers, ...rows].map((r) => r.map(escape).join(';'))
  const csv = '﻿' + lines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
