/**
 * activity-report.js — รายงานกิจกรรม /pages/reports/activity-report.html
 * แสดงตารางกิจกรรมพร้อมจำนวนผู้ลงทะเบียน/เข้าร่วมจริง filter ได้ตามปีการศึกษา/ประเภท/สถานะ
 *
 * Element IDs ที่คาดหวัง:
 *   #filter-academic-year, #filter-activity-type, #filter-status, #btn-apply-filter
 *   #btn-export-pdf, #btn-export-excel, #btn-export-csv
 *   #data-table-body, #empty-state, #loading-state
 */

import { requireAuth } from '../auth/auth-guard.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';
import { exportToPdf, exportToExcel, exportToCsv } from './export-utils.js';

let currentRows = [];

const yearSelect = document.getElementById('filter-academic-year');
const typeSelect = document.getElementById('filter-activity-type');
const statusSelect = document.getElementById('filter-status');
const applyBtn = document.getElementById('btn-apply-filter');
const exportPdfBtn = document.getElementById('btn-export-pdf');
const exportExcelBtn = document.getElementById('btn-export-excel');
const exportCsvBtn = document.getElementById('btn-export-csv');
const tableBody = document.getElementById('data-table-body');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');

const STATUS_LABELS = {
  draft: 'ร่าง', published: 'เผยแพร่แล้ว', registration_open: 'เปิดลงทะเบียน',
  registration_closed: 'ปิดลงทะเบียน', ongoing: 'กำลังดำเนินการ', completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก',
};

async function init() {
  const profile = await requireAuth();
  if (!profile) return;
  await loadFilterOptions();
  await loadReport();
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

async function loadReport() {
  loadingState?.classList.remove('is-hidden');

  const filters = [];
  if (yearSelect?.value) filters.push(['academic_year_id', 'eq', yearSelect.value]);
  if (typeSelect?.value) filters.push(['activity_type_id', 'eq', typeSelect.value]);
  if (statusSelect?.value) filters.push(['status', 'eq', statusSelect.value]);

  const { data: activities, error } = await supabaseClient
    .from('activities')
    .select('id,name,activity_code,status,start_datetime,max_participants,activity_types(name),academic_years(year_name)', {
      filters,
      order: 'start_datetime.desc',
    });

  if (error) {
    loadingState?.classList.add('is-hidden');
    Popup.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงข้อมูลกิจกรรมได้');
    return;
  }

  // ดึงจำนวนลงทะเบียน/เข้าร่วมจริงของแต่ละกิจกรรม
  const activityIds = (activities || []).map((a) => a.id);
  const { data: registrations } = activityIds.length
    ? await supabaseClient.from('registrations').select('activity_id,status')
    : { data: [] };
  const { data: attendance } = activityIds.length
    ? await supabaseClient.from('attendance').select('activity_id,status')
    : { data: [] };

  loadingState?.classList.add('is-hidden');

  currentRows = (activities || []).map((a) => {
    const registeredCount = (registrations || []).filter(
      (r) => r.activity_id === a.id && ['registered', 'approved'].includes(r.status)
    ).length;
    const completedCount = (attendance || []).filter(
      (r) => r.activity_id === a.id && r.status === 'completed'
    ).length;
    return {
      ...a,
      registered_count: registeredCount,
      completed_count: completedCount,
    };
  });

  renderTable(currentRows);
}

function renderTable(rows) {
  if (!tableBody) return;
  tableBody.innerHTML = '';

  if (rows.length === 0) {
    emptyState?.classList.remove('is-hidden');
    return;
  }
  emptyState?.classList.add('is-hidden');

  rows.forEach((a) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(a.activity_code)}</td>
      <td>${escapeHtml(a.name)}</td>
      <td class="cell-muted">${escapeHtml(a.activity_types?.name || '-')}</td>
      <td class="cell-muted">${escapeHtml(a.academic_years?.year_name || '-')}</td>
      <td class="cell-muted">${new Date(a.start_datetime).toLocaleDateString('th-TH', { dateStyle: 'medium' })}</td>
      <td>${a.registered_count} / ${a.max_participants ?? '∞'}</td>
      <td>${a.completed_count}</td>
      <td><span class="badge badge-${a.status}">${STATUS_LABELS[a.status] || a.status}</span></td>
    `;
    tableBody.appendChild(tr);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function toExportRows() {
  const columns = ['รหัสกิจกรรม', 'ชื่อกิจกรรม', 'ประเภท', 'ปีการศึกษา', 'วันที่เริ่ม', 'ลงทะเบียน/ที่นั่ง', 'เข้าร่วมจริง', 'สถานะ'];
  const rows = currentRows.map((a) => [
    a.activity_code,
    a.name,
    a.activity_types?.name || '-',
    a.academic_years?.year_name || '-',
    new Date(a.start_datetime).toLocaleDateString('th-TH'),
    `${a.registered_count}/${a.max_participants ?? '∞'}`,
    a.completed_count,
    STATUS_LABELS[a.status] || a.status,
  ]);
  return { columns, rows };
}

applyBtn?.addEventListener('click', loadReport);

exportPdfBtn?.addEventListener('click', () => {
  const { columns, rows } = toExportRows();
  exportToPdf('รายงานกิจกรรม', columns, rows, `activity-report-${Date.now()}.pdf`);
});

exportExcelBtn?.addEventListener('click', () => {
  const { columns, rows } = toExportRows();
  exportToExcel('รายงานกิจกรรม', columns, rows, `activity-report-${Date.now()}.xlsx`);
});

exportCsvBtn?.addEventListener('click', () => {
  const { columns, rows } = toExportRows();
  exportToCsv(columns, rows, `activity-report-${Date.now()}.csv`);
});

init();