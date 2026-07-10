from pathlib import Path

# ===== เปลี่ยนชื่อโฟลเดอร์โปรเจกต์ได้ =====
ROOT = Path("Activity-System")

files = [
    # ==========================
    # Root
    # ==========================
    "index.html",
    "dashboard.html",

    # ==========================
    # Pages
    # ==========================
    "pages/admin/users.html",
    "pages/admin/roles.html",
    "pages/admin/activity-types.html",
    "pages/admin/academic-years.html",
    "pages/admin/departments.html",
    "pages/admin/classes.html",
    "pages/admin/system-logs.html",

    "pages/teacher/activities.html",
    "pages/teacher/activity-form.html",
    "pages/teacher/activity-detail.html",
    "pages/teacher/attendance.html",
    "pages/teacher/qr-generate.html",
    "pages/teacher/teachers-manage.html",

    "pages/student/activities-list.html",
    "pages/student/my-registrations.html",
    "pages/student/history.html",
    "pages/student/scores-hours.html",
    "pages/student/qr-scan.html",
    "pages/student/certificates.html",

    "pages/reports/dashboard-report.html",
    "pages/reports/activity-report.html",
    "pages/reports/student-report.html",
    "pages/reports/score-hours-report.html",

    # ==========================
    # CSS
    # ==========================
    "css/base/reset.css",
    "css/base/variables.css",
    "css/base/typography.css",

    "css/layout/sidebar.css",
    "css/layout/topbar.css",
    "css/layout/dashboard-layout.css",

    "css/components/buttons.css",
    "css/components/table.css",
    "css/components/badge.css",
    "css/components/popup.css",
    "css/components/pagination.css",
    "css/components/loading.css",
    "css/components/empty-state.css",

    "css/pages/login.css",
    "css/pages/admin.css",
    "css/pages/teacher.css",
    "css/pages/student.css",
    "css/pages/reports.css",

    # ==========================
    # JavaScript
    # ==========================
    "js/config/supabase-client.js",

    "js/auth/login.js",
    "js/auth/logout.js",
    "js/auth/reset-password.js",
    "js/auth/auth-guard.js",

    "js/admin/users.js",
    "js/admin/roles.js",
    "js/admin/activity-types.js",
    "js/admin/academic-years.js",
    "js/admin/departments.js",
    "js/admin/classes.js",
    "js/admin/system-logs.js",

    "js/teacher/activities.js",
    "js/teacher/activity-form.js",
    "js/teacher/activity-detail.js",
    "js/teacher/attendance.js",
    "js/teacher/qr-generate.js",
    "js/teacher/teachers-manage.js",

    "js/student/activities-list.js",
    "js/student/my-registrations.js",
    "js/student/history.js",
    "js/student/scores-hours.js",
    "js/student/qr-scan.js",
    "js/student/certificates.js",

    "js/reports/dashboard-report.js",
    "js/reports/activity-report.js",
    "js/reports/student-report.js",
    "js/reports/score-hours-report.js",
    "js/reports/export-utils.js",

    "js/shared/popup.js",
    "js/shared/table-utils.js",
    "js/shared/validators.js",
    "js/shared/status-badge.js",
    "js/shared/certificate-generator.js",
    "js/shared/registration-limit.js",
]

folders = [
    "assets/images",
    "assets/fonts",
]

for folder in folders:
    (ROOT / folder).mkdir(parents=True, exist_ok=True)

for file in files:
    path = ROOT / file
    path.parent.mkdir(parents=True, exist_ok=True)

    if path.exists():
        continue

    ext = path.suffix.lower()

    if ext == ".html":
        content = f"""<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{path.stem}</title>

    <!-- CSS -->

</head>
<body>

    <h1>{path.stem}</h1>

    <!-- JavaScript -->

</body>
</html>
"""

    elif ext == ".css":
        content = f"""/* ==========================================
   {path.name}
   ========================================== */
"""

    elif ext == ".js":
        content = f"""// ==========================================
// {path.name}
// ==========================================

document.addEventListener("DOMContentLoaded", () => {{
    console.log("{path.stem} loaded");
}});
"""

    else:
        content = ""

    path.write_text(content, encoding="utf-8")

print("=" * 60)
print("✅ Project structure created successfully!")
print(ROOT.resolve())
print("=" * 60)