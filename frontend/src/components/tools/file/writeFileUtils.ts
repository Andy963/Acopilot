export function getFileName(filePath: string): string {
  const parts = String(filePath || '').split(/[/\\]/)
  return parts[parts.length - 1] || filePath
}

export function getFileDir(filePath: string): string {
  const normalized = String(filePath || '')
  const lastSlash = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  if (lastSlash <= 0) return '.'
  return normalized.slice(0, lastSlash)
}

export function getFileExtension(filePath: string): string {
  const fileName = getFileName(filePath)
  const lastDotIndex = fileName.lastIndexOf('.')
  if (lastDotIndex > 0) {
    return fileName.substring(lastDotIndex + 1)
  }
  return ''
}

export function getFileNameWithoutExt(filePath: string): string {
  const fileName = getFileName(filePath)
  const lastDotIndex = fileName.lastIndexOf('.')
  if (lastDotIndex > 0) {
    return fileName.substring(0, lastDotIndex)
  }
  return fileName
}

export function getContentLines(content: string | undefined): string[] {
  return content ? content.split('\n') : []
}

