/**
 * Determine whether tool results indicate filesystem changes.
 *
 * Used to show post-edit validation hints (build/test/lint) after a turn completes.
 */
export function hasFileChanges(toolResults: Array<{ name: string; result: any }> | undefined): boolean {
  if (!toolResults || toolResults.length === 0) return false

  for (const tr of toolResults) {
    const toolName = tr.name
    const r = tr.result || {}

    if (toolName === 'write_file' && r.success && r.data?.results) {
      const results = Array.isArray(r.data.results) ? r.data.results : []
      const changed = results.some((x: any) =>
        x?.success === true &&
        (x?.status === 'accepted' || x?.status === undefined) &&
        (x?.action === 'created' || x?.action === 'modified')
      )
      if (changed) return true
    }

    if (toolName === 'apply_diff' && r.success && r.data) {
      // apply_diff: only counts as changes after the user accepts (saved) it.
      if (r.data.status === 'accepted' && (r.data.appliedCount ?? 0) > 0) {
        return true
      }
    }

    if (toolName === 'delete_file' && r.success && Array.isArray(r.data?.deletedPaths) && r.data.deletedPaths.length > 0) {
      return true
    }

    if (toolName === 'create_directory' && r.success && Array.isArray(r.data?.createdPaths) && r.data.createdPaths.length > 0) {
      return true
    }
  }

  return false
}

