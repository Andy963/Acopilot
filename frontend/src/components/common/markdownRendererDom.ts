import { sendToExtension } from '@/utils/vscode'

type GetContainer = () => HTMLElement | null

export type MarkdownRendererDomController = {
  mount: () => void
  refresh: () => void
  unmount: () => void
}

export function createMarkdownRendererDomController(getContainer: GetContainer): MarkdownRendererDomController {
  const copyTimers = new Map<HTMLButtonElement, number>()
  const imageCache = new Map<string, string>()

  function decodeBase64Text(value: string): string {
    return decodeURIComponent(atob(value))
  }

  function clearCopyTimer(button: HTMLButtonElement): void {
    const existingTimer = copyTimers.get(button)
    if (!existingTimer) return
    window.clearTimeout(existingTimer)
    copyTimers.delete(button)
  }

  function handleCopyClick(event: Event): void {
    const target = event.target as HTMLElement | null
    const button = target?.closest('.code-copy-btn') as HTMLButtonElement | null
    if (!button) return

    const encodedCode = button.getAttribute('data-code')
    if (!encodedCode) return

    navigator.clipboard.writeText(decodeBase64Text(encodedCode)).then(() => {
      clearCopyTimer(button)
      button.classList.add('copied')

      const timer = window.setTimeout(() => {
        button.classList.remove('copied')
        copyTimers.delete(button)
      }, 1000)

      copyTimers.set(button, timer)
    }).catch((error) => {
      console.error('Failed to copy code block:', error)
    })
  }

  async function loadWorkspaceImages(): Promise<void> {
    const container = getContainer()
    if (!container) return

    const images = container.querySelectorAll('img.workspace-image[data-path]')

    for (const img of images) {
      const encodedPath = img.getAttribute('data-path')
      if (!encodedPath) continue

      try {
        const imagePath = decodeBase64Text(encodedPath)

        if (imageCache.has(imagePath)) {
          img.setAttribute('src', imageCache.get(imagePath)!)
          img.classList.remove('workspace-image')
          img.classList.add('loaded-image')
          img.setAttribute('data-image-path', imagePath)
          continue
        }

        const response = await sendToExtension<{
          success: boolean
          data?: string
          mimeType?: string
          error?: string
        }>('readWorkspaceImage', { path: imagePath })

        if (response?.success && response.data) {
          const dataUrl = `data:${response.mimeType || 'image/png'};base64,${response.data}`
          imageCache.set(imagePath, dataUrl)
          img.setAttribute('src', dataUrl)
          img.classList.remove('workspace-image')
          img.classList.add('loaded-image')
          img.setAttribute('data-image-path', imagePath)
          continue
        }

        img.classList.add('image-error')
        img.setAttribute('title', response?.error || 'Failed to load image')
      } catch (error) {
        console.error('Failed to load workspace image:', error)
        img.classList.add('image-error')
      }
    }
  }

  async function handleImageClick(event: Event): Promise<void> {
    const target = event.target as HTMLElement | null
    if (target?.tagName !== 'IMG' || !target.classList.contains('loaded-image')) return

    const imagePath = target.getAttribute('data-image-path')
    if (!imagePath) return

    await sendToExtension('openWorkspaceFile', { path: imagePath })
  }

  async function handleWorkspaceFileLinkClick(event: Event): Promise<void> {
    const target = event.target as HTMLElement | null
    if (!target) return

    const link = target.closest('a.workspace-file-link') as HTMLAnchorElement | null
    const container = getContainer()
    if (!link || !container || !container.contains(link)) return

    const path = String(link.getAttribute('data-path') || '').trim()
    const line = Number(link.getAttribute('data-line'))
    const column = link.getAttribute('data-column') === null ? 1 : Number(link.getAttribute('data-column'))

    if (!path || !Number.isFinite(line) || line <= 0) return
    if (!Number.isFinite(column) || column <= 0) return

    event.preventDefault()
    event.stopPropagation()

    try {
      await sendToExtension('openWorkspaceFileAtLocation', { path, line, column })
    } catch (error) {
      console.warn('Failed to open workspace file reference:', error)
    }
  }

  function handleContainerClick(event: Event): void {
    handleCopyClick(event)
    void handleImageClick(event)
    void handleWorkspaceFileLinkClick(event)
  }

  return {
    mount() {
      const container = getContainer()
      container?.addEventListener('click', handleContainerClick)
    },
    refresh() {
      void loadWorkspaceImages()
    },
    unmount() {
      const container = getContainer()
      container?.removeEventListener('click', handleContainerClick)

      for (const timer of copyTimers.values()) {
        window.clearTimeout(timer)
      }
      copyTimers.clear()
    },
  }
}
