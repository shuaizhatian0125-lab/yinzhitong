'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput as CmdInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CENTERS } from '@/lib/permissions';

const PLACEHOLDER_EXAMPLES = [
  '研究北京AI产业',
  '写本周工作总结',
  '分析某企业财务状况',
  '生成会议纪要',
  '查询最新制度文件',
];

type MentionItem = {
  label: string;
  type: 'enterprise' | 'customer' | 'document' | 'knowledge';
  description: string;
};

const MENTION_ITEMS: MentionItem[] = [
  { label: '企业', type: 'enterprise', description: '引用企业客户档案' },
  { label: '客户', type: 'customer', description: '引用个人客户信息' },
  { label: '文档', type: 'document', description: '引用行内文档' },
  { label: '知识', type: 'knowledge', description: '引用知识库条目' },
];

export function CommandInput() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState('');
  const [mode, setMode] = React.useState<'normal' | 'command' | 'mention'>('normal');
  const [placeholderIdx, setPlaceholderIdx] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx((prev) => (prev + 1) % PLACEHOLDER_EXAMPLES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (value.startsWith('/')) setMode('command');
    else if (value.startsWith('@')) setMode('mention');
    else setMode('normal');
  }, [value]);

  const handleSubmit = async (msg: string) => {
    if (!msg.trim()) return;
    setOpen(false);
    setValue('');
    try {
      const res = await fetch('/api/v1/ai/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: msg.slice(0, 20) }),
      });
      const json = await res.json();
      if (json.code === 0 && json.data?.id) {
        const convId = json.data.id;
        await fetch(`/api/v1/ai/conversations/${convId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: msg }),
        });
        router.push(`/workbench/c/${convId}`);
      }
    } catch {
      // ignore
    }
  };

  const handleSelectCenter = (centerCode: string) => {
    handleSubmit(`/${centerCode} `);
  };

  const handleSelectMention = (mention: MentionItem) => {
    setValue((prev) => `@${mention.label} `);
    setOpen(true);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className="flex h-9 w-full items-center gap-2 rounded-[6px] border px-3 cursor-text transition-all duration-200 focus-within:border-[var(--bz-brand)] focus-within:shadow-[0_0_0_3px_rgba(204, 0, 0,0.08)]"
          style={{
            background: 'var(--bz-bg)',
            borderColor: 'var(--bz-line-strong)',
          }}
        >
          <Sparkles className="h-4 w-4 shrink-0" style={{ color: 'var(--bz-brand)' }} />
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit(value);
              }
              if (e.key === 'Escape') {
                setOpen(false);
                setValue('');
              }
            }}
            placeholder={`输入指令… 例如：${PLACEHOLDER_EXAMPLES[placeholderIdx]}`}
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--bz-text-muted)]"
          />
          <kbd className="text-[10px] text-[var(--bz-text-muted)] border rounded-[4px] px-1.5 py-0.5" style={{ borderColor: 'var(--bz-line)' }}>
            / 唤起 · @ 引用
          </kbd>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[480px] p-0 rounded-[8px]" align="center">
        <Command shouldFilter={false}>
          {mode === 'command' && (
            <>
              <CmdInput placeholder="选择工作中心…" value={value.slice(1)} onValueChange={() => {}} />
              <CommandList>
                <CommandEmpty>无匹配工作中心</CommandEmpty>
                <CommandGroup heading="12大工作中心">
                  {CENTERS.map((center) => (
                    <CommandItem
                      key={center.code}
                      onSelect={() => handleSelectCenter(center.code)}
                      className="flex items-center justify-between"
                    >
                      <span className="font-medium">{center.name}</span>
                      <span className="text-xs text-[var(--bz-text-muted)]">{center.group}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </>
          )}
          {mode === 'mention' && (
            <>
              <CmdInput placeholder="选择引用对象…" value={value.slice(1)} onValueChange={() => {}} />
              <CommandList>
                <CommandEmpty>无匹配对象</CommandEmpty>
                <CommandGroup heading="可引用对象">
                  {MENTION_ITEMS.map((item) => (
                    <CommandItem
                      key={item.type}
                      onSelect={() => handleSelectMention(item)}
                      className="flex items-center justify-between"
                    >
                      <span className="font-medium">@{item.label}</span>
                      <span className="text-xs text-[var(--bz-text-muted)]">{item.description}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </>
          )}
          {mode === 'normal' && (
            <CommandList>
              <CommandGroup heading="快捷指令">
                {PLACEHOLDER_EXAMPLES.map((example) => (
                  <CommandItem
                    key={example}
                    onSelect={() => handleSubmit(example)}
                  >
                    <Search className="mr-2 h-4 w-4 opacity-50" />
                    {example}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="提示">
                <CommandItem disabled>
                  输入 <span className="font-mono mx-1">/</span> 唤起工作中心列表
                </CommandItem>
                <CommandItem disabled>
                  输入 <span className="font-mono mx-1">@</span> 引用企业、客户、文档等对象
                </CommandItem>
              </CommandGroup>
            </CommandList>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}