'use strict';

(() => {
  const get = id => document.getElementById(id);
  const stage = get('slide-stage');
  const picture = get('slide-image');
  const frame = get('frame');
  const area = get('stage-area');
  const overview = get('overview');
  const search = get('overview-search');
  const counter = get('quick-number');
  const smallStep = get('quick-step');
  let slides = [];
  let page = 1;
  let step = 0;
  let retry = load;
  let reopenFocus = null;
  let preload = null;
  let suppressClickUntil = 0;
  let touch = null;

  function fit() {
    const css = getComputedStyle(area);
    const innerWidth = area.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
    const innerHeight = area.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom);
    frame.style.width = Math.max(0, Math.min(innerWidth, innerHeight * 16 / 9)) + 'px';
  }
  new ResizeObserver(fit).observe(area);
  window.addEventListener('resize', fit);
  fit();

  function clamp(number, low, high) {
    const value = Number(number);
    return Math.min(high, Math.max(low, Number.isFinite(value) ? Math.trunc(value) : low));
  }
  const pad = value => String(value).padStart(2, '0');
  const asset = name => 'slides/' + name + '?v=5';
  function showError(message, action) {
    retry = action; get('error-text').textContent = message; get('error').hidden = false;
  }
  get('retry').addEventListener('click', () => { get('error').hidden = true; retry(); });
  picture.addEventListener('load', () => { get('error').hidden = true; });
  picture.addEventListener('error', () => {
    showError('本页图片暂时未能载入。', () => {
      const url = new URL(picture.src); url.searchParams.set('retry', Date.now()); picture.src = url.href;
    });
  });

  const links = {
    36: [
      [42.8,32,50.6,9.5,'分享网站','./'],
      [42.7,61,41,8.5,'网评信息脱敏','https://mp.weixin.qq.com/s/xegzsFUCwHW8N7a07qlMnQ'],
      [42.7,74,41,8.5,'Markdown格式','https://mp.weixin.qq.com/s/-lsDnhzbKZyXTDusMvoFow']
    ],
    40: [[14,90.8,32,4.8,'分享网站','./']]
  };
  function showLinks() {
    const box = get('slide-links');
    box.replaceChildren();
    for (const [left,top,width,height,title,url] of (links[page] || [])) {
      const a = document.createElement('a');
      a.className = 'slide-link'; a.href = url; a.title = title; a.setAttribute('aria-label',title);
      if (url.startsWith('https:')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      Object.assign(a.style,{left:left+'%',top:top+'%',width:width+'%',height:height+'%'});
      box.append(a);
    }
  }
  function chapter() {
    const entries = Array.from(document.querySelectorAll('[data-goto]'));
    const active = entries.filter(el => Number(el.dataset.goto) <= page).pop();
    entries.forEach(el => el.classList.toggle('current', el === active));
  }
  function render(syncAddress = true) {
    const slide = slides[page-1];
    if (!slide) return;
    const last = slide.frames.length - 1;
    const target = asset(slide.frames[step]);
    if (picture.getAttribute('src') !== target) { get('error').hidden = true; picture.src = target; }
    const extra = last ? '，已展开 '+step+' / '+last+' 项' : '';
    picture.alt = '第'+page+'页，'+slide.title+extra;
    stage.setAttribute('aria-label', picture.alt+'。单击前进');
    const count = pad(page)+' / '+slides.length;
    counter.textContent = count;
    smallStep.hidden = !last; smallStep.textContent = last ? '展开 '+step+' / '+last : '';
    document.querySelector('.work-count').textContent = count;
    get('quick-count').setAttribute('aria-label','选择页面，当前第'+page+'页'+extra);
    get('position').textContent = '第 '+page+' / '+slides.length+' 页，'+slide.title+extra;
    get('current-title').textContent = slide.title+extra;
    document.title = slide.title+' · 挑战杯备赛经验分享';
    document.querySelectorAll('[data-prev]').forEach(b => { b.disabled = page === 1 && step === 0; b.setAttribute('aria-label', step ? '上一步' : '上一页'); });
    document.querySelectorAll('[data-next]').forEach(b => { b.disabled = page === slides.length && step === last; b.setAttribute('aria-label', step < last ? '下一步' : '下一页'); });
    get('progress-value').style.transform = 'scaleX('+page/slides.length+')';
    showLinks(); chapter();
    if (syncAddress) {
      const url = new URL(location.href);
      url.searchParams.set('page',page);
      if (step) url.searchParams.set('step',step); else url.searchParams.delete('step');
      const fragment = new URLSearchParams(url.hash.slice(1));
      if (fragment.has('slide')) { fragment.set('slide',page); url.hash = fragment.toString(); }
      history.replaceState(null,'',url);
    }
    const nextName = step < last ? slide.frames[step+1] : slides[page]?.frames[0];
    if (nextName) { preload = new Image(); preload.src = asset(nextName); }
  }
  function go(target,phase=0,sync=true) {
    if (!slides.length) return;
    page = clamp(target,1,slides.length);
    step = clamp(phase,0,slides[page-1].frames.length-1);
    render(sync);
  }
  function next() {
    if (!slides.length) return;
    if (step+1 < slides[page-1].frames.length) go(page,step+1);
    else if (page < slides.length) go(page+1);
  }
  function previous() {
    if (!slides.length) return;
    if (step) go(page,step-1);
    else if (page > 1) go(page-1,slides[page-2].frames.length-1);
  }
  function restore() {
    const url = new URL(location.href);
    const sharedPage = new URLSearchParams(url.hash.slice(1)).get('slide');
    go(sharedPage || url.searchParams.get('page') || 1,url.searchParams.get('step') || 0,false);
  }
  window.addEventListener('hashchange',restore);
  window.addEventListener('popstate',restore);
  document.querySelectorAll('[data-prev]').forEach(b => b.addEventListener('click',previous));
  document.querySelectorAll('[data-next]').forEach(b => b.addEventListener('click',next));
  document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click',() => go(b.dataset.goto)));
  stage.addEventListener('click',() => { if (Date.now() > suppressClickUntil) next(); });
  stage.addEventListener('touchstart',e => {
    if (e.touches.length !== 1) { touch = null; return; }
    const t = e.touches[0]; touch = [t.clientX,t.clientY];
  },{passive:true});
  stage.addEventListener('touchend',e => {
    if (!touch || !e.changedTouches.length) return;
    const t = e.changedTouches[0], dx = t.clientX-touch[0], dy = t.clientY-touch[1]; touch=null;
    if (Math.abs(dx)>48 && Math.abs(dx)>Math.abs(dy)*1.4) {
      suppressClickUntil=Date.now()+450; dx<0 ? next() : previous();
    }
  },{passive:true});
  stage.addEventListener('touchcancel',() => {touch=null;},{passive:true});

  function buildOverview() {
    const list = get('overview-list'); list.replaceChildren();
    const word = search.value.trim().toLowerCase();
    for (const slide of slides) {
      if (word && !(pad(slide.page)+' '+slide.title.toLowerCase()).includes(word)) continue;
      const b = document.createElement('button'); b.type='button'; b.dataset.page=slide.page;
      const number=document.createElement('span'); number.className='index'; number.textContent=pad(slide.page);
      const title=document.createElement('span'); title.textContent=slide.title;
      b.classList.toggle('current',slide.page===page);
      if (slide.page===page) b.setAttribute('aria-current','page');
      b.append(number,title); b.addEventListener('click',() => {overview.close(); go(slide.page);}); list.append(b);
    }
    if (!list.children.length) {const p=document.createElement('p');p.className='empty';p.textContent='没有找到这一页';list.append(p);}
  }
  function openOverview() {
    if (!slides.length || overview.open) return;
    reopenFocus=document.activeElement; search.value=''; buildOverview(); overview.showModal(); search.focus();
  }
  document.querySelectorAll('[data-overview]').forEach(b=>b.addEventListener('click',openOverview));
  search.addEventListener('input',buildOverview);
  get('close-overview').addEventListener('click',()=>overview.close());
  overview.addEventListener('click',e=>{if(e.target===overview)overview.close();});
  overview.addEventListener('close',()=>{if(reopenFocus?.isConnected)reopenFocus.focus({preventScroll:true});});
  function workbench(open) {
    document.body.classList.toggle('workbench-open',open);
    (open?get('back-to-show'):get('workspace-button')).focus({preventScroll:true});
    requestAnimationFrame(fit);
  }
  get('workspace-button').addEventListener('click',()=>workbench(true));
  get('back-to-show').addEventListener('click',()=>workbench(false));
  async function full() {
    const active = document.fullscreenElement || document.body.classList.contains('presentation-mode');
    if (active) {
      document.body.classList.remove('presentation-mode');
      if (document.fullscreenElement) {try {await document.exitFullscreen();} catch {}}
    } else {
      workbench(false); document.body.classList.add('presentation-mode');
      if (document.documentElement.requestFullscreen) {try {await document.documentElement.requestFullscreen();} catch {}}
    }
    fit();
  }
  get('fullscreen').addEventListener('click',full);
  document.addEventListener('fullscreenchange',()=>{document.body.classList.toggle('presentation-mode',!!document.fullscreenElement);fit();});
  document.addEventListener('keydown',e=>{
    if (overview.open || e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (['ArrowRight','ArrowDown','PageDown'].includes(e.key)) {e.preventDefault();next();}
    else if (['ArrowLeft','ArrowUp','PageUp'].includes(e.key)) {e.preventDefault();previous();}
    else if (e.key===' ' && !e.target.closest('button,a')) {e.preventDefault();next();}
    else if (e.key==='Home') {e.preventDefault();go(1);}
    else if (e.key==='End') {e.preventDefault();go(slides.length);}
    else if (e.key.toLowerCase()==='o') {e.preventDefault();openOverview();}
    else if (e.key.toLowerCase()==='f') {e.preventDefault();full();}
    else if (e.key==='Escape') {document.body.classList.remove('presentation-mode');if(document.body.classList.contains('workbench-open'))workbench(false);}
  });
  async function load() {
    try {
      const response=await fetch('slides/manifest.json?v=5');
      if (!response.ok) throw Error('manifest');
      const data=await response.json();
      if (!Array.isArray(data.slides)||!data.slides.length) throw Error('slides');
      slides=data.slides; restore();
    } catch {showError('暂时无法读取页面目录。',load);}
  }
  load();
})();

