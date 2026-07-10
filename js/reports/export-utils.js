/**
 * export-utils.js — ฟังก์ชัน export PDF / Excel / CSV ใช้ร่วมกันทุกหน้ารายงาน
 *
 * ต้องโหลด library ผ่าน CDN ในไฟล์ HTML ก่อนใช้งานไฟล์นี้:
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
 *
 * วิธีใช้:
 *   import { exportToPdf, exportToExcel, exportToCsv } from '../reports/export-utils.js';
 *   exportToPdf('รายงานกิจกรรม', ['ชื่อกิจกรรม','สถานะ'], [['ค่ายวิชาการ','เสร็จสิ้น']], 'activity-report.pdf');
 */

/** Export เป็น PDF (ใช้ jsPDF + autotable plugin ที่โหลดจาก CDN) */
export function exportToPdf(title, columns, rows, filename = 'report.pdf') {
  if (!window.jspdf) {
    console.error('ไม่พบ jsPDF กรุณาโหลด CDN ของ jsPDF ในหน้า HTML ก่อนใช้งาน');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: rows.length && columns.length > 6 ? 'landscape' : 'portrait' });

  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text(`สร้างเมื่อ: ${new Date().toLocaleString('th-TH')}`, 14, 22);

  if (typeof doc.autoTable === 'function') {
    doc.autoTable({
      head: [columns],
      body: rows,
      startY: 28,
      styles: { font: 'helvetica', fontSize: 8 },
      headStyles: { fillColor: [200, 16, 46] }, // แดงหลักของธีม
    });
  } else {
    // fallback แบบไม่มี autotable: วาดตารางเองแบบง่ายๆ
    let y = 30;
    doc.setFontSize(8);
    doc.text(columns.join(' | '), 14, y);
    y += 6;
    rows.forEach((row) => {
      doc.text(row.join(' | '), 14, y);
      y += 6;
      if (y > 280) { doc.addPage(); y = 20; }
    });
  }

  doc.save(filename);
}

/** Export เป็น Excel (.xlsx) ใช้ SheetJS ที่โหลดจาก CDN */
export function exportToExcel(sheetName, columns, rows, filename = 'report.xlsx') {
  if (!window.XLSX) {
    console.error('ไม่พบ SheetJS (XLSX) กรุณาโหลด CDN ในหน้า HTML ก่อนใช้งาน');
    return;
  }
  const worksheetData = [columns, ...rows];
  const worksheet = window.XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));
  window.XLSX.writeFile(workbook, filename);
}

/** Export เป็น CSV (ไม่ต้องพึ่ง library ภายนอก) */
export function exportToCsv(columns, rows, filename = 'report.csv') {
  const escapeCsvCell = (value) => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [columns.map(escapeCsvCell).join(',')];
  rows.forEach((row) => lines.push(row.map(escapeCsvCell).join(',')));

  // ใส่ BOM (\uFEFF) ป้องกันภาษาไทยเพี้ยนตอนเปิดด้วย Excel
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}