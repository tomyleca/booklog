export const IPC_CHANNELS = {
  BOOKS: {
    LIST: 'books:list',
    GET_BY_ID: 'books:getById',
    CREATE: 'books:create',
    UPDATE_STATUS: 'books:updateStatus',
    UPDATE_PROGRESS: 'books:updateProgress',
    RATE: 'books:rate',
    SET_FINISHED_DATE: 'books:setFinishedDate',
    DELETE: 'books:delete'
  },
  NOTES: {
    GET_BY_BOOK: 'notes:getByBook',
    CREATE: 'notes:create',
    UPDATE: 'notes:update',
    DELETE: 'notes:delete'
  },
  HIGHLIGHTS: {
    GET_BY_BOOK: 'highlights:getByBook',
    DELETE: 'highlights:delete'
  },
  KINDLE: {
    PREVIEW_FROM_DEVICE: 'kindle:previewFromDevice',
    PREVIEW_FROM_FILE: 'kindle:previewFromFile',
    COMMIT: 'kindle:commit'
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
  },
  SETTINGS: {
    GET: 'settings:get',
    SAVE: 'settings:save',
    TEST_API_KEY: 'settings:testApiKey',
    GET_APP_INFO: 'settings:getAppInfo'
  }
} as const

export type IpcChannel =
  | (typeof IPC_CHANNELS.BOOKS)[keyof typeof IPC_CHANNELS.BOOKS]
  | (typeof IPC_CHANNELS.NOTES)[keyof typeof IPC_CHANNELS.NOTES]
  | (typeof IPC_CHANNELS.HIGHLIGHTS)[keyof typeof IPC_CHANNELS.HIGHLIGHTS]
  | (typeof IPC_CHANNELS.KINDLE)[keyof typeof IPC_CHANNELS.KINDLE]
  | (typeof IPC_CHANNELS.COVERS)[keyof typeof IPC_CHANNELS.COVERS]
  | (typeof IPC_CHANNELS.SEARCH)[keyof typeof IPC_CHANNELS.SEARCH]
  | (typeof IPC_CHANNELS.WINDOW)[keyof typeof IPC_CHANNELS.WINDOW]
  | (typeof IPC_CHANNELS.SETTINGS)[keyof typeof IPC_CHANNELS.SETTINGS]
