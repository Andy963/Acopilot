/**
 * search_in_files 工具注册
 */

import { registerTool } from '../../toolRegistry'
import SearchInFilesComponent from '../../../components/tools/search/search_in_files.vue'

// 注册 search_in_files 工具
registerTool('search_in_files', {
  name: 'search_in_files',
  label: 'Search in Files',
  icon: 'codicon-search',
  
  // 描述生成器 - 显示搜索关键词和替换信息
  descriptionFormatter: (args: Record<string, unknown>) => {
    const query = args.query as string || ''
    const path = args.path as string || '.'
    const pattern = args.pattern as string || '**/*'
    const replace = args.replace as string | undefined
    const dryRun = args.dryRun as boolean || false
    
    let desc = query
    if (replace !== undefined) {
      desc += ` -> ${replace || '(empty)'}`
      if (dryRun) {
        desc += ' [dry-run]'
      }
    }
    if (path !== '.') {
      desc += `\nPath: ${path}`
    }
    if (pattern !== '**/*') {
      desc += `\nPattern: ${pattern}`
    }
    return desc
  },
  
  // 使用自定义组件显示内容
  contentComponent: SearchInFilesComponent,
  
  // This tool is search-only, so it never produces diffs.
  hasDiffPreview: false,
  
  // 获取所有替换的文件路径
  getDiffFilePath: (args: Record<string, unknown>, result?: Record<string, unknown>) => {
    // 只有替换模式才支持 diff 预览
    const replace = args.replace as string | undefined
    if (replace === undefined) {
      return []
    }
    
    // 从结果中获取替换的文件路径
    const resultData = result?.data as Record<string, unknown> | undefined
    const results = resultData?.results as Array<{ file: string }> | undefined
    
    if (!results || results.length === 0) {
      return []
    }
    
    return results.map(r => r.file)
  }
})
