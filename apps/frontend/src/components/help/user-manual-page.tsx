'use client';

import { Fragment, type ReactNode, useMemo, useState } from 'react';
import Image from 'next/image';
import { BookOpen, CheckCircle2, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getManualsForUser, manualAssetPath, type ManualId } from '@/content/manuals';
import type { ManualBlock, ManualContent } from '@/content/manuals/types';
import { useSession } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

export function UserManualPage({ initialManual }: { initialManual?: string }) {
  const t = useTranslations('help');
  const session = useSession();
  const manuals = getManualsForUser(session.data?.user);
  const [selectedId, setSelectedId] = useState<ManualId | undefined>(
    manuals.find((manual) => manual.id === initialManual)?.id,
  );
  const selected = manuals.find((manual) => manual.id === selectedId) ?? manuals[0];

  if (!selected) {
    return <EmptyState icon={BookOpen} title={t('noManualTitle')} description={t('noManualDescription')} />;
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {manuals.length > 1 ? (
        <Tabs value={selected.id} onValueChange={(value) => setSelectedId(value as ManualId)}>
          <TabsList className="h-auto flex-wrap">
            {manuals.map((manual) => (
              <TabsTrigger key={manual.id} value={manual.id}>{manual.content.title.replace(/^TAMS\s+/, '')}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}
      <ManualView key={selected.id} manual={selected.content} />
    </div>
  );
}

function ManualView({ manual }: { manual: ManualContent }) {
  const t = useTranslations('help');
  const sections = useMemo(() => splitSections(manual.blocks), [manual.blocks]);

  const scrollTo = (index: number) => {
    document.getElementById(sectionAnchor(index))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-lg">
        <CardContent className="p-4">
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-semibold">{manual.title}</h2>
            <p className="text-sm text-muted-foreground">{manual.summary}</p>
            <Badge variant="secondary">{manual.audience}</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label={t('contents')} className="lg:sticky lg:top-0 lg:self-start">
          <Card className="rounded-lg">
            <CardContent className="p-3">
              <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('contents')}</p>
              <ol className="max-h-[70vh] space-y-0.5 overflow-auto">
                {sections.map((section, index) => (
                  <li key={section.title}>
                    <button
                      type="button"
                      onClick={() => scrollTo(index)}
                      className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    >
                      {index + 1}. {section.title}
                    </button>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          {sections.map((section, index) => (
            <Card key={section.title} id={sectionAnchor(index)} className="scroll-mt-4 rounded-lg">
              <CardContent className="space-y-4 p-4 sm:p-6">
                <h2 className="text-xl font-semibold">{index + 1}. {section.title}</h2>
                {section.blocks.map((block, blockIndex) => (
                  <ManualBlockView key={blockIndex} block={block} manualId={manual.id} />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function ManualBlockView({ block, manualId }: { block: ManualBlock; manualId: string }) {
  const t = useTranslations('help');
  switch (block.type) {
    case 'h1':
      return null;
    case 'h2':
      return <h3 className="pt-2 text-base font-semibold">{block.text}</h3>;
    case 'p':
      return <p className="text-sm leading-6">{renderInline(block.text)}</p>;
    case 'steps':
      return (
        <ol className="list-decimal space-y-1.5 pl-6 text-sm leading-6 marker:font-semibold">
          {block.items.map((item) => <li key={item}>{renderInline(item)}</li>)}
        </ol>
      );
    case 'bullets':
      return (
        <ul className="list-disc space-y-1.5 pl-6 text-sm leading-6">
          {block.items.map((item) => <li key={item}>{renderInline(item)}</li>)}
        </ul>
      );
    case 'note': {
      const Icon = block.tone === 'success' ? CheckCircle2 : Info;
      return (
        <div
          className={cn(
            'flex gap-3 rounded-md border p-3 text-sm leading-6',
            block.tone === 'success' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40' : 'bg-muted/50',
          )}
        >
          <Icon className={cn('mt-1 size-4 shrink-0', block.tone === 'success' ? 'text-emerald-600' : 'text-primary')} />
          <p><span className="font-semibold">{block.label}.</span> {renderInline(block.text)}</p>
        </div>
      );
    }
    case 'table':
      return (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-primary text-primary-foreground">
              <tr>{block.header.map((cell) => <th key={cell} className="px-3 py-2 text-left font-medium">{cell}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t odd:bg-background even:bg-muted/40">
                  {row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2 align-top">{renderInline(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'figure': {
      const src = manualAssetPath(manualId, block.src);
      const figureLabel = t('figure');
      return (
        <figure className="space-y-2">
          <a href={src} target="_blank" rel="noreferrer" className="mx-auto block" style={{ maxWidth: `${Math.round(block.scale * 100)}%` }}>
            <Image
              src={src}
              alt={block.caption}
              width={block.width}
              height={block.height}
              className="h-auto w-full rounded-md border"
              sizes="(min-width: 1024px) 60vw, 100vw"
            />
          </a>
          <figcaption className="text-center text-xs text-muted-foreground">
            <span className="font-semibold">{figureLabel} {block.number}.</span> {block.caption}
          </figcaption>
        </figure>
      );
    }
    default:
      return null;
  }
}

/** Group blocks under their top-level (h1) heading. */
function splitSections(blocks: ManualBlock[]) {
  const sections: Array<{ title: string; blocks: ManualBlock[] }> = [];
  for (const block of blocks) {
    if (block.type === 'h1') sections.push({ title: block.text, blocks: [] });
    else sections.at(-1)?.blocks.push(block);
  }
  return sections;
}

function sectionAnchor(index: number) {
  return `manual-section-${index + 1}`;
}

/** Render **bold** spans inside manual text. */
function renderInline(text: string): ReactNode {
  return text.split('**').map((part, index) => (
    index % 2 === 1 ? <strong key={index}>{part}</strong> : <Fragment key={index}>{part}</Fragment>
  ));
}
