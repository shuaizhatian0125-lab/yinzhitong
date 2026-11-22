'use client';

import * as React from 'react';
import { Check, X, AlertTriangle, ShieldCheck } from 'lucide-react';

type ConfirmationType =
  | 'CREATE_TASK'
  | 'MODIFY_TASK'
  | 'DELETE_DATA'
  | 'SEND_NOTIFICATION'
  | 'EXECUTE_TOOL'
  | 'CHANGE_PERMISSION'
  | 'EXTERNAL_ACTION'
  | 'SYSTEM_CONFIG';

type ConfirmationCardProps = {
  confirmationId: string;
  type: ConfirmationType;
  operation: string;
  dataScope: string;
  affectedObjects: string;
  externalImpact: string;
  reversible: boolean;
  expectedResult: string;
  riskLevel: string;
  permissionSource: string;
  onConfirm?: () => void;
  onReject?: () => void;
  className?: string;
};

const TYPE_LABELS: Record<ConfirmationType, string> = {
  CREATE_TASK: '创建任务',
  MODIFY_TASK: '修改任务',
  DELETE_DATA: '删除数据',
  SEND_NOTIFICATION: '发送通知',
  EXECUTE_TOOL: '执行工具',
  CHANGE_PERMISSION: '变更权限',
  EXTERNAL_ACTION: '外部操作',
  SYSTEM_CONFIG: '系统配置',
};

const RISK_COLORS: Record<string, string> = {
  L0: 'var(--bz-ok)',
  L1: 'var(--bz-info)',
  L2: 'var(--bz-gold)',
  L3: 'var(--bz-danger)',
  L4: 'var(--bz-danger)',
};

const INFO_ITEMS = [
  { key: 'operation', label: '操作内容' },
  { key: 'dataScope', label: '涉及数据' },
  { key: 'affectedObjects', label: '影响对象' },
  { key: 'externalImpact', label: '外部影响' },
  { key: 'reversible', label: '可撤销性' },
  { key: 'expectedResult', label: '预期结果' },
  { key: 'riskLevel', label: '风险级别' },
  { key: 'permissionSource', label: '权限来源' },
];

export function ConfirmationCard({
  confirmationId,
  type,
  operation,
  dataScope,
  affectedObjects,
  externalImpact,
  reversible,
  expectedResult,
  riskLevel,
  permissionSource,
  onConfirm,
  onReject,
  className,
}: ConfirmationCardProps) {
  const [loading, setLoading] = React.useState(false);

  const values: Record<string, string> = {
    operation,
    dataScope,
    affectedObjects,
    externalImpact,
    reversible: reversible ? '可撤销' : '不可撤销',
    expectedResult,
    riskLevel,
    permissionSource,
  };

  return (
    <div className="rounded-[4px] border border-[var(--bz-border)] bg-[var(--bz-card)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" style={{ color: 'var(--bz-brand)' }} />
          <span className="text-[14px] font-semibold text-[var(--bz-text)]">
            确认请求 · {TYPE_LABELS[type]}
          </span>
        </div>
        <span
          className="inline-flex items-center rounded-[2px] px-2 py-0.5 text-[12px] font-medium"
          style={{ backgroundColor: RISK_COLORS[riskLevel] ?? 'var(--bz-info)', color: '#fff' }}
        >
          {riskLevel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
        {INFO_ITEMS.map((item) => (
          <div key={item.key} className="flex flex-col">
            <span className="text-[11px] text-[var(--bz-text-sub)]">{item.label}</span>
            <span className="text-[13px] text-[var(--bz-text)]">
              {item.key === 'reversible' && !reversible ? (
                <span style={{ color: 'var(--bz-danger)' }}>{values[item.key]}</span>
              ) : (
                values[item.key]
              )}
            </span>
          </div>
        ))}
      </div>

      {!reversible && (
        <div className="flex items-center gap-2 mb-3 text-[12px]" style={{ color: 'var(--bz-danger)' }}>
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>此操作不可撤销，请谨慎确认</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => { setLoading(true); onConfirm?.(); setLoading(false); }}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-[2px] px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--bz-ok)' }}
        >
          <Check className="h-3.5 w-3.5" />
          确认
        </button>
        <button
          onClick={() => { setLoading(true); onReject?.(); setLoading(false); }}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-[2px] px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--bz-danger)' }}
        >
          <X className="h-3.5 w-3.5" />
          拒绝
        </button>
      </div>
    </div>
  );
}