/**
 * layout.js — จัดการพฤติกรรมร่วมของ shell หลังบ้านทุกหน้า (sidebar + topbar)
 * ไม่ได้อยู่ในลิสต์ไฟล์ตั้งต้น แต่จำเป็นเพราะทุกหน้าหลัง login ต้องมี sidebar/topbar ที่ทำงานได้จริง
 *
 * วิธีใช้: import ไว้ท้ายไฟล์ HTML ทุกหน้าหลัง login (พร้อมกับ auth-guard/logout)
 *   <script type="module" src="/js/shared/layout.js"></script>
 *
 * Element IDs ที่คาดหวัง: #sidebar, #sidebar-backdrop, #topbar-menu-btn,
 *   #sidebar-collapse-btn, #app-shell, #topbar-user-name, #topbar-user-role, #topbar-user-avatar
 */

const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('sidebar-backdrop');
const menuBtn = document.getElementById('topbar-menu-btn');
const collapseBtn = document.getElementById('sidebar-collapse-btn');
const appShell = document.getElementById('app-shell');

function openSidebar() {
  sidebar?.classList.add('is-open');
  backdrop?.classList.add('is-visible');
}

function closeSidebar() {
  sidebar?.classList.remove('is-open');
  backdrop?.classList.remove('is-visible');
}

menuBtn?.addEventListener('click', () => {
  if (sidebar?.classList.contains('is-open')) closeSidebar();
  else openSidebar();
});

backdrop?.addEventListener('click', closeSidebar);

collapseBtn?.addEventListener('click', () => {
  sidebar?.classList.toggle('is-collapsed');
  appShell?.classList.toggle('is-sidebar-collapsed');
});

// แสดงชื่อ/role ผู้ใช้ปัจจุบันที่ topbar + ตั้ง data-user-role ให้ CSS ใช้ซ่อน/แสดงเมนูตามสิทธิ์
(function renderCurrentUser() {
  const raw = sessionStorage.getItem('sams_current_profile');
  if (!raw) return;

  try {
    const profile = JSON.parse(raw);
    const nameEl = document.getElementById('topbar-user-name');
    const roleEl = document.getElementById('topbar-user-role');
    const avatarEl = document.getElementById('topbar-user-avatar');

    const roleLabels = { admin: 'ผู้ดูแลระบบ', teacher: 'ครู', student: 'นักเรียน' };

    if (nameEl) nameEl.textContent = profile.full_name;
    if (roleEl) roleEl.textContent = roleLabels[profile.role] || profile.role;
    if (avatarEl) avatarEl.textContent = (profile.full_name || '?').charAt(0);

    // ใช้ selector เช่น :root[data-user-role="student"] .admin-only { display:none } ใน sidebar.css
    document.documentElement.dataset.userRole = profile.role;
  } catch {
    // ไม่ต้องทำอะไร ถ้า parse ไม่สำเร็จ
  }
})();