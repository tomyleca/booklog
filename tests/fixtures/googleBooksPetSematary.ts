/**
 * Respuestas grabadas (recortadas) de Google Books para "pet sematary". Reproducen el
 * problema de la feature #21: la consulta libre devuelve primero guías de estudio,
 * revistas y traducciones, y la edición de Stephen King aparece tarde en la lista.
 * No se hacen llamadas reales a la API en los tests.
 */

export const KING_EDITION_ID = 'king_pet_sematary_gallery'
export const KING_PLAIN_EDITION_ID = 'king_pet_sematary_plain'

const kingEdition = {
  kind: 'books#volume',
  id: KING_EDITION_ID,
  volumeInfo: {
    title: 'Pet Sematary',
    authors: ['Stephen King'],
    publisher: 'Gallery Books',
    publishedDate: '2018-07-31',
    description: 'Louis Creed, a young doctor from Chicago, moves with his family to Maine...',
    industryIdentifiers: [
      { type: 'ISBN_13', identifier: '9781982115982' },
      { type: 'ISBN_10', identifier: '1982115988' }
    ],
    pageCount: 416,
    printType: 'BOOK',
    imageLinks: {
      smallThumbnail: 'http://books.google.com/books/content?id=king1&zoom=5',
      thumbnail: 'http://books.google.com/books/content?id=king1&zoom=1'
    },
    language: 'en'
  }
}

const studyGuide = {
  kind: 'books#volume',
  id: 'supersummary_pet_sematary',
  volumeInfo: {
    title: 'Study Guide: Pet Sematary by Stephen King',
    authors: ['SuperSummary'],
    publisher: 'SuperSummary',
    publishedDate: '2019',
    industryIdentifiers: [{ type: 'ISBN_13', identifier: '9781950000001' }],
    pageCount: 52,
    printType: 'BOOK',
    imageLinks: { thumbnail: 'http://books.google.com/books/content?id=ss1&zoom=1' },
    language: 'en'
  }
}

const bookRagsGuide = {
  kind: 'books#volume',
  id: 'bookrags_pet_sematary',
  volumeInfo: {
    title: 'Pet Sematary (Study Guide)',
    authors: ['BookRags'],
    publisher: 'BookRags',
    publishedDate: '2011',
    industryIdentifiers: [{ type: 'ISBN_13', identifier: '9781304000002' }],
    pageCount: 60,
    printType: 'BOOK',
    imageLinks: { thumbnail: 'http://books.google.com/books/content?id=br1&zoom=1' },
    language: 'en'
  }
}

const magazine = {
  kind: 'books#volume',
  id: 'fangoria_83',
  volumeInfo: {
    title: 'Fangoria',
    publisher: 'O’Quinn Studios',
    publishedDate: '1989-05',
    description: 'Inside: the making of Pet Sematary, interviews and makeup effects.',
    printType: 'MAGAZINE',
    imageLinks: { thumbnail: 'http://books.google.com/books/content?id=fg83&zoom=1' },
    language: 'en'
  }
}

const germanEdition = {
  kind: 'books#volume',
  id: 'king_friedhof_der_kuscheltiere',
  volumeInfo: {
    title: 'Friedhof der Kuscheltiere',
    authors: ['Stephen King'],
    publisher: 'Heyne Verlag',
    publishedDate: '2011',
    industryIdentifiers: [{ type: 'ISBN_13', identifier: '9783453435773' }],
    pageCount: 624,
    printType: 'BOOK',
    imageLinks: { thumbnail: 'http://books.google.com/books/content?id=de1&zoom=1' },
    language: 'de'
  }
}

const spanishEdition = {
  kind: 'books#volume',
  id: 'king_cementerio_de_animales',
  volumeInfo: {
    title: 'Cementerio de animales',
    authors: ['Stephen King'],
    publisher: 'DEBOLSILLO',
    publishedDate: '2019',
    industryIdentifiers: [{ type: 'ISBN_13', identifier: '9788466347210' }],
    pageCount: 520,
    printType: 'BOOK',
    imageLinks: { thumbnail: 'http://books.google.com/books/content?id=es1&zoom=1' },
    language: 'es'
  }
}

const filmEssay = {
  kind: 'books#volume',
  id: 'essay_horror_films',
  volumeInfo: {
    title: 'Sematary Tales: Essays on Horror Cinema',
    authors: ['Jane Critic'],
    publishedDate: '2005',
    printType: 'BOOK',
    language: 'en'
  }
}

const kingPlainEdition = {
  kind: 'books#volume',
  id: KING_PLAIN_EDITION_ID,
  volumeInfo: {
    title: 'Pet Sematary',
    authors: ['Stephen King'],
    publisher: 'Doubleday',
    publishedDate: '1983',
    printType: 'BOOK',
    language: 'en'
  }
}

/** `q=pet sematary` — la consulta libre, con la edición de King muy abajo. */
export const PET_SEMATARY_FREE_RESPONSE = {
  kind: 'books#volumes',
  totalItems: 8,
  items: [
    studyGuide,
    magazine,
    germanEdition,
    bookRagsGuide,
    spanishEdition,
    filmEssay,
    kingPlainEdition,
    kingEdition
  ]
}

/** `q=intitle:"pet sematary"` — repite la edición de King y la guía de BookRags. */
export const PET_SEMATARY_INTITLE_RESPONSE = {
  kind: 'books#volumes',
  totalItems: 3,
  items: [bookRagsGuide, studyGuide, kingEdition]
}

export const PET_SEMATARY_UNIQUE_IDS = [
  'supersummary_pet_sematary',
  'fangoria_83',
  'king_friedhof_der_kuscheltiere',
  'bookrags_pet_sematary',
  'king_cementerio_de_animales',
  'essay_horror_films',
  KING_PLAIN_EDITION_ID,
  KING_EDITION_ID
]
