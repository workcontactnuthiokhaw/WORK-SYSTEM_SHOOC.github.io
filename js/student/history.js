/**
 * history.js — ประวัติการเข้าร่วมกิจกรรมย้อนหลัง /pages/student/history.html
 * แสดงกิจกรรมทั้งหมดที่เคยเช็กชื่อ (ทุกสถานะใน attendance ไม่ใช่แค่ completed)
 *
 * Element IDs ที่คาดหวัง:
 *   #filter-academic-year, #search-input
 *   #data-table-body, #empty-state, #loading-state
 */

import { requireAuth } from '../auth/auth-guard.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';
import { renderStatusBadge, ATTENDANCE_STATUS_LABELS } from '../shared/status-badge.js';

let currentProfile = null;
let allHistory = [];

const yearSelect = document.getElementById('filter-academic-year');
const searchInput = document.getElementById('search-input');
const tableBody = document.getElementById('data-table-body');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');

async function init() {
  currentProfile = await requireAuth(['student']);
  if (!currentProfile) return;
  await loadFilterOptions();
  await loadHistory();
}

async function loadFilterOptions() {
  const { data } = await supabaseClient.from('academic_years').select('id,year_name', { order: 'start_date.desc' });
  if (yearSelect) {
    yearSelect.innerHTML = '<option value="">ทุกปีการศึกษา</option>';
    (data || []).forEach((y) => {
      const opt = document.createElement('option');
      opt.value = y.id;
      opt.textContent = y.year_name;
      yearSelect.appendChild(opt);
    });
  }
}

async function loadHistory() {
  loadingState?.classList.remove('is-hidden');

  const { data, error } = await supabaseClient
    .from('attendance')
    .select('*,activities(name,activity_code,start_datetime,academic_year_id,activity_types(name),academic_years(year_name))', {
      filters: [['student_id', 'eq', currentProfile.id]],
      order: 'updated_at.desc',
    });

  loadingState?.classList.add('is-hidden');

  if (error) {
    Popup.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงข้อมูลประวัติการเข้าร่วมกิจกรรมได้');
    return;
  }

  allHistory = data || [];
  renderTable(allHistory);
}

function renderTable(rows) {
  if (!tableBody) return;

  const keyword = (searchInput?.value || '').trim().toLowerCase();
  const yearFilter = yearSelect?.value || '';

  const filtered = rows.filter((r) => {
    const matchKeyword = (r.activities?.name || '').toLowerCase().includes(keyword);
    const matchYear = !yearFilter || r.activities?.academic_year_id === yearFilter;
    return matchKeyword && matchYear;
  });

  tableBody.innerHTML = '';

  if (filtered.length === 0) {
    emptyState?.classList.remove('is-hidden');
    return;
  }
  emptyState?.classList.add('is-hidden');

  filtered.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.activities?.name || '-')}</td>
      <td class="cell-muted">${escapeHtml(r.activities?.activity_types?.name || '-')}</td>
      <td class="cell-muted">${r.activities ? new Date(r.activities.start_datetime).toLocaleDateString('th-TH', { dateStyle: 'medium' }) : '-'}</td>
      <td class="cell-muted">${r.check_in_time ? new Date(r.check_in_time).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</td>
      <td>${r.score ?? '-'}</td>
      <td>${r.hours_earned ?? '-'}</td>
      <td>${renderStatusBadge(r.status, ATTENDANCE_STATUS_LABELS)}</td>
    `;
    tableBody.appendChild(tr);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

yearSelect?.addEventListener('change', () => renderTable(allHistory));
searchInput?.addEventListener('input', () => renderTable(allHistory));

init();