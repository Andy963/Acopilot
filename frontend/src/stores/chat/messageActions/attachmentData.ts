import type { Attachment } from '../../../types'
import type { AttachmentData } from '../types'

export function toAttachmentData(attachments?: Attachment[]): AttachmentData[] | undefined {
  if (!attachments || attachments.length === 0) return undefined

  return attachments.map(att => ({
    id: att.id,
    name: att.name,
    type: att.type,
    size: att.size,
    mimeType: att.mimeType,
    data: att.data || '',
    thumbnail: att.thumbnail
  }))
}

