/**
 * my-registrations.js — สถานะการลงทะเบียนของฉัน /pages/student/my-registrations.html
 * ยกเลิกลงทะเบียนได้เฉพาะก่อนวันกิจกรรมเริ่มเท่านั้น
 *
 * Element IDs ที่คาดหวัง:
 *   #filter-status, #data-table-body, #empty-state, #loading-state
 */

import { requireAuth } from '../auth/auth-guard.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';
import { renderStatusBadge, REGISTRATION_STATUS_LABELS } from '../shared/status-badge.js';

let currentProfile = null;
let allRegistrations = [];

const filterStatus = document.getElementById('filter-status');
const tableBody = document.getElementById('data-table-body');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');

async function init() {
  currentProfile = await requireAuth(['student']);
  if (!currentProfile) return;
  await loadRegistrations();
}

async function loadRegistrations() {
  loadingState?.classList.remove('is-hidden');

  const { data, error } = await supabaseClient
    .from('registrations')
    .select('*,activities(name,activity_code,start_datetime,location,status)', {
      filters: [['student_id', 'eq', currentProfile.id]],
      order: 'registered_at.desc',
    });

  loadingState?.classList.add('is-hidden');

  if (error) {
    Popup.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงข้อมูลการลงทะเบียนได้');
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
    const activity = r.activities;
    const canCancel = ['registered', 'approved', 'pending_approval'].includes(r.status)
      && activity && new Date(activity.start_datetime) > new Date();

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(activity?.name || '-')}</td>
      <td class="cell-muted">${activity ? new Date(activity.start_datetime).toLocaleDateString('th-TH', { dateStyle: 'medium' }) : '-'}</td>
      <td class="cell-muted">${escapeHtml(activity?.location || '-')}</td>
      <td>${renderStatusBadge(r.status, REGISTRATION_STATUS_LABELS)}</td>
      <td class="cell-actions">
        ${canCancel ? `<button class="btn btn-danger btn-sm btn-cancel" data-id="${r.id}">ยกเลิก</button>` : '<span class="text-faint text-small">-</span>'}
      </td>
    `;
    tableBody.appendChild(tr);
  });

  tableBody.querySelectorAll('.btn-cancel').forEach((btn) => {
    btn.addEventListener('click', () => handleCancel(btn.dataset.id));
  });
}

async function handleCancel(registrationId) {
  const confirmed = await Popup.confirm('ยกเลิกการลงทะเบียน', 'ต้องการยกเลิกการลงทะเบียนกิจกรรมนี้ใช่หรือไม่?');
  if (!confirmed) return;

  const { error } = await supabaseClient
    .from('registrations')
    .update({ status: 'cancelled' }, [['id', 'eq', registrationId]]);

  if (error) {
    Popup.error('ยกเลิกไม่สำเร็จ', 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    return;
  }

  Popup.toast('success', 'ยกเลิกการลงทะเบียนสำเร็จ');
  await loadRegistrations();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

filterStatus?.addEventListener('change', () => renderTable(allRegistrations));

init();