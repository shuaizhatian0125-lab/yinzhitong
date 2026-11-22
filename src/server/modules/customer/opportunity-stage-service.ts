import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { OpportunityRow } from './customer-service';

export const OPPORTUNITY_STAGES = [
  'identification',
  'initial_contact',
  'requirement_confirmation',
  'solution_design',
  'business_negotiation',
  'contract_signed',
  'lost',
] as const;

export const STAGE_LABELS: Record<string, string> = {
  identification: '商机识别',
  initial_contact: '初步接触',
  requirement_confirmation: '需求确认',
  solution_design: '方案设计',
  business_negotiation: '商务谈判',
  contract_signed: '合同签订',
  lost: '已流失',
};

export type StageTransitionResult = {
  opportunity: OpportunityRow;
  fromStage: string;
  toStage: string;
  historyId: string;
};

export async function transitionStage(
  tenantId: string,
  opportunityId: string,
  targetStage: string,
  reason?: string,
  lostReason?: string,
  transitionedBy?: string,
): Promise<StageTransitionResult> {
  const db = getSupabaseClient();

  const { data: oppData } = await db
    .from('opportunity')
    .select('*')
    .eq('id', opportunityId)
    .eq('tenant_id', tenantId)
    .limit(1);

  const opportunity = (oppData?.[0] as OpportunityRow | undefined) ?? null;
  if (!opportunity) {
    throw new Error('商机不存在');
  }

  const currentStage = opportunity.stage;
  const currentIndex = OPPORTUNITY_STAGES.indexOf(currentStage as typeof OPPORTUNITY_STAGES[number]);
  const targetIndex = OPPORTUNITY_STAGES.indexOf(targetStage as typeof OPPORTUNITY_STAGES[number]);

  if (currentIndex === -1) {
    throw new Error(`当前阶段无效: ${currentStage}`);
  }
  if (targetIndex === -1) {
    throw new Error(`目标阶段无效: ${targetStage}`);
  }

  if (currentStage === 'contract_signed' || currentStage === 'lost') {
    throw new Error('商机已结束，不可再流转');
  }

  if (targetStage === 'lost') {
    if (!lostReason) {
      throw new Error('流失时必须提供流失原因');
    }
  } else {
    if (targetIndex !== currentIndex + 1) {
      throw new Error(
        `商机阶段不可跳级，当前阶段：${STAGE_LABELS[currentStage] ?? currentStage}，目标阶段：${STAGE_LABELS[targetStage] ?? targetStage}`,
      );
    }
  }

  const now = new Date().toISOString();
  const historyId = crypto.randomUUID();

  const updateFields: Record<string, unknown> = {
    stage: targetStage,
    updated_at: now,
  };

  if (targetStage === 'contract_signed') {
    updateFields.probability = 100;
  }
  if (targetStage === 'lost') {
    updateFields.probability = 0;
  }

  const { data: updatedData, error: updateError } = await db
    .from('opportunity')
    .update(updateFields)
    .eq('id', opportunityId)
    .eq('tenant_id', tenantId)
    .select('*')
    .limit(1);

  if (updateError) {
    throw new Error(`更新商机阶段失败: ${updateError.message}`);
  }

  const updatedOpp = (updatedData?.[0] as OpportunityRow | undefined) ?? null;
  if (!updatedOpp) {
    throw new Error('更新商机阶段失败');
  }

  const { error: historyError } = await db
    .from('opportunity_stage_history')
    .insert({
      id: historyId,
      tenant_id: tenantId,
      opportunity_id: opportunityId,
      from_stage: currentStage,
      to_stage: targetStage,
      transition_reason: reason ?? null,
      lost_reason: lostReason ?? null,
      transitioned_by: transitionedBy ?? null,
      transitioned_at: now,
    });

  if (historyError) {
    throw new Error(`记录流转历史失败: ${historyError.message}`);
  }

  return {
    opportunity: updatedOpp,
    fromStage: currentStage,
    toStage: targetStage,
    historyId,
  };
}

export function getNextStage(currentStage: string): string | null {
  const currentIndex = OPPORTUNITY_STAGES.indexOf(currentStage as typeof OPPORTUNITY_STAGES[number]);
  if (currentIndex === -1) return null;
  if (currentIndex >= OPPORTUNITY_STAGES.length - 2) return null;
  return OPPORTUNITY_STAGES[currentIndex + 1];
}