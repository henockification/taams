import type { Department } from '@/data/types/core.types';

export type DepartmentNode = Department & { children: DepartmentNode[] };

const byName = (a: Department, b: Department) => a.nameEn.localeCompare(b.nameEn);

export function buildDepartmentTree(departments: Department[]) {
  const nodeMap = new Map<string, DepartmentNode>();
  departments.forEach((department) => {
    nodeMap.set(department.id, { ...department, children: [] });
  });

  const roots: DepartmentNode[] = [];
  nodeMap.forEach((node) => {
    if (node.parentDepartmentId && nodeMap.has(node.parentDepartmentId)) {
      nodeMap.get(node.parentDepartmentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (nodes: DepartmentNode[]) => {
    nodes.sort(byName);
    nodes.forEach((node) => sortNodes(node.children));
  };
  sortNodes(roots);

  // Top-level departments that head a branch come first; departments not placed anywhere yet sink to the bottom.
  return [...roots.filter((node) => node.children.length > 0), ...roots.filter((node) => node.children.length === 0)];
}

/** The department itself plus everything below it — none of these can become its parent. */
export function collectSelfAndDescendantIds(departments: Department[], departmentId: string) {
  const childrenByParent = new Map<string, string[]>();
  departments.forEach((department) => {
    if (!department.parentDepartmentId) return;
    const siblings = childrenByParent.get(department.parentDepartmentId) ?? [];
    siblings.push(department.id);
    childrenByParent.set(department.parentDepartmentId, siblings);
  });

  const ids = new Set<string>([departmentId]);
  const queue = [departmentId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    (childrenByParent.get(current) ?? []).forEach((childId) => {
      if (!ids.has(childId)) {
        ids.add(childId);
        queue.push(childId);
      }
    });
  }

  return ids;
}

export function isNotPlaced(department: Department, departments: Department[]) {
  return !department.parentDepartmentId && !departments.some((other) => other.parentDepartmentId === department.id);
}
