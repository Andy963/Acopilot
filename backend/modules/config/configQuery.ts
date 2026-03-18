import type { ChannelConfig, ConfigFilter, ConfigSortOptions } from './types';

export function applyFilter(configs: ChannelConfig[], filter: ConfigFilter): ChannelConfig[] {
  let result = configs;

  if (filter.type) {
    result = result.filter(c => c.type === filter.type);
  }

  if (filter.enabled !== undefined) {
    result = result.filter(c => c.enabled === filter.enabled);
  }

  if (filter.tags && filter.tags.length > 0) {
    // ⚡ Bolt: Convert filter criteria to a Set once before iteration to achieve O(1) lookup
    // This improves the time complexity of the intersection check from O(N * M) to O(N)
    const filterTags = new Set(filter.tags);
    result = result.filter(c => c.tags && c.tags.some(tag => filterTags.has(tag)));
  }

  if (filter.nameSearch) {
    const search = filter.nameSearch.toLowerCase();
    result = result.filter(c => c.name.toLowerCase().includes(search));
  }

  return result;
}

export function applySort(configs: ChannelConfig[], sort: ConfigSortOptions): ChannelConfig[] {
  const sorted = [...configs];

  sorted.sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (sort.field) {
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'createdAt':
        aVal = a.createdAt;
        bVal = b.createdAt;
        break;
      case 'updatedAt':
        aVal = a.updatedAt;
        bVal = b.updatedAt;
        break;
      case 'type':
        aVal = a.type;
        bVal = b.type;
        break;
    }

    if (sort.order === 'asc') {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    }
    return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
  });

  return sorted;
}

