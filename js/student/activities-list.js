/**
 * activities-list.js — รายการกิจกรรมที่เปิดลงทะเบียน /pages/student/activities-list.html
 * ค้นหา/filter (ปีการศึกษา, ประเภท, วันที่, สถานะ, ห้องเรียน) + ปุ่มลงทะเบียน
 *
 * Element IDs ที่คาดหวัง:
 *   #search-input, #filter-academic-year, #filter-type, #filter-status, #btn-apply-filter
 *   #activity-grid, #empty-state, #loading-state
 */

import { requireAuth } from '../auth/auth-guard.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';
import { renderSeatsBar } from '../shared/registration-limit.js';

let currentProfile = null;
let allActivities = [];

const searchInput = document.getElementById('search-input');
const yearSelect = document.getElementById('filter-academic-year');
const typeSelect = document.getElementById('filter-type');
const statusSelect = document.getElementById('filter-status');
const applyBtn = document.getElementById('btn-apply-filter');
const grid = document.getElementById('activity-grid');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');

const REGISTERABLE_STATUSES = ['published', 'registration_open'];

async function init() {
  currentProfile = await requireAuth(['student']);
  if (!currentProfile) return;
  await Promise.all([loadFilterOptions(), loadActivities()]);
}

async function loadFilterOptions() {
  const [yearsRes, typesRes] = await Promise.all([
    supabaseClient.from('academic_years').select('id,year_name', { order: 'start_date.desc' }),
    supabaseClient.from('activity_types').select('id,name', { order: 'name.asc' }),
  ]);
  fillSelect(yearSelect, yearsRes.data || [], 'ทุกปีการศึกษา', 'year_name');
  fillSelect(typeSelect, typesRes.data || [], 'ทุกประเภท', 'name');
}

function fillSelect(selectEl, items, placeholder, labelKey) {
  if (!selectEl) return;
  selectEl.innerHTML = `<option value="">${placeholder}</option>`;
  items.forEach((item) => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = item[labelKey];
    selectEl.appendChild(opt);
  });
}

async function loadActivities() {
  loadingState?.classList.remove('is-hidden');

  const filters = [];
  if (yearSelect?.value) filters.push(['academic_year_id', 'eq', yearSelect.value]);
  if (typeSelect?.value) filters.push(['activity_type_id', 'eq', typeSelect.value]);
  if (statusSelect?.value) {
    filters.push(['status', 'eq', statusSelect.value]);
  } else {
    filters.push(['status', 'in', `(${REGISTERABLE_STATUSES.join(',')})`]);
  }

  const { data, error } = await supabaseClient
    .from('activities')
    .select('*,activity_types(name),academic_years(year_name)', { filters, order: 'start_datetime.asc' });

  loadingState?.classList.add('is-hidden');

  if (error) {
    Popup.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงรายการกิจกรรมได้');
    return;
  }

  allActivities = data || [];
  await renderGrid(allActivities);
}

async function renderGrid(activities) {
  if (!grid) return;
  grid.innerHTML = '';

  const keyword = (searchInput?.value || '').trim().toLowerCase();
  const filtered = activities.filter(
    (a) => a.name.toLowerCase().includes(keyword) || a.activity_code.toLowerCase().includes(keyword)
  );

  if (filtered.length === 0) {
    emptyState?.classList.remove('is-hidden');
    return;
  }
  emptyState?.classList.add('is-hidden');

  // ดึงข้อมูลการลงทะเบียนของ "ทุกกิจกรรมที่เห็นอยู่" มาครั้งเดียว (1 query)
  // แทนการยิง query ทีละกิจกรรมในลูป (เดิมช้ามากถ้ามีหลายกิจกรรม เพราะยิงทีละคิว)
  const activityIds = filtered.map((a) => a.id);
  const { data: allRegs } = activityIds.length
    ? await supabaseClient.from('registrations').select('activity_id,student_id,status', {
        filters: [['activity_id', 'in', `(${activityIds.join(',')})`]],
      })
    : { data: [] };

  filtered.forEach((activity) => {
    const activityRegs = (allRegs || []).filter((r) => r.activity_id === activity.id);

    const registeredCount = activityRegs.filter((r) =>
      ['registered', 'approved', 'pending_approval'].includes(r.status)
    ).length;
    const maxParticipants = activity.max_participants;
    const isFull = maxParticipants != null && registeredCount >= maxParticipants;
    const capacityInfo = { registeredCount, maxParticipants, isFull };

    const myReg = activityRegs.find((r) => r.student_id === currentProfile.id);
    const regInfo = myReg ? { registered: true, status: myReg.status } : { registered: false, status: null };

    const card = document.createElement('div');
    card.className = 'student-activity-card';
    card.innerHTML = `
      <div class="student-activity-cover"><i class="fi fi-rr-calendar-star"></i></div>
      <div class="student-activity-body">
        <div class="student-activity-type">${escapeHtml(activity.activity_types?.name || '-')}</div>
        <div class="student-activity-title">${escapeHtml(activity.name)}</div>
        <div class="student-activity-meta">
          <span><i class="fi fi-rr-calendar"></i> ${new Date(activity.start_datetime).toLocaleDateString('th-TH', { dateStyle: 'medium' })}</span>
          <span><i class="fi fi-rr-marker"></i> ${escapeHtml(activity.location || 'ไม่ระบุสถานที่')}</span>
        </div>
        ${renderSeatsBar(capacityInfo.registeredCount, capacityInfo.maxParticipants)}
        <div class="student-activity-footer">
          ${renderActionButton(activity, capacityInfo, regInfo)}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  attachRegisterHandlers();
}

function renderActionButton(activity, capacityInfo, regInfo) {
  if (regInfo.registered) {
    return `<span class="badge badge-${regInfo.status}">ลงทะเบียนแล้ว</span>`;
  }
  if (capacityInfo.isFull) {
    return `<button class="btn btn-secondary btn-sm" disabled>ที่นั่งเต็มแล้ว</button>`;
  }
  return `<button class="btn btn-primary btn-sm btn-register" data-id="${activity.id}" data-requires-approval="${activity.requires_approval}">ลงทะเบียน</button>`;
}

function attachRegisterHandlers() {
  grid.querySelectorAll('.btn-register').forEach((btn) => {
    btn.addEventListener('click', () => handleRegister(btn.dataset.id, btn.dataset.requiresApproval === 'true'));
  });
}

async function handleRegister(activityId, requiresApproval) {
  const confirmed = await Popup.confirm(
    'ยืนยันการลงทะเบียน',
    requiresApproval
      ? 'กิจกรรมนี้ต้องรอการอนุมัติจากครูก่อน ต้องการลงทะเบียนใช่หรือไม่?'
      : 'ต้องการลงทะเบียนเข้าร่วมกิจกรรมนี้ใช่หรือไม่?'
  );
  if (!confirmed) return;

  const { error } = await supabaseClient.from('registrations').insert({
    student_id: currentProfile.id,
    activity_id: activityId,
    status: requiresApproval ? 'pending_approval' : 'registered',
  });

  if (error) {
    const message = String(error.message || '');
    if (message.includes('ที่นั่งเต็ม')) {
      Popup.error('ที่นั่งเต็มแล้ว', 'มีคนลงทะเบียนที่นั่งสุดท้ายไปก่อนแล้ว กรุณาเลือกกิจกรรมอื่น');
    } else if (message.includes('duplicate') || error.code === '23505') {
      Popup.warning('ลงทะเบียนซ้ำ', 'คุณลงทะเบียนกิจกรรมนี้ไปแล้ว');
    } else {
      Popup.error('ลงทะเบียนไม่สำเร็จ', 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    }
    return;
  }

  Popup.toast('success', requiresApproval ? 'ลงทะเบียนสำเร็จ รอการอนุมัติ' : 'ลงทะเบียนสำเร็จ');
  await loadActivities();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

applyBtn?.addEventListener('click', loadActivities);
searchInput?.addEventListener('input', () => renderGrid(allActivities));

init();
