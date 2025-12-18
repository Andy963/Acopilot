/**
 * search_in_files 工具注册
 */

import { registerTool } from '../../toolRegistry'
import SearchInFilesComponent from '../../../components/tools/search/search_in_files.vue'

// 注册 search_in_files 工具
registerTool('search_in_files', {
  name: 'search_in_files',
  label: '搜索内容',
  icon: 'codicon-search',
  
  // 描述生成器 - 显示搜索关键词
  descriptionFormatter: (args) => {
    const query = args.query as string || ''
    const path = args.path as string || '.'
    const pattern = args.pattern as string || '**/*'
    
    let desc = query
    if (path !== '.') {
      desc += `\n路径: ${path}`
    }
    if (pattern !== '**/*') {
      desc += `\n模式: ${pattern}`
    }
    return desc
  },
  
  // 使用自定义组件显示内容
  contentComponent: SearchInFilesComponent
})