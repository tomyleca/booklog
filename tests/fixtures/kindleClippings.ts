/**
 * Fixture de `My Clippings.txt` derivado de la muestra real del usuario (feature #23).
 * ANONIMIZADO: los encabezados (títulos sucios y líneas de metadatos) conservan el formato
 * real, pero todo el texto de subrayados y notas es inventado. Nunca copiar el archivo real.
 */

const SEPARATOR = '=========='

interface FixtureEntry {
  title: string
  meta: string
  body: string
}

function entry(title: string, meta: string, body = ''): FixtureEntry {
  return { title, meta, body }
}

export const KINDLE_TITLES = {
  annasArchive:
    "AI Engineering_ Building Applications with Foundation Models -- Chip Huyen -- 2024 -- O'Reilly Media, Incorporated -- 9781098166304 -- d3b6e5c5133e004242914f8b66feaf7d -- Anna’s Archive (Chip Huyen)",
  annasArchiveIsbn13:
    'Legado de cenizas _ La historia de la CIA -- Tim Weiner [Weiner, Tim] -- Penguin Random House Grupo Editorial, S_A_U_, [N_p_], 2019 -- Debols!llo -- isbn13 9788466351737 -- 50bda1b2de1ebce09e187f7c15691719 -- Anna’s Archive (Tim Weiner)',
  dashAuthor: 'Legado de cenizas - Tim Weiner (Tim Weiner)',
  zLibrary:
    'This Is How They Tell Me the World Ends The Cyberweapons Arms Race (Nicole Perlroth) (Z-Library) (Nicole Perlroth)',
  oceanOfPdf: '_OceanofPDF.com_Eisenhorn_The_Omnibus_-_Dan_Abnett (Dan Abnett)',
  epubLibre: 'Borges, Jorge Luis - Ficciones [19293] (r1.2) (Jorge Luis Borges)',
  hyphenated:
    'De-animales-a-dioses-Breve-historia-de-la-humanidad - Yuval Noah Harari (Yuval Noah Harari)',
  noAuthor: 'Moby-Dick  ',
  underscoredNoAuthor: 'Jorge_Luis_Borges_ficciones  ',
  lastNameFirst:
    'King, Stephen - The Mist -- Stephen King, Stephen King -- 1st, 2018 -- Scribner -- 9780451223296 -- f75e7030b2176a6454f5f4e034cc0daa -- Anna’s Archive (King, Stephen)',
  translator: 'Siddhartha trad Juan Jose del Solar - Hermann Hesse (Hermann Hesse)',
  truncatedHash:
    'Para hechizar a un cazador _ Premio Clarín de Novela 2023 -- Luciano Lamberti -- Penguin Random House Grupo Editorial, S_A_U_, [N_p_], 2024 -- 9789870758167 -- 78a6dcdc9f945a61813edc696b (Luciano Lamberti)'
} as const

const T = KINDLE_TITLES

export const KINDLE_FIXTURE_ENTRIES: FixtureEntry[] = [
  // Castellano: página + posición, resaltado y nota vinculada (la nota cae dentro del rango).
  entry(
    T.annasArchive,
    '- Tu resaltado en la página 12 | posición 180-183 | Añadido el lunes, 14 de julio de 2025 22:15:03',
    'Texto inventado del primer subrayado sobre modelos.'
  ),
  entry(
    T.annasArchive,
    '- La nota en la página 12 | posición 183 | Añadido el lunes, 14 de julio de 2025 22:16:00',
    'Nota inventada sobre el primer subrayado.'
  ),
  // Subrayado editado: el viejo (más corto) y el nuevo (lo contiene) se superponen.
  entry(
    T.annasArchive,
    '- Tu resaltado en la página 20 | posición 300-302 | Añadido el martes, 15 de julio de 2025 10:00:00',
    'Frase inventada que el usuario subrayó primero'
  ),
  entry(
    T.annasArchive,
    '- Tu resaltado en la página 20 | posición 300-305 | Añadido el martes, 15 de julio de 2025 10:01:30',
    'Frase inventada que el usuario subrayó primero y después extendió un poco más.'
  ),
  // Nota editada: borradores (prefijos) y un duplicado exacto en la misma ubicación.
  entry(
    T.annasArchive,
    '- La nota en la página 20 | posición 304 | Añadido el martes, 15 de julio de 2025 10:02:00',
    'Bor'
  ),
  entry(
    T.annasArchive,
    '- La nota en la página 20 | posición 304 | Añadido el martes, 15 de julio de 2025 10:02:10',
    'Borrador de nota'
  ),
  entry(
    T.annasArchive,
    '- La nota en la página 20 | posición 304 | Añadido el martes, 15 de julio de 2025 10:02:20',
    'Borrador de nota terminado.'
  ),
  entry(
    T.annasArchive,
    '- La nota en la página 20 | posición 304 | Añadido el martes, 15 de julio de 2025 10:02:30',
    'Borrador de nota terminado.'
  ),
  // Autoguardado con correcciones en el medio (caso real anonimizado, feature #25): ninguna
  // versión es prefijo de la siguiente. Solo queda la más reciente de la ubicación.
  entry(
    T.annasArchive,
    '- La nota en la página 20 | posición 304 | Añadido el martes, 15 de julio de 2025 10:02:56',
    'Borrador de nota terminado. una pelicula, influenxiq'
  ),
  entry(
    T.annasArchive,
    '- La nota en la página 20 | posición 304 | Añadido el martes, 15 de julio de 2025 10:02:58',
    'Borrador de nota terminado. una pelicula, influenx'
  ),
  entry(
    T.annasArchive,
    '- La nota en la página 20 | posición 304 | Añadido el martes, 15 de julio de 2025 10:03:00',
    'Borrador de nota terminado. una pelicula, influencia?'
  ),
  // Marcador y resaltado vacío: se ignoran.
  entry(
    T.annasArchive,
    '- El marcador en la página 25 | posición 400 | Añadido el martes, 15 de julio de 2025 11:00:00'
  ),
  entry(
    T.annasArchive,
    '- Tu resaltado en la posición 410-411 | Añadido el martes, 15 de julio de 2025 11:05:00'
  ),
  // Solo posición, número suelto y rango.
  entry(
    T.dashAuthor,
    '- Tu resaltado en la posición 1200-1205 | Añadido el viernes, 8 de agosto de 2025 9:05:00',
    'Cita inventada sobre una agencia.'
  ),
  entry(
    T.dashAuthor,
    '- La nota en la posición 1204 | Añadido el viernes, 8 de agosto de 2025 9:06:00',
    'Comentario inventado dentro del rango.'
  ),
  entry(
    T.dashAuthor,
    '- Tu resaltado en la posición 1500 | Añadido el viernes, 8 de agosto de 2025 9:10:00',
    'Cita inventada de una sola posición.'
  ),
  // Solo página con rango, y nota suelta (no cae dentro de ningún subrayado).
  entry(
    T.annasArchiveIsbn13,
    '- Tu resaltado en la página 33-34 | Añadido el domingo, 2 de marzo de 2025 18:00:00',
    'Cita inventada que cruza de página.'
  ),
  entry(
    T.annasArchiveIsbn13,
    '- La nota en la página 90 | Añadido el domingo, 2 de marzo de 2025 18:30:00',
    'Nota suelta inventada.'
  ),
  // Inglés con fecha en castellano (caso real) y en inglés.
  entry(
    T.zLibrary,
    '- Your Highlight on Location 512-515 | Added on martes, 8 de julio de 2025 21:40:12',
    'Invented highlight about software.'
  ),
  entry(
    T.zLibrary,
    '- Your Highlight on page 7 | Location 98-101 | Added on Monday, July 14, 2025 10:15:03 PM',
    'Invented highlight with an English date.'
  ),
  entry(
    T.zLibrary,
    '- Your Note on page 7 | Location 101 | Added on Monday, July 14, 2025 10:16:00 PM',
    'Invented note in English.'
  ),
  entry(
    T.zLibrary,
    '- Your Bookmark on Location 600 | Added on martes, 8 de julio de 2025 21:50:00'
  ),
  // Resto de patrones de títulos.
  entry(
    T.oceanOfPdf,
    '- Tu resaltado en la posición 10-11 | Añadido el sábado, 4 de enero de 2025 12:00:00',
    'Texto inventado uno.'
  ),
  entry(
    T.epubLibre,
    '- Tu resaltado en la página 5 | posición 70-72 | Añadido el jueves, 9 de enero de 2025 8:00:00',
    'Texto inventado dos.'
  ),
  entry(
    T.hyphenated,
    '- Tu resaltado en la posición 2000-2003 | Añadido el miércoles, 12 de marzo de 2025 19:20:00',
    'Texto inventado tres.'
  ),
  entry(
    T.noAuthor,
    '- Tu resaltado en la posición 50-52 | Añadido el lunes, 6 de enero de 2025 7:00:00',
    'Texto inventado cuatro.'
  ),
  entry(
    T.underscoredNoAuthor,
    '- Tu resaltado en la página 3 | posición 40-41 | Añadido el lunes, 6 de enero de 2025 7:10:00',
    'Texto inventado cinco.'
  ),
  entry(
    T.lastNameFirst,
    '- Your Highlight on page 15 | Location 230-232 | Added on jueves, 10 de julio de 2025 23:00:00',
    'Invented highlight six.'
  ),
  entry(
    T.translator,
    '- Tu resaltado en la posición 77-79 | Añadido el sábado, 1 de febrero de 2025 16:45:00',
    'Texto inventado siete.'
  ),
  entry(
    T.truncatedHash,
    '- Tu resaltado en la página 8 | posición 120-121 | Añadido el domingo, 5 de enero de 2025 20:00:00',
    'Texto inventado ocho.'
  )
]

/** Arma el archivo como lo escribe el Kindle: BOM, CRLF y `==========` tras cada entrada. */
export function buildClippingsFile(entries: FixtureEntry[] = KINDLE_FIXTURE_ENTRIES): string {
  const body = entries
    .map((e) => [e.title, e.meta, '', e.body, SEPARATOR].join('\r\n'))
    .join('\r\n')
  return `${String.fromCharCode(0xfeff)}${body}\r\n`
}

export const KINDLE_FIXTURE_TEXT = buildClippingsFile()
