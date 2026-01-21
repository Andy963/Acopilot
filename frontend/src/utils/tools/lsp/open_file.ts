/**
 * open_file 工具注册
 */

import { registerTool } from '../../toolRegistry'

registerTool('open_file', {
  name: 'open_file',
  label: '打开文件',
  icon: 'codicon-go-to-file',
  descriptionFormatter: (args) => {
    const path = String((args as any)?.path || '')
    const line = (args as any)?.start_line
    const col = (args as any)?.start_column
    const loc =
      typeof line === 'number'
        ? `:${line}${typeof col === 'number' ? `:${col}` : ''}`
        : ''
    return `${path}${loc}`
  }
})

