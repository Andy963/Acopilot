/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

// VSCode Webview API 类型声明
interface VsCodeApi {
  postMessage(message: unknown): void
  getState(): unknown
  setState(state: unknown): void
}

declare function acquireVsCodeApi(): VsCodeApi

// Global constants from Vite
declare const __APP_VERSION__: string
declare const __APP_NAME__: string
declare const __APP_REPOSITORY__: string
declare const __APP_AUTHOR__: string
