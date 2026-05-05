# Các file nguồn quan trọng

Dưới đây là nội dung chi tiết các file `js/api.js`, `js/auth.js`, `dashboard.html`, và `styles/main.css` để team có thể tích hợp PWA và xem xét logic giao diện.


## `js/api.js`
```javascript
// ══════════════════════════════════════════════════════════
//   ORI STUDENT PORTAL — API MODULE
//   Handles all communication with Google Apps Script
// ══════════════════════════════════════════════════════════

const API = (() => {
  // ⚠️ THAY ĐỔI SAU KHI DEPLOY APPS SCRIPT
  const BASE_URL = 'https://script.google.com/macros/s/AKfycbzsdLmNQml4XonIzofnWr7ITeNipdCVJOzF6vCjdgl53kxkaMfM2r6MTtjqWFfIwUep/exec';

  async function request(method, params = {}) {
    try {
      let url;

      if (method === 'POST') {
        // Google Apps Script redirect POST→GET gây lỗi
        // Giải pháp: gửi qua GET với param 'payload'
        const payload = encodeURIComponent(JSON.stringify(params));
        url = `${BASE_URL}?action=${params.action || ''}&payload=${payload}`;
      } else {
        const query = new URLSearchParams(params).toString();
        url = `${BASE_URL}?${query}`;
      }

      const resp = await fetch(url, { method: 'GET', redirect: 'follow' });
      const data = await resp.json();
      return data;
    } catch (err) {
      console.error('API Error:', err);
      return { ok: false, error: 'Không thể kết nối đến server. Vui lòng thử lại.' };
    }
  }

  return {
    // ── Auth ──
    login(hoTen, sdt) {
      return request('POST', { action: 'login', hoTen, sdt });
    },

    // ── Profile ──
    getProfile(maHV) {
      return request('GET', { action: 'profile', maHV });
    },

    // ── Learning History ──
    getHistory(maHV) {
      return request('GET', { action: 'history', maHV });
    },

    // ── Referral ──
    getReferralStats(maHV) {
      return request('GET', { action: 'referral', maHV });
    },

    // ── Leaderboard ──
    getLeaderboard() {
      return request('GET', { action: 'leaderboard' });
    },

    // ── Courses ──
    getCourses() {
      return request('GET', { action: 'courses' });
    },

    // ── Registration ──
    register(data) {
      return request('POST', { action: 'register', ...data });
    },

    // ── Test ──
    test() {
      return request('GET', { action: 'test' });
    },

    // ── Public ──
    lookupRef(refCode) {
      return request('GET', { action: 'lookup_ref', ref: refCode });
    },

    // ── Admin (protected by secret) ──
    adminListStudents() {
      return request('POST', { action: 'admin_list_students', secret: API.getSecret() });
    },
    adminAddStudent(data) {
      return request('POST', { action: 'admin_add_student', secret: API.getSecret(), ...data });
    },
    adminAddHistory(data) {
      return request('POST', { action: 'admin_add_history', secret: API.getSecret(), ...data });
    },
    adminUpdateCommission(rowIndex, status) {
      return request('POST', { action: 'admin_update_commission', secret: API.getSecret(), rowIndex, status });
    },

    // Secret management
    getSecret() {
      return localStorage.getItem('ori_admin_secret') || '';
    },
    setSecret(s) {
      localStorage.setItem('ori_admin_secret', s);
    },
  };
})();

```


## `js/auth.js`
```javascript
// ══════════════════════════════════════════════════════════
//   ORI STUDENT PORTAL — AUTH MODULE
// ══════════════════════════════════════════════════════════

const Auth = (() => {
  const STORAGE_KEY = 'ori_portal_user';

  function save(userData) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
  }

  function get() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function isLoggedIn() {
    return !!get();
  }

  function requireAuth() {
    if (!isLoggedIn()) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  }

  function getMaHV() {
    const user = get();
    return user ? user.MaHV : null;
  }

  function getHoTen() {
    const user = get();
    return user ? user.HoTen : '';
  }

  function getMaGioiThieu() {
    const user = get();
    return user ? user.MaGioiThieu : '';
  }

  function logout() {
    clear();
    window.location.href = 'index.html';
  }

  return { save, get, clear, isLoggedIn, requireAuth, getMaHV, getHoTen, getMaGioiThieu, logout };
})();

```


## `dashboard.html`
```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ORI Academy — Student Portal</title>
  <meta name="description" content="ORI Academy Student Portal — Nhật ký học tập, giới thiệu bạn bè, theo dõi hoa hồng.">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎓</text></svg>">
  <link rel="stylesheet" href="styles/main.css">
  <link rel="stylesheet" href="styles/dashboard.css">
</head>
<body>
  <div class="dashboard-layout">
    <!-- Mobile overlay -->
    <div class="sidebar-overlay" id="sidebar-overlay"></div>

    <!-- ═══ SIDEBAR ═══ -->
    <aside class="sidebar" id="sidebar">
      <!-- Brand -->
      <div class="sidebar-header">
        <div class="sidebar-brand">
          <div class="brand-icon">🎓</div>
          <div>
            <div class="brand-name">ORI Academy</div>
            <div class="brand-sub">Student Portal</div>
          </div>
        </div>
      </div>

      <!-- User -->
      <div class="sidebar-user">
        <div class="avatar" id="sidebar-avatar">U</div>
        <div>
          <div class="user-name" id="sidebar-user-name">Học viên</div>
          <div class="user-status" id="sidebar-user-status">—</div>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-section-title">📊 Tổng Quan</div>
          <div class="nav-item active" data-tab="overview">
            <span class="nav-icon">🏠</span> Trang Chủ
          </div>
          <div class="nav-item" data-tab="history">
            <span class="nav-icon">📝</span> Nhật Ký Học Tập
          </div>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">🔗 Chia Sẻ</div>
          <div class="nav-item" data-tab="referral">
            <span class="nav-icon">📊</span> Thống Kê Giới Thiệu
          </div>
          <div class="nav-item" data-tab="policy">
            <span class="nav-icon">📋</span> Chính Sách Chia Sẻ
          </div>
          <div class="nav-item" data-tab="commission">
            <span class="nav-icon">💰</span> Hoa Hồng Của Bạn
          </div>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">⚙️ Tài Khoản</div>
          <div class="nav-item" data-tab="courses">
            <span class="nav-icon">📚</span> Gói Khóa Học
          </div>
          <div class="nav-item" data-tab="profile">
            <span class="nav-icon">👤</span> Thông Tin Cá Nhân
          </div>
          <div class="nav-item" data-tab="guide">
            <span class="nav-icon">📖</span> Hướng Dẫn Sử Dụng
          </div>
        </div>

        <!-- Admin nav (hidden by default, shown by JS) -->
        <div class="nav-section" id="admin-nav" style="display:none">
          <div class="nav-section-title">🔐 Quản Trị</div>
          <div class="nav-item" data-tab="admin">
            <span class="nav-icon">⚙️</span> Bảng Điều Khiển
          </div>
        </div>
      </nav>

      <!-- Logout -->
      <div class="sidebar-footer">
        <button class="logout-btn" id="logout-btn">
          <span>🚪</span> Đăng Xuất
        </button>
      </div>
    </aside>

    <!-- ═══ MAIN CONTENT ═══ -->
    <main class="main-content">
      <!-- Header -->
      <header class="main-header">
        <div class="header-left">
          <button class="menu-toggle" id="menu-toggle">☰</button>
          <h2 class="page-title" id="page-title">Tổng Quan</h2>
        </div>
        <div class="header-right">
          <span class="header-date" id="header-date"></span>
        </div>
      </header>

      <!-- Page Content -->
      <div class="page-content">

        <!-- ═══ TAB: OVERVIEW ═══ -->
        <div class="tab-content active" id="tab-overview">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon purple">📘</div>
              <div>
                <div class="stat-value" id="overview-course">—</div>
                <div class="stat-label">Khóa học hiện tại</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon blue">📅</div>
              <div>
                <div class="stat-value" id="overview-start-date">—</div>
                <div class="stat-label">Ngày vào học</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon green">📝</div>
              <div>
                <div class="stat-value" id="overview-lessons">0</div>
                <div class="stat-label">Buổi đã học</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon orange">👥</div>
              <div>
                <div class="stat-value" id="overview-referred">0</div>
                <div class="stat-label">Đã giới thiệu</div>
              </div>
            </div>
          </div>

          <!-- Quick referral card -->
          <div class="card" style="margin-bottom: 24px;">
            <div class="card-header">
              <span class="card-title">🔗 Mã Giới Thiệu Của Bạn</span>
            </div>
            <div class="flex items-center gap-md" style="flex-wrap: wrap;">
              <div style="flex:1; min-width: 200px;">
                <div class="text-sm text-muted" style="margin-bottom: 4px;">Mã code</div>
                <div class="text-2xl font-bold text-accent" id="overview-ref-code">—</div>
              </div>
              <div>
                <div class="text-sm text-muted" style="margin-bottom: 4px;">Trạng thái</div>
                <div class="font-semibold" id="overview-status">—</div>
              </div>
              <div>
                <div class="text-sm text-muted" style="margin-bottom: 4px;">Hoa hồng tích lũy</div>
                <div class="text-xl font-bold" style="color: var(--success);" id="overview-commission">0đ</div>
              </div>
            </div>
          </div>

          <!-- Quick info -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">💡 Hướng Dẫn Nhanh</span>
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
              <div class="policy-step" style="margin-bottom:0; background: var(--bg-input);">
                <div class="step-number">1</div>
                <div>
                  <div class="step-title">Sao chép mã giới thiệu</div>
                  <div class="step-desc">Vào tab "Thống Kê Giới Thiệu" để copy link của bạn.</div>
                </div>
              </div>
              <div class="policy-step" style="margin-bottom:0; background: var(--bg-input);">
                <div class="step-number">2</div>
                <div>
                  <div class="step-title">Gửi cho bạn bè</div>
                  <div class="step-desc">Bạn bè đăng ký qua mã của bạn được giảm 5% học phí.</div>
                </div>
              </div>
              <div class="policy-step" style="margin-bottom:0; background: var(--bg-input);">
                <div class="step-number">3</div>
                <div>
                  <div class="step-title">Nhận hoa hồng 5%</div>
                  <div class="step-desc">Bạn nhận 5% giá khóa học mà bạn bè đăng ký.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ TAB: HISTORY ═══ -->
        <div class="tab-content" id="tab-history">
          <div class="card">
            <div class="card-header">
              <span class="card-title">📝 Lịch Sử Học Tập</span>
            </div>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Ngày</th>
                    <th>Bài học</th>
                    <th>Điểm danh</th>
                    <th>Điểm</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody id="history-tbody">
                  <tr><td colspan="6" class="text-center text-muted" style="padding:40px">⏳ Đang tải...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ═══ TAB: REFERRAL ═══ -->
        <div class="tab-content" id="tab-referral">
          <!-- Referral link -->
          <div class="referral-box">
            <h3>🔗 Link giới thiệu của bạn</h3>
            <div class="referral-link-wrapper">
              <input type="text" class="referral-link-input" id="referral-link" readonly>
              <button class="btn-copy" id="copy-ref-btn">📋 Sao chép</button>
            </div>
          </div>

          <!-- Stats -->
          <div class="stats-grid" style="margin-bottom: 28px;">
            <div class="stat-card">
              <div class="stat-icon purple">👥</div>
              <div>
                <div class="stat-value" id="ref-total">0</div>
                <div class="stat-label">Đã giới thiệu</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon green">💰</div>
              <div>
                <div class="stat-value" id="ref-commission-total">0đ</div>
                <div class="stat-label">Tổng hoa hồng</div>
              </div>
            </div>
          </div>

          <!-- Referral list -->
          <div class="card" style="margin-bottom: 28px;">
            <div class="card-header">
              <span class="card-title">📋 Danh Sách Người Được Giới Thiệu</span>
            </div>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Học viên</th>
                    <th>Khóa học</th>
                    <th>Hoa hồng</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody id="referral-tbody">
                  <tr><td colspan="5" class="text-center text-muted" style="padding:40px">⏳ Đang tải...</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Leaderboard -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">🏆 Top Người Giới Thiệu</span>
              <span class="text-sm text-muted">Bảng xếp hạng toàn trung tâm</span>
            </div>
            <div class="leaderboard-list" id="leaderboard-list">
              <div class="empty-state"><div class="spinner" style="margin:0 auto"></div></div>
            </div>
          </div>
        </div>

        <!-- ═══ TAB: POLICY ═══ -->
        <div class="tab-content" id="tab-policy">
          <div class="policy-section">
            <div class="card" style="margin-bottom: 28px;">
              <div class="card-header">
                <span class="card-title">📋 Chính Sách Giới Thiệu ORI Academy</span>
              </div>
              <p class="text-muted" style="margin-bottom: 24px; line-height: 1.7;">
                Mỗi học viên ORI Academy đều có một <strong class="text-accent">Mã Giới Thiệu (Referral Code)</strong> riêng. 
                Khi bạn bè đăng ký khóa học qua mã này, cả hai bên đều được hưởng ưu đãi!
              </p>

              <div class="policy-step">
                <div class="step-number">1</div>
                <div>
                  <div class="step-title">🎁 Bạn bè được giảm 5% học phí</div>
                  <div class="step-desc">Người được giới thiệu sẽ nhận ngay ưu đãi giảm 5% trên giá khóa học khi đăng ký qua mã của bạn.</div>
                </div>
              </div>

              <div class="policy-step">
                <div class="step-number">2</div>
                <div>
                  <div class="step-title">💰 Bạn nhận 5% hoa hồng</div>
                  <div class="step-desc">Người giới thiệu nhận 5% giá trị khóa học mà bạn bè đăng ký. Hoa hồng được tích lũy và quy đổi thành tiền mặt.</div>
                </div>
              </div>

              <div class="policy-step">
                <div class="step-number">3</div>
                <div>
                  <div class="step-title">📊 Theo dõi minh bạch</div>
                  <div class="step-desc">Mọi thông tin giới thiệu đều được hiển thị trên portal: danh sách người được GT, số tiền hoa hồng, trạng thái thanh toán.</div>
                </div>
              </div>

              <div class="policy-step">
                <div class="step-number">4</div>
                <div>
                  <div class="step-title">🏆 Bảng xếp hạng</div>
                  <div class="step-desc">Top người giới thiệu nhiều nhất sẽ được vinh danh trên bảng xếp hạng toàn trung tâm.</div>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-header">
                <span class="card-title">❓ Câu Hỏi Thường Gặp</span>
              </div>
              <div style="display:flex; flex-direction:column; gap: 16px;">
                <div>
                  <p class="font-semibold" style="margin-bottom: 4px;">Hoa hồng được thanh toán khi nào?</p>
                  <p class="text-sm text-muted">Hoa hồng được thanh toán vào cuối mỗi tháng qua chuyển khoản ngân hàng hoặc tiền mặt tại trung tâm.</p>
                </div>
                <div>
                  <p class="font-semibold" style="margin-bottom: 4px;">Có giới hạn số người giới thiệu không?</p>
                  <p class="text-sm text-muted">Không! Bạn có thể giới thiệu không giới hạn và nhận hoa hồng cho mỗi người đăng ký thành công.</p>
                </div>
                <div>
                  <p class="font-semibold" style="margin-bottom: 4px;">Bạn bè cần làm gì để nhận ưu đãi?</p>
                  <p class="text-sm text-muted">Bạn bè chỉ cần cung cấp mã giới thiệu của bạn khi liên hệ đăng ký tại ORI Academy.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ TAB: COMMISSION ═══ -->
        <div class="tab-content" id="tab-commission">
          <div class="commission-summary">
            <div class="commission-card total">
              <div class="amount" id="comm-total">0đ</div>
              <div class="label">Tổng hoa hồng</div>
            </div>
            <div class="commission-card paid">
              <div class="amount" id="comm-paid">0đ</div>
              <div class="label">Đã thanh toán</div>
            </div>
            <div class="commission-card unpaid">
              <div class="amount" id="comm-unpaid">0đ</div>
              <div class="label">Chờ thanh toán</div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <span class="card-title">💰 Chi Tiết Hoa Hồng</span>
            </div>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Người được GT</th>
                    <th>Khóa học</th>
                    <th>Giá gốc</th>
                    <th>Hoa hồng (5%)</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody id="commission-tbody">
                  <tr><td colspan="6" class="text-center text-muted" style="padding:40px">⏳ Đang tải...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ═══ TAB: COURSES ═══ -->
        <div class="tab-content" id="tab-courses">
          <div class="courses-grid" id="courses-grid">
            <div class="empty-state"><div class="spinner" style="margin:0 auto"></div><p class="text-muted" style="margin-top:16px">Đang tải khóa học...</p></div>
          </div>
        </div>

        <!-- ═══ TAB: PROFILE ═══ -->
        <div class="tab-content" id="tab-profile">
          <div class="card" style="margin-bottom: 24px;">
            <div class="card-header">
              <span class="card-title">👤 Thông Tin Cá Nhân</span>
            </div>
            <div class="profile-grid">
              <div class="profile-field">
                <span class="field-label">Họ và tên</span>
                <span class="field-value" id="profile-name">—</span>
              </div>
              <div class="profile-field">
                <span class="field-label">Số điện thoại</span>
                <span class="field-value" id="profile-phone">—</span>
              </div>
              <div class="profile-field">
                <span class="field-label">CCCD</span>
                <span class="field-value" id="profile-cccd">—</span>
              </div>
              <div class="profile-field">
                <span class="field-label">Email</span>
                <span class="field-value" id="profile-email">—</span>
              </div>
              <div class="profile-field">
                <span class="field-label">Ngày vào học</span>
                <span class="field-value" id="profile-start">—</span>
              </div>
              <div class="profile-field">
                <span class="field-label">Khóa học</span>
                <span class="field-value" id="profile-course">—</span>
              </div>
              <div class="profile-field">
                <span class="field-label">Trạng thái</span>
                <span class="field-value" id="profile-status">—</span>
              </div>
              <div class="profile-field">
                <span class="field-label">Mã giới thiệu</span>
                <span class="field-value text-accent" id="profile-ref-code">—</span>
              </div>
              <div class="profile-field">
                <span class="field-label">Ngày tạo tài khoản</span>
                <span class="field-value" id="profile-created">—</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ TAB: GUIDE ═══ -->
        <div class="tab-content" id="tab-guide">
          <div class="policy-section" style="max-width:800px">

            <!-- Welcome -->
            <div class="card" style="margin-bottom:28px; position:relative; overflow:hidden;">
              <div style="position:absolute;top:0;left:0;right:0;height:4px;background:var(--accent-gradient)"></div>
              <div style="text-align:center; padding: 20px 0 10px;">
                <div style="font-size:3rem; margin-bottom:12px;">📖</div>
                <h2 style="font-size:1.5rem; font-weight:800; margin-bottom:8px;">Hướng Dẫn Sử Dụng Portal</h2>
                <p class="text-muted">Tất cả những gì bạn cần biết để sử dụng ORI Student Portal hiệu quả nhất.</p>
              </div>
            </div>

            <!-- Step 1: Login -->
            <div class="card" style="margin-bottom:24px;">
              <div class="card-header">
                <span class="card-title">🔐 Bước 1: Đăng Nhập</span>
                <span class="badge badge-info">Cơ bản</span>
              </div>
              <div style="display:flex; flex-direction:column; gap:16px;">
                <div class="policy-step" style="margin:0; background:var(--bg-input);">
                  <div class="step-number">1</div>
                  <div>
                    <div class="step-title">Truy cập website</div>
                    <div class="step-desc">Mở trình duyệt → Vào địa chỉ <strong class="text-accent">ori-student-portal.vercel.app</strong></div>
                  </div>
                </div>
                <div class="policy-step" style="margin:0; background:var(--bg-input);">
                  <div class="step-number">2</div>
                  <div>
                    <div class="step-title">Nhập thông tin</div>
                    <div class="step-desc">Điền <strong>Họ và Tên</strong> + <strong>Số Điện Thoại</strong> đã đăng ký tại ORI. Lưu ý nhập đúng tên, có dấu.</div>
                  </div>
                </div>
                <div class="policy-step" style="margin:0; background:var(--bg-input);">
                  <div class="step-number">3</div>
                  <div>
                    <div class="step-title">Bấm Đăng Nhập</div>
                    <div class="step-desc">Hệ thống sẽ xác minh thông tin và chuyển bạn vào trang Dashboard.</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 2: Dashboard -->
            <div class="card" style="margin-bottom:24px;">
              <div class="card-header">
                <span class="card-title">🏠 Bước 2: Trang Chủ (Dashboard)</span>
              </div>
              <p class="text-muted" style="margin-bottom:16px; line-height:1.7;">Sau khi đăng nhập, bạn sẽ thấy trang tổng quan hiển thị:</p>
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
                <div style="background:var(--bg-input); border-radius:var(--radius-md); padding:16px; border:1px solid var(--border-color);">
                  <div style="font-size:1.5rem; margin-bottom:8px;">📘</div>
                  <div class="font-semibold" style="margin-bottom:4px;">Khóa học hiện tại</div>
                  <div class="text-sm text-muted">Khóa bạn đang theo học</div>
                </div>
                <div style="background:var(--bg-input); border-radius:var(--radius-md); padding:16px; border:1px solid var(--border-color);">
                  <div style="font-size:1.5rem; margin-bottom:8px;">📝</div>
                  <div class="font-semibold" style="margin-bottom:4px;">Buổi đã học</div>
                  <div class="text-sm text-muted">Tổng số buổi đã tham gia</div>
                </div>
                <div style="background:var(--bg-input); border-radius:var(--radius-md); padding:16px; border:1px solid var(--border-color);">
                  <div style="font-size:1.5rem; margin-bottom:8px;">🔗</div>
                  <div class="font-semibold" style="margin-bottom:4px;">Mã giới thiệu</div>
                  <div class="text-sm text-muted">Mã code riêng của bạn</div>
                </div>
                <div style="background:var(--bg-input); border-radius:var(--radius-md); padding:16px; border:1px solid var(--border-color);">
                  <div style="font-size:1.5rem; margin-bottom:8px;">💰</div>
                  <div class="font-semibold" style="margin-bottom:4px;">Hoa hồng</div>
                  <div class="text-sm text-muted">Tổng tiền đã tích lũy</div>
                </div>
              </div>
            </div>

            <!-- Step 3: Referral -->
            <div class="card" style="margin-bottom:24px;">
              <div class="card-header">
                <span class="card-title">🔗 Bước 3: Giới Thiệu Bạn Bè & Nhận Hoa Hồng</span>
                <span class="badge badge-success">Quan trọng</span>
              </div>
              <div style="display:flex; flex-direction:column; gap:16px;">
                <div class="policy-step" style="margin:0; background:var(--bg-input);">
                  <div class="step-number" style="background:linear-gradient(135deg, #10b981, #34d399);">1</div>
                  <div>
                    <div class="step-title">Copy mã giới thiệu</div>
                    <div class="step-desc">Vào tab <strong>"Thống Kê Giới Thiệu"</strong> ở sidebar → Bấm nút <strong>📋 Sao chép</strong> để copy link giới thiệu của bạn.</div>
                  </div>
                </div>
                <div class="policy-step" style="margin:0; background:var(--bg-input);">
                  <div class="step-number" style="background:linear-gradient(135deg, #10b981, #34d399);">2</div>
                  <div>
                    <div class="step-title">Gửi cho bạn bè</div>
                    <div class="step-desc">Chia sẻ link qua <strong>Zalo, Facebook, hoặc tin nhắn</strong>. Bạn bè chỉ cần cung cấp mã của bạn khi đăng ký tại ORI.</div>
                  </div>
                </div>
                <div class="policy-step" style="margin:0; background:var(--bg-input);">
                  <div class="step-number" style="background:linear-gradient(135deg, #10b981, #34d399);">3</div>
                  <div>
                    <div class="step-title">Nhận thưởng tự động</div>
                    <div class="step-desc">🎁 Bạn bè được <strong class="text-accent">giảm 5%</strong> học phí. Bạn nhận <strong style="color:var(--success)">5% hoa hồng</strong> quy đổi thành tiền mặt!</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 4: Menu Guide -->
            <div class="card" style="margin-bottom:24px;">
              <div class="card-header">
                <span class="card-title">📑 Bước 4: Các Tab Trên Portal</span>
              </div>
              <div class="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Tab</th>
                      <th>Chức năng</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>🏠 Trang Chủ</strong></td>
                      <td>Tổng quan: khóa học, buổi đã học, mã giới thiệu, hoa hồng tích lũy</td>
                    </tr>
                    <tr>
                      <td><strong>📝 Nhật Ký Học Tập</strong></td>
                      <td>Xem lịch sử điểm danh, bài học đã hoàn thành, điểm số từng buổi</td>
                    </tr>
                    <tr>
                      <td><strong>📊 Thống Kê Giới Thiệu</strong></td>
                      <td>Link giới thiệu, danh sách người đã giới thiệu, bảng xếp hạng top</td>
                    </tr>
                    <tr>
                      <td><strong>📋 Chính Sách Chia Sẻ</strong></td>
                      <td>Chi tiết chính sách giảm 5% + hoa hồng 5%, câu hỏi thường gặp</td>
                    </tr>
                    <tr>
                      <td><strong>💰 Hoa Hồng Của Bạn</strong></td>
                      <td>Tổng hoa hồng, đã thanh toán, chờ thanh toán — chi tiết từng giao dịch</td>
                    </tr>
                    <tr>
                      <td><strong>📚 Gói Khóa Học</strong></td>
                      <td>Xem tất cả các gói khóa học tại ORI: TOEIC, Giao Tiếp, PV Hàng Không...</td>
                    </tr>
                    <tr>
                      <td><strong>👤 Thông Tin Cá Nhân</strong></td>
                      <td>Xem thông tin tài khoản: họ tên, SĐT, email, mã giới thiệu, trạng thái</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Tips -->
            <div class="card" style="margin-bottom:24px;">
              <div class="card-header">
                <span class="card-title">💡 Mẹo Hay</span>
              </div>
              <div style="display:flex; flex-direction:column; gap:14px;">
                <div style="display:flex; align-items:flex-start; gap:12px; padding:14px; background:var(--bg-input); border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                  <span style="font-size:1.3rem; flex-shrink:0;">📱</span>
                  <div>
                    <div class="font-semibold" style="margin-bottom:2px;">Dùng trên điện thoại</div>
                    <div class="text-sm text-muted">Portal hoạt động tốt trên mọi thiết bị. Mở trình duyệt Safari/Chrome → nhập link → bấm "Thêm vào màn hình chính" để dùng như app.</div>
                  </div>
                </div>
                <div style="display:flex; align-items:flex-start; gap:12px; padding:14px; background:var(--bg-input); border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                  <span style="font-size:1.3rem; flex-shrink:0;">🔄</span>
                  <div>
                    <div class="font-semibold" style="margin-bottom:2px;">Cập nhật dữ liệu</div>
                    <div class="text-sm text-muted">Dữ liệu nhật ký học tập và hoa hồng được cập nhật bởi ORI Academy. Nếu thấy chưa đúng, hãy liên hệ trung tâm.</div>
                  </div>
                </div>
                <div style="display:flex; align-items:flex-start; gap:12px; padding:14px; background:var(--bg-input); border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                  <span style="font-size:1.3rem; flex-shrink:0;">🔒</span>
                  <div>
                    <div class="font-semibold" style="margin-bottom:2px;">Bảo mật</div>
                    <div class="text-sm text-muted">Không chia sẻ SĐT đăng nhập cho người khác. Nếu quên thông tin, liên hệ ORI để được hỗ trợ.</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Contact -->
            <div class="card">
              <div class="card-header">
                <span class="card-title">📞 Cần Hỗ Trợ?</span>
              </div>
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
                <a href="https://zalo.me/0906303373" target="_blank" style="display:flex; align-items:center; gap:12px; padding:16px; background:var(--bg-input); border-radius:var(--radius-md); border:1px solid var(--border-color); text-decoration:none; transition:var(--transition);" onmouseover="this.style.borderColor='rgba(99,102,241,0.3)'" onmouseout="this.style.borderColor='rgba(148,163,184,0.12)'">
                  <span style="font-size:1.5rem;">💬</span>
                  <div>
                    <div class="font-semibold" style="color:var(--text-primary)">Zalo</div>
                    <div class="text-sm text-muted">0906 303 373</div>
                  </div>
                </a>
                <a href="tel:0906303373" style="display:flex; align-items:center; gap:12px; padding:16px; background:var(--bg-input); border-radius:var(--radius-md); border:1px solid var(--border-color); text-decoration:none; transition:var(--transition);" onmouseover="this.style.borderColor='rgba(99,102,241,0.3)'" onmouseout="this.style.borderColor='rgba(148,163,184,0.12)'">
                  <span style="font-size:1.5rem;">📞</span>
                  <div>
                    <div class="font-semibold" style="color:var(--text-primary)">Hotline</div>
                    <div class="text-sm text-muted">0906 303 373</div>
                  </div>
                </a>
                <div style="display:flex; align-items:center; gap:12px; padding:16px; background:var(--bg-input); border-radius:var(--radius-md); border:1px solid var(--border-color);">
                  <span style="font-size:1.5rem;">📍</span>
                  <div>
                    <div class="font-semibold">Địa chỉ</div>
                    <div class="text-sm text-muted">135 Bạch Đằng, Tân Bình</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- ═══ TAB: ADMIN ═══ -->
        <div class="tab-content" id="tab-admin">
          <!-- Admin stats -->
          <div class="stats-grid" style="margin-bottom:24px">
            <div class="stat-card">
              <div class="stat-icon purple">👥</div>
              <div>
                <div class="stat-value" id="admin-total-students">0</div>
                <div class="stat-label">Tổng học viên</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon green">🟢</div>
              <div>
                <div class="stat-value" id="admin-active-students">0</div>
                <div class="stat-label">Đang học</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon blue">📝</div>
              <div>
                <div class="stat-value" id="admin-trial-students">0</div>
                <div class="stat-label">Học thử</div>
              </div>
            </div>
          </div>

          <!-- Quick actions -->
          <div class="card" style="margin-bottom:24px;">
            <div class="card-header">
              <span class="card-title">⚡ Thao Tác Nhanh</span>
            </div>
            <div style="display:flex; gap:12px; flex-wrap:wrap;">
              <button class="login-btn" style="width:auto; padding:10px 20px; font-size:0.85rem;" onclick="document.getElementById('modal-add-student').style.display='flex'">
                🆕 Thêm Học Viên
              </button>
              <button class="login-btn" style="width:auto; padding:10px 20px; font-size:0.85rem; background:linear-gradient(135deg, #10b981, #34d399);" onclick="document.getElementById('modal-add-history').style.display='flex'">
                📝 Thêm Nhật Ký
              </button>
            </div>
          </div>

          <!-- Student list -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">📋 Danh Sách Học Viên</span>
              <span class="text-sm text-muted" id="admin-student-count"></span>
            </div>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Mã HV</th>
                    <th>Họ tên</th>
                    <th>SĐT</th>
                    <th>Khóa học</th>
                    <th>Mã GT</th>
                    <th>Trạng thái</th>
                    <th>Ngày vào</th>
                  </tr>
                </thead>
                <tbody id="admin-students-tbody">
                  <tr><td colspan="7" class="text-center text-muted" style="padding:40px">⏳ Đang tải...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div><!-- /page-content -->
    </main>
  </div>

  <!-- ═══ ADMIN MODAL: Add Student ═══ -->
  <div class="modal-overlay" id="modal-add-student" style="display:none">
    <div class="modal-card">
      <div class="modal-header">
        <span class="card-title">🆕 Thêm Học Viên Mới</span>
        <button class="modal-close" onclick="document.getElementById('modal-add-student').style.display='none'">&times;</button>
      </div>
      <form id="form-add-student">
        <div class="form-grid">
          <div class="input-group">
            <label>Họ và tên *</label>
            <input type="text" id="as-name" required placeholder="Nguyễn Văn A">
          </div>
          <div class="input-group">
            <label>SĐT *</label>
            <input type="tel" id="as-phone" required placeholder="0901234567">
          </div>
          <div class="input-group">
            <label>Email</label>
            <input type="email" id="as-email" placeholder="email@gmail.com">
          </div>
          <div class="input-group">
            <label>CCCD</label>
            <input type="text" id="as-cccd" placeholder="012345678901">
          </div>
          <div class="input-group">
            <label>Khóa học *</label>
            <select id="as-course"></select>
          </div>
          <div class="input-group">
            <label>Mã giới thiệu (nếu có)</label>
            <input type="text" id="as-ref" placeholder="VD: REF-AN7X3">
          </div>
        </div>
        <button type="submit" class="login-btn" style="margin-top:16px;width:100%">
          <span id="as-btn-text">➕ Thêm Học Viên</span>
        </button>
      </form>
    </div>
  </div>

  <!-- ═══ ADMIN MODAL: Add History ═══ -->
  <div class="modal-overlay" id="modal-add-history" style="display:none">
    <div class="modal-card">
      <div class="modal-header">
        <span class="card-title">📝 Thêm Nhật Ký Học Tập</span>
        <button class="modal-close" onclick="document.getElementById('modal-add-history').style.display='none'">&times;</button>
      </div>
      <form id="form-add-history">
        <div class="form-grid">
          <div class="input-group">
            <label>Học viên *</label>
            <select id="ah-student"></select>
          </div>
          <div class="input-group">
            <label>Ngày học</label>
            <input type="date" id="ah-date">
          </div>
          <div class="input-group">
            <label>Khóa học</label>
            <input type="text" id="ah-course" placeholder="VD: TOEIC-450">
          </div>
          <div class="input-group">
            <label>Bài học *</label>
            <input type="text" id="ah-lesson" required placeholder="VD: Listening Part 1">
          </div>
          <div class="input-group">
            <label>Điểm danh</label>
            <select id="ah-attendance">
              <option value="CoMat">✅ Có mặt</option>
              <option value="Vang">❌ Vắng</option>
              <option value="PhepVang">⚠️ Vắng phép</option>
            </select>
          </div>
          <div class="input-group">
            <label>Điểm</label>
            <input type="number" id="ah-score" placeholder="0-100" min="0" max="100">
          </div>
          <div class="input-group" style="grid-column: 1 / -1">
            <label>Ghi chú</label>
            <input type="text" id="ah-note" placeholder="Ghi chú (tùy chọn)">
          </div>
        </div>
        <button type="submit" class="login-btn" style="margin-top:16px;width:100%">
          <span id="ah-btn-text">➕ Thêm Nhật Ký</span>
        </button>
      </form>
    </div>
  </div>

  <script src="js/api.js"></script>
  <script src="js/auth.js"></script>
  <script src="js/dashboard.js"></script>
</body>
</html>

```


## `styles/main.css`
```css
/* ══════════════════════════════════════════════════════════
   ORI STUDENT PORTAL — MAIN STYLESHEET
   Dark theme with navy-to-purple gradient aesthetic
   ══════════════════════════════════════════════════════════ */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

/* ── CSS Variables ── */
:root {
  /* Colors */
  --bg-primary: #0a0e1a;
  --bg-secondary: #111827;
  --bg-card: #1a1f35;
  --bg-card-hover: #222845;
  --bg-sidebar: #0d1225;
  --bg-input: #1e2440;
  
  /* Accent */
  --accent-primary: #6366f1;
  --accent-secondary: #8b5cf6;
  --accent-gradient: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
  --accent-glow: rgba(99, 102, 241, 0.3);
  
  /* Status */
  --success: #10b981;
  --success-bg: rgba(16, 185, 129, 0.15);
  --warning: #f59e0b;
  --warning-bg: rgba(245, 158, 11, 0.15);
  --danger: #ef4444;
  --danger-bg: rgba(239, 68, 68, 0.15);
  --info: #3b82f6;
  --info-bg: rgba(59, 130, 246, 0.15);
  
  /* Text */
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --text-accent: #a5b4fc;
  
  /* Borders */
  --border-color: rgba(148, 163, 184, 0.12);
  --border-focus: rgba(99, 102, 241, 0.5);
  
  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 30px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 20px rgba(99, 102, 241, 0.2);
  
  /* Layout */
  --sidebar-width: 260px;
  --header-height: 70px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  
  /* Transitions */
  --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-fast: all 0.15s ease;
}

/* ── Reset ── */
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  font-size: 16px;
  scroll-behavior: smooth;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

a {
  color: var(--text-accent);
  text-decoration: none;
  transition: var(--transition-fast);
}

a:hover {
  color: var(--accent-primary);
}

button {
  cursor: pointer;
  border: none;
  outline: none;
  font-family: inherit;
  font-size: inherit;
}

input, select, textarea {
  font-family: inherit;
  font-size: inherit;
  outline: none;
}

/* ── Utility Classes ── */
.flex { display: flex; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
.justify-center { justify-content: center; }
.gap-sm { gap: 8px; }
.gap-md { gap: 16px; }
.gap-lg { gap: 24px; }
.text-center { text-align: center; }
.text-right { text-align: right; }
.font-bold { font-weight: 700; }
.font-semibold { font-weight: 600; }
.text-sm { font-size: 0.875rem; }
.text-xs { font-size: 0.75rem; }
.text-lg { font-size: 1.125rem; }
.text-xl { font-size: 1.25rem; }
.text-2xl { font-size: 1.5rem; }
.text-3xl { font-size: 1.875rem; }
.text-muted { color: var(--text-secondary); }
.text-accent { color: var(--text-accent); }
.mt-auto { margin-top: auto; }
.w-full { width: 100%; }
.hidden { display: none !important; }

/* ── Card Component ── */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 24px;
  transition: var(--transition);
}

.card:hover {
  border-color: rgba(99, 102, 241, 0.2);
  box-shadow: var(--shadow-glow);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.card-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

/* ── Badge ── */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.badge-success {
  background: var(--success-bg);
  color: var(--success);
}

.badge-warning {
  background: var(--warning-bg);
  color: var(--warning);
}

.badge-danger {
  background: var(--danger-bg);
  color: var(--danger);
}

.badge-info {
  background: var(--info-bg);
  color: var(--info);
}

.badge-purple {
  background: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
}

/* ── Button ── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: 0.875rem;
  transition: var(--transition);
  white-space: nowrap;
}

.btn-primary {
  background: var(--accent-gradient);
  color: white;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-secondary {
  background: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--bg-card-hover);
  border-color: var(--accent-primary);
}

.btn-copy {
  background: var(--accent-gradient);
  color: white;
  padding: 10px 24px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
}

.btn-copy:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
}

/* ── Table ── */
.table-container {
  overflow-x: auto;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead th {
  background: rgba(99, 102, 241, 0.08);
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 12px 16px;
  text-align: left;
  white-space: nowrap;
}

tbody td {
  padding: 14px 16px;
  border-top: 1px solid var(--border-color);
  font-size: 0.9rem;
}

tbody tr {
  transition: var(--transition-fast);
}

tbody tr:hover {
  background: rgba(99, 102, 241, 0.05);
}

/* ── Input ── */
.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-group label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.input-group input,
.input-group select {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 12px 16px;
  color: var(--text-primary);
  transition: var(--transition);
}

.input-group input:focus,
.input-group select:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.input-group input::placeholder {
  color: var(--text-muted);
}

/* ── Stat Card ── */
.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 20px 24px;
  transition: var(--transition);
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-glow);
}

.stat-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  font-size: 1.4rem;
  flex-shrink: 0;
}

.stat-icon.purple { background: rgba(139, 92, 246, 0.15); }
.stat-icon.blue   { background: rgba(59, 130, 246, 0.15); }
.stat-icon.green  { background: rgba(16, 185, 129, 0.15); }
.stat-icon.orange { background: rgba(245, 158, 11, 0.15); }

.stat-value {
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1.2;
}

.stat-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 500;
}

/* ── Avatar ── */
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1rem;
  color: white;
  flex-shrink: 0;
}

.avatar-sm { width: 32px; height: 32px; font-size: 0.8rem; }
.avatar-lg { width: 56px; height: 56px; font-size: 1.4rem; }
.avatar-xl { width: 80px; height: 80px; font-size: 2rem; }

/* ── Toast Notification ── */
.toast {
  position: fixed;
  bottom: 30px;
  right: 30px;
  padding: 14px 24px;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: 0.9rem;
  z-index: 9999;
  transform: translateY(120%);
  opacity: 0;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: var(--shadow-lg);
}

.toast.show {
  transform: translateY(0);
  opacity: 1;
}

.toast-success {
  background: var(--success);
  color: white;
}

.toast-error {
  background: var(--danger);
  color: white;
}

/* ── Loading Spinner ── */
.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 14, 26, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  z-index: 9998;
  backdrop-filter: blur(4px);
}

.loading-overlay .spinner {
  width: 40px;
  height: 40px;
}

/* ── Animations ── */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-20px); }
  to   { opacity: 1; transform: translateX(0); }
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(20px); }
  to   { opacity: 1; transform: translateX(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.6; }
}

@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.animate-fade-in {
  animation: fadeIn 0.5s ease forwards;
}

.animate-slide-left {
  animation: slideInLeft 0.4s ease forwards;
}

.animate-slide-right {
  animation: slideInRight 0.4s ease forwards;
}

/* ── Scrollbar ── */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: var(--bg-primary);
}

::-webkit-scrollbar-thumb {
  background: var(--text-muted);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

/* ── Responsive ── */
@media (max-width: 768px) {
  :root {
    --sidebar-width: 0px;
    --header-height: 60px;
  }
  
  .stat-card {
    padding: 16px;
  }
  
  .stat-value {
    font-size: 1.4rem;
  }
  
  .card {
    padding: 16px;
  }
  
  thead th, tbody td {
    padding: 10px 12px;
  }
}

```
