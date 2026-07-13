/**
 * logout.js — จัดการปุ่มออกจากระบบ ใช้ import ร่วมกันได้จากทุกหน้า (topbar)
 *
 * วิธีใช้: <button id="logout-btn">ออกจากระบบ</button>
 *   import '../auth/logout.js'; (หรือ path ที่ตรงกับตำแหน่งไฟล์)
 */

import { logAction } from '../shared/activity-logger.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';

const LOGOUT_SUFFIX = '/js/auth/logout.js';
const scriptPath = new URL(import.meta.url).pathname;
const BASE_PATH = scriptPath.endsWith(LOGOUT_SUFFIX)
  ? scriptPath.slice(0, -LOGOUT_SUFFIX.length)
  : '';

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('#logout-btn');
  if (!btn) return;

  const confirmed = await Popup.confirm('ออกจากระบบ', 'ต้องการออกจากระบบใช่หรือไม่?');
  if (!confirmed) return;

  await logAction('logout', null, {});await supabaseClient.auth.signOut();
  sessionStorage.removeItem('sams_current_profile');
  window.location.href = `${BASE_PATH}/index.html`;
});