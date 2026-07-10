/**
 * teachers-manage.js — กำหนดครูผู้รับผิดชอบกิจกรรม /pages/teacher/teachers-manage.html?id=xxx
 * เพิ่ม/ลบครูในกิจกรรม (many-to-many ผ่าน activity_teachers) พร้อมระบุบทบาท (หัวหน้า/ผู้ช่วย)
 *
 * Element IDs ที่คาดหวัง:
 *   #activity-title, #assigned-teachers-list
 *   #add-teacher-form, #teacher-select, #role-select, #form-submit-btn
 *   #loading-state
 */

import { requireAuth } from '../auth/auth-guard.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';

let activityId = null;
let allTeachers = [];
let assignedTeachers = [];

const titleEl = document.getElementById('activity-title');
const listEl = document.getElementById('assigned-teachers-list');
const form = document.getElementById('add-teacher-form');
const teacherSelect = document.getElementById('teacher-select');
const roleSelect = document.getElementById('role-select');
const submitBtn = document.getElementById('form-submit-btn');
const loadingState = document.getElementById('loading-state');

async function init() {
  const profile = await requireAuth(['admin', 'teacher']);
  if (!profile) return;

  const params = new URLSearchParams(window.location.search);
  activityId = params.get('id');
  if (!activityId) {
    Popup.error('ไม่พบกิจกรรม', 'ไม่ได้ระบุกิจกรรมที่ต้องการจัดการ');
    window.location.href = './activities.html';
    return;
  }

  await loadActivityInfo();
  await loadAllTeachers();
  await loadAssignedTeachers();
}

async function loadActivityInfo() {
  const { data } = await supabaseClient.from('activities').select('name', { filters: [['id', 'eq', activityId]] });
  if (titleEl && data && data.length > 0) titleEl.textContent = `ครูผู้รับผิดชอบ: ${data[0].name}`;
}

async function loadAllTeachers() {
  const { data } = await supabaseClient
    .from('teachers')
    .select('id,teacher_code,profiles(full_name)', { order: 'teacher_code.asc' });
  allTeachers = data || [];

  if (teacherSelect) {
    teacherSelect.innerHTML = '<option value="">เลือกครู</option>';
    allTeachers.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.profiles?.full_name || '-'} (${t.teacher_code})`;
      teacherSelect.appendChild(opt);
    });
  }
}

async function loadAssignedTeachers() {
  loadingState?.classList.remove('is-hidden');

  const { data, error } = await supabaseClient
    .from('activity_teachers')
    .select('*,teachers(teacher_code,profiles(full_name))', { filters: [['activity_id', 'eq', activityId]] });

  loadingState?.classList.add('is-hidden');

  if (error) {
    Popup.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงรายชื่อครูผู้รับผิดชอบได้');
    return;
  }

  assignedTeachers = data || [];
  renderList();
}

function renderList() {
  if (!listEl) return;
  listEl.innerHTML = '';

  if (assignedTeachers.length === 0) {
    listEl.innerHTML = '<p class="text-muted text-small">ยังไม่มีครูผู้รับผิดชอบกิจกรรมนี้</p>';
    return;
  }

  assignedTeachers.forEach((at) => {
    const fullName = at.teachers?.profiles?.full_name || '-';
    const initials = fullName.charAt(0) || '?';
    const chip = document.createElement('span');
    chip.className = 'teacher-chip';
    chip.innerHTML = `
      <span class="teacher-chip-avatar">${escapeHtml(initials)}</span>
      <span>${escapeHtml(fullName)}</span>
      <span class="teacher-chip-role">(${escapeHtml(at.role_in_activity)})</span>
      <button class="teacher-chip-remove" data-id="${at.id}" aria-label="นำออก"><i class="fi fi-rr-cross"></i></button>
    `;
    listEl.appendChild(chip);
  });

  listEl.querySelectorAll('.teacher-chip-remove').forEach((btn) => {
    btn.addEventListener('click', () => removeTeacher(btn.dataset.id));
  });
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const teacherId = teacherSelect.value;
  const roleInActivity = roleSelect.value || 'ผู้ช่วย';

  if (!teacherId) {
    Popup.warning('กรุณาเลือกครู', 'เลือกครูที่ต้องการเพิ่มเป็นผู้รับผิดชอบกิจกรรมนี้');
    return;
  }

  if (assignedTeachers.some((at) => at.teacher_id === teacherId)) {
    Popup.warning('ครูคนนี้ถูกเพิ่มไปแล้ว', 'ครูท่านนี้เป็นผู้รับผิดชอบกิจกรรมนี้อยู่แล้ว');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.classList.add('is-loading');

  const { error } = await supabaseClient.from('activity_teachers').insert({
    activity_id: activityId,
    teacher_id: teacherId,
    role_in_activity: roleInActivity,
  });

  submitBtn.disabled = false;
  submitBtn.classList.remove('is-loading');

  if (error) {
    Popup.error('เพิ่มไม่สำเร็จ', 'คุณอาจไม่มีสิทธิ์แก้ไขกิจกรรมนี้ หรือเกิดข้อผิดพลาด');
    return;
  }

  Popup.toast('success', 'เพิ่มครูผู้รับผิดชอบสำเร็จ');
  form.reset();
  await loadAssignedTeachers();
});

async function removeTeacher(activityTeacherId) {
  const confirmed = await Popup.confirm('นำครูออกจากกิจกรรม', 'ต้องการนำครูท่านนี้ออกจากผู้รับผิดชอบกิจกรรมนี้ใช่หรือไม่?');
  if (!confirmed) return;

  const { error } = await supabaseClient.from('activity_teachers').delete([['id', 'eq', activityTeacherId]]);
  if (error) {
    Popup.error('นำออกไม่สำเร็จ', 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    return;
  }

  Popup.toast('success', 'นำครูออกจากกิจกรรมสำเร็จ');
  await loadAssignedTeachers();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

init();