import { Fragment, useId, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { allTemplates } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import type { ErrorPatternId } from '@/shared/types'
import {
  dayKey,
  firstTryRate,
  hintRate,
  mastery,
  propertyAccuracy,
  relativeDays,
  useDrillAccuracy,
  useEvents,
  useHabits,
  usePatternCounts,
  useStore,
  useStreak,
  useWeekly,
  type ImportMode,
  type RatioInfo,
} from '@/store'

function patternTitle(id: string): string {
  return id in ERROR_PATTERNS ? ERROR_PATTERNS[id as ErrorPatternId].title : id.replace(/_/g, ' ')
}

function NoData() {
  return (
    <span className="text-navy/60">
      <span aria-hidden>—</span>
      <span className="sr-only">no data yet</span>
    </span>
  )
}

function Percent({ r }: { r: RatioInfo }) {
  if (r.rate === null) return <NoData />
  return (
    <span>
      {Math.round(r.rate * 100)}%{' '}
      <span className="text-xs text-navy/70">
        ({r.numerator}/{r.denominator})
      </span>
    </span>
  )
}

function PerStep({ r }: { r: RatioInfo }) {
  if (r.rate === null) return <NoData />
  return (
    <span>
      {r.rate.toFixed(1)} per step{' '}
      <span className="text-xs text-navy/70">
        ({r.numerator}/{r.denominator})
      </span>
    </span>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-4">
      <p className="text-sm font-semibold text-navy/80">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-navy">{value}</p>
      <p className="mt-1 text-xs text-navy/70">{note}</p>
    </div>
  )
}

function SkillTable() {
  const events = useEvents()
  const weekly = useWeekly()
  const groups = useMemo(() => {
    const out: { id: string; title: string; rows: ReturnType<typeof rowFor>[] }[] = []
    function rowFor(templateId: string, title: string) {
      return {
        id: templateId,
        title,
        m: mastery(events, templateId),
        first: firstTryRate(events, weekly, templateId),
        hints: hintRate(events, weekly, templateId),
        prop: propertyAccuracy(events, weekly, templateId),
      }
    }
    for (const { module, template } of allTemplates()) {
      let g = out.find((x) => x.id === module.id)
      if (!g) {
        g = { id: module.id, title: module.title, rows: [] }
        out.push(g)
      }
      g.rows.push(rowFor(template.id, template.title))
    }
    return out
  }, [events, weekly])

  return (
    <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white">
      <table className="w-full min-w-[46rem] text-left text-sm">
        <caption className="sr-only">Mastery, first-try rate, hints and property picks for each problem type</caption>
        <thead className="bg-navy-50 text-navy">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">
              Problem type
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Mastery
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Mastered
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              First-try
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Hints
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Property picks
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Last practiced
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.id}>
              <tr className="border-t border-navy-100">
                <th
                  scope="colgroup"
                  colSpan={7}
                  className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-coral-700"
                >
                  {g.title}
                </th>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.id} className="border-t border-navy-100 align-top">
                  <th scope="row" className="px-3 py-2 font-medium text-navy">
                    {r.title}
                  </th>
                  <td className="px-3 py-2 text-navy">
                    {r.m.rate === null ? (
                      <NoData />
                    ) : (
                      <span>
                        {Math.round(r.m.rate * 100)}%{' '}
                        <span className="text-xs text-navy/70">
                          ({r.m.count} of {r.m.window})
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.m.mastered ? (
                      <span className="font-semibold text-ok">
                        <span aria-hidden>✓ </span>mastered
                      </span>
                    ) : (
                      <span className="text-navy/70">not yet</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-navy">
                    <Percent r={r.first} />
                  </td>
                  <td className="px-3 py-2 text-navy">
                    <PerStep r={r.hints} />
                  </td>
                  <td className="px-3 py-2 text-navy">
                    <Percent r={r.prop} />
                  </td>
                  <td className="px-3 py-2 text-navy">{r.m.lastAt === null ? 'never' : relativeDays(r.m.lastAt)}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PatternTable() {
  const counts = usePatternCounts()
  if (counts.length === 0) {
    return (
      <p className="rounded-2xl border border-navy-100 bg-white p-4 text-navy/80">
        No mistakes logged yet. When the checker stops a step, the mistake gets a name and shows up here, so you can watch
        it fade week by week.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white">
      <table className="w-full min-w-[26rem] text-left text-sm">
        <caption className="sr-only">Error patterns, this week compared with everything before this week</caption>
        <thead className="bg-navy-50 text-navy">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">
              Pattern
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              This week
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Before this week
            </th>
          </tr>
        </thead>
        <tbody>
          {counts.map((c) => (
            <tr key={c.pattern} className="border-t border-navy-100">
              <th scope="row" className="px-3 py-2 font-medium text-navy">
                {patternTitle(c.pattern)}
              </th>
              <td className="px-3 py-2 text-navy">{c.thisWeek}</td>
              <td className="px-3 py-2 text-navy">{c.before}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DrillRows() {
  const property = useDrillAccuracy('property')
  const legal = useDrillAccuracy('legal')
  const line = (r: RatioInfo) =>
    r.denominator === 0 ? 'not tried yet' : `${r.numerator} of ${r.denominator} right (${Math.round((r.rate ?? 0) * 100)}%)`
  return (
    <dl className="divide-y divide-navy-100">
      <div className="flex flex-wrap justify-between gap-2 py-2">
        <dt className="text-navy">Which property?</dt>
        <dd className="font-semibold text-navy">{line(property)}</dd>
      </div>
      <div className="flex flex-wrap justify-between gap-2 py-2">
        <dt className="text-navy">Legal or illegal?</dt>
        <dd className="font-semibold text-navy">{line(legal)}</dd>
      </div>
    </dl>
  )
}

type Result = { ok: boolean; message: string }

function BackupSection() {
  const exportJson = useStore((s) => s.exportJson)
  const importJson = useStore((s) => s.importJson)
  const lastBackupAt = useStore((s) => s.meta.lastBackupAt)
  const [exportText, setExportText] = useState<string | null>(null)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [importText, setImportText] = useState('')
  const [mode, setMode] = useState<ImportMode>('merge')
  const [result, setResult] = useState<Result | null>(null)
  const exportRef = useRef<HTMLTextAreaElement>(null)
  const exportId = useId()
  const importId = useId()
  const fileId = useId()
  const modeName = useId()

  const lastMs = lastBackupAt ? Date.parse(lastBackupAt) : Number.NaN
  const lastLine = Number.isFinite(lastMs) ? `Last backup: ${relativeDays(lastMs)}` : 'No backup from this device yet.'

  function download() {
    const json = exportJson()
    try {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `precalc-progress-${dayKey(Date.now())}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setExportStatus('Backup file downloaded. Keep it somewhere safe, or import it on your other device.')
    } catch {
      setExportText(json)
      setExportStatus('This browser blocked the download, so the backup text is below. Copy it somewhere safe.')
    }
  }

  function showText() {
    setExportText(exportJson())
    setExportStatus(null)
  }

  async function copy() {
    if (exportText === null) return
    try {
      await navigator.clipboard.writeText(exportText)
      setExportStatus('Copied. Paste it into a note or into Import on your other device.')
    } catch {
      exportRef.current?.focus()
      exportRef.current?.select()
      setExportStatus('Copying is blocked here, so the text is selected — press Ctrl+C, or long-press and tap Copy.')
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setImportText(await file.text())
      setResult(null)
    } catch {
      setResult({ ok: false, message: "Couldn't read that file. Open it and paste the text into the box instead." })
    }
  }

  function runImport() {
    if (!importText.trim()) {
      setResult({ ok: false, message: 'Choose a backup file or paste the backup text first.' })
      return
    }
    const r = importJson(importText, mode)
    if (!r.ok) {
      setResult({ ok: false, message: `That backup couldn't be imported: ${r.error}` })
      return
    }
    const events = `${r.added} ${r.added === 1 ? 'event' : 'events'}`
    setResult({
      ok: true,
      message:
        mode === 'merge'
          ? r.added === 0
            ? 'Merged — nothing new. This device already had everything in that backup.'
            : `Merged — ${events} added. Your bars and patterns now include them.`
          : `Replaced — this device now holds the backup's progress (${events}).`,
    })
  }

  return (
    <section aria-labelledby="progress-backup" className="space-y-4 rounded-2xl border border-navy-100 bg-white p-4">
      <div>
        <h2 id="progress-backup" className="text-lg font-semibold text-navy">
          Backup
        </h2>
        <p className="mt-0.5 text-sm text-navy/80">
          Progress is saved on this device only. Export it to keep a copy or to carry it to your other device.
        </p>
        <p className="mt-1 text-sm font-semibold text-navy">{lastLine}</p>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-navy">Export</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={download}
            className="min-h-11 rounded-xl bg-navy px-4 text-sm font-semibold text-white hover:bg-navy-600"
          >
            Download backup (.json)
          </button>
          <button
            type="button"
            onClick={showText}
            className="min-h-11 rounded-xl border border-navy-100 bg-white px-4 text-sm font-semibold text-navy hover:bg-navy-50"
          >
            Show backup text
          </button>
        </div>
        {exportText !== null && (
          <div className="space-y-2">
            <label htmlFor={exportId} className="block text-sm font-semibold text-navy">
              Backup text
            </label>
            <textarea
              id={exportId}
              ref={exportRef}
              readOnly
              value={exportText}
              rows={6}
              className="w-full rounded-xl border-2 border-navy-100 p-2 font-mono text-xs text-navy"
            />
            <button
              type="button"
              onClick={() => void copy()}
              className="min-h-11 rounded-xl border border-navy-100 bg-white px-4 text-sm font-semibold text-navy hover:bg-navy-50"
            >
              Copy
            </button>
          </div>
        )}
        <p role="status" className="text-sm text-navy">
          {exportStatus && (
            <>
              <span aria-hidden className="text-ok">
                ✓{' '}
              </span>
              {exportStatus}
            </>
          )}
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-navy">Import</h3>
        <div>
          <label htmlFor={fileId} className="block text-sm font-semibold text-navy">
            Backup file
          </label>
          <input
            id={fileId}
            type="file"
            accept="application/json,.json"
            onChange={(e) => void onFile(e)}
            className="mt-1 block min-h-11 w-full text-sm text-navy file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-navy-50 file:px-4 file:font-semibold file:text-navy"
          />
        </div>
        <div>
          <label htmlFor={importId} className="block text-sm font-semibold text-navy">
            …or paste the backup text
          </label>
          <textarea
            id={importId}
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value)
              setResult(null)
            }}
            rows={5}
            spellCheck={false}
            className="mt-1 w-full rounded-xl border-2 border-navy-100 p-2 font-mono text-xs text-navy focus:border-navy"
          />
        </div>
        <fieldset>
          <legend className="text-sm font-semibold text-navy">How to import</legend>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-navy">
            <input
              type="radio"
              name={modeName}
              checked={mode === 'merge'}
              onChange={() => setMode('merge')}
              className="h-5 w-5 accent-navy"
            />
            Merge with this device (keeps everything from both)
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-navy">
            <input
              type="radio"
              name={modeName}
              checked={mode === 'replace'}
              onChange={() => setMode('replace')}
              className="h-5 w-5 accent-navy"
            />
            Replace this device&apos;s progress with the backup
          </label>
        </fieldset>
        {mode === 'replace' && (
          <p className="text-sm text-navy">
            <span aria-hidden className="text-coral-700">
              !{' '}
            </span>
            Careful: replace wipes the progress on this device first. Export above if you might want it back.
          </p>
        )}
        <button
          type="button"
          onClick={runImport}
          className="min-h-11 rounded-xl bg-navy px-4 text-sm font-semibold text-white hover:bg-navy-600"
        >
          {mode === 'merge' ? 'Import and merge' : 'Replace my progress'}
        </button>
        {result &&
          (result.ok ? (
            <p role="status" className="text-sm font-semibold text-ok">
              <span aria-hidden>✓ </span>
              {result.message}
            </p>
          ) : (
            <p role="alert" className="text-sm font-semibold text-bad">
              <span aria-hidden>✗ </span>
              {result.message}
            </p>
          ))}
      </div>
    </section>
  )
}

export function ProgressPage() {
  const streak = useStreak()
  const habits = useHabits()
  const drill = useDrillAccuracy()
  const minutes = Math.round(habits.secs / 60)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold text-navy">Progress</h1>
        <p className="max-w-2xl text-navy/80">
          Mastery is your last 5 finished problems of each type. Mistakes are counted by name, so you can see which ones
          are fading.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Day streak" value={String(streak)} note="days in a row with a finished problem" />
        <Stat label="Finished" value={String(habits.done)} note={minutes > 0 ? `about ${minutes} min of focused work` : 'problems worked to the end'} />
        <Stat label="Left unfinished" value={String(habits.abandoned)} note="problems started and set aside" />
        <Stat
          label="Drill"
          value={drill.rate === null ? '—' : `${Math.round(drill.rate * 100)}%`}
          note={drill.denominator === 0 ? 'not tried yet' : `${drill.numerator} of ${drill.denominator} right`}
        />
      </div>

      <section aria-labelledby="progress-skills" className="space-y-2">
        <h2 id="progress-skills" className="text-lg font-semibold text-navy">
          By problem type
        </h2>
        <SkillTable />
      </section>

      <section aria-labelledby="progress-patterns" className="space-y-2">
        <h2 id="progress-patterns" className="text-lg font-semibold text-navy">
          Error patterns
        </h2>
        <PatternTable />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="progress-habits" className="rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="progress-habits" className="text-lg font-semibold text-navy">
            Habits
          </h2>
          <dl className="mt-1 divide-y divide-navy-100">
            <div className="flex flex-wrap justify-between gap-2 py-2">
              <dt className="text-navy">Finished</dt>
              <dd className="font-semibold text-navy">{habits.done}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 py-2">
              <dt className="text-navy">Left unfinished</dt>
              <dd className="font-semibold text-navy">{habits.abandoned}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 py-2">
              <dt className="text-navy">Day streak</dt>
              <dd className="font-semibold text-navy">{streak}</dd>
            </div>
          </dl>
        </section>
        <section aria-labelledby="progress-drill" className="rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="progress-drill" className="text-lg font-semibold text-navy">
            Drill accuracy
          </h2>
          <div className="mt-1">
            <DrillRows />
          </div>
        </section>
      </div>

      <BackupSection />
    </div>
  )
}

export default ProgressPage
