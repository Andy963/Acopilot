export const MAIN_VIEW_REGISTRY = {
  chat: {
    id: 'chat',
    title: 'Chat',
    icon: 'codicon-comment-discussion',
    command: 'showChat',
    restoresState: true,
  },
  history: {
    id: 'history',
    title: 'History',
    icon: 'codicon-history',
    command: 'showHistory',
    restoresState: true,
  },
  settings: {
    id: 'settings',
    title: 'Settings',
    icon: 'codicon-settings-gear',
    command: 'showSettings',
    restoresState: true,
  },
} as const

export type AppView = keyof typeof MAIN_VIEW_REGISTRY
export type MainViewDefinition = (typeof MAIN_VIEW_REGISTRY)[AppView]

export const MAIN_VIEW_IDS = Object.keys(MAIN_VIEW_REGISTRY) as AppView[]
export const MAIN_VIEWS = MAIN_VIEW_IDS.map(id => MAIN_VIEW_REGISTRY[id])

export function isAppView(value: unknown): value is AppView {
  return typeof value === 'string' && value in MAIN_VIEW_REGISTRY
}
