const appRoot = document.querySelector('#app');
let currentUser = null;
let state = null;
let page = 'home';
let activeChat = null;
let modal = null;
let modalDraft = {};
let activeStory = null;
let storyQueue = [];
let storyIndex = 0;
let storyTimer = null;
let storyDeadline = 0;
let storyRemaining = 5000;
let storyProgress = 0;
let storyPaused = false;
let storyTouchPaused = false;
let authMode = 'login';
let busy = false;
let pollTimer = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
const byId = id => state?.users.find(user => Number(user.id) === Number(id)) || { id, name:'사우', handle:'', bio:'', photo:'', color:'#767882' };
const me = () => currentUser;
const api = async (url, options = {}) => {
  const response = await fetch(url, { credentials:'same-origin', headers:{ 'Content-Type':'application/json', ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '요청을 처리하지 못했습니다.');
  return data;
};

function avatar(user, size = '') {
  return user.photo
    ? `<img class="avatar ${size}" src="${user.photo}" alt="${esc(user.name)}">`
    : `<div class="avatar ${size}" style="background:linear-gradient(140deg,#67718a,#a25d83)">${esc(user.name?.slice(0,1) || '사')}</div>`;
}
function when(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 전`;
  return `${Math.floor(minutes / 1440)}일 전`;
}
function toast(message) {
  document.querySelector('.toast')?.remove();
  const element = document.createElement('div');
  element.className = 'toast'; element.textContent = message; document.body.append(element);
  setTimeout(() => element.remove(), 2600);
}
function setBackground() {
  const value = me()?.background || '';
  document.body.style.backgroundImage = value.startsWith('data:image')
    ? `linear-gradient(#08090be6,#08090be6),url("${value}")`
    : value === 'aurora'
      ? 'radial-gradient(ellipse at 75% 0%,#303034 0%,#151518 45%,#0b0c0f 78%)'
      : value === 'sunset'
        ? 'radial-gradient(ellipse at 70% 0%,#363638 0%,#18181a 48%,#0b0c0f 80%)'
        : '';
}

async function start() {
  try {
    const session = await api('/api/session');
    currentUser = session.user;
    await refresh(false);
    render();
    startPolling();
  } catch (error) {
    if (/로그인|만료/.test(error.message)) renderAuth();
    else renderError(error.message);
  }
}
function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    if (!document.hidden && !modal && !activeStory && !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) refresh(true,true).catch(() => {});
  }, 6000);
}
async function refresh(shouldRender = true, light = false) {
  if (busy) return;
  busy = true;
  try {
    const old = state;
    let data = await api(`/api/bootstrap${light?'?light=1':''}`);
    if (light && old) {
      const knownPosts = new Set(old.posts.map(post=>Number(post.id)));
      const knownStories = new Set(old.stories.map(story=>Number(story.id)));
      if (data.posts.some(post=>!knownPosts.has(Number(post.id))) || data.stories.some(story=>!knownStories.has(Number(story.id)))) data = await api('/api/bootstrap');
    }
    if (light && old) {
      const oldUsers = new Map(old.users.map(user=>[Number(user.id),user]));
      const oldPosts = new Map(old.posts.map(post=>[Number(post.id),post]));
      const oldStories = new Map(old.stories.map(story=>[Number(story.id),story]));
      data.users=data.users.map(user=>({...user,photo:oldUsers.get(Number(user.id))?.photo||''}));
      data.me={...data.me,photo:old.me.photo||''};
      data.posts=data.posts.map(post=>({...post,image:post.image||oldPosts.get(Number(post.id))?.image||''}));
      data.stories=data.stories.map(story=>({...story,image:story.image||oldStories.get(Number(story.id))?.image||''}));
    }
    state = data;
    currentUser = data.me;
    if (!activeChat || !state.chats.some(chat => Number(chat.id) === Number(activeChat))) activeChat = state.chats[0]?.id ?? null;
    setBackground();
    if (shouldRender) render();
  } finally { busy = false; }
}
function renderAuth(errorText = '') {
  clearInterval(pollTimer);
  document.body.style.backgroundImage = '';
  appRoot.innerHTML = `<main class="auth"><section class="auth-card"><img class="auth-logo" src="/joongdo-logo.png" alt="중도일보 로고"><div class="eyebrow">중도일보 사우 전용 공간</div><h1>중도일보 사우회</h1><p>${authMode === 'login' ? '사우들과 일상을 나누고 소식을 확인하세요.' : '아이디와 비밀번호를 만들면 바로 가입할 수 있습니다.'}</p><div class="auth-tabs"><button class="${authMode==='login'?'selected':''}" data-auth-mode="login">로그인</button><button class="${authMode==='register'?'selected':''}" data-auth-mode="register">계정 만들기</button></div>${errorText?`<div class="form-error">${esc(errorText)}</div>`:''}<form id="auth-form">${authMode==='register'?'<label class="field">이름<input name="name" maxlength="30" autocomplete="name" required placeholder="이름"></label>':''}<label class="field">아이디<input name="username" minlength="3" maxlength="24" pattern="[a-zA-Z0-9_]+" autocomplete="username" required placeholder="영문 소문자, 숫자, 밑줄"></label><label class="field">비밀번호<input name="password" type="password" minlength="8" maxlength="72" autocomplete="${authMode==='login'?'current-password':'new-password'}" required placeholder="8자 이상"></label><button class="button full">${authMode==='login'?'로그인':'계정 만들기'}</button></form><div class="auth-note">사우회 계정은 최대 10명까지 가입할 수 있습니다.</div></section></main>`;
  document.querySelectorAll('[data-auth-mode]').forEach(button => button.onclick = () => { authMode = button.dataset.authMode; renderAuth(); });
  document.querySelector('#auth-form')?.addEventListener('submit', submitAuth);
}
function renderError(message) {
  appRoot.innerHTML = `<main class="auth"><section class="auth-card"><img class="auth-logo" src="/joongdo-logo.png" alt="중도일보 로고"><h1>서버에 연결할 수 없습니다</h1><p>${esc(message)}</p><p>Render에 서버와 데이터베이스가 배포된 뒤 이 페이지를 사용할 수 있습니다.</p></section></main>`;
}
async function submitAuth(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const button = form.querySelector('button'); button.disabled = true;
  try {
    const result = await api(`/api/auth/${authMode==='register'?'register':'login'}`, { method:'POST', body:JSON.stringify(data) });
    currentUser = result.user;
    await refresh(false); page = 'home'; render(); startPolling();
  } catch (error) { renderAuth(error.message); }
}

const navItems = [['home','⌂','홈'],['friends','⌕','사우'],['messages','✉','메시지'],['notifications','♡','알림'],['profile','◉','프로필']];
function render() {
  if (!state || !me()) return renderAuth();
  setBackground();
  document.title = '중도일보 사우회';
  appRoot.innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand" title="중도일보 사우회"><img class="brand-logo" src="/joongdo-logo.png" alt="중도일보 사우회">중도일보 사우회</div><nav class="nav">${navItems.map(([id,icon,label])=>`<button title="${label}" aria-label="${label}" class="${page===id?'active':''}" data-page="${id}"><span class="ico">${icon}</span>${label}${id==='notifications'&&state.notifications.some(n=>!n.read)?'<i class="notification-dot"></i>':''}</button>`).join('')}</nav><div class="side-bottom"><button class="profile-mini" title="프로필" aria-label="프로필" data-page="profile">${avatar(me(),'small')}</button><button class="side-logout" title="로그아웃" aria-label="로그아웃" data-logout>↪</button></div></aside><main class="main">${page==='home'?homePage():page==='messages'?messagesPage():page==='profile'?profilePage():page==='friends'?friendsPage():notificationsPage()}</main><aside class="right">${rightRail()}</aside></div><nav class="mobile-nav">${navItems.map(([id,icon,label])=>`<button aria-label="${label}" title="${label}" class="${page===id?'active':''}" data-page="${id}">${icon}</button>`).join('')}</nav>${modal?modalHtml():''}${activeStory?storyHtml():''}`;
  bind();
}
function homePage() {
  const storiesByUser = new Map();
  for (const story of state.stories) {
    const key = Number(story.user);
    if (!storiesByUser.has(key)) storiesByUser.set(key, []);
    storiesByUser.get(key).push(story);
  }
  const storyUsers = state.users.filter(user => Number(user.id) === Number(me().id) || storiesByUser.has(Number(user.id)));
  return `<div class="topbar"><div><div class="eyebrow">중도일보 사우회</div><h1>안녕하세요, ${esc(me().name)}님</h1></div><button class="button" data-modal="post">＋ 게시물</button></div><section class="stories">${storyUsers.map(user=>{const userStories=storiesByUser.get(Number(user.id))||[],own=Number(user.id)===Number(me().id);return `<div class="story-tile"><button class="story" data-story-user="${user.id}"><div class="story-ring ${userStories.length?'has-story':'seen'}">${avatar(user)}</div><span>${own?'내 스토리':esc(user.name)}</span></button>${own?'<button class="story-add-trigger" data-modal="story" aria-label="새 스토리 올리기">＋</button>':''}</div>`;}).join('')}</section><div class="feed-head"><h2>사우들의 게시물</h2><span>함께 나누는 하루</span></div><button class="compose" data-modal="post">지금 소식을 나눠보세요…</button>${state.posts.map(postCard).join('')||'<div class="empty">아직 게시물이 없습니다. 첫 소식을 나눠보세요.</div>'}`;
}
function postCard(post) {
  const owner = byId(post.user), liked = post.likes.includes(Number(me().id));
  return `<article class="post"><div class="post-head">${avatar(owner,'small')}<div class="post-author"><strong>${esc(owner.name)}</strong><small>@${esc(owner.handle)} · ${when(post.created)}</small></div>${Number(post.user)===Number(me().id)?`<button class="more" aria-label="게시물 삭제" data-delete-post="${post.id}">···</button>`:''}</div>${post.image?`<img class="post-image" src="${post.image}" alt="게시물 이미지">`:`<div class="post-placeholder text-only"><span>${esc(post.caption)}</span></div>`}<div class="post-actions"><button class="${liked?'liked':''}" aria-label="좋아요" data-like="${post.id}">${liked?'♥':'♡'}</button><button aria-label="댓글" data-comment-focus="${post.id}">◯</button><span class="post-like-count">${post.likes.length}명이 좋아합니다</span></div><div class="post-content"><div><strong>${esc(owner.name)}</strong><span class="caption">${esc(post.caption)}</span></div><div class="comment-list">${post.comments.slice(-4).map(comment=>`<div><b>${esc(comment.name||byId(comment.user).name)}</b> ${esc(comment.text)}</div>`).join('')}</div></div><form class="comment-form" data-comment="${post.id}"><input placeholder="댓글 남기기…" aria-label="댓글"><button>게시</button></form></article>`;
}
function rightRail() {
  const newNotifications=state.notifications.filter(item=>!item.read).slice(0,3);
  return `<div class="right-card"><div style="display:flex;align-items:center;justify-content:space-between"><h3>내 프로필</h3><button class="follow" data-page="profile">편집</button></div><div class="user-row">${avatar(me(),'small')}<div><b>${esc(me().name)}</b><small>@${esc(me().handle)}</small></div></div><div class="eyebrow">${esc(me().bio||'소개를 추가해 보세요.')}</div></div><div class="right-card"><h3>사우회 회원 <span class="muted">· ${state.users.length}명</span></h3>${state.users.filter(user=>Number(user.id)!==Number(me().id)).slice(0,5).map(user=>`<div class="user-row">${avatar(user,'small')}<div><b>${esc(user.name)}</b><small>@${esc(user.handle)}</small></div><button class="follow" data-dm="${user.id}">메시지</button></div>`).join('')||'<div class="eyebrow">아직 다른 회원이 가입하지 않았어요.</div>'}</div><div class="right-card"><h3>새 소식</h3>${newNotifications.map(item=>`<div class="notification">${avatar(byId(item.user),'small')}<div><b>${esc(item.name||byId(item.user).name)}</b> ${esc(item.text)}<em>${when(item.created)}</em></div></div>`).join('')||'<div class="eyebrow">새 알림이 없습니다.</div>'}<button class="follow" data-page="notifications">모두 보기 →</button></div><div class="eyebrow" style="line-height:1.8">중도일보 사우회 · 2026<br>사우들과 일상을 나누는 공간</div>`;
}
function friendsPage() {
  return `<div class="topbar"><div><div class="eyebrow">함께 소식을 나누는 사람들</div><h1>사우회 회원</h1></div><span class="pill">${state.users.length} / 10명</span></div>${state.users.map(user=>`<article class="right-card friend-card">${avatar(user)}<div class="friend-info"><b>${esc(user.name)}</b><div class="eyebrow">@${esc(user.handle)}</div><div class="eyebrow">${esc(user.bio||'')}</div></div>${Number(user.id)!==Number(me().id)?`<button class="button ghost" data-dm="${user.id}">메시지</button>`:'<span class="pill">나</span>'}</article>`).join('')}`;
}
function messagesPage() {
  const chat=state.chats.find(item=>Number(item.id)===Number(activeChat));
  return `<div class="topbar"><div><div class="eyebrow">사우들과 이야기 나누기</div><h1>메시지</h1></div><button class="button" data-modal="chat">＋ 대화 시작</button></div><div class="chat-layout"><div class="chat-list">${state.chats.map(item=>{const other=byId(item.members.find(id=>Number(id)!==Number(me().id))),last=item.messages.at(-1);return `<button class="chat-person ${Number(item.id)===Number(activeChat)?'selected':''}" data-chat="${item.id}">${item.group?'<div class="avatar small">✺</div>':avatar(other,'small')}<span>${esc(item.title)}${last?`<small>${esc(last.text)}</small>`:''}</span></button>`}).join('')||'<div class="empty">아직 대화가 없습니다.</div>'}</div>${chat?`<section class="chat-window"><div class="chat-top">${esc(chat.title)} <span class="muted">· ${chat.members.length}명</span></div><div class="messages" id="messages">${chat.messages.map(message=>`<div class="bubble ${Number(message.user)===Number(me().id)?'mine':''}">${Number(message.user)===Number(me().id)?'':`<small>${esc(message.name||byId(message.user).name)}</small>`}${esc(message.text)}</div>`).join('')||'<div class="empty" style="margin:auto">첫 인사를 건네 보세요.</div>'}</div><form class="chat-send" id="chat-send"><input placeholder="메시지를 입력하세요…" aria-label="메시지" maxlength="2000"><button class="button">보내기</button></form></section>`:'<section class="chat-window"><div class="empty" style="margin:auto">대화를 선택하거나 새 대화를 시작하세요.</div></section>'}</div>`;
}
function profilePage() {
  const posts=state.posts.filter(post=>Number(post.user)===Number(me().id));
  return `<div class="topbar"><div><div class="eyebrow">내 정보를 관리합니다</div><h1>프로필</h1></div><div class="profile-actions"><button class="button ghost" data-logout>로그아웃</button><button class="button" data-modal="profile">프로필 편집</button></div></div><section class="profile-hero">${avatar(me(),'big')}<div><h2>${esc(me().name)}</h2><div class="eyebrow">@${esc(me().handle)}</div><div class="profile-numbers"><span><b>${posts.length}</b>게시물</span><span><b>${state.stories.filter(story=>Number(story.user)===Number(me().id)).length}</b>스토리</span><span><b>${Math.max(0,state.users.length-1)}</b>사우</span></div></div></section><p class="profile-bio">${esc(me().bio||'소개를 추가해 보세요.')}</p><div class="right-card"><h3>화면 배경</h3><div class="eyebrow" style="margin-bottom:12px">배경 설정은 내 계정에 저장됩니다.</div><div class="background-options"><button class="button ghost" data-bg="">기본 다크</button><button class="button ghost" data-bg="aurora">오로라</button><button class="button ghost" data-bg="sunset">노을</button><label class="button ghost upload-label">사진 선택<input type="file" hidden accept="image/*" id="bg-upload"></label></div></div><div class="feed-head"><h2>내 게시물</h2><span>${posts.length}개</span></div>${posts.map(postCard).join('')||'<div class="empty">아직 게시물이 없습니다.</div>'}`;
}
function notificationsPage() {
  return `<div class="topbar"><div><div class="eyebrow">사우들의 소식</div><h1>알림</h1></div></div><div class="right-card notifications-list">${state.notifications.map(item=>`<div class="notification">${avatar(byId(item.user),'small')}<div><b>${esc(item.name||byId(item.user).name)}</b> ${esc(item.text)}<em>${when(item.created)}</em></div></div>`).join('')||'<div class="empty">아직 알림이 없습니다.</div>'}</div>`;
}

function modalHtml() {
  const titles={post:'새 게시물',story:'스토리 올리기',profile:'프로필 편집',chat:'새 대화'};
  let content='';
  if (modal==='post'||modal==='story') content=`<form id="create-form"><label class="field">사진<input type="file" name="image" accept="image/*"><span class="eyebrow">${modal==='post'?'게시물은 24시간 스토리에도 자동으로 공유됩니다.':'사진 없이 글과 이모지를 올릴 수도 있습니다.'}</span></label><label class="field">내용<textarea name="caption" maxlength="500" placeholder="사우들과 나누고 싶은 이야기를 적어 주세요."></textarea></label>${modal==='story'?'<label class="field">이모지<input name="emoji" maxlength="8" value="🌷"></label>':''}<div id="file-preview"></div><button class="button full">${modal==='post'?'게시하기':'스토리 공유하기'}</button></form>`;
  if (modal==='profile') content=`<form id="profile-form"><label class="field">이름<input name="name" required maxlength="30" value="${esc(me().name)}"></label><label class="field">사용자 이름<input name="handle" required maxlength="24" value="${esc(me().handle)}"></label><label class="field">소개<textarea name="bio" maxlength="120">${esc(me().bio)}</textarea></label><label class="field">프로필 사진<input name="photo" type="file" accept="image/*"></label><div id="profile-preview"></div><button class="button full">저장하기</button></form>`;
  if (modal==='chat') content=`<form id="chat-form"><label class="field">대화 이름<input name="title" maxlength="50" placeholder="예: 주말 약속"></label><div class="field">함께할 사우들${state.users.filter(user=>Number(user.id)!==Number(me().id)).map(user=>`<label class="member-option"><input type="checkbox" name="members" value="${user.id}">${esc(user.name)}</label>`).join('')||'<p class="eyebrow">아직 다른 회원이 가입하지 않았습니다.</p>'}</div><button class="button full">대화 만들기</button></form>`;
  return `<div class="modal-backdrop" id="modal-bg"><section class="modal"><header class="modal-head"><h2>${titles[modal]}</h2><button class="close" data-close>×</button></header>${content}</section></div>`;
}
function storyHtml() {
  const story=state.stories.find(item=>Number(item.id)===Number(activeStory));
  if (!story) { activeStory=null; return ''; }
  const owner=byId(story.user);
  const currentIndex=storyQueue.findIndex(item=>Number(item.id)===Number(story.id));
  const segments=storyQueue.map((item,index)=>`<span class="story-progress-segment ${index<currentIndex?'completed':index===currentIndex?'current':'future'}"><i style="--story-progress:${index<currentIndex?1:index===currentIndex?storyProgress:0};--story-remaining:${index===currentIndex?storyRemaining:0}ms;--story-play-state:${storyPaused?'paused':'running'}"></i></span>`).join('');
  return `<div class="modal-backdrop" id="story-bg"><section class="story-view" style="${story.image?`background-image:linear-gradient(#0005,#0005),url('${story.image}')`:''}"><div><div class="story-progress">${segments}</div><div class="story-owner">${avatar(owner,'small')}<b>${esc(owner.name)}</b><small>${when(story.created)}</small><button class="story-play-toggle" data-story-toggle aria-label="${storyPaused?'스토리 재생':'스토리 일시정지'}">${storyPaused?'▶':'Ⅱ'}</button><button class="close" data-close-story>×</button></div></div><div class="story-content">${!story.image&&story.emoji?`<div class="story-emoji">${esc(story.emoji)}</div>`:''}<div>${esc(story.caption)}</div></div>${Number(story.user)===Number(me().id)?'<div class="pill" style="align-self:center">내 스토리</div>':`<form class="story-msg" id="story-reply"><input maxlength="300" placeholder="${esc(owner.name)}님에게 답장…"><button>보내기</button></form>`}</section></div>`;
}

function openStoryUser(userId) {
  storyQueue=state.stories.filter(item=>Number(item.user)===Number(userId)).sort((a,b)=>new Date(a.created)-new Date(b.created));
  if (!storyQueue.length) { modal='story';modalDraft={};render();return; }
  storyIndex=0;activeStory=storyQueue[0].id;storyPaused=false;storyProgress=0;storyRemaining=5000;render();startStoryTimer();
}
function startStoryTimer() {
  clearTimeout(storyTimer);
  if (!activeStory||storyPaused) return;
  storyDeadline=Date.now()+storyRemaining;
  storyTimer=setTimeout(advanceStory,storyRemaining);
}
function advanceStory() {
  if (storyIndex+1<storyQueue.length) {
    storyIndex++;activeStory=storyQueue[storyIndex].id;storyPaused=false;storyProgress=0;storyRemaining=5000;render();startStoryTimer();
  } else closeStory();
}
function pauseStory() {
  if (!activeStory||storyPaused) return;
  storyRemaining=Math.max(0,storyDeadline-Date.now());
  storyProgress=Math.min(1,1-storyRemaining/5000);
  storyPaused=true;clearTimeout(storyTimer);render();
}
function resumeStory() {
  if (!activeStory||!storyPaused) return;
  storyPaused=false;render();startStoryTimer();
}
function closeStory() {
  clearTimeout(storyTimer);activeStory=null;storyQueue=[];storyIndex=0;storyDeadline=0;storyRemaining=5000;storyProgress=0;storyPaused=false;storyTouchPaused=false;render();
}

function bind() {
  document.querySelectorAll('[data-page]').forEach(button=>button.onclick=async()=>{
    page=button.dataset.page;
    if (page==='notifications') { try { await api('/api/notifications/read',{method:'PATCH',body:'{}'}); await refresh(false); } catch {} }
    render();
  });
  document.querySelectorAll('[data-modal]').forEach(button=>button.onclick=()=>{modal=button.dataset.modal;modalDraft={};render();});
  document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>{modal=null;render();});
  document.querySelector('#modal-bg')?.addEventListener('click',event=>{if(event.target.id==='modal-bg'){modal=null;render();}});
  document.querySelectorAll('[data-close-story]').forEach(button=>button.onclick=closeStory);
  document.querySelector('#story-bg')?.addEventListener('click',event=>{if(event.target.id==='story-bg')closeStory();});
  document.querySelectorAll('[data-story-user]').forEach(button=>button.onclick=()=>openStoryUser(button.dataset.storyUser));
  document.querySelector('[data-story-toggle]')?.addEventListener('click',()=>storyPaused?resumeStory():pauseStory());
  document.querySelector('.story-view')?.addEventListener('pointerdown',event=>{if(event.pointerType==='touch'&&!event.target.closest('button,input,form')){storyTouchPaused=true;pauseStory();}});
  document.querySelectorAll('[data-like]').forEach(button=>button.onclick=async()=>mutate(`/api/posts/${button.dataset.like}/like`,{},'좋아요를 저장했습니다.'));
  document.querySelectorAll('[data-comment]').forEach(form=>form.onsubmit=async event=>{event.preventDefault();const input=form.querySelector('input'),text=input.value.trim();if(!text)return;await mutate(`/api/posts/${form.dataset.comment}/comments`,{text},'댓글을 남겼습니다.');});
  document.querySelectorAll('[data-comment-focus]').forEach(button=>button.onclick=()=>document.querySelector(`[data-comment="${button.dataset.commentFocus}"] input`)?.focus());
  document.querySelectorAll('[data-delete-post]').forEach(button=>button.onclick=async()=>{if(!confirm('이 게시물을 삭제할까요?'))return;await mutate(`/api/posts/${button.dataset.deletePost}`,{},'게시물을 삭제했습니다.','DELETE');});
  document.querySelectorAll('[data-chat]').forEach(button=>button.onclick=()=>{activeChat=button.dataset.chat;render();});
  document.querySelectorAll('[data-dm]').forEach(button=>button.onclick=async()=>{try{const result=await api('/api/chats',{method:'POST',body:JSON.stringify({members:[Number(button.dataset.dm)]})});activeChat=result.id;page='messages';await refresh(false);render();}catch(error){toast(error.message);}});
  document.querySelectorAll('[data-bg]').forEach(button=>button.onclick=()=>saveBackground(button.dataset.bg));
  document.querySelector('#bg-upload')?.addEventListener('change',async event=>{if(event.target.files[0])await saveBackground(await imageData(event.target.files[0],1200));});
  document.querySelector('#create-form')?.addEventListener('submit',submitContent);
  document.querySelector('#create-form [name=image]')?.addEventListener('change',async event=>{if(event.target.files[0]){modalDraft.image=await imageData(event.target.files[0],1400);document.querySelector('#file-preview').innerHTML=`<img class="preview-image" src="${modalDraft.image}">`;}});
  document.querySelector('#profile-form')?.addEventListener('submit',saveProfile);
  document.querySelector('#profile-form [name=photo]')?.addEventListener('change',async event=>{if(event.target.files[0]){modalDraft.photo=await imageData(event.target.files[0],512);document.querySelector('#profile-preview').innerHTML=`<img class="preview-image avatar-preview" src="${modalDraft.photo}">`;}});
  document.querySelector('#chat-form')?.addEventListener('submit',createChat);
  document.querySelector('#chat-send')?.addEventListener('submit',sendMessage);
  document.querySelector('#story-reply')?.addEventListener('submit',sendStoryReply);
  document.querySelector('[data-logout]')?.addEventListener('click',logout);
}
async function mutate(url,body,message,method='POST') { try { await api(url,{method,body:JSON.stringify(body)}); await refresh(false);render();toast(message); } catch(error) { toast(error.message); } }
async function submitContent(event) {
  event.preventDefault(); const form=event.currentTarget,fd=new FormData(form),kind=modal;
  try {
    await api(kind==='post'?'/api/posts':'/api/stories',{method:'POST',body:JSON.stringify({caption:fd.get('caption'),emoji:fd.get('emoji'),image:modalDraft.image||''})});
    modal=null;modalDraft={};await refresh(false);render();toast(kind==='post'?'게시물과 스토리를 올렸습니다.':'스토리를 공유했습니다.');
  } catch(error) { toast(error.message); }
}
async function saveProfile(event) {
  event.preventDefault();const fd=new FormData(event.currentTarget);
  try {
    const result=await api('/api/profile',{method:'PATCH',body:JSON.stringify({name:fd.get('name'),handle:fd.get('handle'),bio:fd.get('bio'),photo:modalDraft.photo||'',background:me().background||''})});
    currentUser=result.user;modal=null;modalDraft={};await refresh(false);render();toast('프로필을 저장했습니다.');
  } catch(error) { toast(error.message); }
}
async function saveBackground(value) {
  try {
    const result=await api('/api/profile',{method:'PATCH',body:JSON.stringify({name:me().name,handle:me().handle,bio:me().bio,background:value,photo:''})});
    currentUser=result.user;await refresh(false);render();toast('배경을 저장했습니다.');
  } catch(error) { toast(error.message); }
}
async function createChat(event) {
  event.preventDefault();const fd=new FormData(event.currentTarget),members=fd.getAll('members').map(Number);
  try { const result=await api('/api/chats',{method:'POST',body:JSON.stringify({title:fd.get('title'),members})});activeChat=result.id;page='messages';modal=null;await refresh(false);render(); }
  catch(error) { toast(error.message); }
}
async function sendMessage(event) {
  event.preventDefault();const input=event.currentTarget.querySelector('input'),text=input.value.trim();if(!text||!activeChat)return;
  try { await api(`/api/chats/${activeChat}/messages`,{method:'POST',body:JSON.stringify({text})});await refresh(false);render();document.querySelector('#messages')?.scrollTo(0,999999); }
  catch(error) { toast(error.message); }
}
async function sendStoryReply(event) {
  event.preventDefault();const text=event.currentTarget.querySelector('input').value.trim();if(!text)return;
  try { const result=await api(`/api/stories/${activeStory}/reply`,{method:'POST',body:JSON.stringify({text})});clearTimeout(storyTimer);activeStory=null;storyQueue=[];page='messages';activeChat=result.chatId;await refresh(false);render();toast('스토리에 답장했습니다.'); }
  catch(error) { toast(error.message); }
}
async function logout() {
  try { await api('/api/auth/logout',{method:'POST',body:'{}'}); } catch {}
  currentUser=null;state=null;activeChat=null;clearInterval(pollTimer);authMode='login';renderAuth();
}
async function imageData(file,max=1200) {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onerror=reject;
    reader.onload=()=>{const image=new Image();image.onerror=()=>reject(new Error('이미지를 읽을 수 없습니다.'));image.onload=()=>{let scale=Math.min(1,max/Math.max(image.width,image.height)),quality=.72,data='';const canvas=document.createElement('canvas'),context=canvas.getContext('2d');for(let attempt=0;attempt<6;attempt++){canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));context.drawImage(image,0,0,canvas.width,canvas.height);data=canvas.toDataURL('image/jpeg',quality);if(data.length<1_200_000)break;scale*=.78;quality=Math.max(.45,quality-.05);}resolve(data);};image.src=reader.result;};
    reader.readAsDataURL(file);
  });
}

document.addEventListener('pointerup',()=>{if(storyTouchPaused){storyTouchPaused=false;resumeStory();}});
document.addEventListener('pointercancel',()=>{if(storyTouchPaused){storyTouchPaused=false;resumeStory();}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&(modal||activeStory)){modal=null;if(activeStory){clearTimeout(storyTimer);activeStory=null;storyQueue=[];storyPaused=false;}render();}else if(activeStory&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)&&event.code==='Space'){event.preventDefault();storyPaused?resumeStory():pauseStory();}else if(activeStory&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)&&event.key==='ArrowRight')advanceStory();else if(activeStory&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)&&event.key==='ArrowLeft'&&storyIndex>0){storyIndex-=2;advanceStory();}});
start();
