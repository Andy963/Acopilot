import { useI18n } from '@/i18n'

export function useCheckpointCleanupFormatting() {
  const { t } = useI18n()

  function formatRelativeTime(timestamp?: number): string {
    if (!timestamp) return ''

    const now = Date.now()
    const diff = now - timestamp

    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour

    if (diff < minute) {
      return t('components.settings.checkpoint.sections.cleanup.timeFormat.justNow')
    }
    if (diff < hour) {
      return t('components.settings.checkpoint.sections.cleanup.timeFormat.minutesAgo', { count: Math.floor(diff / minute) })
    }
    if (diff < day) {
      return t('components.settings.checkpoint.sections.cleanup.timeFormat.hoursAgo', { count: Math.floor(diff / hour) })
    }
    if (diff < 7 * day) {
      return t('components.settings.checkpoint.sections.cleanup.timeFormat.daysAgo', { count: Math.floor(diff / day) })
    }

    return new Date(timestamp).toLocaleDateString()
  }

  function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B'

    const units = ['B', 'KB', 'MB', 'GB']
    const sizeIndex = Math.floor(Math.log(bytes) / Math.log(1024))
    const size = bytes / Math.pow(1024, sizeIndex)

    return `${size.toFixed(sizeIndex > 0 ? 1 : 0)} ${units[sizeIndex]}`
  }

  function formatCheckpointCount(count: number): string {
    return t('components.settings.checkpoint.sections.cleanup.checkpointCount', { count })
  }

  return {
    formatRelativeTime,
    formatSize,
    formatCheckpointCount
  }
}
