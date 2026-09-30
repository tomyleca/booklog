# init.ps1 — Verificación e inicialización del entorno BookLog (PowerShell / Windows)
#
# Salida esperada: códigos de salida claros y bloques marcados con [OK]/[FAIL].

$ErrorActionPreference = "Continue"
$EXIT_CODE = 0

function Write-Ok($msg) {
    Write-Host "[OK]    $msg" -ForegroundColor Green
}

function Write-Warn($msg) {
    Write-Host "[WARN]  $msg" -ForegroundColor Yellow
}

function Write-Fail($msg) {
    Write-Host "[FAIL]  $msg" -ForegroundColor Red
}

Write-Host "── 1. Verificando entorno ─────────────────────────────"

# Node.js
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Fail "node no está instalado"
    exit 1
}
$nodeVersion = node --version
Write-Ok "node -> $nodeVersion"

$nodeMajor = [int](node -e "console.log(process.versions.node.split('.')[0])")
if ($nodeMajor -lt 18) {
    Write-Fail "Se requiere Node.js >= 18 (actual: $nodeVersion)"
    exit 1
}
Write-Ok "Versión de Node.js compatible"

# pnpm
$pnpmCmd = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if (-not $pnpmCmd) {
    $pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
}
if (-not $pnpmCmd) {
    Write-Fail "pnpm no está instalado (npm install -g pnpm)"
    exit 1
}
$pnpmVersion = & $pnpmCmd.Source --version
Write-Ok "pnpm -> $pnpmVersion"

Write-Host ""
Write-Host "── 2. Verificando archivos base del arnés ──────────────"

$baseFiles = @(
    "AGENTS.md",
    "init.ps1",
    "feature_list.json",
    "progress/current.md",
    "docs/architecture.md",
    "docs/conventions.md",
    "docs/verification.md",
    "CHECKPOINTS.md"
)

foreach ($f in $baseFiles) {
    if (Test-Path $f) {
        Write-Ok "Existe $f"
    } else {
        Write-Fail "Falta archivo base: $f"
        $EXIT_CODE = 1
    }
}

Write-Host ""
Write-Host "── 3. Validando feature_list.json ──────────────────────"

$validationScript = @"
const fs = require('fs');
try {
  const data = JSON.parse(fs.readFileSync('feature_list.json', 'utf-8'));
  const valid = new Set(['pending', 'in_progress', 'done', 'blocked']);
  const inProgress = data.features.filter(f => f.status === 'in_progress');
  if (inProgress.length > 1) {
    console.log('[FAIL]  Hay ' + inProgress.length + ' features en in_progress (máximo 1)');
    process.exit(1);
  }
  for (const f of data.features) {
    if (!valid.has(f.status)) {
      console.log('[FAIL]  Estado inválido en feature ' + f.id + ': ' + f.status);
      process.exit(1);
    }
  }
  console.log('[OK]    feature_list.json válido (' + data.features.length + ' features)');
} catch (e) {
  console.log('[FAIL]  feature_list.json inválido: ' + e.message);
  process.exit(1);
}
"@

$valOutput = node -e $validationScript
Write-Host $valOutput
if ($LASTEXITCODE -ne 0) {
    $EXIT_CODE = 1
}

Write-Host ""
Write-Host "── 4. Verificando dependencias ──────────────────────────"

if (Test-Path "package.json") {
    if (Test-Path "node_modules") {
        Write-Ok "node_modules existe"
    } else {
        Write-Warn "node_modules no existe. Ejecutá 'pnpm install' antes de continuar."
        $EXIT_CODE = 1
    }
} else {
    Write-Warn "package.json no existe todavía"
}

Write-Host ""
Write-Host "── 5. Ejecutando tests ─────────────────────────────────"

if ((Test-Path "package.json") -and (Test-Path "node_modules")) {
    & $pnpmCmd.Source test
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "Todos los tests pasan"
    } else {
        Write-Fail "Hay tests rotos"
        $EXIT_CODE = 1
    }
} else {
    Write-Warn "No se pueden ejecutar tests todavía (falta package.json o node_modules)"
}

Write-Host ""
Write-Host "── 6. Resumen ──────────────────────────────────────────"

if ($EXIT_CODE -eq 0) {
    Write-Ok "🚀 Entorno listo. Puedes empezar a trabajar."
} else {
    Write-Fail "⛔ Entorno NO está listo. Resolvé los errores antes de avanzar."
}

exit $EXIT_CODE
