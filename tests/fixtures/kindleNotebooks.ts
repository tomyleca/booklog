/**
 * Fixtures de exportaciones del Cuaderno de la app de Kindle para PC (feature #26).
 *
 * ANONIMIZADOS: la estructura (XHTML mal formado `<h3 class='noteHeading'>…</div><div
 * class='noteText'>…</h3>`, cabecera, estilos, secciones, encabezados con capítulo,
 * entidades, colores, subrayados partidos con la misma posición, distancias nota → subrayado
 * y la nota multilínea) se derivó de dos exportaciones reales del usuario, pero todo el texto
 * de subrayados y notas es inventado y los hashes de los títulos se cambiaron. Nunca copiar
 * los archivos reales. El fixture en inglés se armó a mano siguiendo la misma estructura.
 */

const STYLE = `<style>
.bodyContainer {
    font-family: Arial, Helvetica, sans-serif;
    text-align: center;
}

.bookTitle {
    font-size: 32px;
}

.noteHeading {
    font-size: 18px;
    font-weight: 700;
}

.noteText {
    font-size: 18px;
}

.highlight_blue {
    color: rgb(178, 205, 251);
}

.highlight_orange {
    color: #ffd7ae;
}

.highlight_pink {
    color: rgb(255, 191, 206);
}

.highlight_yellow {
    color: rgb(247, 206, 0);
}
</style>`

function document(notebookFor: string, title: string, author: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "XHTML1-s.dtd" >
<html xmlns="http://www.w3.org/TR/1999/REC-html-in-xml" xml:lang="en" lang="en">

<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></meta>
${STYLE}
</head>
<body>
<div class='bodyContainer'>
<h1><div class='notebookFor'>${notebookFor}</div><div class='bookTitle'>${title}
</div>, de <div class='authors'>
${author}
</div>
</div></h1><hr/>

${body}
</div>
</body>
</html>
`
}

function highlight(color: string, colorLabel: string, where: string, text: string): string {
  return `<h3 class='noteHeading'>Subrayado (<span class='highlight_${color}'>${colorLabel}</span>) - ${where}</div><div class='noteText'>${text}</h3>`
}

function note(where: string, text: string): string {
  return `<h3 class='noteHeading'>Nota - ${where}</div><div class='noteText'>${text}</h3>`
}

function section(title: string): string {
  return `<h2 class='sectionHeading'>${title}</h2>`
}

/** Derivado de la exportación con subrayados y notas (secciones numeradas, nota multilínea). */
export const NOTEBOOK_ES_TITLE =
  'El crepúsculo de los ídolos -- Friedrich Nietzsche -- 1889 -- 0123456789abcdef0123456789abcdef -- Anna’s Archive'
export const NOTEBOOK_ES_FILE_NAME = `${NOTEBOOK_ES_TITLE}-Bloc de notas.html`

export const NOTEBOOK_ES_TEXTS = {
  first: 'Primer subrayado inventado del prólogo, con varias palabras de relleno.',
  splitA: 'Primera mitad de un subrayado que',
  splitB: 'sigue en la página siguiente y termina acá.',
  withNoteNext: 'Subrayado inventado que tiene una nota una posición después.',
  noteNext: '¿pregunta inventada?',
  long:
    'Subrayado largo inventado que ocupa varias posiciones del Kindle porque tiene mucho texto, ' +
    'más de doscientos caracteres en total, para que la nota quede dos posiciones después del ' +
    'inicio igual que en la muestra real, y siga contando como su comentario.',
  noteTwoAfter: 'nota inventada dos posiciones después del subrayado. ',
  multilineNote:
    'primera línea inventada de una nota escrita en el celular,\nsegunda línea inventada después del salto',
  samePosition: 'Subrayado inventado con la nota en la misma posición.',
  noteSame: 'nota en la misma posición',
  quoted: 'Las «comillas» & los símbolos &lt;raros&gt; se decodifican.',
  beforeFar: 'Subrayado inventado corto.',
  farNote: 'nota inventada lejos de cualquier subrayado',
  blue: 'Subrayado azul inventado.',
  last: 'Último subrayado inventado del libro.'
} as const

const ES = NOTEBOOK_ES_TEXTS

export const NOTEBOOK_ES_HTML = document(
  'Notas y subrayados en',
  NOTEBOOK_ES_TITLE,
  'Friedrich Nietzsche',
  [
    section('Prólogo') + highlight('yellow', 'amarillo', 'Posición 52', ES.first),
    highlight('yellow', 'amarillo', 'Posición 58', ES.splitA),
    highlight('yellow', 'amarillo', 'Posición 58', ES.splitB),
    section('6') + highlight('yellow', 'amarillo', 'Posición 640', ES.withNoteNext),
    note('Posición 641', ES.noteNext),
    section('8') + highlight('yellow', 'amarillo', 'Posición 872', ES.long),
    note('Posición 873', ES.multilineNote),
    section('9') + highlight('blue', 'azul', 'Posición 1265', ES.blue),
    note('Posición 1267', ES.noteTwoAfter),
    highlight('pink', 'rosa', 'Posición 1427', ES.samePosition),
    note('Posición 1427', ES.noteSame),
    highlight(
      'orange',
      'naranja',
      'Posición 1450',
      'Las «comillas» &amp; los símbolos &amp;lt;raros&amp;gt; se decodifican.'
    ),
    highlight('yellow', 'amarillo', 'Posición 1500', ES.beforeFar),
    note('Posición 1530', ES.farNote),
    section('10') + highlight('yellow', 'amarillo', 'Posición 1654', ES.last)
  ].join('\n')
)

/** Derivado de la exportación con capítulos en el encabezado (`Carta II &gt; Posición N`). */
export const NOTEBOOK_CHAPTERS_TITLE =
  'Frankenstein, o el moderno Prometeo -- Mary Shelley -- 1818 -- ePubLibre -- fedcba9876543210fedcba9876543210 -- Anna’s Archive'
export const NOTEBOOK_CHAPTERS_FILE_NAME = `${NOTEBOOK_CHAPTERS_TITLE}-Bloc de notas.html`

export const NOTEBOOK_CHAPTERS_HTML = document(
  'Notas y subrayados en',
  NOTEBOOK_CHAPTERS_TITLE,
  'Mary Shelley',
  [
    section('Estudio preliminar') +
      highlight('yellow', 'amarillo', 'Posición 136', 'Texto inventado del estudio preliminar.'),
    section('Frankenstein, o el moderno Prometeo') +
      highlight(
        'yellow',
        'amarillo',
        'Carta II &gt; Posición 1069',
        'Texto inventado de una carta.'
      ),
    highlight(
      'yellow',
      'amarillo',
      'Capítulo IV &gt; Posición 1614',
      'Texto inventado del capítulo cuatro.'
    ),
    highlight(
      'yellow',
      'amarillo',
      'Capítulo XXIV &gt; Posición 4033',
      'Texto inventado del final.'
    )
  ].join('\n')
)

/** Construido a mano: app en inglés, página y posición, marcador y entrada sin ubicación. */
export const NOTEBOOK_EN_TITLE = 'Moby-Dick; or, The Whale'
export const NOTEBOOK_EN_FILE_NAME = `${NOTEBOOK_EN_TITLE}-Notebook.html`

export const NOTEBOOK_EN_HTML = document(
  'Notes and highlights for',
  NOTEBOOK_EN_TITLE,
  'Herman Melville',
  [
    section('Chapter 1') +
      `<h3 class='noteHeading'>Highlight (<span class='highlight_yellow'>yellow</span>) - Page 12 · Location 150</div><div class='noteText'>Invented English highlight number one.</h3>`,
    `<h3 class='noteHeading'>Note - Page 12 · Location 151</div><div class='noteText'>Invented note on the first highlight.</h3>`,
    `<h3 class='noteHeading'>Highlight (<span class='highlight_blue'>blue</span>) - Chapter 3 &gt; Page 40 · Location 610</div><div class='noteText'>Invented blue highlight with an entity: caf&#233; &amp; tea.</h3>`,
    `<h3 class='noteHeading'>Bookmark - Page 41 · Location 620</div><div class='noteText'></h3>`,
    `<h3 class='noteHeading'>Highlight (<span class='highlight_pink'>pink</span>) - Page 55</div><div class='noteText'>Invented highlight with only a page.</h3>`,
    `<h3 class='noteHeading'>Note - Page 56</div><div class='noteText'>Invented note on the next page.</h3>`,
    `<h3 class='noteHeading'>Highlight (<span class='highlight_orange'>orange</span>) - Location 900</div><div class='noteText'>   </h3>`,
    `<h3 class='noteHeading'>Highlight (<span class='highlight_yellow'>yellow</span>) - Page xii</div><div class='noteText'>Roman numeral pages cannot be stored.</h3>`
  ].join('\n')
)
