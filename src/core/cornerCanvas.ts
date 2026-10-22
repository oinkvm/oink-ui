import type { CornerPaint } from './corner';

type CanvasDocument = Document & {
  getCSSCanvasContext?: (kind: '2d', name: string, width: number, height: number) => CanvasRenderingContext2D;
};

let serial = 0;

export function cornerCanvasSupported(doc: Document): boolean {
  return typeof (doc as CanvasDocument).getCSSCanvasContext === 'function'
    && !!doc.defaultView?.CSS?.supports('border-image-source', '-webkit-canvas(ok-se-probe)');
}

/**
 * WebKit 的命名 CSS canvas 是持久的图像源：颜色变化只在同一任务里重画像素，
 * 不替换 border-image，也不经过 SVG 图像的异步解码。直接执行 cornerPaint 生成
 * 的路径、裁切和图层，几何仍然只有一个来源；这里不接受用户提供的 SVG。
 * SVG 图像里的 currentColor 不能继承 HTML，端点淡化仍会更换资源；这两种写法
 * 无法保证曲线与原生直边同帧。已实测 macOS 14.7.8 / 26.6.2 的 WKWebView；
 * 其它内核继续使用原来的 SVG 路径，支持原生 corner-shape 时不启用回退。
 */
export class CornerCanvas {
  private name = `ok-se-${++serial}`;
  private doc: CanvasDocument;
  private context: CanvasRenderingContext2D | null = null;

  constructor(doc: Document) { this.doc = doc; }

  paint(spec: CornerPaint | null): string {
    if (!spec) {
      if (this.context) this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
      return '';
    }
    const svg = new DOMParser().parseFromString(spec.svg, 'image/svg+xml');
    const root = svg.documentElement;
    const w = Number(root.getAttribute('width')), h = Number(root.getAttribute('height'));
    const ratio = this.doc.defaultView?.devicePixelRatio || 1;
    const ctx = this.doc.getCSSCanvasContext!('2d', this.name, Math.ceil(w * ratio), Math.ceil(h * ratio));
    this.context = ctx;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.save();
    ctx.scale(ratio, ratio);
    ctx.translate(spec.outset, spec.outset);
    const reference = (value: string | null) => value ? svg.getElementById(value.slice(5, -1)) : null;
    const clip = (element: Element) => {
      const parent = reference(element.getAttribute('clip-path'));
      if (parent) clip(parent);
      for (const child of Array.from(element.children)) {
        if (child.tagName === 'path') ctx.clip(new Path2D(child.getAttribute('d')!), child.getAttribute('clip-rule') === 'evenodd' ? 'evenodd' : 'nonzero');
      }
    };
    const draw = (element: Element) => {
      if (element.tagName === 'defs') return;
      ctx.save();
      const clipping = reference(element.getAttribute('clip-path'));
      if (clipping) clip(clipping);
      const mask = reference(element.getAttribute('mask'));
      if (mask) {
        // cornerPaint 的唯一 mask：白色矩形减去黑色内轮廓。
        ctx.clip(new Path2D(Array.from(mask.children).map(p => p.getAttribute('d')).join('')), 'evenodd');
      }
      if (element.tagName === 'path') {
        const path = new Path2D(element.getAttribute('d')!);
        const fill = element.getAttribute('fill') || '#000';
        const rule = element.getAttribute('fill-rule') === 'evenodd' ? 'evenodd' : 'nonzero';
        const filter = reference(element.getAttribute('filter'));
        const blur = Number(filter?.firstElementChild?.getAttribute('stdDeviation'));
        if (blur) {
          // Safari 14 的 2D context 没有 filter；只画阴影，把实体移出画布。
          // shadowBlur 的值是高斯标准差的两倍，且不随 context transform 缩放。
          ctx.shadowColor = fill;
          ctx.shadowBlur = blur * 2 * ratio;
          ctx.shadowOffsetX = 10000 * ratio;
          ctx.translate(-10000, 0);
          ctx.fillStyle = '#000';
        } else ctx.fillStyle = fill;
        ctx.fill(path, rule);
      } else for (const child of Array.from(element.children)) draw(child);
      ctx.restore();
    };
    draw(root);
    ctx.restore();
    const slice = spec.slice.map(v => v * ratio).join(' ');
    const widths = spec.slice.map(v => `${v}px`).join(' ');
    return `-webkit-canvas(${this.name}) ${slice} / ${widths} / ${spec.outset}px stretch`;
  }

  destroy() {
    if (this.context) this.doc.getCSSCanvasContext!('2d', this.name, 0, 0);
    this.context = null;
  }
}
