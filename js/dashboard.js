// ══════════════════════════════════════════════════════════
//   ORI STUDENT PORTAL — DASHBOARD MODULE
//   Tab navigation, profile, learning history, referral
// ══════════════════════════════════════════════════════════

const Dashboard = (() => {
  let currentTab = 'overview';

  // ── Init ──
  function init() {
    if (!Auth.requireAuth()) return;

    renderUserInfo();
    setupNavigation();
    setupLogout();
    setupMobileMenu();

    // Load overview tab by default
    switchTab('overview');
  }

  // ── Render user info in sidebar ──
  function renderUserInfo() {
    const user = Auth.get();
    if (!user) return;

    const nameEl = document.getElementById('sidebar-user-name');
    const statusEl = document.getElementById('sidebar-user-status');
    const avatarEl = document.getElementById('sidebar-avatar');
    const headerNameEl = document.getElementById('header-user-name');

    if (nameEl) nameEl.textContent = user.HoTen || '';
    if (statusEl) {
      const statusMap = {
        'HocThu': '🟢 Học thử',
        'ChinhThuc': '🟣 Chính thức',
        'DaTotNghiep': '🎓 Tốt nghiệp',
      };
      statusEl.textContent = statusMap[user.TrangThai] || user.TrangThai || '';
    }
    if (avatarEl) {
      avatarEl.textContent = (user.HoTen || 'U').charAt(0).toUpperCase();
      avatarEl.style.background = getAvatarColor(user.HoTen || '');
    }
    if (headerNameEl) headerNameEl.textContent = user.HoTen || '';

    // Date in header
    const dateEl = document.getElementById('header-date');
    if (dateEl) {
      const now = new Date();
      const options = { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' };
      dateEl.textContent = now.toLocaleDateString('vi-VN', options);
    }
  }

  // ── Navigation ──
  function setupNavigation() {
    document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
      item.addEventListener('click', () => {
        const tab = item.dataset.tab;
        switchTab(tab);

        // Close mobile sidebar
        document.querySelector('.sidebar')?.classList.remove('open');
        document.querySelector('.sidebar-overlay')?.classList.remove('show');
      });
    });
  }

  function switchTab(tab) {
    currentTab = tab;

    // Update nav
    document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tab);
    });

    // Update page title
    const titles = {
      overview: 'Tổng Quan',
      history: 'Nhật Ký Học Tập',
      referral: 'Thống Kê Giới Thiệu',
      commission: 'Hoa Hồng Của Bạn',
      policy: 'Chính Sách Chia Sẻ',
      courses: 'Gói Khóa Học',
      profile: 'Thông Tin Cá Nhân',
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = titles[tab] || '';

    // Show/hide tab content
    document.querySelectorAll('.tab-content').forEach(el => {
      el.classList.toggle('active', el.id === `tab-${tab}`);
    });

    // Load data for tab
    loadTabData(tab);
  }

  async function loadTabData(tab) {
    const maHV = Auth.getMaHV();

    switch (tab) {
      case 'overview':
        loadOverview(maHV);
        break;
      case 'history':
        loadHistory(maHV);
        break;
      case 'referral':
        loadReferral(maHV);
        break;
      case 'commission':
        loadCommission(maHV);
        break;
      case 'policy':
        // Static content, no API needed
        break;
      case 'courses':
        loadCourses();
        break;
      case 'profile':
        loadProfile(maHV);
        break;
    }
  }

  // ── Overview Tab ──
  async function loadOverview(maHV) {
    const user = Auth.get();
    const container = document.getElementById('tab-overview');
    if (!container) return;

    // Set static values from cached user data
    setTextContent('overview-course', user.KhoaHoc || 'Chưa có');
    setTextContent('overview-start-date', user.NgayVaoHoc || '—');
    setTextContent('overview-status', getStatusText(user.TrangThai));
    setTextContent('overview-ref-code', user.MaGioiThieu || '—');

    // Load referral stats
    const refResult = await API.getReferralStats(maHV);
    if (refResult.ok) {
      setTextContent('overview-referred', refResult.data.totalReferred || 0);
      setTextContent('overview-commission', formatMoney(refResult.data.totalCommission || 0));
    }

    // Load history count
    const histResult = await API.getHistory(maHV);
    if (histResult.ok !== false) {
      const data = Array.isArray(histResult) ? histResult : (histResult.data || []);
      setTextContent('overview-lessons', data.length || 0);
    }
  }

  // ── History Tab ──
  async function loadHistory(maHV) {
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:40px">⏳ Đang tải...</td></tr>';

    const result = await API.getHistory(maHV);
    const data = Array.isArray(result) ? result : (result.data || []);

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:40px">📝 Chưa có dữ liệu học tập</td></tr>';
      return;
    }

    tbody.innerHTML = data.map((item, i) => {
      const attendBadge = {
        'CoMat': '<span class="badge badge-success">✓ Có mặt</span>',
        'Vang': '<span class="badge badge-danger">✗ Vắng</span>',
        'PhepVang': '<span class="badge badge-warning">⚠ Phép</span>',
      };
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${item.Ngay || '—'}</td>
          <td>${item.BaiHoc || '—'}</td>
          <td>${attendBadge[item.DiemDanh] || item.DiemDanh || '—'}</td>
          <td><strong>${item.Diem || '—'}</strong></td>
          <td class="text-muted">${item.GhiChu || ''}</td>
        </tr>
      `;
    }).join('');
  }

  // ── Referral Tab ──
  async function loadReferral(maHV) {
    const user = Auth.get();
    const refCode = user.MaGioiThieu || '';
    const portalUrl = window.location.origin + window.location.pathname.replace('dashboard.html', '');

    // Set referral link
    const linkInput = document.getElementById('referral-link');
    if (linkInput) {
      linkInput.value = refCode ? `${portalUrl}?ref=${refCode}` : 'Chưa có mã giới thiệu';
    }

    // Copy button
    const copyBtn = document.getElementById('copy-ref-btn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        if (linkInput) {
          navigator.clipboard.writeText(linkInput.value).then(() => {
            showToast('✅ Đã sao chép link giới thiệu!', 'success');
            copyBtn.textContent = '✓ Đã sao chép';
            setTimeout(() => { copyBtn.textContent = '📋 Sao chép'; }, 2000);
          });
        }
      };
    }

    // Load stats
    const result = await API.getReferralStats(maHV);
    if (result.ok) {
      const d = result.data;
      setTextContent('ref-total', d.totalReferred || 0);
      setTextContent('ref-commission-total', formatMoney(d.totalCommission || 0));

      // Render referral list
      const tbody = document.getElementById('referral-tbody');
      if (tbody) {
        if (d.referrals.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding:40px">👥 Chưa có người được giới thiệu</td></tr>';
        } else {
          tbody.innerHTML = d.referrals.map((r, i) => {
            const statusBadge = r.TrangThaiHH === 'DaThanhToan'
              ? '<span class="badge badge-success">Đã TT</span>'
              : '<span class="badge badge-warning">Chờ TT</span>';
            return `
              <tr>
                <td>${i + 1}</td>
                <td>
                  <div class="flex items-center gap-sm">
                    <div class="avatar avatar-sm" style="background:${getAvatarColor(r.NguoiDuocGT)}">${(r.NguoiDuocGT || 'U').charAt(0)}</div>
                    <span class="font-semibold">${r.NguoiDuocGT || '—'}</span>
                  </div>
                </td>
                <td>${r.KhoaHocDK || '—'}</td>
                <td>${formatMoney(r.HoaHong_10pct || 0)}</td>
                <td>${statusBadge}</td>
              </tr>
            `;
          }).join('');
        }
      }
    }

    // Load leaderboard
    const lbResult = await API.getLeaderboard();
    if (lbResult.ok) {
      renderLeaderboard(lbResult.data || []);
    }
  }

  // ── Commission Tab ──
  async function loadCommission(maHV) {
    const result = await API.getReferralStats(maHV);
    if (!result.ok) return;

    const d = result.data;
    setTextContent('comm-total', formatMoney(d.totalCommission || 0));
    setTextContent('comm-paid', formatMoney(d.paidCommission || 0));
    setTextContent('comm-unpaid', formatMoney(d.unpaidCommission || 0));

    const tbody = document.getElementById('commission-tbody');
    if (tbody) {
      if (d.referrals.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:40px">💰 Chưa có hoa hồng</td></tr>';
      } else {
        tbody.innerHTML = d.referrals.map((r, i) => {
          const statusBadge = r.TrangThaiHH === 'DaThanhToan'
            ? '<span class="badge badge-success">✓ Đã thanh toán</span>'
            : '<span class="badge badge-warning">⏳ Chờ thanh toán</span>';
          return `
            <tr>
              <td>${i + 1}</td>
              <td class="font-semibold">${r.NguoiDuocGT || '—'}</td>
              <td>${r.KhoaHocDK || '—'}</td>
              <td>${formatMoney(r.GiaGoc || 0)}</td>
              <td class="font-bold text-accent">${formatMoney(r.HoaHong_10pct || 0)}</td>
              <td>${statusBadge}</td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  // ── Courses Tab ──
  async function loadCourses() {
    const grid = document.getElementById('courses-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:0 auto"></div><p class="text-muted" style="margin-top:16px">Đang tải khóa học...</p></div>';

    const result = await API.getCourses();
    const courses = Array.isArray(result) ? result : (result.data || []);

    if (courses.length === 0) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📚</div><div class="empty-text">Chưa có khóa học nào</div></div>';
      return;
    }

    grid.innerHTML = courses.map(c => {
      const hasDiscount = c.GiaKM && c.GiaKM < c.GiaGoc;
      return `
        <div class="course-card animate-fade-in">
          ${hasDiscount ? '<span class="course-badge badge badge-danger">🔥 Khuyến mãi</span>' : ''}
          <div class="course-icon">${c.Icon || '📘'}</div>
          <div class="course-name">${c.TenKhoaHoc || c.MaKH}</div>
          <div class="course-desc">${c.MoTa || ''}</div>
          <div class="course-meta">
            <span>⏱ ${c.ThoiLuong || '—'}</span>
            <span>📋 ${c.MaKH || ''}</span>
          </div>
          <div class="course-price">
            <span class="price-current">${formatMoney(c.GiaKM || c.GiaGoc || 0)}</span>
            ${hasDiscount ? `<span class="price-original">${formatMoney(c.GiaGoc)}</span>` : ''}
          </div>
          <button class="course-cta" onclick="window.open('https://zalo.me/0906303373','_blank')">
            📞 Đăng ký ngay
          </button>
        </div>
      `;
    }).join('');
  }

  // ── Profile Tab ──
  async function loadProfile(maHV) {
    const user = Auth.get();
    if (!user) return;

    const fields = {
      'profile-name': user.HoTen,
      'profile-phone': user.SDT,
      'profile-cccd': user.CCCD || 'Chưa cập nhật',
      'profile-email': user.Email || 'Chưa cập nhật',
      'profile-start': user.NgayVaoHoc || '—',
      'profile-course': user.KhoaHoc || 'Chưa có',
      'profile-status': getStatusText(user.TrangThai),
      'profile-ref-code': user.MaGioiThieu || '—',
      'profile-created': user.NgayTao || '—',
    };

    Object.entries(fields).forEach(([id, value]) => {
      setTextContent(id, value);
    });
  }

  // ── Leaderboard ──
  function renderLeaderboard(data) {
    const container = document.getElementById('leaderboard-list');
    if (!container) return;

    if (data.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">🏆</div><div class="empty-text">Chưa có dữ liệu xếp hạng</div></div>';
      return;
    }

    container.innerHTML = data.map((item, i) => {
      const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
      return `
        <div class="leaderboard-item animate-fade-in" style="animation-delay:${i * 0.05}s">
          <div class="rank ${rankClass}">${medal}</div>
          <div class="avatar avatar-sm" style="background:${getAvatarColor(item.name)}">${(item.name || 'U').charAt(0)}</div>
          <div class="lb-name">${item.name || '—'}</div>
          <div class="lb-count">${item.count} người</div>
        </div>
      `;
    }).join('');
  }

  // ── Mobile Menu ──
  function setupMobileMenu() {
    const toggle = document.getElementById('menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (toggle) {
      toggle.addEventListener('click', () => {
        sidebar?.classList.toggle('open');
        overlay?.classList.toggle('show');
      });
    }

    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar?.classList.remove('open');
        overlay?.classList.remove('show');
      });
    }
  }

  // ── Logout ──
  function setupLogout() {
    const btn = document.getElementById('logout-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        Auth.logout();
      });
    }
  }

  // ── Helpers ──
  function setTextContent(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function getStatusText(status) {
    const map = {
      'HocThu': '🟢 Học thử',
      'ChinhThuc': '🟣 Chính thức',
      'DaTotNghiep': '🎓 Đã tốt nghiệp',
    };
    return map[status] || status || '—';
  }

  function formatMoney(n) {
    if (!n && n !== 0) return '0đ';
    return new Intl.NumberFormat('vi-VN').format(n) + 'đ';
  }

  function getAvatarColor(name) {
    const colors = [
      'linear-gradient(135deg, #6366f1, #8b5cf6)',
      'linear-gradient(135deg, #3b82f6, #06b6d4)',
      'linear-gradient(135deg, #10b981, #34d399)',
      'linear-gradient(135deg, #f59e0b, #f97316)',
      'linear-gradient(135deg, #ef4444, #ec4899)',
      'linear-gradient(135deg, #8b5cf6, #ec4899)',
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  function showToast(message, type = 'success') {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  return { init, switchTab, showToast, formatMoney };
})();

// Init on DOM ready
document.addEventListener('DOMContentLoaded', Dashboard.init);
