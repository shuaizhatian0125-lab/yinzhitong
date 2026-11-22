'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FileText, Building2, ClipboardList, BookOpen,
  TrendingUp, AlertCircle, Sparkles, ArrowRight,
  CheckCircle2, Clock, ChevronRight,
} from 'lucide-react';
import { CommandInput } from '@/components/domain/CommandInput';

const QUICK_ACTIONS = [
  { icon: FileText, label: '写周报', description: '生成本周工作总结', color: '#cc0000', tint: '#fbeeee', message: '请帮我生成本周工作总结' },
  { icon: Building2, label: '分析企业', description: '企业全景与价值评估', color: '#55677a', tint: '#eef1f4', message: '请帮我分析企业财务状况' },
  { icon: ClipboardList, label: '生成纪要', description: '会议纪要自动整理', color: '#b08a4a', tint: '#f7f1e6', message: '请帮我生成会议纪要' },
  { icon: BookOpen, label: '查制度', description: '制度文件智能检索', color: '#1e7b4f', tint: '#edf7f1', message: '请帮我查询最新制度文件' },
];

const TODO_ITEMS = [
  { id: '1', title: '审批：某企业授信申请', priority: 'high', dueTime: '今日 14:00' },
  { id: '2', title: '完成本周客户拜访记录', priority: 'medium', dueTime: '今日 17:00' },
  { id: '3', title: '审核：AI生成的行业报告', priority: 'medium', dueTime: '明日 09:00' },
  { id: '4', title: '提交月度经营分析数据', priority: 'low', dueTime: '本周五' },
];

const AI_SUGGESTIONS = [
  {
    type: 'opportunity',
    icon: TrendingUp,
    label: 'AI 建议',
    color: '#cc0000',
    tint: '#fbeeee',
    content: '检测到3家企业近期有融资动态，建议主动跟进。',
    action: '查看详情',
    href: '/centers/enterprise',
  },
  {
    type: 'risk',
    icon: AlertCircle,
    label: '风险提醒',
    color: '#b26a00',
    tint: '#fdf4e7',
    content: '某客户贷款即将到期，请及时安排续贷流程。',
    action: '处理',
    href: '/centers/risk',
  },
];

const RECENT_RESULTS = [
  { id: '1', title: '北京AI产业研究报告', type: '行业研究', time: '2小时前', color: '#cc0000', href: '/centers/research' },
  { id: '2', title: '某企业财务分析摘要', type: '企业分析', time: '昨日', color: '#55677a', href: '/centers/enterprise' },
  { id: '3', title: '本周工作总结（草稿）', type: '文档生成', time: '3天前', color: '#b08a4a', href: '/centers/office' },
];

const PRIORITY_CONFIG = {
  high: { color: '#b42318', label: '紧急' },
  medium: { color: '#b26a00', label: '重要' },
  low: { color: '#8a97a8', label: '一般' },
};

export default function WorkbenchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [greeting, setGreeting] = React.useState('');
  const [dateStr, setDateStr] = React.useState('');
  const [mounted, setMounted] = React.useState(false);
  const [creatingConv, setCreatingConv] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const now = new Date();
    const hour = now.getHours();
    const greet = hour < 12 ? '上午好' : hour < 18 ? '下午好' : '晚上好';
    setGreeting(greet);
    setDateStr(
      now.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      })
    );
  }, []);

  const handleQuickAction = (message: string) => {
    startConversationWithMessage(message);
  };

  const startConversationWithMessage = async (message: string) => {
    if (creatingConv) return;
    setCreatingConv(true);
    try {
      const res = await fetch('/api/v1/ai/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: message.slice(0, 20) }),
      });
      const json = await res.json();
      if (json.code === 0 && json.data?.id) {
        const convId = json.data.id;
        await fetch(`/api/v1/ai/conversations/${convId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: message }),
        });
        router.push(`/workbench/c/${convId}`);
      }
    } catch {
      // ignore
    } finally {
      setCreatingConv(false);
    }
  };

  React.useEffect(() => {
    const initialMessage = searchParams.get('initialMessage');
    if (initialMessage && mounted) {
      startConversationWithMessage(initialMessage);
    }
  }, [searchParams, mounted]);

  const handleTodoClick = (todoId: string) => {
    router.push(`/work/tasks/${todoId}`);
  };

  const handleSuggestionClick = (href: string) => {
    router.push(href);
  };

  const handleResultClick = (href: string) => {
    router.push(href);
  };

  const handleViewAllResults = () => {
    router.push('/centers/office');
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Hero 区域：问候 + 日期 */}
      <div
        className="relative overflow-hidden rounded-[8px] px-5 py-5 md:px-8 md:py-7"
        style={{
          background: 'linear-gradient(135deg, #cc0000 0%, #e02b2b 100%)',
          boxShadow: '0 4px 24px rgba(204, 0, 0, 0.12)',
        }}
      >
        {/* 装饰性光效 */}
        <div
          className="absolute -right-20 -top-20 h-48 w-48 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(176, 138, 74, 0.15) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute -right-10 bottom-0 h-32 w-32 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(31, 111, 178, 0.2) 0%, transparent 70%)',
          }}
        />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: '#b08a4a' }} />
              <span className="text-[12px] font-medium tracking-wide" style={{ color: 'rgba(255,255,255,0.7)' }}>
                银智通 · AI智能工作平台
              </span>
            </div>
            <h1 className="text-[22px] md:text-[26px] font-semibold leading-tight" style={{ color: '#ffffff' }}>
              {mounted ? greeting : '你好'}，欢迎回来
            </h1>
            <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {mounted ? dateStr : ''}
            </p>
          </div>

          <div className="flex items-center gap-4 md:gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>今日待办</span>
              <span className="text-[20px] md:text-[22px] font-semibold" style={{ color: '#ffffff' }}>{TODO_ITEMS.length}</span>
            </div>
            <div className="h-8 w-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <div className="flex flex-col items-end">
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>AI成果</span>
              <span className="text-[20px] md:text-[22px] font-semibold" style={{ color: '#b08a4a' }}>{RECENT_RESULTS.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI 指令台 */}
      <div
        className="rounded-[8px] px-4 py-4 md:px-6 md:py-5"
        style={{
          background: '#ffffff',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.03)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div className="mb-3 flex items-center gap-2">
          <div
            className="flex h-6 w-6 items-center justify-center rounded-[4px]"
            style={{ background: '#fbeeee' }}
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: '#cc0000' }} />
          </div>
          <span className="text-[14px] font-semibold" style={{ color: '#0f172a' }}>
            AI 指令台
          </span>
          <span className="text-[12px]" style={{ color: '#8a97a8' }}>
            自然语言发起任务，AI 自动执行
          </span>
        </div>
        <CommandInput />
      </div>

      {/* 快捷入口 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action.message)}
              disabled={creatingConv}
              className="group flex flex-col items-center gap-2 md:gap-3 px-3 py-4 md:px-4 md:py-5 rounded-[8px] transition-all duration-300 min-h-[44px]"
              style={{
                background: '#ffffff',
                boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
                border: '1px solid #e2e8f0',
                opacity: creatingConv ? 0.6 : 1,
                cursor: creatingConv ? 'wait' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!creatingConv) {
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(0, 0, 0, 0.04)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = action.color;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.03)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-[8px] transition-transform duration-300 group-hover:scale-110"
                style={{ background: action.tint }}
              >
                <Icon className="h-5 w-5" style={{ color: action.color }} />
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[14px] font-medium" style={{ color: '#0f172a' }}>{action.label}</span>
                <span className="text-[12px]" style={{ color: '#8a97a8' }}>{action.description}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 左：今日待办 + 右：AI主动提示 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {/* 今日待办 */}
        <div
          className="rounded-[8px]"
          style={{
            background: '#ffffff',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
            border: '1px solid #e2e8f0',
          }}
        >
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2">
              <div
                className="h-4 w-1 rounded-[1px]"
                style={{ background: '#cc0000' }}
              />
              <span className="text-[15px] font-semibold" style={{ color: '#0f172a' }}>今日待办</span>
            </div>
            <button
              onClick={() => router.push('/work/tasks')}
              className="text-[12px] flex items-center gap-0.5 transition-colors"
              style={{ color: '#475569' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#cc0000'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#475569'; }}
            >
              查看全部
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          <div className="px-3 pb-3">
            {TODO_ITEMS.map((todo, idx) => {
              const priority = PRIORITY_CONFIG[todo.priority as keyof typeof PRIORITY_CONFIG];
              return (
                <div
                  key={todo.id}
                  onClick={() => handleTodoClick(todo.id)}
                  className="group flex items-center gap-3 px-3 py-3 rounded-[4px] transition-colors cursor-pointer"
                  style={{
                    borderBottom: idx < TODO_ITEMS.length - 1 ? '1px solid #f1f5f9' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ background: priority.color }}
                  />
                  <span
                    className="text-[11px] px-1.5 py-0.5 rounded-[2px] shrink-0 font-medium"
                    style={{ background: `${priority.color}15`, color: priority.color }}
                  >
                    {priority.label}
                  </span>
                  <span className="flex-1 text-[13px] truncate" style={{ color: '#0f172a' }}>{todo.title}</span>
                  <span className="text-[12px] shrink-0 flex items-center gap-0.5" style={{ color: '#8a97a8' }}>
                    <Clock className="h-3 w-3" />
                    {todo.dueTime}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI 主动提示 */}
        <div
          className="rounded-[8px]"
          style={{
            background: '#ffffff',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
            border: '1px solid #e2e8f0',
          }}
        >
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2">
              <div
                className="h-4 w-1 rounded-[1px]"
                style={{ background: '#b08a4a' }}
              />
              <span className="text-[15px] font-semibold" style={{ color: '#0f172a' }}>AI 主动提示</span>
            </div>
            <span
              className="text-[11px] px-2 py-0.5 rounded-[2px] font-medium flex items-center gap-1"
              style={{ background: '#fbeeee', color: '#cc0000' }}
            >
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: '#cc0000' }} />
              实时
            </span>
          </div>

          <div className="px-4 pb-4 flex flex-col gap-3">
            {AI_SUGGESTIONS.map((suggestion, idx) => {
              const Icon = suggestion.icon;
              return (
                <div
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion.href)}
                  className="group rounded-[6px] px-4 py-3 transition-all duration-300 cursor-pointer"
                  style={{
                    background: suggestion.tint,
                    border: `1px solid ${suggestion.color}20`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = `0 4px 12px ${suggestion.color}15`;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon className="h-3.5 w-3.5" style={{ color: suggestion.color }} />
                    <span className="text-[12px] font-semibold" style={{ color: suggestion.color }}>
                      {suggestion.label}
                    </span>
                  </div>
                  <p className="text-[13px] leading-relaxed mb-2" style={{ color: '#0f172a' }}>
                    {suggestion.content}
                  </p>
                  <div className="flex items-center gap-1 text-[12px] font-medium" style={{ color: suggestion.color }}>
                    {suggestion.action}
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 最近 AI 成果 */}
      <div
        className="rounded-[8px]"
        style={{
          background: '#ffffff',
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <div
              className="h-4 w-1 rounded-[1px]"
              style={{ background: '#1e7b4f' }}
            />
            <span className="text-[15px] font-semibold" style={{ color: '#0f172a' }}>最近 AI 成果</span>
          </div>
          <button
            onClick={handleViewAllResults}
            className="text-[12px] flex items-center gap-0.5 transition-colors"
            style={{ color: '#475569' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#cc0000';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#475569';
            }}
          >
            查看全部
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        <div className="px-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {RECENT_RESULTS.map((item) => (
              <div
                key={item.id}
                onClick={() => handleResultClick(item.href)}
                className="group rounded-[6px] px-4 py-3 transition-all duration-300 cursor-pointer"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.borderColor = item.color;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-[11px] px-1.5 py-0.5 rounded-[2px] font-medium"
                    style={{ background: `${item.color}15`, color: item.color }}
                  >
                    {item.type}
                  </span>
                  <span className="text-[11px]" style={{ color: '#8a97a8' }}>{item.time}</span>
                </div>
                <p className="text-[13px] font-medium truncate" style={{ color: '#0f172a' }}>
                  {item.title}
                </p>
                <div className="flex items-center gap-1 text-[11px] mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: item.color }}>
                  查看详情
                  <ArrowRight className="h-2.5 w-2.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}