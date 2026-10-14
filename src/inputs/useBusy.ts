import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ButtonStatus, ButtonStatusLabels } from './Button';

export type BusyState = 'idle' | ButtonStatus;

export interface UseBusyOptions {
  /** 成功态（对勾）停留多久再复原，毫秒，默认 1200 */
  successHold?: number;
  /** 失败态（叉号 + 抖动）停留多久再复原，毫秒，默认 1200 */
  errorHold?: number;
  /** 读屏播报文案，透传给 Button 的 statusLabels，例如 { loading: '正在保存', success: '已保存', error: '保存失败' } */
  labels?: ButtonStatusLabels;
}

export interface UseBusyResult {
  state: BusyState;
  /**
   * 跑一个异步任务：加载 → 成功（停留 successHold）/ 失败（停留 errorHold）→ 复原。
   * 返回任务本身的结果；任务失败时照样 reject，调用方按需 catch（比如弹一条轻提示）
   */
  run: <T>(task: Promise<T> | (() => Promise<T>)) => Promise<T>;
  /** 立即回到常态 */
  reset: () => void;
  /** 展开到 Button 上：loading / success / error / statusLabels */
  buttonProps: { loading: boolean; success: boolean; error: boolean; statusLabels?: ButtonStatusLabels };
}

/**
 * 按钮的「加载 → 成功 / 失败 → 复原」流程。
 *
 *   const save = useBusy({ labels: { loading: '正在保存', success: '已保存', error: '保存失败' } });
 *   <Button {...save.buttonProps} onClick={() => save.run(api.save()).catch(() => toast.danger('保存失败'))}>保存</Button>
 *
 * 停留时长是「让人看清结果」的时间，不是动画，所以不乘 --ok-ms：减弱动效时对勾 / 叉号照样停留，只是不再有过渡和抖动。
 * 组件卸载后不再改状态；连续调用时只认最后一次。
 */
export function useBusy(options: UseBusyOptions = {}): UseBusyResult {
  const { successHold = 1200, errorHold = 1200, labels } = options;
  const [state, setState] = useState<BusyState>('idle');
  const token = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const holds = useRef({ successHold, errorHold });
  holds.current = { successHold, errorHold };

  useEffect(() => () => { token.current++; clearTimeout(timer.current); }, []);

  const reset = useCallback(() => {
    token.current++;
    clearTimeout(timer.current);
    setState('idle');
  }, []);

  const run = useCallback(<T,>(task: Promise<T> | (() => Promise<T>)): Promise<T> => {
    const id = ++token.current;
    clearTimeout(timer.current);
    setState('loading');
    const settle = (next: 'success' | 'error') => {
      if (id !== token.current) return;
      setState(next);
      timer.current = setTimeout(() => { if (id === token.current) setState('idle'); }, next === 'success' ? holds.current.successHold : holds.current.errorHold);
    };
    let p: Promise<T>;
    try { p = Promise.resolve(typeof task === 'function' ? task() : task); } catch (e) { p = Promise.reject(e); }
    return p.then(
      (v) => { settle('success'); return v; },
      (e: unknown) => { settle('error'); throw e; },
    );
  }, []);

  const buttonProps = useMemo(
    () => ({ loading: state === 'loading', success: state === 'success', error: state === 'error', ...(labels ? { statusLabels: labels } : {}) }),
    [state, labels],
  );

  return { state, run, reset, buttonProps };
}
