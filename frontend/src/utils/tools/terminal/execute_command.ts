/**
 * execute_command 工具注册
 */

import { registerTool } from '../../toolRegistry'
import ExecuteCommandComponent from '../../../components/tools/terminal/execute_command.vue'
import { assessCommandRisk } from '@/utils/commandRisk'

// 注册 execute_command 工具
registerTool('execute_command', {
  name: 'execute_command',
  label: '执行命令',
  icon: 'codicon-terminal',
  
  // 描述生成器 - 显示命令
  descriptionFormatter: (args) => {
    const command = args.command as string || ''
    const cwd = args.cwd as string
    
    const risk = assessCommandRisk(command)
    const riskLabelMap: Record<string, string> = {
      low: '低',
      medium: '中',
      high: '高',
      critical: '致命'
    }

    let desc = `[风险: ${riskLabelMap[risk.level] || risk.level}] ${command}`
    if (risk.reasons.length > 0) {
      desc += `\n原因: ${risk.reasons.slice(0, 2).join('；')}`
    }
    if (cwd) {
      desc += `\n目录: ${cwd}`
    }
    return desc
  },
  
  // 使用自定义组件显示内容
  contentComponent: ExecuteCommandComponent
})
