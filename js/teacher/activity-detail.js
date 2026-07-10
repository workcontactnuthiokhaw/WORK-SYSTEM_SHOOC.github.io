/**
 * activity-detail.js — รายละเอียดกิจกรรม + รายชื่อนักเรียนที่ลงทะเบียน /pages/teacher/activity-detail.html?id=xxx
 * อนุมัติ/ปฏิเสธการลงทะเบียน (เฉพาะกิจกรรมที่ requires_approval = true)
 *
 * Element IDs ที่คาดหวัง:
 *   #activity-title, #activity-meta, #activity-status-badge
 *   #btn-edit-activity, #btn-manage-teachers, #btn-generate-qr, #btn-attendance
 *   #registration-table-body, #empty-state, #loading-state
 *   #filter-registration-status
 */

import { requireAuth } from '../auth/auth-guard.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';
import { renderStatusBadge, ACTIVITY_STATUS_LABELS, REGISTRATION_STATUS_LABELS } from '../shared/status-badge.js';

let activityId = null;
let allRegistrations = [];

const titleEl = document.getElementById('activity-title');
const metaEl = document.getElementById('activity-meta');
const statusBadgeEl = document.getElementById('activity-status-badge');
const editBtn = document.getElementById('btn-edit-activity');
const manageTeachersBtn = document.getElementById('btn-manage-teachers');
const generateQrBtn = document.getElementById('btn-generate-qr');
const attendanceBtn = document.getElementById('btn-attendance');
const filterStatus = document.getElementById('filter-registration-status');
const tableBody = document.getElementById('registration-table-body');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');

async function init() {
  const profile = await requireAuth(['admin', 'teacher']);
  if (!profile) return;

  const params = new URLSearchParams(window.location.search);
  activityId = params.get('id');
  if (!activityId) {
    Popup.error('ไม่พบกิจกรรม', 'ไม่ได้ระบุกิจกรรมที่ต้องการดู');
    window.location.href = './activities.html';
    return;
  }

  wireActionButtons();
  await loadActivityInfo();
  await loadRegistrations();
}

function wireActionButtons() {
  editBtn?.addEventListener('click', () => { window.location.href = `./activity-form.html?id=${activityId}`; });
  manageTeachersBtn?.addEventListener('click', () => { window.location.href = `./teachers-manage.html?id=${activityId}`; });
  generateQrBtn?.addEventListener('click', () => { window.location.href = `./qr-generate.html?id=${activityId}`; });
  attendanceBtn?.addEventListener('click', () => { window.location.href = `./attendance.html?id=${activityId}`; });
}

async function loadActivityInfo() {
  const { data, error } = await supabaseClient
    .from('activities')
    .select('*,activity_types(name),academic_years(year_name)', { filters: [['id', 'eq', activityId]] });

  if (error || !data || data.length === 0) {
    Popup.error('ไม่พบกิจกรรม', 'ไม่พบข้อมูลกิจกรรมนี้ในระบบ');
    window.location.href = './activities.html';
    return;
  }

  const a = data[0];
  titleEl && (titleEl.textContent = a.name);
  statusBadgeEl && (statusBadgeEl.innerHTML = renderStatusBadge(a.status, ACTIVITY_STATUS_LABELS));
  if (metaEl) {
    metaEl.innerHTML = `
      <span><i class="fi fi-rr-hashtag"></i> ${escapeHtml(a.activity_code)}</span>
      <span><i class="fi fi-rr-calendar"></i> ${new Date(a.start_datetime).toLocaleDateString('th-TH', { dateStyle: 'medium' })}</span>
      <span><i class="fi fi-rr-marker"></i> ${escapeHtml(a.location || 'ไม่ระบุ')}</span>
      <span><i class="fi fi-rr-users"></i> จำกัด ${a.max_participants ?? 'ไม่จำกัด'} ที่นั่ง</span>
      <span><i class="fi fi-rr-graduation-cap"></i> ${escapeHtml(a.academic_years?.year_name || '-')}</span>
    `;
  }
}

async function loadRegistrations() {
  loadingState?.classList.remove('is-hidden');

  const { data, error } = await supabaseClient
    .from('registrations')
    .select('*,students(student_code,classes(class_name),profiles(full_name))', {
      filters: [['activity_id', 'eq', activityId]],
      order: 'registered_at.asc',
    });

  loadingState?.classList.add('is-hidden');

  if (error) {
    Popup.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงรายชื่อนักเรียนที่ลงทะเบียนได้');
    return;
  }

  allRegistrations = data || [];
  renderTable(allRegistrations);
}

function renderTable(rows) {
  if (!tableBody) return;
  const statusFilter = filterStatus?.value || '';
  const filtered = statusFilter ? rows.filter((r) => r.status === statusFilter) : rows;

  tableBody.innerHTML = '';

  if (filtered.length === 0) {
    emptyState?.classList.remove('is-hidden');
    return;
  }
  emptyState?.classList.add('is-hidden');

  filtered.forEach((r) => {
    const student = r.students;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(student?.student_code || '-')}</td>
      <td>${escapeHtml(student?.profiles?.full_name || '-')}</td>
      <td class="cell-muted">${escapeHtml(student?.classes?.class_name || '-')}</td>
      <td>${renderStatusBadge(r.status, REGISTRATION_STATUS_LABELS)}</td>
      <td class="cell-actions">
        ${r.status === 'pending_approval'
          ? `<button class="btn btn-primary btn-sm btn-approve" data-id="${r.id}">อนุมัติ</button>
             <button class="btn btn-danger btn-sm btn-reject" data-id="${r.id}">ปฏิเสธ</button>`
          : '<span class="text-faint text-small">-</span>'}
      </td>
    `;
    tableBody.appendChild(tr);
  });

  tableBody.querySelectorAll('.btn-approve').forEach((btn) => {
    btn.addEventListener('click', () => updateRegistrationStatus(btn.dataset.id, 'approved'));
  });
  tableBody.querySelectorAll('.btn-reject').forEach((btn) => {
    btn.addEventListener('click', () => updateRegistrationStatus(btn.dataset.id, 'rejected'));
  });
}

async function updateRegistrationStatus(registrationId, newStatus) {
  const actionLabel = newStatus === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ';
  const confirmed = await Popup.confirm(`${actionLabel}การลงทะเบียน`, `ต้องการ${actionLabel}การลงทะเบียนนี้ใช่หรือไม่?`);
  if (!confirmed) return;

  const { error } = await supabaseClient.from('registrations').update({ status: newStatus }, [['id', 'eq', registrationId]]);

  if (error) {
    Popup.error(`${actionLabel}ไม่สำเร็จ`, 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    return;
  }

  Popup.toast('success', `${actionLabel}การลงทะเบียนสำเร็จ`);
  await loadRegistrations();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

filterStatus?.addEventListener('change', () => renderTable(allRegistrations));

init();