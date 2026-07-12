/**
 * system-logs.js — ดู System Logs (read-only) /pages/admin/system-logs.html
 * Filter ได้ตาม: ช่วงวันที่, ผู้ใช้, ประเภท action
 *
 * Element IDs ที่คาดหวัง:
 *   #filter-date-from, #filter-date-to, #filter-user, #filter-action, #btn-apply-filter
 *   #data-table-body, #empty-state, #loading-state
 *   #log-detail-modal, #log-detail-json (แสดง detail jsonb ตอนคลิกแถว)
 */

import { requireAuth } from '../auth/auth-guard.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';

let allLogs = [];
let allUsers = [];

const dateFromInput = document.getElementById('filter-date-from');
const dateToInput = document.getElementById('filter-date-to');
const userSelect = document.getElementById('filter-user');
const actionSelect = document.getElementById('filter-action');
const applyBtn = document.getElementById('btn-apply-filter');
const tableBody = document.getElementById('data-table-body');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');

const ACTION_LABELS = {
  login: 'เข้าสู่ระบบ',
  logout: 'ออกจากระบบ',
  create: 'เพิ่มข้อมูล',
  update: 'แก้ไขข้อมูล',
  delete: 'ลบข้อมูล',
  check_in: 'เช็กชื่อ',
  grade: 'ให้คะแนน',
};

async function init() {
  const profile = await requireAuth(['admin']);
  if (!profile) return;
  await Promise.all([loadUsersForFilter(), loadLogs()]);
}

async function loadUsersForFilter() {
  const { data } = await supabaseClient.from('profiles').select('id,full_name', { order: 'full_name.asc' });
  allUsers = data || [];
  if (userSelect) {
    userSelect.innerHTML = '<option value="">ผู้ใช้ทั้งหมด</option>';
    allUsers.forEach((u) => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.full_name;
      userSelect.appendChild(opt);
    });
  }
}

async function loadLogs() {
  loadingState?.classList.remove('is-hidden');

  const filters = [];
  if (dateFromInput?.value) filters.push(['created_at', 'gte', `${dateFromInput.value}T00:00:00`]);
  if (dateToInput?.value) filters.push(['created_at', 'lte', `${dateToInput.value}T23:59:59`]);
  if (userSelect?.value) filters.push(['user_id', 'eq', userSelect.value]);
  if (actionSelect?.value) filters.push(['action', 'eq', actionSelect.value]);

  const { data, error } = await supabaseClient
    .from('logs')
    .select('*,profiles(full_name)', { filters, order: 'created_at.desc', limit: 500 });

  loadingState?.classList.add('is-hidden');

  if (error) {
    Popup.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงข้อมูล System Logs ได้ (เฉพาะ admin เท่านั้นที่เข้าถึงได้)');
    return;
  }

  allLogs = data || [];
  renderTable(allLogs);
}

function renderTable(rows) {
  if (!tableBody) return;
  tableBody.innerHTML = '';

  if (rows.length === 0) {
    emptyState?.classList.remove('is-hidden');
    return;
  }
  emptyState?.classList.add('is-hidden');

  rows.forEach((log) => {
    const tr = document.createElement('tr');
    tr.classList.add('log-row');
    tr.dataset.id = log.id;
    tr.innerHTML = `
      <td class="cell-muted">${formatDateTime(log.created_at)}</td>
      <td>${escapeHtml(log.profiles?.full_name || 'ไม่ทราบผู้ใช้')}</td>
      <td><span class="log-action-tag ${log.action}">${ACTION_LABELS[log.action] || log.action}</span></td>
      <td class="cell-muted">${escapeHtml(log.table_name || '-')}</td>
      <td class="cell-actions">
        <button class="btn btn-icon btn-view-detail" data-id="${log.id}" aria-label="ดูรายละเอียด"><i class="fi fi-rr-eye"></i></button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

function formatDateTime(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleString('th-TH', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

tableBody?.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-view-detail');
  if (!btn) return;
  const log = allLogs.find((l) => l.id === btn.dataset.id);
  if (!log) return;

  const detailEl = document.getElementById('log-detail-json');
  if (detailEl) {
    detailEl.textContent = JSON.stringify(log.detail ?? {}, null, 2);
  }
  document.getElementById('log-detail-modal')?.classList.add('is-open');
});

document.addEventListener('click', (e) => {
  if (e.target.closest('.btn-close-log-detail') || e.target.id === 'log-detail-modal') {
    document.getElementById('log-detail-modal')?.classList.remove('is-open');
  }
});

applyBtn?.addEventListener('click', loadLogs);

init();
