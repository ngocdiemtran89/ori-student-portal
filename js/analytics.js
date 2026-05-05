async function loadAnalytics() {
  const user = Auth.get();
  if (!user || user.role !== 'admin') return;
  const studentsResult = await API.adminListStudents();
  const students = studentsResult.ok ? studentsResult.data : [];
  renderQuickStats(students);
  renderStatusChart(students);
  renderMonthlyChart(students);
  renderCourseChart(students);
}

function renderQuickStats(students) {
  const setEl = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  setEl('an-total',    students.length);
  setEl('an-active',   students.filter(s => s.TrangThai === 'ChinhThuc').length);
  setEl('an-trial',    students.filter(s => s.TrangThai === 'HocThu').length);
  setEl('an-referred', students.filter(s => s.GioiThieuBoi && s.GioiThieuBoi !== '').length);
}

function renderStatusChart(students) {
  const ctx = document.getElementById('chart-status'); if (!ctx) return;
  const active = students.filter(s => s.TrangThai === 'ChinhThuc').length;
  const trial  = students.filter(s => s.TrangThai === 'HocThu').length;
  if (window._chartStatus) window._chartStatus.destroy();
  window._chartStatus = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ['Chính thức','Học thử','Khác'], datasets: [{ data: [active, trial, students.length - active - trial], backgroundColor: ['#6366f1','#10b981','#f59e0b'], borderColor: '#1a1f35', borderWidth: 3, hoverOffset: 8 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 16, usePointStyle: true } }, tooltip: { backgroundColor: '#1a1f35', titleColor: '#f1f5f9', bodyColor: '#94a3b8', callbacks: { label: c => ` ${c.label}: ${c.raw} học viên` } } } }
  });
}

function renderMonthlyChart(students) {
  const ctx = document.getElementById('chart-monthly'); if (!ctx) return;
  const now = new Date(); const months = []; const counts = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toLocaleString('vi-VN', { month: 'short', year: '2-digit' }));
    counts.push(students.filter(s => {
      const raw = s.NgayTao || s.NgayVaoHoc; if (!raw) return false;
      const p = String(raw).split('/');
      if (p.length === 3) { const sd = new Date(p[2], p[1]-1, p[0]); return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear(); }
      return false;
    }).length);
  }
  if (window._chartMonthly) window._chartMonthly.destroy();
  window._chartMonthly = new Chart(ctx, {
    type: 'bar',
    data: { labels: months, datasets: [{ label: 'Học viên mới', data: counts, backgroundColor: 'rgba(99,102,241,0.7)', borderColor: '#6366f1', borderWidth: 2, borderRadius: 8, borderSkipped: false }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1f35', titleColor: '#f1f5f9', bodyColor: '#94a3b8' } }, scales: { x: { grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { color: '#94a3b8' } }, y: { grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { color: '#94a3b8', stepSize: 1 }, beginAtZero: true } } }
  });
}

function renderCourseChart(students) {
  const ctx = document.getElementById('chart-courses'); if (!ctx) return;
  const map = {};
  students.forEach(s => { const kh = s.KhoaHoc || 'Chưa có'; map[kh] = (map[kh]||0) + 1; });
  const sorted = Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0,6);
  const colors = ['#6366f1','#10b981','#f59e0b','#3b82f6','#8b5cf6','#ef4444'];
  if (window._chartCourses) window._chartCourses.destroy();
  window._chartCourses = new Chart(ctx, {
    type: 'bar',
    data: { labels: sorted.map(([k])=>k), datasets: [{ data: sorted.map(([,v])=>v), backgroundColor: colors.map(c=>c+'cc'), borderColor: colors, borderWidth: 2, borderRadius: 6, borderSkipped: false }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1f35', titleColor: '#f1f5f9', bodyColor: '#94a3b8', callbacks: { label: c => ` ${c.raw} học viên` } } }, scales: { x: { grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { color: '#94a3b8' } }, y: { grid: { display: false }, ticks: { color: '#94a3b8' } } } }
  });
}
