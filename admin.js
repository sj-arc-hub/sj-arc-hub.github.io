import { readableError } from './site-api.js';
import { preparePhoto } from './image-upload.js';

const el = id => document.getElementById(id);
let client, site, settings, selected, previewUrl, busy = false, selectionVersion = 0, accountVersion = 0;
let sessionUserId = null;
const roles = { pending: '승인 대기', member: '동아리원', admin: '운영진' };

function status(message, error = false) {
  el('status').textContent = message;
  el('status').classList.toggle('error', error);
}
function saveStatus(message, error = false) {
  el('save-status').textContent = message;
  el('save-status').classList.toggle('error-text', error);
}
function controls() {
  el('photo').disabled = busy;
  el('description').disabled = busy;
  el('save').disabled = busy || !selected || !settings || !el('description').value.trim();
  el('cancel').disabled = busy || !selected;
  el('refresh').disabled = busy;
  el('logout').disabled = busy;
}
function releasePreview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
}
function showImage(url, alt) {
  el('preview').hidden = !url;
  el('photo-empty').hidden = !!url;
  if (url) { el('preview').src = url; el('preview').alt = alt; }
  else el('preview').removeAttribute('src');
}
function showSaved() {
  selectionVersion++;
  selected = null;
  releasePreview();
  el('photo').value = '';
  el('description').value = settings?.hero_alt || '';
  showImage(settings ? site.photoUrl(settings.hero_path) : '', settings?.hero_alt || '대표 활동 사진');
  el('preview-label').textContent = '현재 공개된 사진';
  el('saved-at').textContent = settings?.hero_path ? '최근 저장: ' + new Date(settings.updated_at).toLocaleString('ko-KR') : '';
  controls();
}
async function refreshAccount() {
  if (busy) return;
  const version = ++accountVersion;
  el('editor').hidden = true;
  el('management').hidden = true;
  el('pending').hidden = true;
  el('signed-out').hidden = true;
  try {
    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    if (version !== accountVersion) return;
    sessionUserId = session?.user?.id || null;
    el('account').hidden = !session;
    if (!session) {
      settings = null; selected = null; releasePreview();
      el('signed-out').hidden = false;
      status('Google 계정으로 로그인해 주세요.');
      return;
    }
    el('account-name').textContent = session.user.email || '로그인한 계정';
    el('account-role').textContent = '권한 확인 중';
    const profile = await site.profile(session.user.id);
    if (version !== accountVersion) return;
    el('account-role').textContent = roles[profile.role] || '권한 확인 필요';
    if (profile.role !== 'admin') {
      settings = null; selected = null; releasePreview();
      el('pending').hidden = false;
      el('member-heading').textContent = profile.role === 'member' ? '동아리원으로 승인됐습니다' : '회원 승인을 기다리고 있습니다';
      el('member-description').textContent = profile.role === 'member' ? '게시판에서 글을 작성하고, 자료를 첨부해 승급 심사를 요청할 수 있습니다.' : '운영진에게 회원 명단과 이 Google 계정의 연결·승인을 요청해 주세요.';
      status('로그인했습니다. 아래에서 게시판과 레벨 현황을 열 수 있습니다.');
      return;
    }
    el('management').hidden = false;
    const current = await site.settings();
    if (version !== accountVersion) return;
    settings = current;
    showSaved();
    saveStatus('');
    el('editor').hidden = false;
    status('운영진 권한이 확인됐습니다. 대표 사진을 변경할 수 있습니다.');
  } catch (error) {
    if (version !== accountVersion) return;
    el('signed-out').hidden = !!sessionUserId;
    status(readableError(error), true);
  }
}

el('login').addEventListener('click', async () => {
  el('login').disabled = true;
  try {
    if (!(await site.googleEnabled())) {
      status('Google 로그인 설정이 아직 완료되지 않았습니다. 운영자에게 설정 확인을 요청해 주세요.', true);
      el('login').disabled = false;
      return;
    }
    const redirectTo = new URL('./admin.html', location.href).href;
    const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) throw error;
  } catch (error) { status(readableError(error), true); el('login').disabled = false; }
});
el('logout').addEventListener('click', async () => {
  if (busy) return;
  el('logout').disabled = true;
  try {
    const { error } = await client.auth.signOut();
    if (error) throw error;
    await refreshAccount();
  } catch (error) { status(readableError(error), true); }
  finally { el('logout').disabled = false; }
});
el('refresh').addEventListener('click', refreshAccount);
el('description').addEventListener('input', controls);
el('cancel').addEventListener('click', () => { showSaved(); saveStatus('사진 선택을 취소했습니다.'); });
el('photo').addEventListener('change', async () => {
  const file = el('photo').files[0];
  if (!file || busy) return;
  const version = ++selectionVersion;
  const userId = sessionUserId;
  selected = null;
  controls();
  saveStatus('사진을 준비하고 있습니다.');
  try {
    const blob = await preparePhoto(file);
    if (version !== selectionVersion || userId !== sessionUserId || el('editor').hidden) return;
    selected = blob;
    releasePreview();
    previewUrl = URL.createObjectURL(blob);
    showImage(previewUrl, '선택한 대표 활동 사진 미리보기');
    el('preview-label').textContent = '선택한 사진 · 아직 공개되지 않았습니다';
    saveStatus(`준비 완료 · 약 ${Math.ceil(blob.size / 1024)}KB`);
  } catch (error) {
    if (version !== selectionVersion) return;
    showSaved(); saveStatus(error.message, true);
  }
  controls();
});
el('photo-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !selected || !settings) return;
  busy = true;
  controls();
  saveStatus('사진을 업로드하고 홈페이지에 연결하고 있습니다.');
  try {
    settings = await site.saveHero(selected, el('description').value, settings.revision);
    showSaved();
    saveStatus('저장했습니다. 홈페이지를 새로 열면 새 사진이 표시됩니다.');
  } catch (error) {
    saveStatus(readableError(error) + ' 현재 사진을 새로고침해 저장 여부를 확인할 수 있습니다.', true);
  } finally { busy = false; controls(); }
});
window.addEventListener('beforeunload', event => {
  if (busy) { event.preventDefault(); event.returnValue = ''; }
});

try {
  ({ client, site } = await import('./supabase-client.js'));
  // Never await Supabase calls inside its synchronous auth-state callback.
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && session?.user.id !== sessionUserId)) {
      setTimeout(refreshAccount, 0);
    }
  });
  await refreshAccount();
  const errorDescription = new URLSearchParams(location.hash.slice(1)).get('error_description')
    || new URLSearchParams(location.search).get('error_description');
  if (errorDescription) {
    status('Google 로그인을 완료하지 못했습니다. 계정과 로그인 설정을 확인해 주세요.', true);
    history.replaceState(null, '', location.pathname);
  }
} catch {
  el('signed-out').hidden = false;
  el('login').disabled = true;
  status('로그인 기능을 불러오지 못했습니다. 페이지를 새로고침해 주세요.', true);
}
