import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OinkProvider, useOink } from '../../src/core/theme';
import { Input } from '../../src/inputs/Input';
import { PinInput } from '../../src/inputs/PinInput';
import { OptionCard } from '../../src/inputs/OptionCard';
import '../../src/styles.css';
import './corner-transition.css';

function Fixture() {
  const [selected, setSelected] = useState(false);
  const [invalid, setInvalid] = useState(false);
  return <OinkProvider defaultTheme="light" defaultAccent="blue" defaultMotion="full" locale="zh-CN">
    <main>
      <TransitionControls setInvalid={setInvalid}/>
      <Input id="focus-input" aria-label="输入框" invalid={invalid}/>
      <PinInput length={4} aria-label="配对码" />
      <OptionCard value="test" checked={selected} onChange={setSelected}>选项卡片</OptionCard>
      <button id="ring-card" type="button" aria-pressed={selected} onClick={() => setSelected(!selected)}>选中卡片</button>
      <button id="away" type="button">移开焦点</button>
    </main>
  </OinkProvider>;
}
function TransitionControls({ setInvalid }: { setInvalid: (value: boolean) => void }) {
  const { setAccent } = useOink();
  useEffect(() => {
    Object.assign(window, { cornerTransition: { setAccent, setInvalid } });
  }, [setAccent, setInvalid]);
  return null;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
