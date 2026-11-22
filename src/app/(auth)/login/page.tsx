'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => null);
      const token = data?.code === 0 ? data?.data?.access_token : undefined;
      if (!res.ok || !token) {
        setError(data?.message ?? '登录失败');
        return;
      }

      /**
       * 全站十几处 fetch 都从 localStorage 取 access_token 拼 Authorization 头，
       * 而登录只做了跳转、没落这个键 —— 结果所有需要鉴权的接口都返回 401，
       * 页面把它渲染成"暂无数据"，看起来像数据缺失，其实是没带上身份。
       */
      window.localStorage.setItem('access_token', token);
      // 令牌过期被接口弹回来时带上 next，登录后回到原来那一页，而不是把人丢在工作台。
      // 只认站内相对路径：// 开头会被浏览器当成另一台主机。
      const next = new URLSearchParams(window.location.search).get('next') ?? '';
      router.push(next.startsWith('/') && !next.startsWith('//') ? next : '/workbench');
    } catch {
      setError('网络异常，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: 'var(--bz-bg)' }}
    >
      <div className="w-full max-w-[400px]">
        {/* Logo 与标题 */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-[6px] text-white text-xl font-bold"
            style={{ background: 'var(--bz-brand)' }}
          >
            银
          </div>
          <div className="text-center">
            <h1 className="text-[22px] font-semibold text-[var(--bz-text)]">银智通</h1>
            <p className="text-[13px] text-[var(--bz-text-sub)] mt-1">
              面向银行业的AI原生智能工作平台
            </p>
          </div>
        </div>

        {/* 登录卡片 */}
        <Card className="bz-card" style={{ borderRadius: 8, boxShadow: '0 4px 24px rgba(204, 0, 0,0.08)' }}>
          <CardHeader className="pb-4">
            <CardTitle className="text-[16px]">登录</CardTitle>
            <CardDescription className="text-[13px]">
              欢迎使用银智通智能银行工作台
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="username" className="bz-label">用户名</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  required
                  className="h-9"
                  style={{ borderRadius: 4 }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password" className="bz-label">密码</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  required
                  className="h-9"
                  style={{ borderRadius: 4 }}
                />
              </div>

              {error && (
                <div
                  className="rounded px-3 py-2 text-[13px]"
                  style={{
                    background: '#fdf0ef',
                    color: 'var(--bz-danger)',
                    border: '1px solid #f2cfcc',
                    borderRadius: 4,
                  }}
                >
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="h-9 w-full"
                style={{
                  background: 'var(--bz-brand)',
                  borderRadius: 4,
                }}
              >
                {loading ? '登录中…' : '登录'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-[12px] text-[var(--bz-text-muted)]">
          银智通 · Bank AI OS — 让银行业务更智能、更高效
        </p>

        <div className="mt-4 rounded border border-[var(--bz-border)] bg-[var(--bz-bg-secondary)] p-3 text-[12px] text-[var(--bz-text-sub)]" style={{ borderRadius: 6 }}>
          <p className="font-medium text-[var(--bz-text)] mb-2">测试账号（演示模式）</p>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span>管理员</span>
              <span className="font-mono">admin / admin123</span>
            </div>
            <div className="flex justify-between">
              <span>部门负责人</span>
              <span className="font-mono">manager / manager123</span>
            </div>
            <div className="flex justify-between">
              <span>客户经理</span>
              <span className="font-mono">staff / staff123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}