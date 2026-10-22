/** 使用现有 Playwright 安装检查真实布局；截图和结果写到仓库外。
 * node scripts/check-control-defaults.mjs /path/to/playwright/index.mjs /absolute/evidence/directory
 */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'vite';
const {chromium}=await import(pathToFileURL(resolve(process.argv[2])).href);
assert.ok(process.argv[3],'请指定仓库外的证据输出目录');
const output=resolve(process.argv[3]);await mkdir(output,{recursive:true});
const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0}});
await server.listen();
const browser=await chromium.launch();
const results=[];
try{
 for(const theme of ['light','dark']){
  const page=await browser.newPage({viewport:{width:800,height:1600},colorScheme:theme,reducedMotion:'reduce'});
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/scripts/fixtures/control-defaults.html`);
  await page.getByRole('switch',{name:'default',exact:true}).waitFor();
  const geometry=async name=>page.getByRole('switch',{name,exact:true}).evaluate(el=>{
   const track=el.nextElementSibling,thumb=track.firstElementChild,t=track.getBoundingClientRect(),b=thumb.getBoundingClientRect();
   return {track:[t.width,t.height],thumb:[b.width,b.height],left:b.left-t.left,right:t.right-b.right,top:b.top-t.top};
  });
  for(const [name,track,thumb,pressed] of [['sm',[36,22],[20,16],24],['md',[44,26],[26,20],31],['lg',[54,32],[32,26],38]]){
   let g=await geometry(name);assert.deepEqual(g.track,track);assert.deepEqual(g.thumb,thumb);assert.equal(g.right,3);assert.equal(g.top,3);
   await page.getByRole('switch',{name,exact:true}).hover();await page.mouse.down();
   g=await geometry(name);assert.equal(g.thumb[0],pressed);assert.equal(g.right,3);
   await page.mouse.up();g=await geometry(name);assert.equal(g.left,3);
   results.push({theme,size:name,...g});
  }
  assert.deepEqual((await geometry('default')).track,[44,26]);
  await page.getByRole('switch',{name:'disabled',exact:true}).hover();await page.mouse.down();
  assert.deepEqual((await geometry('disabled')).thumb,[26,20]);await page.mouse.up();
  const styles=await page.evaluate(()=>{
   const cs=el=>getComputedStyle(el),q=sel=>document.querySelector(sel),row=label=>[...document.querySelectorAll('.ok-row')].find(e=>e.querySelector('.ok-row__label')?.textContent===label);
   const controls={};for(const label of ['Fill','Fixed','Slider','Wrap']){const el=row(label),ctl=el.querySelector('.ok-row__control')??el.querySelector('.ok-slider');controls[label]={flex:cs(ctl).flex,width:ctl.getBoundingClientRect().width,wrap:cs(el).flexWrap};}
   return {button:cs(q('.ok-btn')).fontWeight,input:cs(q('input[aria-label="Form"]')).fontWeight,affix:cs(q('.ok-input__affix')).fontWeight,search:cs(q('input[aria-label="Search"]')).fontWeight,
    row:[cs(q('.ok-row')).fontWeight,cs(q('.ok-row')).fontSize,cs(q('.ok-row')).lineHeight],description:[cs(q('.ok-row__desc')).fontWeight,cs(q('.ok-row__desc')).fontSize,cs(q('.ok-row__desc')).lineHeight],
    natural:q('[aria-label="Natural"]').getBoundingClientRect().width,block:q('[aria-label="Block"]').getBoundingClientRect().width,
    heading:{padding:cs(q('.ok-accordion__head')).padding,minHeight:cs(q('.ok-accordion__head')).minHeight,radius:cs(q('.ok-accordion__head')).borderRadius},
    contentPadding:cs(q('.ok-accordion__content')).padding,controls};
  });
  for(const key of ['button','input','affix'])assert.equal(styles[key],'400');assert.equal(styles.search,'500');
  assert.deepEqual(styles.row,['400','14px','18.2px']);assert.deepEqual(styles.description,['300','12.5px','17.5px']);
  assert.ok(styles.natural<styles.block);assert.equal(styles.block,560);
  assert.match(styles.controls.Fill.flex,/^1 1/);assert.match(styles.controls.Fixed.flex,/^0 1/);assert.equal(styles.controls.Fixed.width,200);
  assert.match(styles.controls.Slider.flex,/^1 1/);assert.match(styles.controls.Wrap.flex,/^1 1/);assert.equal(styles.controls.Wrap.wrap,'wrap');
  assert.deepEqual(styles.heading,{padding:'12px 20px',minHeight:'56px',radius:'0px'});assert.equal(styles.contentPadding,'0px');
  await page.getByRole('combobox',{name:'Select',exact:true}).click();
  await page.getByRole('option').first().waitFor();
  const weights=await page.getByRole('option').evaluateAll(els=>els.map(e=>getComputedStyle(e).fontWeight));assert.deepEqual(weights,['400','400']);
  await page.keyboard.press('Escape');
  await page.screenshot({path:resolve(output,`${theme}.png`),fullPage:true});results.push({theme,styles,optionWeights:weights});
  await page.close();
 }
 await writeFile(resolve(output,'results.json'),JSON.stringify(results,null,2)+'\n');
 console.log('浅色和深色的尺寸、按压、字重、分组折叠行、控件宽度均通过。');
}finally{await browser.close();await server.close();}
