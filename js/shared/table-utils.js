/**
 * table-utils.js — ฟังก์ชันกลาง sort / filter / pagination ใช้ร่วมกันทุกตารางในระบบ
 * คู่กับ css/components/table.css และ css/components/pagination.css
 *
 * วิธีใช้ทั่วไป:
 *   let state = { page: 1, pageSize: 10, sortKey: 'name', sortDir: 'asc' };
 *   const sorted = sortBy(rows, state.sortKey, state.sortDir);
 *   const { pageItems, totalPages } = paginate(sorted, state.page, state.pageSize);
 *   renderPagination(document.getElementById('pagination-container'), state.page, totalPages, (newPage) => { ... });
 */

/** เรียงข้อมูลตาม key (รองรับ nested key แบบ 'a.b' คั่นด้วยจุด) */
export function sortBy(rows, key, direction = 'asc') {
  if (!key) return [...rows];
  const factor = direction === 'desc' ? -1 : 1;

  return [...rows].sort((a, b) => {
    const valA = getNestedValue(a, key);
    const valB = getNestedValue(b, key);

    if (valA == null && valB == null) return 0;
    if (valA == null) return 1 * factor;
    if (valB == null) return -1 * factor;

    if (typeof valA === 'number' && typeof valB === 'number') {
      return (valA - valB) * factor;
    }
    return String(valA).localeCompare(String(valB), 'th') * factor;
  });
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), obj);
}

/** ค้นหาแบบง่าย: คืนแถวที่มี keyword ปรากฏในคอลัมน์ที่ระบุ (ไม่สนตัวพิมพ์เล็ก-ใหญ่) */
export function searchRows(rows, keyword, searchKeys = []) {
  const kw = (keyword || '').trim().toLowerCase();
  if (!kw) return [...rows];

  return rows.filter((row) =>
    searchKeys.some((key) => {
      const value = getNestedValue(row, key);
      return value != null && String(value).toLowerCase().includes(kw);
    })
  );
}

/** ตัดข้อมูลตามหน้า คืนค่า { pageItems, totalPages, totalItems } */
export function paginate(rows, page = 1, pageSize = 10) {
  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = rows.slice(start, start + pageSize);
  return { pageItems, totalPages, totalItems, currentPage: safePage };
}

/**
 * วาด pagination bar ลงใน container ที่ระบุ (ใช้ class จาก pagination.css)
 * @param {HTMLElement} container
 * @param {number} currentPage
 * @param {number} totalPages
 * @param {number} totalItems
 * @param {function} onPageChange - callback(newPage)
 */
export function renderPagination(container, currentPage, totalPages, totalItems, onPageChange) {
  if (!container) return;
  container.innerHTML = '';

  const bar = document.createElement('div');
  bar.className = 'pagination-bar';

  const info = document.createElement('div');
  info.className = 'pagination-info';
  info.textContent = `ทั้งหมด ${totalItems.toLocaleString('th-TH')} รายการ · หน้า ${currentPage}/${totalPages}`;

  const controls = document.createElement('div');
  controls.className = 'pagination-controls';

  const makeBtn = (label, page, disabled = false, isActive = false) => {
    const btn = document.createElement('button');
    btn.className = `pagination-btn${isActive ? ' is-active' : ''}`;
    btn.textContent = label;
    btn.disabled = disabled;
    btn.addEventListener('click', () => onPageChange(page));
    return btn;
  };

  controls.appendChild(makeBtn('‹', currentPage - 1, currentPage <= 1));

  const pageWindow = getPageWindow(currentPage, totalPages);
  pageWindow.forEach((p) => {
    if (p === '...') {
      const span = document.createElement('span');
      span.className = 'pagination-ellipsis';
      span.textContent = '...';
      controls.appendChild(span);
    } else {
      controls.appendChild(makeBtn(String(p), p, false, p === currentPage));
    }
  });

  controls.appendChild(makeBtn('›', currentPage + 1, currentPage >= totalPages));

  bar.appendChild(info);
  bar.appendChild(controls);
  container.appendChild(bar);
}

/** คำนวณเลขหน้าที่จะแสดง (มี ... คั่นถ้าหน้าเยอะ) */
function getPageWindow(current, total, siblingCount = 1) {
  const pages = [];
  const start = Math.max(2, current - siblingCount);
  const end = Math.min(total - 1, current + siblingCount);

  pages.push(1);
  if (start > 2) pages.push('...');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push('...');
  if (total > 1) pages.push(total);

  return pages;
}

/** ทำให้ header ของตารางคลิกแล้ว sort ได้ (เพิ่ม/สลับ asc-desc) */
export function attachSortableHeaders(theadEl, onSortChange) {
  if (!theadEl) return;
  let currentKey = null;
  let currentDir = 'asc';

  theadEl.querySelectorAll('th.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sortKey;
      if (currentKey === key) {
        currentDir = currentDir === 'asc' ? 'desc' : 'asc';
      } else {
        currentKey = key;
        currentDir = 'asc';
      }
      onSortChange(currentKey, currentDir);
    });
  });
}