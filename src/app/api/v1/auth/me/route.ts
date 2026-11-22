import { NextRequest } from 'next/server';
import { getApiUser } from '@/lib/api-auth';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { enabledModules } from '@/lib/config';
import { CENTERS } from '@/lib/permissions';

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getApiUser(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未认证或认证已过期'), 401);
  }

  const menus = CENTERS.filter((c) => enabledModules.includes(c.code));

  return jsonResponse(
    success({
      user: {
        id: user.id,
        tenantId: user.tenantId,
        tenantName: user.tenantName,
        username: user.username,
        displayName: user.displayName,
        title: user.title,
        roleCode: user.roleCode,
        roleName: user.roleName,
        orgUnitId: user.orgUnitId,
        orgName: user.orgName,
        dataScope: user.dataScope,
      },
      permissions: user.permissions,
      menus,
      enabledModules,
    }),
  );
}