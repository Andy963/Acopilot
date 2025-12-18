/**
 * read_file 工具注册
 */

import { registerTool } from '../../toolRegistry'
import ReadFileComponent from '../../../components/tools/file/read_file.vue'

// 注册 read_file 工具
registerTool('read_file', {
  name: 'read_file',
  label: '读取文件',
  icon: 'codicon-file-text',
  
  // 描述生成器 - 显示文件路径（每行一个）
  descriptionFormatter: (args) => {
    if (args.paths && Array.isArray(args.paths)) {
      return (args.paths as string[]).join('\n')
    }
    if (args.path) {
      return args.path as string
    }
    return '未知路径'
  },
  
  // 使用自定义组件显示内容
  contentComponent: ReadFileComponent
})