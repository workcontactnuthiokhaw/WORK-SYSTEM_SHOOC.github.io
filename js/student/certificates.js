/**
 * certificates.js — ใบประกาศนียบัตรของฉัน /pages/student/certificates.html
 * แถวใน certificates ถูกสร้างอัตโนมัติโดย trigger เมื่อ attendance.status = 'completed'
 * ไฟล์ PDF จริงถูก generate/upload โดย certificate-generator.js ตอน check-in สำเร็จ
 *
 * Element IDs ที่คาดหวัง:
 *   #certificate-grid, #empty-state, #loading-state
 */

import { requireAuth } from '../auth/auth-guard.js';
import supabaseClient from '../config/supabase-client.js';
import Popup from '../shared/popup.js';
import { getCertificateDownloadUrl } from '../shared/certificate-generator.js';

let currentProfile = null;

const grid = document.getElementById('certificate-grid');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');

async function init() {
  currentProfile = await requireAuth(['student']);
  if (!currentProfile) return;
  await loadCertificates();
}

async function loadCertificates() {
  loadingState?.classList.remove('is-hidden');

  const { data, error } = await supabaseClient
    .from('certificates')
    .select('*,activities(name,start_datetime)', {
      filters: [['student_id', 'eq', currentProfile.id]],
      order: 'issue_date.desc',
    });

  loadingState?.classList.add('is-hidden');

  if (error) {
    Popup.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงข้อมูลใบประกาศนียบัตรได้');
    return;
  }

  renderGrid(data || []);
}

function renderGrid(certificates) {
  if (!grid) return;
  grid.innerHTML = '';

  if (certificates.length === 0) {
    emptyState?.classList.remove('is-hidden');
    return;
  }
  emptyState?.classList.add('is-hidden');

  certificates.forEach((cert) => {
    const card = document.createElement('div');
    card.className = 'certificate-card';
    card.innerHTML = `
      <div class="certificate-thumb"><i class="fi fi-rr-diploma"></i></div>
      <div class="student-activity-title" style="font-size:var(--fs-small)">${escapeHtml(cert.activities?.name || '-')}</div>
      <div class="certificate-no">เลขที่: ${escapeHtml(cert.certificate_no)}</div>
      <div class="text-tiny text-faint" style="margin-bottom:var(--space-3)">
        ออกให้เมื่อ ${new Date(cert.issue_date).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
      </div>
      <button class="btn btn-primary btn-sm btn-block btn-download" data-path="${cert.file_url || ''}" ${!cert.file_url ? 'disabled' : ''}>
        <i class="fi fi-rr-download"></i> ${cert.file_url ? 'ดาวน์โหลด PDF' : 'กำลังจัดเตรียมไฟล์...'}
      </button>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll('.btn-download').forEach((btn) => {
    btn.addEventListener('click', () => handleDownload(btn.dataset.path));
  });
}

async function handleDownload(path) {
  if (!path) return;
  const url = await getCertificateDownloadUrl(path);
  if (!url) {
    Popup.error('ดาวน์โหลดไม่สำเร็จ', 'ไม่สามารถสร้างลิงก์ดาวน์โหลดได้ กรุณาลองใหม่อีกครั้ง');
    return;
  }
  window.open(url, '_blank');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

init();