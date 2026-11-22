import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { updateContact, deleteContact } from '@/server/modules/customer/contact-service';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  title: z.string().optional(),
  mobile_enc: z.string().optional(),
  email: z.string().email('邮箱格式不正确').optional(),
  decision_role: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { contactId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    const updated = await updateContact(user.tenantId, contactId, {
      name: parsed.data.name,
      title: parsed.data.title,
      mobileEnc: parsed.data.mobile_enc,
      email: parsed.data.email,
      decisionRole: parsed.data.decision_role,
    });

    if (!updated) {
      return jsonResponse(error(ErrorCode.NOT_FOUND, '联系人不存在'), 404);
    }

    return jsonResponse(success(updated));
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新联系人失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { contactId } = await params;

  try {
    await deleteContact(user.tenantId, contactId);
    return jsonResponse(success(null));
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除联系人失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}