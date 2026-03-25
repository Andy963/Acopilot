/**
 * replace_in_files tool registration
 */

import { registerTool } from '../../toolRegistry'
import SearchInFilesComponent from '../../../components/tools/search/search_in_files.vue'

registerTool('replace_in_files', {
  name: 'replace_in_files',
  label: 'Replace in Files',
  icon: 'codicon-replace-all',

  descriptionFormatter: (args: Record<string, unknown>) => {
    const query = (args.query as string) || ''
    const path = (args.path as string) || '.'
    const pattern = (args.pattern as string) || '**/*'
    const replace = args.replace as string | undefined
    const dryRun = (args.dryRun as boolean) || false

    let desc = query
    if (replace !== undefined) {
      desc += ` -> ${replace}`
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

  contentComponent: SearchInFilesComponent,

  hasDiffPreview: true,

  getDiffFilePath: (_args: Record<string, unknown>, result?: Record<string, unknown>) => {
    const resultData = result?.data as Record<string, unknown> | undefined
    const results = resultData?.results as Array<{ file: string; diffContentId?: string | null }> | undefined

    if (!Array.isArray(results) || results.length === 0) {
      return []
    }

    return results
      .filter((r) => typeof r?.diffContentId === 'string' && Boolean(r.diffContentId))
      .map((r) => r.file)
  }
})

