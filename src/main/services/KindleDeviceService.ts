import { execFile } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export type KindleDeviceFailure = 'NOT_FOUND' | 'TIMEOUT' | 'UNSUPPORTED' | 'FAILED'

/** Error tipado de la lectura del Kindle; el handler IPC lo traduce a un código. */
export class KindleDeviceError extends Error {
  constructor(
    public readonly reason: KindleDeviceFailure,
    message: string
  ) {
    super(message)
    this.name = 'KindleDeviceError'
  }
}

export class KindleFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KindleFileError'
  }
}

export interface PowerShellResult {
  stdout: string
  stderr: string
  exitCode: number | null
  timedOut: boolean
}

/**
 * Ejecuta un script de PowerShell. Se inyecta en `KindleDeviceService` para poder testear
 * sin dispositivo. El script es una constante y los datos variables viajan por variables
 * de entorno: nunca se interpola nada dentro del texto del script.
 */
export type PowerShellRunner = (
  script: string,
  env: Record<string, string>,
  timeoutMs: number
) => Promise<PowerShellResult>

/**
 * Busca, en todos los dispositivos de "Este equipo" (`Shell.Application`, `Namespace(17)`),
 * un almacenamiento con `documents\My Clippings.txt` y lo copia a la carpeta destino.
 * - Unidades con letra (Kindle viejos como almacenamiento USB): `Copy-Item` directo.
 * - Dispositivos MTP (Kindle actuales): `CopyHere`, que es **asíncrono**, así que se espera
 *   a que el archivo tenga el tamaño esperado (o un tamaño estable) y se pueda abrir en
 *   exclusiva, con timeout.
 * Responde una línea JSON con `status` = OK | NOT_FOUND | TIMEOUT | ERROR.
 */
export const KINDLE_COPY_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
function Emit($data) { Write-Output (ConvertTo-Json -InputObject $data -Compress) }
$destDir = $env:BOOKLOG_KINDLE_DEST
$timeoutMs = [int]$env:BOOKLOG_KINDLE_TIMEOUT_MS
$fileNames = @('My Clippings.txt', 'My Clippings')
$target = Join-Path $destDir 'My Clippings.txt'
try {
  $shell = New-Object -ComObject Shell.Application
  $computer = $shell.Namespace(17)
  $found = $null
  $deviceName = $null
  foreach ($device in @($computer.Items())) {
    $devicePath = [string]$device.Path
    if ($devicePath -match '^[A-Za-z]:\\?$') {
      $candidate = Join-Path $devicePath 'documents\My Clippings.txt'
      if (Test-Path -LiteralPath $candidate) {
        Copy-Item -LiteralPath $candidate -Destination $target -Force
        Emit @{ status = 'OK'; device = [string]$device.Name; path = $target; size = (Get-Item -LiteralPath $target).Length }
        exit 0
      }
      continue
    }
    try { $storages = @($device.GetFolder.Items()) } catch { continue }
    foreach ($storage in $storages) {
      if (-not $storage.IsFolder) { continue }
      try {
        $documents = @($storage.GetFolder.Items()) | Where-Object { $_.IsFolder -and $_.Name -ieq 'documents' } | Select-Object -First 1
      } catch { continue }
      if ($null -eq $documents) { continue }
      $file = @($documents.GetFolder.Items()) | Where-Object { (-not $_.IsFolder) -and ($fileNames -icontains $_.Name) } | Select-Object -First 1
      if ($null -ne $file) {
        $found = $file
        $deviceName = [string]$device.Name
        break
      }
    }
    if ($null -ne $found) { break }
  }
  if ($null -eq $found) {
    Emit @{ status = 'NOT_FOUND' }
    exit 0
  }
  $expected = [int64]0
  try { $expected = [int64]$found.ExtendedProperty('System.Size') } catch { $expected = [int64]0 }
  if ($expected -le 0) { try { $expected = [int64]$found.Size } catch { $expected = [int64]0 } }
  $shell.Namespace($destDir).CopyHere($found, 4 + 16 + 1024)
  $watch = [System.Diagnostics.Stopwatch]::StartNew()
  $lastSize = [int64]-1
  $stableChecks = 0
  while ($watch.ElapsedMilliseconds -lt $timeoutMs) {
    Start-Sleep -Milliseconds 250
    if (-not (Test-Path -LiteralPath $target)) { continue }
    $size = [int64](Get-Item -LiteralPath $target).Length
    if ($expected -gt 0) { $complete = $size -ge $expected } else { $complete = ($size -gt 0) -and ($size -eq $lastSize) }
    if ($complete) { $stableChecks++ } else { $stableChecks = 0 }
    $lastSize = $size
    if ($stableChecks -ge 2) {
      try {
        $stream = [System.IO.File]::Open($target, 'Open', 'Read', 'None')
        $stream.Close()
      } catch { continue }
      Emit @{ status = 'OK'; device = $deviceName; path = $target; size = $size }
      exit 0
    }
  }
  Emit @{ status = 'TIMEOUT' }
  exit 0
} catch {
  Emit @{ status = 'ERROR'; message = $_.Exception.Message }
  exit 0
}
`

/** Runner real: `powershell.exe -NoProfile -NonInteractive -EncodedCommand`, sin shell. */
export function createPowerShellRunner(): PowerShellRunner {
  return (script, env, timeoutMs) =>
    new Promise((resolve) => {
      // -EncodedCommand espera el script en UTF-16LE + Base64: evita escapar comillas y no
      // depende de la política de ejecución de archivos .ps1.
      const encoded = Buffer.from(script, 'utf16le').toString('base64')
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
        {
          env: { ...process.env, ...env },
          timeout: timeoutMs,
          windowsHide: true,
          encoding: 'utf8',
          maxBuffer: 1024 * 1024
        },
        (error, stdout, stderr) => {
          const timedOut = Boolean(
            error && (error as NodeJS.ErrnoException & { killed?: boolean }).killed
          )
          const exitCode = error ? (typeof error.code === 'number' ? error.code : null) : 0
          resolve({
            stdout: String(stdout ?? ''),
            stderr: String(stderr ?? ''),
            exitCode,
            timedOut
          })
        }
      )
    })
}

export interface KindleDeviceServiceOptions {
  /** Carpeta base (userData en producción); las copias van a `<base>/kindle-import/<id>`. */
  baseDir: string
  runner?: PowerShellRunner
  platform?: NodeJS.Platform
  /** Tiempo máximo para que termine la copia MTP. */
  copyTimeoutMs?: number
  /** Margen extra para enumerar dispositivos antes de matar el proceso. */
  processGraceMs?: number
}

export interface KindleFileContents {
  text: string
  /** Nombre del dispositivo o del archivo, para mostrar al usuario. */
  label: string
}

/** Tamaño máximo razonable de un My Clippings.txt (el real del usuario pesa ~1 MB). */
export const MAX_CLIPPINGS_BYTES = 50 * 1024 * 1024

interface ScriptResponse {
  status?: string
  device?: string
  path?: string
  message?: string
}

function parseResponse(stdout: string): ScriptResponse | null {
  const lines = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{'))
  const last = lines[lines.length - 1]
  if (!last) return null
  try {
    return JSON.parse(last) as ScriptResponse
  } catch {
    return null
  }
}

/**
 * Lee `My Clippings.txt` del Kindle conectado (feature #23) o de un archivo elegido por el
 * usuario. Node no puede leer rutas MTP, por eso la copia la hace PowerShell con el Shell
 * de Windows; Node solo lee el archivo ya copiado a una carpeta temporal propia.
 */
export class KindleDeviceService {
  private readonly runner: PowerShellRunner
  private readonly platform: NodeJS.Platform
  private readonly copyTimeoutMs: number
  private readonly processGraceMs: number
  private readonly importDir: string

  constructor(options: KindleDeviceServiceOptions) {
    this.runner = options.runner ?? createPowerShellRunner()
    this.platform = options.platform ?? process.platform
    this.copyTimeoutMs = options.copyTimeoutMs ?? 60_000
    this.processGraceMs = options.processGraceMs ?? 30_000
    this.importDir = path.resolve(options.baseDir, 'kindle-import')
  }

  public async readFromDevice(): Promise<KindleFileContents> {
    if (this.platform !== 'win32') {
      throw new KindleDeviceError(
        'UNSUPPORTED',
        'La lectura directa del Kindle solo está disponible en Windows.'
      )
    }

    const destDir = path.join(this.importDir, crypto.randomUUID())
    await fs.promises.mkdir(destDir, { recursive: true })
    try {
      const result = await this.runner(
        KINDLE_COPY_SCRIPT,
        {
          BOOKLOG_KINDLE_DEST: destDir,
          BOOKLOG_KINDLE_TIMEOUT_MS: String(this.copyTimeoutMs)
        },
        this.copyTimeoutMs + this.processGraceMs
      )
      const response = this.interpret(result)
      const copiedPath = path.join(destDir, 'My Clippings.txt')
      const text = await this.readFile(copiedPath)
      return { text, label: response.device || 'Kindle' }
    } finally {
      await fs.promises.rm(destDir, { recursive: true, force: true }).catch(() => undefined)
    }
  }

  public async readFromFile(filePath: string): Promise<KindleFileContents> {
    if (typeof filePath !== 'string' || path.extname(filePath).toLowerCase() !== '.txt') {
      throw new KindleFileError('Elegí un archivo de texto (.txt) exportado por el Kindle.')
    }
    const text = await this.readFile(filePath)
    return { text, label: path.basename(filePath) }
  }

  private interpret(result: PowerShellResult): ScriptResponse {
    if (result.timedOut) {
      throw new KindleDeviceError('TIMEOUT', 'El Kindle no respondió a tiempo.')
    }
    const response = parseResponse(result.stdout)
    switch (response?.status) {
      case 'OK':
        return response
      case 'NOT_FOUND':
        throw new KindleDeviceError(
          'NOT_FOUND',
          'No encontré un Kindle conectado con documents\\My Clippings.txt.'
        )
      case 'TIMEOUT':
        throw new KindleDeviceError(
          'TIMEOUT',
          'La copia desde el Kindle no terminó a tiempo. Probá de nuevo o elegí el archivo.'
        )
      default:
        throw new KindleDeviceError(
          'FAILED',
          `No se pudo leer el Kindle${response?.message ? `: ${response.message}` : '.'}`
        )
    }
  }

  private async readFile(filePath: string): Promise<string> {
    let stats: fs.Stats
    try {
      stats = await fs.promises.stat(filePath)
    } catch {
      throw new KindleFileError('No se encontró el archivo de recortes copiado o elegido.')
    }
    if (!stats.isFile() || stats.size === 0) {
      throw new KindleFileError('El archivo de recortes está vacío.')
    }
    if (stats.size > MAX_CLIPPINGS_BYTES) {
      throw new KindleFileError('El archivo es demasiado grande para ser un My Clippings.txt.')
    }
    return await fs.promises.readFile(filePath, 'utf-8')
  }
}
