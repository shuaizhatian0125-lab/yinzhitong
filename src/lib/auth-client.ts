'use client';

/**
 * 浏览器侧统一的带身份请求。
 *
 * 之前每个页面各自 `fetch` + 各自读 localStorage：令牌过期时页面只回一句
 * "读不到数据"，人留在原地反复刷新。这里集中做两件事 —— 拼 Authorization 头，
 * 以及在 401 时清掉失效令牌并告诉调用方"该去登录了"。
 * 跳转留给页面用 useRouter 做：模块里直接改 window.location 会绕掉 Next 的客户端路由。
 */

const TOKEN_KEY = 'access_token';

export function readToken(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(TOKEN_KEY) ?? '';
}

export function clearToken(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(TOKEN_KEY);
}

/** 登录后该回哪一页：只认站内相对路径，// 开头会被浏览器当成另一台主机。 */
export function loginUrl(currentPath?: string): string {
  const here = currentPath ?? (typeof window === 'undefined' ? '' : window.location.pathname + window.location.search);
  const next = here.startsWith('/') && !here.startsWith('//') ? `?next=${encodeURIComponent(here)}` : '';
  return `/login${next}`;
}

export type AuthFetchResult<T = unknown> = {
  ok: boolean;
  /** true 表示令牌已失效且已被清掉，调用方应当跳登录页，而不是渲染"暂无数据"。 */
  unauthorized: boolean;
  /**
   * HTTP 状态码（网络失败时为 0）。
   * 页面需要它来区分"404 这条记录不存在"和"500 服务出错"：
   * 把两者都渲染成"暂无数据"，就等于把故障说成空集。
   */
  status: number;
  data?: T;
  message?: string;
};

export async function authFetch<T = Record<string, unknown>>(
  path: string,
  init?: RequestInit,
): Promise<AuthFetchResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${readToken()}` },
    });
  } catch (err) {
    return { ok: false, unauthorized: false, status: 0, message: err instanceof Error ? err.message : '接口不可用' };
  }

  if (res.status === 401) {
    clearToken();
    return { ok: false, unauthorized: true, status: 401, message: '登录状态已失效，请重新登录。' };
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.code !== 0) {
    return {
      ok: false,
      unauthorized: false,
      status: res.status,
      message: json?.message ?? `接口返回异常（HTTP ${res.status}）`,
    };
  }
  return { ok: true, unauthorized: false, status: res.status, data: json.data as T };
}
