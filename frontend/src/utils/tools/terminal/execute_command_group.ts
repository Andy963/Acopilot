/**
 * execute_command_group tool (UI-only)
 */

import { registerTool } from '../../toolRegistry'
import ExecuteCommandGroupComponent from '../../../components/tools/terminal/execute_command_group.vue'

interface ExecuteCommandArgsLike {
  command?: string
  cwd?: string
  shell?: string
}

registerTool('execute_command_group', {
  name: 'execute_command_group',
  label: '执行命令',
  icon: 'codicon-terminal',
  descriptionFormatter: (args) => {
    const raw = (args as any)?.commands
    const commands: ExecuteCommandArgsLike[] = Array.isArray(raw) ? raw : []

    const lines = commands
      .map((c) => (typeof c?.command === 'string' ? c.command.trim() : ''))
      .filter(Boolean)

    const limit = 6
    const shown = lines.slice(0, limit)
    const rest = Math.max(0, lines.length - shown.length)

    return rest > 0 ? `${shown.join('\n')}\n(+${rest} more)` : shown.join('\n')
  },
  contentComponent: ExecuteCommandGroupComponent
})

