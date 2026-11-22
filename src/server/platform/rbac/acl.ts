import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { SessionUser } from '@/lib/auth';

export type AclResourceType = 'document' | 'knowledge_base';
export type AclAction = 'view' | 'edit' | 'delete' | 'share' | 'grant' | 'export';

type AclCheckResult = {
  allowed: boolean;
  reason: 'owner' | 'shared' | 'granted' | 'role' | 'denied';
};

/**
 * ACL 资源级授权检查
 *
 * 检查顺序：owner → shared → granted → role-based
 * - owner: 用户是资源所有者
 * - shared: document_share 表中有对该用户的分享记录
 * - granted: knowledge_grant 表中有对该用户的授权记录
 * - role: 用户角色权限码匹配（如 document.view / knowledge.view）
 */
export async function checkAcl(
  user: SessionUser,
  resourceType: AclResourceType,
  resourceId: string,
  action: AclAction,
): Promise<AclCheckResult> {
  // 1. owner 检查
  const ownerResult = await checkOwner(user, resourceType, resourceId);
  if (ownerResult) {
    return { allowed: true, reason: 'owner' };
  }

  // 2. shared / granted 检查
  if (resourceType === 'document') {
    const sharedResult = await checkDocumentShare(user, resourceId, action);
    if (sharedResult) {
      return { allowed: true, reason: 'shared' };
    }
  }

  if (resourceType === 'knowledge_base') {
    const grantedResult = await checkKnowledgeGrant(user, resourceId, action);
    if (grantedResult) {
      return { allowed: true, reason: 'granted' };
    }
  }

  // 3. role-based 检查
  const permCode = mapActionToPermission(resourceType, action);
  if (permCode && (user.permissions.includes(permCode) || user.permissions.includes('*'))) {
    return { allowed: true, reason: 'role' };
  }

  return { allowed: false, reason: 'denied' };
}

async function checkOwner(
  user: SessionUser,
  resourceType: AclResourceType,
  resourceId: string,
): Promise<boolean> {
  const db = await getSupabaseClient();
  const table = resourceType === 'document' ? 'document' : 'knowledge_base';
  const ownerField = 'owner_id';

  const { data } = await db
    .from(table)
    .select(ownerField)
    .eq('id', resourceId)
    .eq('tenant_id', user.tenantId)
    .limit(1);

  const row = data?.[0];
  if (!row) return false;

  const ownerId = row[ownerField] as string | null;
  return ownerId === user.id;
}

async function checkDocumentShare(
  user: SessionUser,
  documentId: string,
  action: AclAction,
): Promise<boolean> {
  const db = await getSupabaseClient();

  const { data } = await db
    .from('document_share')
    .select('target_type,target_id,permission')
    .eq('document_id', documentId)
    .eq('tenant_id', user.tenantId);

  if (!data || data.length === 0) return false;

  const requiredPerm = actionToSharePermission(action);
  if (!requiredPerm) return false;

  for (const share of data) {
    const targetType = share.target_type as string;
    const targetId = share.target_id as string;
    const permission = share.permission as string;

    if (permissionLevel(permission) < permissionLevel(requiredPerm)) {
      continue;
    }

    if (targetType === 'user' && targetId === user.id) {
      return true;
    }

    if (targetType === 'org' && targetId === user.orgUnitId) {
      return true;
    }

    if (targetType === 'role' && targetId === user.roleCode) {
      return true;
    }
  }

  return false;
}

async function checkKnowledgeGrant(
  user: SessionUser,
  kbId: string,
  action: AclAction,
): Promise<boolean> {
  const db = await getSupabaseClient();

  const { data } = await db
    .from('knowledge_grant')
    .select('target_type,target_id,permission')
    .eq('kb_id', kbId)
    .eq('tenant_id', user.tenantId);

  if (!data || data.length === 0) return false;

  const requiredPerm = actionToGrantPermission(action);
  if (!requiredPerm) return false;

  for (const grant of data) {
    const targetType = grant.target_type as string;
    const targetId = grant.target_id as string;
    const permission = grant.permission as string;

    if (permissionLevel(permission) < permissionLevel(requiredPerm)) {
      continue;
    }

    if (targetType === 'user' && targetId === user.id) {
      return true;
    }

    if (targetType === 'org' && targetId === user.orgUnitId) {
      return true;
    }

    if (targetType === 'role' && targetId === user.roleCode) {
      return true;
    }
  }

  return false;
}

function mapActionToPermission(
  resourceType: AclResourceType,
  action: AclAction,
): string | null {
  if (resourceType === 'document') {
    switch (action) {
      case 'view': return 'document.view';
      case 'edit': return 'document.edit';
      case 'delete': return 'document.delete';
      case 'share': return 'document.share';
      case 'export': return 'document.export';
      default: return null;
    }
  }

  if (resourceType === 'knowledge_base') {
    switch (action) {
      case 'view': return 'knowledge.view';
      case 'edit': return 'knowledge.edit';
      case 'delete': return 'knowledge.delete';
      case 'grant': return 'knowledge.grant';
      default: return null;
    }
  }

  return null;
}

function actionToSharePermission(action: AclAction): string | null {
  switch (action) {
    case 'view': return 'view';
    case 'edit': return 'edit';
    case 'delete': return 'edit';
    case 'share': return 'edit';
    case 'export': return 'view';
    default: return null;
  }
}

function actionToGrantPermission(action: AclAction): string | null {
  switch (action) {
    case 'view': return 'view';
    case 'edit': return 'edit';
    case 'delete': return 'edit';
    case 'grant': return 'edit';
    default: return null;
  }
}

function permissionLevel(perm: string): number {
  switch (perm) {
    case 'view': return 1;
    case 'edit': return 2;
    case 'manage': return 3;
    default: return 0;
  }
}