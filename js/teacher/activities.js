/**
 * activities.js — รายการกิจกรรมทั้งหมด /pages/teacher/activities.html
 * ครูเห็นกิจกรรมทั้งหมดในระบบ แต่แก้ไข/ลบได้เฉพาะกิจกรรมที่ตนเองรับผิดชอบ
 * (การบังคับสิทธิ์จริงอยู่ที่ RLS policy activities_update_owner/activities_delete_owner ใน SQL)
 *
 * Element IDs ที่คาดหวัง:
 *   #search-input, #filter-academic-year, #filter-type, #filter-status, #btn-apply-filter
 *   #activity-grid, #empty-state, #loading-state, #btn-create-activity
 */

import { requireAuth } from '../auth/auth-guard.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';
import { renderStatusBadge, ACTIVITY_STATUS_LABELS } from '../shared/status-badge.js';

let currentProfile = null;
let myTeacherActivityIds = new Set();
let allActivities = [];

const searchInput = document.getElementById('search-input');
const yearSelect = document.getElementById('filter-academic-year');
const typeSelect = document.getElementById('filter-type');
const statusSelect = document.getElementById('filter-status');
const applyBtn = document.getElementById('btn-apply-filter');
const createBtn = document.getElementById('btn-create-activity');
const grid = document.getElementById('activity-grid');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');

async function init() {
  currentProfile = await requireAuth(['admin', 'teacher']);
  if (!currentProfile) return;
  await loadOwnedActivityIds();
  await loadFilterOptions();
  await loadActivities();
}

async function loadOwnedActivityIds() {
  const { data } = await supabaseClient
    .from('activity_teachers')
    .select('activity_id', { filters: [['teacher_id', 'eq', currentProfile.id]] });
  myTeacherActivityIds = new Set((data || []).map((r) => r.activity_id));
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
  if (statusSelect?.value) filters.push(['status', 'eq', statusSelect.value]);

  const { data, error } = await supabaseClient
    .from('activities')
    .select('*,activity_types(name),academic_years(year_name)', { filters, order: 'start_datetime.desc' });

  loadingState?.classList.add('is-hidden');

  if (error) {
    Popup.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงรายการกิจกรรมได้');
    return;
  }

  allActivities = data || [];
  renderGrid(allActivities);
}

function renderGrid(activities) {
  if (!grid) return;

  const keyword = (searchInput?.value || '').trim().toLowerCase();
  const filtered = activities.filter(
    (a) => a.name.toLowerCase().includes(keyword) || a.activity_code.toLowerCase().includes(keyword)
  );

  grid.innerHTML = '';

  if (filtered.length === 0) {
    emptyState?.classList.remove('is-hidden');
    return;
  }
  emptyState?.classList.add('is-hidden');

  filtered.forEach((a) => {
    const isOwner = currentProfile.role === 'admin' || myTeacherActivityIds.has(a.id);
    const card = document.createElement('div');
    card.className = 'activity-card';
    card.innerHTML = `
      <div class="activity-card-header">
        <div>
          <div class="activity-card-type">${escapeHtml(a.activity_types?.name || '-')}</div>
          <div class="activity-card-title">${escapeHtml(a.name)}</div>
        </div>
        ${renderStatusBadge(a.status, ACTIVITY_STATUS_LABELS)}
      </div>
      <div class="activity-card-meta">
        <span><i class="fi fi-rr-calendar"></i> ${new Date(a.start_datetime).toLocaleDateString('th-TH', { dateStyle: 'medium' })}</span>
        <span><i class="fi fi-rr-marker"></i> ${escapeHtml(a.location || 'ไม่ระบุ')}</span>
        <span><i class="fi fi-rr-users"></i> จำกัด ${a.max_participants ?? 'ไม่จำกัด'}</span>
      </div>
      <div class="activity-card-footer">
        ${isOwner
          ? `<div style="display:flex;gap:8px">
              <a class="btn btn-secondary btn-sm" href="./activity-detail.html?id=${a.id}">รายละเอียด</a>
              <a class="btn btn-outline-primary btn-sm" href="./activity-form.html?id=${a.id}">แก้ไข</a>
            </div>`
          : `<a class="btn btn-secondary btn-sm" href="./activity-detail.html?id=${a.id}">ดูรายละเอียด</a>
             <span class="view-only-tag"><i class="fi fi-rr-eye"></i> ดูอย่างเดียว</span>`
        }
      </div>
    `;
    grid.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

applyBtn?.addEventListener('click', loadActivities);
searchInput?.addEventListener('input', () => renderGrid(allActivities));
createBtn?.addEventListener('click', () => {
  window.location.href = './activity-form.html';
});

init();