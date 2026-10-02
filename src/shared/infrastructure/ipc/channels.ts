export const IPC_CHANNELS = {
  BOOKS: {
    LIST: 'books:list',
    GET_BY_ID: 'books:getById',
    CREATE: 'books:create',
    UPDATE_STATUS: 'books:updateStatus',
    UPDATE_PROGRESS: 'books:updateProgress',
    RATE: 'books:rate',
    DELETE: 'books:delete'
  },
  NOTES: {
    GET_BY_BOOK: 'notes:getByBook',
    CREATE: 'notes:create',
    UPDATE: 'notes:update',
    DELETE: 'notes:delete'
  },
  COVERS: {
    SAVE_FROM_URL: 'covers:saveFromUrl',
    SAVE_FROM_LOCAL: 'covers:saveFromLocal'
  },
  SEARCH: {
    BOOKS: 'search:books'
  },
  WINDOW: {
    MINIMIZE: 'window:minimize',
    MAXIMIZE: 'window:maximize',
    CLOSE: 'window:close',
    IS_MAXIMIZED: 'window:isMaximized'
  }
} as const

export type IpcChannel =
  | (typeof IPC_CHANNELS.BOOKS)[keyof typeof IPC_CHANNELS.BOOKS]
  | (typeof IPC_CHANNELS.NOTES)[keyof typeof IPC_CHANNELS.NOTES]
  | (typeof IPC_CHANNELS.COVERS)[keyof typeof IPC_CHANNELS.COVERS]
  | (typeof IPC_CHANNELS.SEARCH)[keyof typeof IPC_CHANNELS.SEARCH]
  | (typeof IPC_CHANNELS.WINDOW)[keyof typeof IPC_CHANNELS.WINDOW]
