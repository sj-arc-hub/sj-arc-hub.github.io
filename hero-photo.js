// A public display component. Uploads live on the authenticated administrator page.
class HeroPhoto extends HTMLElement {
  constructor() {
    super();
    this.view = this.attachShadow({ mode: 'open' });
  }
  connectedCallback() {
    if (this.started) return;
    this.started = true;
    this.light = this.getAttribute('variant') === 'light';
    this.style.cssText = this.light
      ? 'display:block;width:100%;overflow:hidden;border-radius:16px;background:#edf3e8;color:#5d6c60'
      : 'display:block;width:100%;height:100%;overflow:hidden;border-radius:18px;background:#1f262e;border:1px solid rgba(255,255,255,.12)';
    this.setAttribute('aria-busy', 'true');
    this.showPlaceholder('활동 사진을 불러오는 중입니다.');
    this.loadPhoto();
  }
  showPlaceholder(text) {
    const message = document.createElement('div');
    message.textContent = text;
    message.style.cssText = `height:100%;min-height:260px;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;color:${this.light?'#5d6c60':'#9aa6b5'};text-align:center;font-size:16px`;
    this.view.replaceChildren(message);
  }
  async loadPhoto() {
    try {
      const { site } = await import('./supabase-client.js');
      const data = await site.settings();
      const url = site.photoUrl(data.hero_path);
      if (!url) { this.showPlaceholder('SJ-ARC의 활동 사진을 준비하고 있습니다.'); return; }
      const photo = new Image();
      photo.alt = data.hero_alt;
      photo.decoding = 'async';
      photo.fetchPriority = 'high';
      photo.style.cssText = this.light ? 'display:block;width:100%;height:auto' : 'display:block;width:100%;height:100%;object-fit:cover';
      photo.src = url;
      await photo.decode();
      if (this.isConnected) this.view.replaceChildren(photo);
    } catch {
      this.showPlaceholder('활동 사진을 잠시 불러오지 못했습니다.');
    } finally {
      this.setAttribute('aria-busy', 'false');
    }
  }
}
if (!customElements.get('sjarc-hero')) customElements.define('sjarc-hero', HeroPhoto);
