import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { canUseDOM, useLocale } from '../core';
import { Dialog } from './Dialog';
import type { DialogProps, DialogTone } from './Dialog';
import { trackPointerDown } from './origin';

export interface ConfirmOptions {
  title: ReactNode;
  description?: ReactNode;
  /** 确认按钮的文字，默认“确定” */
  confirmText?: ReactNode;
  /** 取消按钮的文字，默认“取消” */
  cancelText?: ReactNode;
  /** danger：确认按钮用危险色，默认焦点落在“取消”上 */
  tone?: DialogTone;
  icon?: ReactNode;
  size?: DialogProps['size'];
  align?: DialogProps['align'];
  /** 允许 Esc / 点遮罩关闭（按“取消”算），默认允许 */
  dismissible?: boolean;
  /** 从哪里放大进场：默认 'trigger'（点按处 / 焦点元素中心；没有触发元素时屏幕中心）。见 Dialog 的 origin */
  origin?: DialogProps['origin'];
}

interface Request { id: number; options: ConfirmOptions; open: boolean; resolve: (ok: boolean) => void }

/* 模块级的小仓库：confirm() 往里放请求，<Confirmer /> 订阅并渲染 */
let requests: Request[] = [];
let version = 0;
let seq = 0;
const listeners = new Set<() => void>();
const instances: Array<{ id: symbol; auto: boolean }> = [];
let autoRoot = false;

const emit = () => { version++; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getVersion = () => version;
/** 同时挂了多个时只有一个负责渲染：优先用使用者自己挂的，其次才是自动创建的 */
const ownerId = () => (instances.find((i) => !i.auto) ?? instances[0])?.id;

function settle(id: number, ok: boolean) {
  const req = requests.find((r) => r.id === id);
  if (!req || !req.open) return;
  req.resolve(ok);
  requests = requests.map((r) => (r.id === id ? { ...r, open: false } : r));
  emit();
}
function remove(id: number) {
  requests = requests.filter((r) => r.id !== id);
  emit();
}

/**
 * 命令式确认框：`if (await confirm({ title: '删除？', tone: 'danger' })) …`
 * 确认返回 true；取消、Esc、点遮罩返回 false。
 * 页面里挂了 <Confirmer /> 就用它渲染（能拿到你的 React 上下文）；没挂的话第一次调用时自动在 body 下建一个独立的 root。
 */
export function confirm(options: ConfirmOptions | string): Promise<boolean> {
  if (!canUseDOM) return Promise.resolve(false);
  const opts: ConfirmOptions = typeof options === 'string' ? { title: options } : options;
  trackPointerDown();
  return new Promise<boolean>((resolve) => {
    requests = [...requests, { id: ++seq, options: opts, open: true, resolve }];
    if (!instances.some((i) => !i.auto) && !autoRoot) {
      autoRoot = true;
      const host = document.createElement('div');
      host.setAttribute('data-ok-confirmer', '');
      document.body.appendChild(host);
      createRoot(host).render(<Confirmer auto />);
    }
    emit();
  });
}

export interface ConfirmerProps {
  /** 内部使用：标记这是 confirm() 自动创建的实例 */
  auto?: boolean;
}

/** confirm() 的渲染出口。挂在应用根部一次即可；不挂也能用（会自动创建独立的 root，但拿不到应用里的上下文） */
export function Confirmer({ auto = false }: ConfirmerProps) {
  const id = useRef<symbol>();
  if (!id.current) id.current = Symbol('confirmer');
  useSyncExternalStore(subscribe, getVersion, getVersion);
  // 按钮的默认文字跟着 <Confirmer /> 所在位置的语言走（自动创建的那个没有 Provider，是 zh-CN）
  const { messages: t } = useLocale();

  useEffect(() => {
    const entry = { id: id.current as symbol, auto };
    instances.push(entry);
    emit();
    return () => {
      const i = instances.indexOf(entry);
      if (i >= 0) instances.splice(i, 1);
      emit();
    };
  }, [auto]);

  if (ownerId() !== id.current) return null;

  return (
    <>
      {requests.map((req) => {
        const o = req.options;
        const danger = o.tone === 'danger';
        return (
          <Dialog
            key={req.id}
            role="alertdialog"
            open={req.open}
            onOpenChange={(next) => { if (!next) settle(req.id, false); }}
            onExited={() => remove(req.id)}
            title={o.title}
            description={o.description}
            icon={o.icon}
            tone={o.tone}
            size={o.size}
            align={o.align ?? (o.icon == null ? 'center' : 'start')}
            dismissible={o.dismissible ?? true}
            origin={o.origin}
            actions={
              <>
                <button type="button" className="ok-btn ok-btn--lg ok-focusable" data-autofocus={danger ? '' : undefined} onClick={() => settle(req.id, false)}>
                  {o.cancelText ?? t.confirm.cancel}
                </button>
                <button
                  type="button"
                  className={'ok-btn ok-btn--lg ok-focusable ' + (danger ? 'ok-btn--danger' : 'ok-btn--primary')}
                  data-autofocus={danger ? undefined : ''}
                  onClick={() => settle(req.id, true)}
                >
                  {o.confirmText ?? t.confirm.confirm}
                </button>
              </>
            }
          />
        );
      })}
    </>
  );
}
