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
    result = result.filter(c => c.tags && filter.tags!.some(tag => c.tags!.includes(tag)));
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

