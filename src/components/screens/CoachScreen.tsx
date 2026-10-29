'use client';

import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Sparkles, TrendingUp } from 'lucide-react';
import { useTma } from '@/components/tma-provider';
import Screen from '@/components/ui/Screen';
import Segmented from '@/components/ui/Segmented';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useCoach } from '@/hooks/use-app-data';
import { cn } from '@/lib/cn';

type PeriodId = '7' | '14' | '30';

const PERIODS: { id: PeriodId; label: string }[] = [
  { id: '7', label: '7 дней' },
  { id: '14', label: '14 дней' },
  { id: '30', label: '30 дней' },
];

function Section({
  title,
  icon,
  tone,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  tone: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="mb-4 rounded-2xl bg-card p-4">
      <h3 className={cn('mb-3 flex items-center gap-2 text-headline font-semibold', tone)}>
        {icon}
        {title}
      </h3>
      <ul className="space-y-2.5">
        {items.map((text, i) => (
          <li key={i} className="flex gap-2.5 text-callout">
            <span className={cn('mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-current', tone)} />
            <span className="text-label">{text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CoachScreen() {
  const { hapticNotification } = useTma();
  const toast = useToast();
  const [period, setPeriod] = useState<PeriodId>('7');

  const coach = useCoach(Number(period) as 7 | 14 | 30);
  const result = coach.data;

  const generate = async () => {
    const res = await coach.refetch();
    if (res.error) {
      hapticNotification('error');
      toast({ kind: 'error', message: `Не удалось получить разбор: ${(res.error as Error).message}` });
    } else {
      hapticNotification('success');
    }
  };

  return (
    <Screen title="Диетолог">
      <Segmented options={PERIODS} value={period} onChange={setPeriod} className="mb-4" />

      {!result && !coach.isFetching && (
        <section className="mb-4 rounded-2xl bg-card px-6 py-8 text-center">
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo text-white">
            <Sparkles size={32} />
          </span>
          <h2 className="mb-1 text-title2 font-bold">Разбор вашего питания</h2>
          <p className="mb-6 text-callout text-label2">
            ИИ-диетолог посмотрит записи за выбранный период и подскажет, что получается хорошо и что стоит поправить.
          </p>
          <Button onClick={generate}>Получить разбор</Button>
        </section>
      )}

      {coach.isFetching && (
        <section className="mb-4 rounded-2xl bg-card px-6 py-12 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-indigo text-white">
            <Sparkles size={28} />
          </span>
          <p className="text-callout text-label2">Анализируем ваши записи…</p>
        </section>
      )}

      {result && !coach.isFetching && (
        <>
          <section className="mb-4 rounded-2xl bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-caption font-semibold',
                  result.source === 'ai' ? 'bg-indigo/15 text-indigo' : 'bg-fill text-label2'
                )}
              >
                {result.source === 'ai' ? 'ИИ' : 'Автоматический расчёт'}
              </span>
              <span className="text-caption text-label2">
                Дней с записями: {result.summary.loggedDays} из {result.summary.days}
              </span>
            </div>
            <h2 className="mb-1.5 text-title2 font-bold">{result.report.headline}</h2>
            <p className="text-callout text-label2">{result.report.summary}</p>
          </section>

          <Section
            title="Получается хорошо"
            icon={<CheckCircle2 size={20} />}
            tone="text-success"
            items={result.report.wins}
          />
          <Section
            title="Что улучшить"
            icon={<TrendingUp size={20} />}
            tone="text-orange"
            items={result.report.improvements}
          />
          <Section
            title="Следующие шаги"
            icon={<ArrowRight size={20} />}
            tone="text-accent"
            items={result.report.next_steps}
          />

          <Button variant="gray" onClick={generate}>
            Обновить разбор
          </Button>
        </>
      )}

      <p className="mt-6 px-4 text-center text-footnote text-label2">
        Это общие рекомендации по питанию, а не медицинская консультация. При проблемах со здоровьем обратитесь к врачу.
      </p>
    </Screen>
  );
}
