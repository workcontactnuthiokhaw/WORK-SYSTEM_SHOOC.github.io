/**
 * certificate-generator.js — generate ใบประกาศนียบัตร PDF ฝั่ง client แล้วอัปโหลดเข้า
 * Supabase Storage bucket 'certificates' จากนั้นอัปเดต certificates.file_url
 *
 * แถวใน `certificates` ถูกสร้างอัตโนมัติแล้วโดย trigger `issue_certificate`
 * (ในไฟล์ 001_schema.sql) ทันทีที่ attendance.status = 'completed' — ไฟล์นี้มีหน้าที่
 * แค่ "สร้างไฟล์ PDF จริง" แล้วอัปโหลด/ผูก URL เข้ากับแถวที่ trigger สร้างไว้แล้ว
 *
 * ต้องโหลด jsPDF ผ่าน CDN ในหน้า HTML ก่อนใช้งาน:
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
 *
 * วิธีใช้ (เรียกหลัง check-in สำเร็จ ฝั่งหน้า qr-scan.html):
 *   import { generateAndUploadCertificate } from '../shared/certificate-generator.js';
 *   await generateAndUploadCertificate({
 *     studentId, studentName: 'สมชาย ใจดี', activityName: 'ค่ายอาสาพัฒนา',
 *     certificateNo: '2569-00001', issueDate: '2026-07-10', schoolName: 'Rmutr School',
 *   });
 */

import supabaseClient from '../config/supabase-client.js';

/**
 * สร้าง PDF ใบประกาศนียบัตร (แนวนอน, ธีมขาว/แดงตามระบบ) คืนค่าเป็น Blob
 */
function buildCertificatePdfBlob({ studentName, activityName, certificateNo, issueDate, schoolName }) {
  if (!window.jspdf) {
    throw new Error('ไม่พบ jsPDF กรุณาโหลด CDN ของ jsPDF ในหน้า HTML ก่อนใช้งาน');
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const primaryRed = [200, 16, 46];

  // กรอบตกแต่ง
  doc.setDrawColor(...primaryRed);
  doc.setLineWidth(2);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);
  doc.setLineWidth(0.5);
  doc.rect(12, 12, pageWidth - 24, pageHeight - 24);

  // หัวเรื่อง
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...primaryRed);
  doc.text(schoolName || 'Rmutr School', pageWidth / 2, 30, { align: 'center' });

  doc.setFontSize(26);
  doc.setTextColor(30, 30, 30);
  doc.text('ใบประกาศนียบัตร', pageWidth / 2, 48, { align: 'center' });
  doc.setFontSize(14);
  doc.setTextColor(120, 120, 120);
  doc.text('Certificate of Participation', pageWidth / 2, 56, { align: 'center' });

  // เนื้อหา
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text('มอบเพื่อแสดงว่า', pageWidth / 2, 74, { align: 'center' });

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryRed);
  doc.text(studentName, pageWidth / 2, 88, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(60, 60, 60);
  doc.text(`ได้เข้าร่วมกิจกรรม "${activityName}" เรียบร้อยแล้ว`, pageWidth / 2, 100, { align: 'center' });

  // ท้ายเอกสาร: เลขที่ใบประกาศ + วันที่ออก
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`เลขที่ใบประกาศนียบัตร: ${certificateNo}`, pageWidth / 2, pageHeight - 30, { align: 'center' });
  doc.text(`ออกให้เมื่อวันที่ ${formatThaiDate(issueDate)}`, pageWidth / 2, pageHeight - 24, { align: 'center' });

  return doc.output('blob');
}

function formatThaiDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * สร้าง PDF + อัปโหลดเข้า storage bucket 'certificates' + อัปเดต file_url ในตาราง certificates
 * @returns {Promise<{success:boolean, fileUrl?:string, error?:string}>}
 */
export async function generateAndUploadCertificate({ studentId, activityId, studentName, activityName, certificateNo, issueDate, schoolName }) {
  try {
    const blob = buildCertificatePdfBlob({ studentName, activityName, certificateNo, issueDate, schoolName });
    const path = `${studentId}/${certificateNo}.pdf`;

    const { error: uploadError } = await supabaseClient.storage.upload('certificates', path, blob);
    if (uploadError) {
      return { success: false, error: 'อัปโหลดไฟล์ใบประกาศนียบัตรไม่สำเร็จ' };
    }

    // bucket 'certificates' เป็น private จึงเก็บ "path" ไว้ใน file_url แล้วค่อยขอ signed URL ตอนจะดาวน์โหลดจริง
    const { error: updateError } = await supabaseClient
      .from('certificates')
      .update({ file_url: path }, [
        ['student_id', 'eq', studentId],
        ['activity_id', 'eq', activityId],
      ]);

    if (updateError) {
      return { success: false, error: 'บันทึกลิงก์ไฟล์ใบประกาศนียบัตรไม่สำเร็จ' };
    }

    return { success: true, fileUrl: path };
  } catch (err) {
    return { success: false, error: err.message || 'สร้างใบประกาศนียบัตรไม่สำเร็จ' };
  }
}

/** ขอ signed URL ชั่วคราวเพื่อดาวน์โหลด/แสดงใบประกาศนียบัตร (ใช้ในหน้า certificates.html ของนักเรียน) */
export async function getCertificateDownloadUrl(path) {
  const { data, error } = await supabaseClient.storage.createSignedUrl('certificates', path, 3600);
  if (error || !data) return null;
  return data.signedUrl;
}