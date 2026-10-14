import { accentVars, contrastRatio, hexToHsv, hsvToHex, logoSnoutColors, normalizeHex, onAccentColor, parseHex, perceivedLightness } from './color';

describe('颜色工具', () => {
  it('解析与规范化十六进制', () => {
    expect(parseHex('#FFF')).toEqual([255, 255, 255]);
    expect(normalizeHex('FF6B8E')).toBe('#ff6b8e');
    expect(normalizeHex('#12345')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
  });

  it('HSV 往返不丢精度', () => {
    for (const hex of ['#ff6b8e', '#2e7bff', '#1b1c22', '#ffffff', '#000000', '#c77dff']) {
      expect(hsvToHex(hexToHsv(hex)!)).toBe(hex);
    }
  });

  it('强调色上的字按感知亮度选黑白，和五个预设一致', () => {
    const presets: Record<string, string> = { '#ff6b8e': '#1b1c22', '#ff7a2f': '#1b1c22', '#ffbe3b': '#1b1c22', '#2e7bff': '#ffffff', '#c77dff': '#1b1c22' };
    for (const [hex, on] of Object.entries(presets)) expect(onAccentColor(hex)).toBe(on);
    expect(onAccentColor('#0b3d2e')).toBe('#ffffff');
    expect(onAccentColor('#fff3b0')).toBe('#1b1c22');
  });

  it('派生的深色、亮色文字达到 4.5:1；白字时填充不提亮', () => {
    for (const hex of ['#ffbe3b', '#ff6b8e', '#2e7bff', '#0b3d2e', '#fff3b0', '#808080']) {
      const v = accentVars(hex);
      expect(contrastRatio(parseHex(v['--ok-accent-deep'])!, [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(parseHex(v['--ok-accent-light'])!, [0x2a, 0x29, 0x27])).toBeGreaterThanOrEqual(4.5);
      if (v['--ok-on-accent'] === '#ffffff') expect(v['--ok-accent-fill']).toBe('var(--ok-accent)');
      else expect(v['--ok-accent-fill']).toBeUndefined();
    }
    expect(accentVars('nope')).toEqual({});
    expect(perceivedLightness([255, 255, 255])).toBeCloseTo(1, 3);
  });
});

describe('标志的猪鼻子', () => {
  it('五个预设色在两种主题下都保持原色', () => {
    for (const hex of ['#ff6b8e', '#ff7a2f', '#ffbe3b', '#2e7bff', '#c77dff']) expect(logoSnoutColors(hex)).toEqual({ light: hex, dark: hex });
  });
  it('和方块对比度不够：浅色主题（墨色方块）换白，深色主题（纸色方块）换墨', () => {
    expect(logoSnoutColors('#0b3d2e')).toEqual({ light: '#ffffff', dark: '#0b3d2e' });
    expect(logoSnoutColors('#fff3b0')).toEqual({ light: '#fff3b0', dark: '#1b1c22' });
    expect(accentVars('#0b3d2e')['--ok-logo-snout-light']).toBe('#ffffff');
  });
});
