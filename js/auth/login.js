/**
 * login.js — จัดการฟอร์ม login ของหน้า index.html
 */

import supabaseClient from '../config/supabase-client.js';
import { getHomeForRole } from './auth-guard.js';
import Popup from '../shared/popup.js';
import { logAction } from '../shared/activity-logger.js';

const form = document.getElementById('login-form');
const emailInput = document.getElementById('login-email');
const passwordInput = document.getElementById('login-password');
const submitBtn = document.getElementById('login-submit');
const forgotLink = document.getElementById('login-forgot-link');

// ถ้า login ค้างอยู่แล้ว ให้เด้งไปหน้า dashboard ของ role ตัวเองทันที ไม่ต้อง login ซ้ำ
(async function redirectIfAlreadyLoggedIn() {
  const session = supabaseClient.auth.getSession();
  if (!session) return;

  const { data: userData } = await supabaseClient.auth.getUser();
  if (!userData) return;

  const { data: profileRows } = await supabaseClient
    .from('profiles')
    .select('id,full_name,role', { filters: [['id', 'eq', userData.id]] });

  if (profileRows && profileRows.length > 0) {
    sessionStorage.setItem('sams_current_profile', JSON.stringify(profileRows[0]));
    window.location.href = getHomeForRole(profileRows[0].role);
  }
})();

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle('is-loading', isLoading);
  submitBtn.textContent = isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ';
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    Popup.warning('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกอีเมลและรหัสผ่านให้ครบ');
    return;
  }

  setLoading(true);

  const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword(email, password);

  if (signInError) {
    setLoading(false);
    Popup.error('เข้าสู่ระบบไม่สำเร็จ', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
    return;
  }

  // ดึง role จาก profiles เพื่อ redirect ให้ถูกหน้า
  const userId = signInData.user?.id;
  const { data: profileRows, error: profileError } = await supabaseClient
    .from('profiles')
    .select('id,role,full_name', { filters: [['id', 'eq', userId]] });

  setLoading(false);

  if (profileError || !profileRows || profileRows.length === 0) {
    Popup.error('ไม่พบข้อมูลผู้ใช้งาน', 'บัญชีนี้ยังไม่ได้ผูกกับข้อมูลผู้ใช้ในระบบ กรุณาติดต่อผู้ดูแลระบบ');
    await supabaseClient.auth.signOut();
    return;
  }

  const profile = profileRows[0];

  // เซฟ profile ลง cache ก่อน redirect เสมอ (สำคัญ!)
  // ป้องกันบั๊ก: layout.js ของหน้าถัดไปอ่าน sessionStorage ไม่เจอตอนเพิ่ง login ครั้งแรก
  // ทำให้เมนูที่ควรซ่อนตาม role (เช่น admin-only) ยังโชว์ค้างอยู่จนกว่าจะเปลี่ยนหน้าอีกครั้ง
  sessionStorage.setItem('sams_current_profile', JSON.stringify(profile));await logAction('login', null, { email }, profile.id);

  Popup.toast('success', `ยินดีต้อนรับ ${profile.full_name}`);
  setTimeout(() => {
    window.location.href = getHomeForRole(profile.role);
  }, 600);
});

forgotLink?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('login-panel')?.classList.add('is-hidden');
  document.getElementById('reset-panel')?.classList.remove('is-hidden');
});