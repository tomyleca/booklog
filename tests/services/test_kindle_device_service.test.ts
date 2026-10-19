import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  KINDLE_COPY_SCRIPT,
  KindleDeviceError,
  KindleDeviceService,
  KindleFileError
} from '../../src/main/services/KindleDeviceService.js'
import type {
  PowerShellResult,
  PowerShellRunner
} from '../../src/main/services/KindleDeviceService.js'
import { KINDLE_FIXTURE_TEXT } from '../fixtures/kindleClippings.js'

interface RunnerCall {
  script: string
  env: Record<string, string>
  timeoutMs: number
}

function fakeRunner(
  behaviour: (call: RunnerCall) => Partial<PowerShellResult>,
  calls: RunnerCall[]
): PowerShellRunner {
  return async (script, env, timeoutMs) => {
    const call = { script, env, timeoutMs }
    calls.push(call)
    return { stdout: '', stderr: '', exitCode: 0, timedOut: false, ...behaviour(call) }
  }
}

describe('Feature #23 — KindleDeviceService', () => {
  let baseDir: string
  let calls: RunnerCall[]

  beforeEach(() => {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'booklog_kindle_'))
    calls = []
  })

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true })
  })

  function service(
    runner: PowerShellRunner,
    platform: NodeJS.Platform = 'win32'
  ): KindleDeviceService {
    return new KindleDeviceService({
      baseDir,
      runner,
      platform,
      copyTimeoutMs: 1000,
      processGraceMs: 500
    })
  }

  it('should run the constant script with the destination passed by environment', async () => {
    const svc = service(
      fakeRunner(({ env }) => {
        fs.writeFileSync(
          path.join(env.BOOKLOG_KINDLE_DEST as string, 'My Clippings.txt'),
          KINDLE_FIXTURE_TEXT
        )
        return { stdout: '{"status":"OK","device":"Kindle Paperwhite","path":"x","size":1}\r\n' }
      }, calls)
    )

    const result = await svc.readFromDevice()

    expect(result).toEqual({ text: KINDLE_FIXTURE_TEXT, label: 'Kindle Paperwhite' })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.script).toBe(KINDLE_COPY_SCRIPT)
    expect(calls[0]?.script).not.toContain(baseDir)
    expect(calls[0]?.env.BOOKLOG_KINDLE_DEST.startsWith(path.join(baseDir, 'kindle-import'))).toBe(
      true
    )
    expect(calls[0]?.env.BOOKLOG_KINDLE_TIMEOUT_MS).toBe('1000')
    expect(calls[0]?.timeoutMs).toBe(1500)
  })

  it('should delete the temporary copy after reading it', async () => {
    const svc = service(
      fakeRunner(({ env }) => {
        fs.writeFileSync(path.join(env.BOOKLOG_KINDLE_DEST as string, 'My Clippings.txt'), 'x')
        return { stdout: '{"status":"OK"}' }
      }, calls)
    )
    await svc.readFromDevice()
    expect(fs.existsSync(calls[0]?.env.BOOKLOG_KINDLE_DEST as string)).toBe(false)
  })

  it('should search any storage, not a hardcoded device name', () => {
    expect(KINDLE_COPY_SCRIPT).toContain('Namespace(17)')
    expect(KINDLE_COPY_SCRIPT).toContain("'documents'")
    expect(KINDLE_COPY_SCRIPT).not.toMatch(/Paperwhite/u)
    expect(KINDLE_COPY_SCRIPT).toContain('$env:BOOKLOG_KINDLE_DEST')
  })

  it.each([
    ['{"status":"NOT_FOUND"}', false, 'NOT_FOUND'],
    ['{"status":"TIMEOUT"}', false, 'TIMEOUT'],
    ['{"status":"ERROR","message":"COM roto"}', false, 'FAILED'],
    ['basura sin json', false, 'FAILED'],
    ['', true, 'TIMEOUT']
  ])('should map %s (killed=%s) to a typed %s error', async (stdout, timedOut, reason) => {
    const svc = service(fakeRunner(() => ({ stdout, timedOut }), calls))
    const error = await svc.readFromDevice().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(KindleDeviceError)
    expect((error as KindleDeviceError).reason).toBe(reason)
  })

  it('should fail with a file error when the script says OK but nothing was copied', async () => {
    const svc = service(fakeRunner(() => ({ stdout: '{"status":"OK"}' }), calls))
    await expect(svc.readFromDevice()).rejects.toBeInstanceOf(KindleFileError)
  })

  it('should refuse to read the device outside Windows without running PowerShell', async () => {
    const svc = service(
      fakeRunner(() => ({}), calls),
      'linux'
    )
    const error = await svc.readFromDevice().catch((e: unknown) => e)
    expect((error as KindleDeviceError).reason).toBe('UNSUPPORTED')
    expect(calls).toHaveLength(0)
  })

  it('should read a chosen .txt file and reject other files', async () => {
    const svc = service(fakeRunner(() => ({}), calls))
    const txt = path.join(baseDir, 'My Clippings.txt')
    fs.writeFileSync(txt, KINDLE_FIXTURE_TEXT)
    await expect(svc.readFromFile(txt)).resolves.toEqual({
      text: KINDLE_FIXTURE_TEXT,
      label: 'My Clippings.txt'
    })

    const empty = path.join(baseDir, 'vacio.txt')
    fs.writeFileSync(empty, '')
    await expect(svc.readFromFile(empty)).rejects.toBeInstanceOf(KindleFileError)
    await expect(svc.readFromFile(path.join(baseDir, 'foto.jpg'))).rejects.toBeInstanceOf(
      KindleFileError
    )
    await expect(svc.readFromFile(path.join(baseDir, 'no-existe.txt'))).rejects.toBeInstanceOf(
      KindleFileError
    )
  })
})
