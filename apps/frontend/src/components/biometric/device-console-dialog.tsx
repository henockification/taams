'use client';

import { FormEvent, useState } from 'react';
import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useBiometricDeviceConsole, useSendDeviceConsoleCommand } from '@/data/hooks/core.hooks';
import type { DeviceConsoleCommand } from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

// "\t" is typed literally (the API turns it into a tab). "Tmp=@" / "Size=@" are filled by the
// server from the stored template for that PIN, type and index.
const range = (count: number) => Array.from({ length: count }, (_, index) => index);

// One command per line. "\t" is typed literally (the API turns it into a tab). "Tmp=@" / "Size=@"
// are filled by the server from the stored template for that PIN, type and index/FID.
const PRESETS: { label: string; command: (pin: string) => string }[] = [
  { label: 'INFO', command: () => 'INFO' },
  { label: 'Query user', command: (pin) => `DATA QUERY USERINFO PIN=${pin}` },
  { label: 'Query face', command: (pin) => `DATA QUERY BIODATA Type=2\\tPIN=${pin}` },
  { label: 'Query palm', command: (pin) => `DATA QUERY BIODATA Type=8\\tPIN=${pin}` },
  {
    label: 'Whole face (FACE)',
    command: (pin) => range(15).map((fid) => `DATA UPDATE FACE PIN=${pin}\\tFID=${fid}\\tSIZE=@\\tVALID=1\\tTMP=@`).join('\n'),
  },
  {
    label: 'Whole palm (BIODATA)',
    command: (pin) =>
      range(5)
        .map((index) => `DATA UPDATE BIODATA Pin=${pin}\\tNo=0\\tIndex=${index}\\tValid=1\\tDuress=0\\tType=8\\tMajorVer=12\\tMinorVer=0\\tFormat=0\\tTmp=@`)
        .join('\n'),
  },
];

function statusVariant(command: DeviceConsoleCommand) {
  if (command.status === 'SUCCEEDED') return 'default' as const;
  if (command.status === 'FAILED') return 'destructive' as const;
  return 'secondary' as const;
}

export function DeviceConsoleDialog({ deviceId, onClose }: { deviceId: string | null; onClose: () => void }) {
  const t = useTranslations('biometricEnrollment');
  const common = useTranslations('common');
  const { formatDateTime } = useCalendarPreference();
  const consoleQuery = useBiometricDeviceConsole(deviceId);
  const sendCommand = useSendDeviceConsoleCommand();
  const [pin, setPin] = useState('');
  const [command, setCommand] = useState('');

  const data = consoleQuery.data?.console;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deviceId || !command.trim()) return;
    try {
      await sendCommand.mutateAsync({ biometricDeviceId: deviceId, command });
      notifications.show({ title: common('success'), message: t('consoleQueued'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('actionFailed'), color: 'red' });
    }
  };

  return (
    <Dialog open={Boolean(deviceId)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t('consoleTitle', { device: data?.deviceName ?? '' })}</DialogTitle>
          <DialogDescription>
            {t('consoleDescription')} {data ? `${data.serialNumber ?? '-'} · push ${data.pushProtocolVersion ?? '?'}` : ''}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-3" onSubmit={submit}>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="console-pin">{t('consolePin')}</Label>
              <Input id="console-pin" className="w-40" value={pin} onChange={(event) => setPin(event.target.value.trim())} />
            </div>
            {PRESETS.map((preset) => (
              <Button key={preset.label} type="button" size="sm" variant="outline" disabled={!pin && preset.label !== 'INFO'} onClick={() => setCommand(preset.command(pin))}>
                {preset.label}
              </Button>
            ))}
          </div>
          <Textarea className="font-mono text-xs" rows={6} value={command} onChange={(event) => setCommand(event.target.value)} />
          <div className="flex justify-end">
            <Button type="submit" disabled={!command.trim() || sendCommand.isPending}>
              <Send className="size-4" />
              {t('consoleSend')}
            </Button>
          </div>
        </form>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('consoleCommands')}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>{t('consoleCommand')}</TableHead>
                <TableHead>{t('consoleStatus')}</TableHead>
                <TableHead className="text-right">Return</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.commands ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs">{row.id}</TableCell>
                  <TableCell className="max-w-md break-all font-mono text-xs">{row.command}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row)}>{row.status}</Badge>
                    <p className="text-xs text-muted-foreground">{formatDateTime(row.completedAt ?? row.createdAt)}</p>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{row.returnCode ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('consoleTraffic')}</p>
          {(data?.traffic ?? []).length === 0 ? <p className="text-xs text-muted-foreground">{t('consoleNoTraffic')}</p> : null}
          {(data?.traffic ?? []).map((entry, index) => (
            <div key={`${entry.at}-${index}`} className="rounded-md border p-2 font-mono text-xs">
              <p className="font-semibold">
                {formatDateTime(entry.at)} · {entry.method} {entry.path}
                {entry.query} → {entry.status}
              </p>
              {entry.requestBody ? <pre className="mt-1 whitespace-pre-wrap break-all">↑ {entry.requestBody}</pre> : null}
              {entry.responseBody ? <pre className="mt-1 whitespace-pre-wrap break-all text-muted-foreground">↓ {entry.responseBody}</pre> : null}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
