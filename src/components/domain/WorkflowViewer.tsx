'use client';

import * as React from 'react';

export type WorkflowNodeData = {
  id: string;
  node_key: string;
  node_type: string;
  status: string;
  assignee_id: string | null;
  started_at: string | null;
  finished_at: string | null;
};

export type WorkflowDefinitionData = {
  startNodeKey: string;
  nodes: Array<{
    key: string;
    type: string;
    name: string;
    nextNodeKey?: string;
    config?: Record<string, unknown>;
  }>;
};

type WorkflowViewerProps = {
  definition: WorkflowDefinitionData | null;
  nodeInstances: WorkflowNodeData[];
  className?: string;
};

const NODE_TYPE_ICON: Record<string, string> = {
  ai_task: 'AI',
  human_task: '人',
  approval: '审',
  condition: '条',
  notify: '通',
  integration: '集',
};

const NODE_TYPE_COLOR: Record<string, string> = {
  ai_task: 'var(--bz-brand)',
  human_task: 'var(--bz-info)',
  approval: 'var(--bz-gold)',
  condition: 'var(--bz-warn)',
  notify: 'var(--bz-ok)',
  integration: 'var(--bz-text-sub)',
};

const NODE_STATUS_COLOR: Record<string, string> = {
  pending: 'var(--bz-warn)',
  in_progress: 'var(--bz-info)',
  completed: 'var(--bz-ok)',
  rejected: 'var(--bz-danger)',
};

const NODE_STATUS_LABEL: Record<string, string> = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
  rejected: '已驳回',
};

export function WorkflowViewer({ definition, nodeInstances, className }: WorkflowViewerProps) {
  if (!definition || !definition.nodes || definition.nodes.length === 0) {
    return (
      <div className={`text-center text-[var(--bz-text-muted)] py-8 ${className ?? ''}`}>
        暂无流程定义数据
      </div>
    );
  }

  const orderedNodes = orderNodes(definition);

  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      {orderedNodes.map((node, idx) => {
        const instance = nodeInstances.find((ni) => ni.node_key === node.key);
        const status = instance?.status ?? 'pending';
        const icon = NODE_TYPE_ICON[node.type] ?? '?';
        const typeColor = NODE_TYPE_COLOR[node.type] ?? 'var(--bz-text-muted)';
        const statusColor = NODE_STATUS_COLOR[status] ?? 'var(--bz-text-muted)';
        const statusLabel = NODE_STATUS_LABEL[status] ?? status;
        const isLast = idx === orderedNodes.length - 1;

        return (
          <React.Fragment key={node.key}>
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded"
              style={{
                background: status === 'completed' ? '#f0fdf4' : status === 'in_progress' ? '#eff6ff' : '#fafcfe',
                border: `1px solid ${status === 'completed' ? '#bbf7d0' : status === 'in_progress' ? '#bfdbfe' : 'var(--bz-line)'}`,
                borderRadius: 3,
              }}
            >
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 28,
                  height: 28,
                borderRadius: 8,
                  background: typeColor,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-[var(--bz-text)] truncate">
                    {node.name}
                  </span>
                  <span className="text-[11px] text-[var(--bz-text-muted)]">
                    {node.type}
                  </span>
                </div>
                {instance?.assignee_id && (
                  <span className="text-[11px] text-[var(--bz-text-muted)]">
                    处理人: {instance.assignee_id}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="text-[11px] font-medium"
                  style={{ color: statusColor }}
                >
                  {statusLabel}
                </span>
                {instance?.finished_at && (
                  <span className="text-[10px] text-[var(--bz-text-muted)]">
                    {new Date(instance.finished_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>

            {!isLast && (
              <div className="flex justify-center" style={{ height: 16 }}>
                <div
                  style={{
                    width: 2,
                    height: 16,
                    background: 'var(--bz-line)',
                  }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function orderNodes(definition: WorkflowDefinitionData): WorkflowDefinitionData['nodes'] {
  const visited = new Set<string>();
  const ordered: WorkflowDefinitionData['nodes'] = [];
  const nodeMap = new Map(definition.nodes.map((n) => [n.key, n]));

  function visit(key: string) {
    if (visited.has(key)) return;
    visited.add(key);
    const node = nodeMap.get(key);
    if (!node) return;
    ordered.push(node);
    if (node.nextNodeKey) {
      visit(node.nextNodeKey);
    }
    if (node.config?.['elseNodeKey']) {
      visit(node.config['elseNodeKey'] as string);
    }
  }

  visit(definition.startNodeKey);

  for (const node of definition.nodes) {
    if (!visited.has(node.key)) {
      ordered.push(node);
    }
  }

  return ordered;
}