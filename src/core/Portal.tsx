import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface PortalProps { children: ReactNode; container?: HTMLElement | null; disabled?: boolean }

/** 把内容渲染到 body（或指定容器）。首帧在客户端挂载后才出现，服务端渲染安全 */
export function Portal({ children, container, disabled }: PortalProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(container ?? document.body); }, [container]);
  if (disabled) return <>{children}</>;
  return host ? createPortal(children, host) : null;
}
