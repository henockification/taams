'use client';

import { Badge } from '@/components/ui/badge';
import type { Department } from '@/data/types/core.types';

import type { DepartmentNode } from './department-tree';

type ChartLabels = {
  inactiveLabel: string;
  headLabel: (name: string) => string;
};

function OrganizationChartNode({
  node,
  inactiveLabel,
  headLabel,
  onSelect,
}: ChartLabels & {
  node: DepartmentNode;
  onSelect?: (department: Department) => void;
}) {
  const hasChildren = node.children.length > 0;

  return (
    <li className="relative flex flex-col items-center px-4 pt-6 before:absolute before:left-0 before:top-6 before:h-px before:w-1/2 before:bg-border after:absolute after:right-0 after:top-6 after:h-px after:w-1/2 after:bg-border first:before:hidden last:after:hidden only:before:hidden only:after:hidden">
      <button
        type="button"
        onClick={() => onSelect?.(node)}
        disabled={!onSelect}
        className="relative z-10 flex min-h-24 w-56 flex-col justify-center rounded-md border bg-card px-4 py-3 text-center shadow-sm transition-colors enabled:hover:bg-accent"
      >
        <span className="line-clamp-2 text-sm font-semibold">{node.nameEn}</span>
        <span className="mt-1 truncate text-xs text-muted-foreground">{node.code || '-'}</span>
        {node.headEmployee ? (
          <span className="mt-1 truncate text-xs font-medium text-primary">{headLabel(node.headEmployee.fullName)}</span>
        ) : null}
        {!node.isActive ? (
          <Badge variant="secondary" className="mx-auto mt-2 w-fit">
            {inactiveLabel}
          </Badge>
        ) : null}
      </button>
      {hasChildren ? (
        <div className="relative mt-6 pt-6 before:absolute before:left-1/2 before:top-0 before:h-6 before:w-px before:bg-border">
          <ul className="relative flex items-start justify-center">
            {node.children.map((child) => (
              <OrganizationChartNode
                key={child.id}
                node={child}
                inactiveLabel={inactiveLabel}
                headLabel={headLabel}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

export function OrganizationChart({
  tree,
  inactiveLabel,
  headLabel,
  onSelect,
}: ChartLabels & {
  tree: DepartmentNode[];
  onSelect?: (department: Department) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-muted/20 p-4">
      <div className="inline-flex min-w-full justify-center pb-2">
        <ul className="flex items-start justify-center">
          {tree.map((node) => (
            <OrganizationChartNode
              key={node.id}
              node={node}
              inactiveLabel={inactiveLabel}
              headLabel={headLabel}
              onSelect={onSelect}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
