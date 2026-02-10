import { onBeforeUnmount, ref } from 'vue'
import type { ToolUsage } from '../../types'
import { getReadFileSingleContent } from './toolMessageUtils'

export function useReadFileCopy() {
  const copiedReadFileToolIds = ref<Set<string>>(new Set())
  const copiedReadFileTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

  onBeforeUnmount(() => {
    for (const timeout of copiedReadFileTimeouts.values()) clearTimeout(timeout)
    copiedReadFileTimeouts.clear()
  })

  function isReadFileCopied(toolId: string): boolean {
    return copiedReadFileToolIds.value.has(toolId)
  }

  function markReadFileCopied(toolId: string) {
    copiedReadFileToolIds.value.add(toolId)
    copiedReadFileToolIds.value = new Set(copiedReadFileToolIds.value)

    const existing = copiedReadFileTimeouts.get(toolId)
    if (existing) clearTimeout(existing)

    const timeout = setTimeout(() => {
      copiedReadFileToolIds.value.delete(toolId)
      copiedReadFileToolIds.value = new Set(copiedReadFileToolIds.value)
      copiedReadFileTimeouts.delete(toolId)
    }, 1000)

    copiedReadFileTimeouts.set(toolId, timeout)
  }

  async function copyReadFileSingleContent(tool: ToolUsage) {
    if (tool.name !== 'read_file') return

    const content = getReadFileSingleContent(tool)
    if (!content) return

    try {
      const raw = content
        .split('\n')
        .map((line) => {
          const match = line.match(/^\s*\d+\s*\|\s?(.*)$/)
          return match ? match[1] : line
        })
        .join('\n')

      await navigator.clipboard.writeText(raw)
      markReadFileCopied(tool.id)
    } catch (err) {
      console.error('Failed to copy read_file content:', err)
    }
  }

  return { isReadFileCopied, copyReadFileSingleContent }
}

