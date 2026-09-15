import type { CreateDepartmentInput } from '../../types/core.types';

type ImportDepartment = {
  nameEn: string;
  nameAm: string | null;
  code: string | null;
  isContract: boolean;
};

function departmentImportKey(name: string, isContract: boolean) {
  return `${isContract ? 'CONTRACT' : 'PERMANENT'}:${name.trim().replace(/\s+/g, ' ').toLowerCase()}`;
}

export function buildDepartmentImportCache<T extends ImportDepartment>(departments: T[]) {
  const cache = new Map<string, T>();
  for (const department of departments) {
    for (const name of [department.nameEn, department.nameAm, department.code]) {
      if (name?.trim()) cache.set(departmentImportKey(name, department.isContract), department);
    }
  }
  return cache;
}

export async function findOrCreateImportDepartment<T extends ImportDepartment>(
  name: string,
  cache: Map<string, T>,
  createDepartment: (input: CreateDepartmentInput) => Promise<T>,
  options: { allowCreate?: boolean; isContract?: boolean } = {},
) {
  const isContract = options.isContract ?? false;
  const key = departmentImportKey(name, isContract);
  const found = cache.get(key);
  if (found) return found;
  if (options.allowCreate === false) throw new Error(`Department not found: ${name}`);

  const department = await createDepartment({ nameEn: name, isContract, code: null, isActive: true });
  cache.set(key, department);
  return department;
}
