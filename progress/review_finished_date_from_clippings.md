# Review — feature 24

**Veredicto:** APPROVED

## Verificación
- pnpm test: 45 archivos, 675 tests, todo en verde (lo corrió el reviewer).
- typecheck/lint/build: se tomaron del informe del implementer (sección "Reporte #24" de `progress/current.md`). El diff no toca configuración.

## Puntos revisados
- **Caminos manuales.** `src/shared/domain/services/suggestFinishedDate.ts:54-84` toma el `capturedAt` más reciente de los subrayados y de las notas `NoteOrigin.KINDLE`. Si la fecha es futura (`isAfterToday`) o no hay ninguna, devuelve hoy. La conversión a día local se hace con `toIsoDate` de `CalendarDate`. Los dos caminos la usan: `BookDetailPage.tsx` (`handleStatusChange` → `preloadFinishedDate`) y `UpdateProgressModal.tsx` (prop `finishedDateSuggestion`).
- **Origen visible.** `FinishedDateField` tiene una prop nueva, `hint`, con `data-testid="<testId>-hint"` y la clase `text-ink-muted`. El texto lo arma `describeFinishedDateSuggestion` en `finishedDate.ts`.
- **Autocompletado al 100%.** `UpdateBookProgress` y `Book` no se tocaron, y el test de application sigue en verde.
- **Re-terminar un libro.** Con el libro ya FINISHED, el modal conserva su `finishedAt` (`preloadFinishedDate`: lo existente tiene prioridad). Un libro reabierto que conserva un `finishedAt` viejo precarga la sugerencia o hoy: #20 precargaba hoy, así que no hay regresión. Está documentado en la tabla del ADR 024 §3 y tiene tests (`test_finished_date_from_clippings_ui.test.ts:246` y `:295`).
- **Capas.** El dominio solo importa `CalendarDate` y `NoteOrigin`. El renderer importa del dominio puro, igual que ya hacía con `BookStatus`. No hay IPC nuevo, así que no cambia ningún contrato.
- **UI.** Solo usa tokens de color (`text-ink-muted`) y conserva todos los `data-testid`.
- **Tests y ADR.** Hay 10 tests de dominio y 12 de renderer, y existe `docs/decisions/024-finished-date-from-clippings.md`. No hace falta guía nueva porque la feature no introduce conceptos nuevos.

## Checkpoints
- C1: [x]
- C2: [x] (después del cierre: #24 queda `done` y `current.md` vuelve a la plantilla)
- C3: [x]
- C4: [x]
- C5: [x] (la entrada ya está en `history.md`)

## Cambios requeridos (solo bloqueantes)
Ninguno.

## Notas no bloqueantes
- El ADR 024 tiene el estado "Aceptado (pendiente de revisión)". Hay que pasarlo a "Aceptado".
- En `src/renderer/src/components/UpdateProgressModal.tsx:66-72`, el `useEffect` de reset depende de `initialFinishedDate`. Si los subrayados o las notas llegan con el modal ya abierto, se reinician todos los campos (página, porcentaje y checkbox), no solo la fecha. En la práctica es poco probable, porque el modal se abre desde el detalle ya cargado.
- El informe del implementer quedó en `progress/current.md` y no en `progress/report_finished_date_from_clippings.md`, porque el entorno no dejó crear ese archivo. El contenido se conserva en la entrada de `history.md`.
