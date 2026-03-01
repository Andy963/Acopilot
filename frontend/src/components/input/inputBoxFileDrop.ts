import { nextTick, type Ref } from 'vue'

export function createInputBoxFileDrop(options: {
  textareaRef: Ref<HTMLTextAreaElement | undefined>
  getValue: () => string
  updateValue: (value: string) => void
  onPathsDropped: (paths: string[]) => void
  setDragOver: (value: boolean) => void
  sendToExtension: <T = any>(type: string, data: any) => Promise<T>
}) {
  const { textareaRef, getValue, updateValue, onPathsDropped, setDragOver, sendToExtension } = options

  function insertPathsToTextarea(paths: string[]) {
    if (!textareaRef.value) return

    const textarea = textareaRef.value
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = getValue()

    const pathText = paths.map((p) => `@${p}`).join(' ')

    const beforeCursor = text.substring(0, start)
    const afterCursor = text.substring(end)

    const insertText = ` ${pathText} `
    const newValue = beforeCursor + insertText + afterCursor
    updateValue(newValue)

    nextTick(() => {
      if (!textareaRef.value) return
      const newCursorPos = start + insertText.length
      textareaRef.value.setSelectionRange(newCursorPos, newCursorPos)
      textareaRef.value.focus()
    })
  }

  async function insertFilePathsFromUris(uris: string[]) {
    const relativePaths: string[] = []

    for (const uri of uris) {
      try {
        const result = await sendToExtension<{ relativePath: string; isDirectory?: boolean }>('getRelativePath', {
          absolutePath: uri.trim()
        })
        if (result.relativePath) {
          const path = result.isDirectory ? `${result.relativePath}/` : result.relativePath
          relativePaths.push(path)
        }
      } catch (err) {
        console.error('Failed to resolve relative path:', err)
        try {
          const url = new URL(uri)
          const pathName = decodeURIComponent(url.pathname)
          const fileName = pathName.split('/').pop()
          if (fileName) {
            relativePaths.push(fileName)
          }
        } catch {
          // ignore invalid uri
        }
      }
    }

    if (relativePaths.length > 0) {
      insertPathsToTextarea(relativePaths)
      onPathsDropped(relativePaths)
    }
  }

  async function insertFilePathsFromPaths(paths: string[]) {
    const relativePaths: string[] = []

    for (const absolutePath of paths) {
      try {
        const result = await sendToExtension<{ relativePath: string; isDirectory?: boolean }>('getRelativePath', {
          absolutePath
        })
        if (result.relativePath) {
          const path = result.isDirectory ? `${result.relativePath}/` : result.relativePath
          relativePaths.push(path)
        }
      } catch (err) {
        console.error('Failed to resolve relative path:', err)
        const fileName = absolutePath.split(/[/\\\\]/).pop()
        if (fileName) {
          relativePaths.push(fileName)
        }
      }
    }

    if (relativePaths.length > 0) {
      insertPathsToTextarea(relativePaths)
      onPathsDropped(relativePaths)
    }
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)

    const dt = e.dataTransfer
    if (!dt) return

    const vscodeUriList = dt.getData('application/vnd.code.uri-list')
    if (vscodeUriList) {
      const uris = vscodeUriList.split('\\n').filter((uri) => uri.trim() && !uri.startsWith('#'))
      if (uris.length > 0) {
        await insertFilePathsFromUris(uris)
        return
      }
    }

    const resourceUrls = dt.getData('resourceurls')
    if (resourceUrls) {
      try {
        const urls = JSON.parse(resourceUrls) as string[]
        if (urls.length > 0) {
          await insertFilePathsFromUris(urls)
          return
        }
      } catch {
        // ignore parsing errors
      }
    }

    const uriList = dt.getData('text/uri-list')
    if (uriList) {
      const uris = uriList.split('\\n').filter((uri) => uri.trim() && !uri.startsWith('#'))
      if (uris.length > 0) {
        await insertFilePathsFromUris(uris)
        return
      }
    }

    const plainText = dt.getData('text/plain')
    if (plainText) {
      const lines = plainText.split('\\n').filter((line) => line.trim())
      const fileUris = lines.filter(
        (line) => line.startsWith('file://') || line.match(/^[a-zA-Z]:[\\/\\\\]/) || line.startsWith('/')
      )

      if (fileUris.length > 0) {
        await insertFilePathsFromUris(fileUris)
        return
      }
    }

    if (dt.files && dt.files.length > 0) {
      const paths: string[] = []
      for (let i = 0; i < dt.files.length; i++) {
        const file = dt.files[i]
        const filePath = (file as any).path || file.name
        if (filePath) {
          paths.push(filePath)
        }
      }

      if (paths.length > 0) {
        await insertFilePathsFromPaths(paths)
      }
    }
  }

  return { handleDrop }
}

