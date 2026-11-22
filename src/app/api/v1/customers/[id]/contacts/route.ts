import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error, ErrorCode, jsonResponse } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { createContact, listContacts } from '@/server/modules/customer/contact-service';

const createSchema = z.object({
  name: z.string().min(1, '联系人姓名不能为空'),
  title: z.string().optional(),
  mobile_enc: z.string().optional(),
  email: z.string().email('邮箱格式不正确').optional(),
  decision_role: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { id: customerId } = await params;

  try {
    const contacts = await listContacts(user.tenantId, customerId);
    return jsonResponse(success(contacts));
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询联系人失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const { id: customerId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(error(ErrorCode.BAD_REQUEST, '请求体格式错误'), 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      error(ErrorCode.BAD_REQUEST, '参数校验失败', {
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      }),
      400,
    );
  }

  try {
    const contact = await createContact(user.tenantId, {
      customerId,
      name: parsed.data.name,
      title: parsed.data.title,
      mobileEnc: parsed.data.mobile_enc,
      email: parsed.data.email,
      decisionRole: parsed.data.decision_role,
    });
    return jsonResponse(success(contact), 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : '创建联系人失败';
    return jsonResponse(error(ErrorCode.INTERNAL_ERROR, message), 500);
  }
}