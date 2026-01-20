/**
 * read_file 工具注册
 */

import { registerTool } from '../../toolRegistry'
import ReadFileComponent from '../../../components/tools/file/read_file.vue'

interface FileRequest {
  path: string
  startLine?: number
  endLine?: number
}

// 注册 read_file 工具
registerTool('read_file', {
  name: 'read_file',
  label: '读取文件',
  icon: 'codicon-file-text',
  
  // 描述生成器
  // 说明：read_file 的关键信息（成功/失败/总数）已在 ToolMessage 头部显示，
  // 折叠状态下不再重复列出文件路径，避免占用一整行。
  descriptionFormatter: (args) => {
    void args
    return ''
  },
  
  // 使用自定义组件显示内容
  contentComponent: ReadFileComponent
})
