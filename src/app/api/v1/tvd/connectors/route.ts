import { NextRequest } from 'next/server';
import { error, ErrorCode, jsonResponse, success } from '@/lib/api-response';
import { getCurrentUserFromJwt } from '@/lib/auth';
import { getTvdDb } from '@/storage/database/tvd/client';
import { signalTypeEnum } from '@/storage/database/tvd';
import { describeConnectors } from '@/server/modules/tvd-data/connectors/registry';
import { getSignalTypeCoverage } from '@/server/modules/tvd-data/stats';
import { resolveTvdScope } from '@/server/modules/tvd-data/scope';

/**
 * 数据源接入目录（PRD：无法接入的外部数据源要有标准 Connector 接口）。
 *
 * 这个接口存在的意义是把"哪些维度是真的、哪些是演示值、哪些根本没接"
 * 变成可查询的结构化数据，前端不必写死文案，评审也不会看到
 * "看起来接了很多源、其实一个都没接"的落差。
 */
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getCurrentUserFromJwt(request);
  if (!user) {
    return jsonResponse(error(ErrorCode.UNAUTHORIZED, '未登录或登录已过期'), 401);
  }

  const scope = resolveTvdScope(user);
  const handle = await getTvdDb();

  const [connectors, coverage] = await Promise.all([
    describeConnectors(),
    getSignalTypeCoverage(scope, handle),
  ]);

  const availableSignalTypes = new Set<string>(
    connectors.filter((c) => c.status === 'available').flatMap((c) => c.signal_types),
  );
  const storedSignalTypes = new Set(coverage.map((r) => r.signal_type));
  /** 缺口按全部信号类型算，只比"已声明 + 已落库"会漏掉那些一条数据都没有的维度。 */
  const allSignalTypes: string[] = signalTypeEnum.enumValues;

  return jsonResponse(
    success({
      backend: handle.kind,
      is_demo: true,
      connectors,
      coverage,
      covered_signal_types: allSignalTypes.filter((t) => availableSignalTypes.has(t) && storedSignalTypes.has(t)),
      gaps: allSignalTypes.filter((t) => !availableSignalTypes.has(t) || !storedSignalTypes.has(t)),
    }),
  );
}
