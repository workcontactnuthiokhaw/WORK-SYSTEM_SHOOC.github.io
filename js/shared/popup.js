/**
 * popup.js — ระบบ Pop-up Notification กลางของทั้งเว็บ
 * ใช้แทน alert(), confirm(), prompt() ของ browser ทั้งหมด (ห้ามใช้ของ browser ตามกติกาโปรเจกต์)
 *
 * วิธีใช้:
 *   Popup.success('บันทึกสำเร็จ', 'ข้อมูลถูกบันทึกเรียบร้อยแล้ว');
 *   Popup.error('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้');
 *   Popup.warning('คำเตือน', 'ที่นั่งเหลือน้อยแล้ว');
 *   Popup.information('แจ้งให้ทราบ', 'ระบบจะปิดปรับปรุงเวลา 22:00 น.');
 *   const ok = await Popup.confirm('ยืนยันการลบ', 'ต้องการลบข้อมูลนี้ใช่หรือไม่?');
 *   Popup.toast('success', 'เช็กชื่อสำเร็จ');
 */

const ICONS = {
  success: 'fi fi-rr-check-circle',
  error: 'fi fi-rr-cross-circle',
  warning: 'fi fi-rr-triangle-warning',
  information: 'fi fi-rr-info',
  confirm: 'fi fi-rr-interrogation',
};

function ensureOverlay() {
  let overlay = document.getElementById('popup-overlay-root');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'popup-overlay-root';
  overlay.className = 'popup-overlay';
  overlay.innerHTML = `
    <div class="popup-modal" role="dialog" aria-modal="true">
      <div class="popup-icon-wrap"><i></i></div>
      <div class="popup-title"></div>
      <div class="popup-message"></div>
      <div class="popup-actions"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function ensureToastStack() {
  let stack = document.getElementById('toast-stack-root');
  if (stack) return stack;
  stack = document.createElement('div');
  stack.id = 'toast-stack-root';
  stack.className = 'toast-stack';
  document.body.appendChild(stack);
  return stack;
}

function renderPopup({ type, title, message, buttons }) {
  const overlay = ensureOverlay();
  const iconWrap = overlay.querySelector('.popup-icon-wrap');
  const icon = overlay.querySelector('.popup-icon-wrap i');
  const titleEl = overlay.querySelector('.popup-title');
  const messageEl = overlay.querySelector('.popup-message');
  const actionsEl = overlay.querySelector('.popup-actions');

  iconWrap.className = `popup-icon-wrap ${type}`;
  icon.className = ICONS[type] || ICONS.information;
  titleEl.textContent = title || '';
  messageEl.textContent = message || '';
  actionsEl.innerHTML = '';

  buttons.forEach((btn) => {
    const btnEl = document.createElement('button');
    btnEl.className = `popup-btn ${btn.primary ? 'popup-btn-primary' : 'popup-btn-secondary'}`;
    btnEl.textContent = btn.label;
    btnEl.addEventListener('click', () => {
      closePopup();
      if (btn.onClick) btn.onClick();
    });
    actionsEl.appendChild(btnEl);
  });

  requestAnimationFrame(() => overlay.classList.add('is-open'));

  function onKeydown(e) {
    if (e.key === 'Escape') closePopup();
  }
  document.addEventListener('keydown', onKeydown, { once: true });
}

function closePopup() {
  const overlay = document.getElementById('popup-overlay-root');
  if (overlay) overlay.classList.remove('is-open');
}

const Popup = {
  /** แจ้งเตือนสำเร็จ (ปุ่มตกลงเดียว) */
  success(title, message) {
    renderPopup({
      type: 'success',
      title,
      message,
      buttons: [{ label: 'ตกลง', primary: true }],
    });
  },

  /** แจ้งเตือนข้อผิดพลาด (ปุ่มตกลงเดียว) */
  error(title, message) {
    renderPopup({
      type: 'error',
      title,
      message,
      buttons: [{ label: 'ตกลง', primary: true }],
    });
  },

  /** แจ้งเตือนคำเตือน (ปุ่มตกลงเดียว) */
  warning(title, message) {
    renderPopup({
      type: 'warning',
      title,
      message,
      buttons: [{ label: 'ตกลง', primary: true }],
    });
  },

  /** แจ้งข้อมูลทั่วไป (ปุ่มตกลงเดียว) */
  information(title, message) {
    renderPopup({
      type: 'information',
      title,
      message,
      buttons: [{ label: 'รับทราบ', primary: true }],
    });
  },

  /**
   * ป็อปอัพยืนยัน คืนค่าเป็น Promise<boolean>
   * ใช้แทน confirm() ของ browser เช่น: if (await Popup.confirm('ลบ?', '...')) { ... }
   */
  confirm(title, message) {
    return new Promise((resolve) => {
      renderPopup({
        type: 'confirm',
        title,
        message,
        buttons: [
          { label: 'ยกเลิก', primary: false, onClick: () => resolve(false) },
          { label: 'ยืนยัน', primary: true, onClick: () => resolve(true) },
        ],
      });
    });
  },

  /** Toast แจ้งเตือนสั้นๆ มุมขวาบน หายไปเองใน 3.5 วิ */
  toast(type, message, duration = 3500) {
    const stack = ensureToastStack();
    const toastEl = document.createElement('div');
    toastEl.className = `toast ${type}`;
    toastEl.innerHTML = `<i class="${ICONS[type] || ICONS.information}"></i><span>${message}</span>`;
    stack.appendChild(toastEl);
    setTimeout(() => {
      toastEl.style.opacity = '0';
      toastEl.style.transition = 'opacity 200ms ease';
      setTimeout(() => toastEl.remove(), 200);
    }, duration);
  },

  close: closePopup,
};

export default Popup;