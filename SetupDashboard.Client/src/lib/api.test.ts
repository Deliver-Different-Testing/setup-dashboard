import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from './api'
import { csv, patchAt, removeAt } from './helpers'
import { completionPercent, openRequestCount, STEPS } from '../store'
import type { Session, StepKey, StepState } from './api'

afterEach(() => vi.unstubAllGlobals())

function stubFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({ ok: status < 400, status, text: () => Promise.resolve(body == null ? '' : JSON.stringify(body)) })
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('api client', () => {
  it('sends JSON with the XHR header and the cookie, to this app only', async () => {
    const fetch = stubFetch(200, { session: { id: 'abc' } })
    await api.saveStepData('abc', 'clients', [{ code: 'ACME' }])
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/api/setup/session/abc/steps/clients/data')
    expect(init.method).toBe('PUT')
    expect(init.credentials).toBe('include')
    expect(init.headers['X-Requested-With']).toBe('XMLHttpRequest')
    expect(JSON.parse(init.body)).toEqual([{ code: 'ACME' }])
  })

  it('puts the server message on the error', async () => {
    stubFetch(409, { message: '2 record(s) are not created yet.' })
    await expect(api.completeStep('abc', 'clients')).rejects.toMatchObject({ message: '2 record(s) are not created yet.', status: 409 })
  })

  it('tells the user to refresh when the sign-in expired', async () => {
    stubFetch(401, null)
    await expect(api.getSession('abc')).rejects.toThrow(/sign-in has expired/)
  })

  it('does not follow the redirect to Hub sign-in, and says the sign-in expired', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 0, type: 'opaqueredirect', text: () => Promise.resolve('') })
    vi.stubGlobal('fetch', fetch)
    await expect(api.getSession('abc')).rejects.toMatchObject({ message: expect.stringMatching(/sign-in has expired/), status: 401 })
    expect(fetch.mock.calls[0][1].redirect).toBe('manual')
  })

  it('treats an HTML page where JSON was expected as an expired sign-in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      text: () => Promise.resolve('<!doctype html><title>Sign in</title>'),
    }))
    await expect(api.listSessions('active')).rejects.toThrow(/sign-in has expired/)
  })

  it('asks for an unanswered row to be sent again by kind and key', async () => {
    const fetch = stubFetch(200, { session: { id: 'abc' } })
    await api.retryRow('abc', 'rates', 'zone', 'KC / Downtown')
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/api/setup/session/abc/steps/rates/rows/retry')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ kind: 'zone', key: 'KC / Downtown' })
  })

  it('calls the login check at the app root, not under /api', async () => {
    const fetch = stubFetch(200, { success: true })
    await api.validateLogin()
    expect(fetch.mock.calls[0][0]).toBe('/API/Login/Validate')
  })
})

describe('row helpers', () => {
  it('patch and remove without mutating', () => {
    const list = [{ a: 1 }, { a: 2 }]
    expect(patchAt(list, 1, { a: 9 })).toEqual([{ a: 1 }, { a: 9 }])
    expect(removeAt(list, 0)).toEqual([{ a: 2 }])
    expect(list).toEqual([{ a: 1 }, { a: 2 }])
  })

  it('splits comma lists and drops blanks', () => {
    expect(csv(' 64101, 64102 ,,')).toEqual(['64101', '64102'])
    expect(csv(undefined)).toEqual([])
  })
})

describe('progress', () => {
  const step = (status: StepState['status'], open = 0): StepState => ({
    key: 'clients', status, rows: [], checklist: [], updatedAt: '',
    requests: Array.from({ length: open }, (_, i) => ({ id: String(i), item: 'x', requestedAt: '' })),
  })
  const session = (steps: Partial<Record<StepKey, StepState>>) => ({
    steps: Object.fromEntries(STEPS.map(s => [s.key, steps[s.key] ?? step('not_started')])),
  }) as unknown as Session

  it('counts open requests across steps', () => {
    expect(openRequestCount(session({ clients: step('waiting_on_tenant', 2), rates: step('waiting_on_tenant', 1) }))).toBe(3)
  })

  it('only counts done steps towards completion', () => {
    expect(completionPercent(session({ business: step('done'), team: step('in_progress') }))).toBe(Math.round(100 / STEPS.length))
  })
})

describe('Auto-Mate stream', () => {
  function stubStream(chunks: string[], init: { status?: number; contentType?: string } = {}) {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(c) { chunks.forEach(x => c.enqueue(encoder.encode(x))); c.close() },
    })
    const fn = vi.fn().mockResolvedValue({
      ok: (init.status ?? 200) < 400, status: init.status ?? 200, type: 'basic', body,
      headers: { get: () => init.contentType ?? 'text/event-stream' },
    })
    vi.stubGlobal('fetch', fn)
    return fn
  }

  it('splits complete frames and keeps the partial one for later', () => {
    const { events, rest } = api.parseSseFrames('data: {"delta":"Hel"}\n\ndata: {"delta":"lo"}\r\n\r\ndata: {"del')
    expect(events).toEqual([{ delta: 'Hel' }, { delta: 'lo' }])
    expect(rest).toBe('data: {"del')
  })

  it('ignores frames that are not data or not JSON', () => {
    expect(api.parseSseFrames(': ping\n\ndata: oops\n\n').events).toEqual([])
  })

  it('asks this app, not CSP, and hands over each frame as it arrives, even when split across chunks', async () => {
    const fetch = stubStream(['data: {"sessionId":"s1","status":"Searching"}\n\ndata: {"delta":"Zones ', 'group zips."}\n\n', 'data: {"done":true}\n\n'])
    const events: api.AutoMateEvent[] = []
    await api.askAutoMate('What is a zone?', 's0', e => events.push(e))
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/api/setup/automate/messages')
    expect(init.credentials).toBe('include')
    expect(JSON.parse(init.body)).toEqual({ message: 'What is a zone?', sessionId: 's0' })
    expect(events).toEqual([{ sessionId: 's1', status: 'Searching' }, { delta: 'Zones group zips.' }, { done: true }])
  })

  it('a stream that stops without its last frame ends with an error', async () => {
    stubStream(['data: {"delta":"Half"}\n\n'])
    const events: api.AutoMateEvent[] = []
    await api.askAutoMate('Hi', null, e => events.push(e))
    expect(events.at(-1)).toMatchObject({ done: true, error: expect.stringContaining('cut off') })
  })

  it('an expired sign-in or a failed request is one error frame, never a throw', async () => {
    stubStream([], { contentType: 'text/html' })
    const events: api.AutoMateEvent[] = []
    await api.askAutoMate('Hi', null, e => events.push(e))
    expect(events).toEqual([{ error: expect.stringContaining('sign-in has expired'), done: true }])

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    const more: api.AutoMateEvent[] = []
    await api.askAutoMate('Hi', null, e => more.push(e))
    expect(more).toEqual([{ error: expect.stringContaining("couldn't reach"), done: true }])
  })
})
