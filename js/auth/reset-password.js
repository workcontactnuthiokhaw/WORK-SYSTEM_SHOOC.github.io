/**
 * reset-password.js — จัดการ 2 กรณี บนหน้า index.html เดียวกัน:
 *   1) ฟอร์มขอลิงก์รีเซ็ตรหัสผ่าน (กรอกอีเมล -> ส่งลิงก์)
 *   2) ฟอร์มตั้งรหัสผ่านใหม่ (เมื่อผู้ใช้กดลิงก์จากอีเมลกลับมาที่เว็บ พร้อม access_token ใน URL)
 */

import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';

const RESET_SUFFIX = '/js/auth/reset-password.js';
const scriptPath = new URL(import.meta.url).pathname;
const BASE_PATH = scriptPath.endsWith(RESET_SUFFIX)
  ? scriptPath.slice(0, -RESET_SUFFIX.length)
  : '';

const resetRequestForm = document.getElementById('reset-request-form');
const resetEmailInput = document.getElementById('reset-email');
const resetSubmitBtn = document.getElementById('reset-submit');
const backToLoginLink = document.getElementById('back-to-login-link');

const newPasswordForm = document.getElementById('new-password-form');
const newPasswordInput = document.getElementById('new-password');
const newPasswordConfirmInput = document.getElementById('new-password-confirm');

// ---------- กรณีที่ 1: ขอลิงก์รีเซ็ตรหัสผ่าน ----------
resetRequestForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = resetEmailInput.value.trim();
  if (!email) {
    Popup.warning('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกอีเมลที่ใช้ลงทะเบียน');
    return;
  }

  resetSubmitBtn.disabled = true;
  resetSubmitBtn.textContent = 'กำลังส่ง...';

  const redirectTo = `${window.location.origin}${BASE_PATH}/index.html`;
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, redirectTo);

  resetSubmitBtn.disabled = false;
  resetSubmitBtn.textContent = 'ส่งลิงก์รีเซ็ตรหัสผ่าน';

  if (error) {
    Popup.error('ส่งอีเมลไม่สำเร็จ', 'กรุณาตรวจสอบอีเมลอีกครั้ง หรือติดต่อผู้ดูแลระบบ');
    return;
  }

  Popup.success('ส่งอีเมลแล้ว', `กรุณาตรวจสอบกล่องอีเมลของ ${email} เพื่อรับลิงก์ตั้งรหัสผ่านใหม่`);
});

backToLoginLink?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('reset-panel')?.classList.add('is-hidden');
  document.getElementById('login-panel')?.classList.remove('is-hidden');
});

// ---------- กรณีที่ 2: ตั้งรหัสผ่านใหม่ (มาจากลิงก์ในอีเมล) ----------
// Supabase จะแนบ access_token มาใน URL hash เช่น #access_token=...&type=recovery
(function detectRecoveryTokenFromUrl() {
  const hash = window.location.hash;
  if (!hash || !hash.includes('type=recovery')) return;

  const params = new URLSearchParams(hash.replace('#', ''));
  const accessToken = params.get('access_token');
  if (!accessToken) return;

  // เก็บ token ชั่วคราวไว้ใช้เรียก updatePassword (ยังไม่ถือเป็น session ใช้งานเต็มรูปแบบ)
  localStorage.setItem('sams_auth_session', JSON.stringify({ access_token: accessToken }));

  document.getElementById('login-panel')?.classList.add('is-hidden');
  document.getElementById('reset-panel')?.classList.add('is-hidden');
  document.getElementById('new-password-panel')?.classList.remove('is-hidden');
})();

newPasswordForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = newPasswordInput.value;
  const confirmPassword = newPasswordConfirmInput.value;

  if (!password || password.length < 6) {
    Popup.warning('รหัสผ่านสั้นเกินไป', 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    return;
  }
  if (password !== confirmPassword) {
    Popup.warning('รหัสผ่านไม่ตรงกัน', 'กรุณากรอกรหัสผ่านทั้งสองช่องให้ตรงกัน');
    return;
  }

  const { error } = await supabaseClient.auth.updatePassword(password);

  if (error) {
    Popup.error('ตั้งรหัสผ่านใหม่ไม่สำเร็จ', 'ลิงก์อาจหมดอายุ กรุณาขอลิงก์ใหม่อีกครั้ง');
    return;
  }

  Popup.success('เปลี่ยนรหัสผ่านสำเร็จ', 'กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่');
  localStorage.removeItem('sams_auth_session');
  setTimeout(() => {
    window.location.href = `${BASE_PATH}/index.html`;
  }, 1200);
});