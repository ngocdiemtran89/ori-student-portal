// ╔══════════════════════════════════════════════════════════╗
// ║     ORI STUDENT PORTAL — APPS SCRIPT API v3             ║
// ║     + Bảo mật API (secret key)                          ║
// ║     + Backup tự động hàng tuần                          ║
// ║     + Rate limiting đơn giản                            ║
// ╚══════════════════════════════════════════════════════════╝
//
// SETUP BẮT BUỘC trước khi dùng:
// Apps Script → Project Settings → Script Properties → thêm:
//   API_SECRET   = (tạo 1 chuỗi bí mật, VD: ORI2025@Katie)
//   ADMIN_SDT    = (SĐT đăng nhập admin)
//   BACKUP_ID    = (Sheet ID của file backup — tạo file Google Sheets trống, copy ID từ URL)
// ══════════════════════════════════════════════════════════

const SHEET_ID = '1fMv_ckTvJTwOiAjiCIzdQx7oobwbJyx_oeeDUnI8VWI';

const SH = {
  HOC_VIEN   : 'HocVien',
  LICH_SU    : 'LichSuHoc',
  GIOI_THIEU : 'GioiThieu',
  KHOA_HOC   : 'KhoaHoc',
  RATE_LIMIT : 'RateLimit',
};

// ── Đọc secret từ Properties (không hardcode) ──
function getSecret() {
  return PropertiesService.getScriptProperties().getProperty('API_SECRET') || '';
}

// ══════════════════════════════════════
// OUTPUT
// ══════════════════════════════════════
function createCorsOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════
// [BẢO MẬT] PHÂN LOẠI ACTION
// public   : ai cũng gọi được (courses, login, register)
// student  : cần login (profile, history, referral)
// admin    : cần secret key (admin_*)
// ══════════════════════════════════════
const PUBLIC_ACTIONS  = ['test','courses','login','register', 'lookup_ref'];
const STUDENT_ACTIONS = ['profile','history','referral','leaderboard','update_profile','request_withdrawal'];
const ADMIN_ACTIONS   = ['admin_list_students','admin_add_student','admin_add_history','admin_update_commission','admin_list_withdrawals'];

function checkAuth(action, body, params) {
  // Public — không cần kiểm tra
  if (PUBLIC_ACTIONS.includes(action)) return { ok: true };

  // Student actions — kiểm tra maHV hợp lệ (có trong sheet)
  if (STUDENT_ACTIONS.includes(action)) {
    const maHV = params.maHV || body.maHV || '';
    if (!maHV) return { ok: false, error: 'Thiếu mã học viên.' };
    // Không verify thêm để tránh chậm — bảo mật ở tầng login
    return { ok: true };
  }

  // Admin actions — phải có secret đúng
  if (ADMIN_ACTIONS.includes(action)) {
    const secret = body.secret || params.secret || '';
    if (!secret || secret !== getSecret()) {
      Logger.log('⚠️ Unauthorized admin access attempt. Action: ' + action);
      return { ok: false, error: 'Không có quyền truy cập.' };
    }
    return { ok: true };
  }

  return { ok: true };
}

// ══════════════════════════════════════
// [BẢO MẬT] RATE LIMITING đơn giản
// Ngăn brute-force login: max 10 lần / IP / 10 phút
// ══════════════════════════════════════
function checkRateLimit(ip) {
  try {
    const cache = CacheService.getScriptCache();
    const key   = 'rl_' + (ip || 'unknown').replace(/[^a-z0-9]/gi, '_');
    const count = parseInt(cache.get(key) || '0');

    if (count >= 10) {
      return { ok: false, error: 'Quá nhiều lần thử. Vui lòng đợi 10 phút.' };
    }

    cache.put(key, String(count + 1), 600); // TTL 600 giây = 10 phút
    return { ok: true };
  } catch(e) {
    return { ok: true }; // Nếu cache lỗi thì bỏ qua rate limit
  }
}

// ══════════════════════════════════════
// GET HANDLER
// ══════════════════════════════════════
function doGet(e) {
  const action = (e.parameter.action || '').toLowerCase();
  const ip     = e.parameter.userIp || '';

  let body = {};
  if (e.parameter.payload) {
    try { body = JSON.parse(decodeURIComponent(e.parameter.payload)); } catch(err) { body = {}; }
  }

  // Rate limit cho login
  if (action === 'login') {
    const rl = checkRateLimit(ip);
    if (!rl.ok) return createCorsOutput(rl);
  }

  // Kiểm tra quyền
  const auth = checkAuth(action, body, e.parameter);
  if (!auth.ok) return createCorsOutput({ ok: false, error: auth.error });

  try {
    switch (action) {
      case 'test':       return createCorsOutput({ ok: true, msg: 'ORI Portal API v3.0 ✅' });
      case 'courses':    return createCorsOutput({ ok: true, data: getCourses() });
      case 'profile':    return createCorsOutput(getProfile(e.parameter.maHV));
      case 'history':    return createCorsOutput({ ok: true, data: getHistory(e.parameter.maHV) });
      case 'referral':   return createCorsOutput(getReferralStats(e.parameter.maHV));
      case 'leaderboard':return createCorsOutput({ ok: true, data: getLeaderboard() });
      case 'login':      return createCorsOutput(handleLogin(body.hoTen, body.sdt));
      case 'register':   return createCorsOutput(handleRegister(body));
      case 'lookup_ref': return createCorsOutput(lookupRefCode(e.parameter.ref || body.ref));
      case 'admin_add_student':      return createCorsOutput(handleRegister(body));
      case 'admin_list_students':    return createCorsOutput(adminListStudents());
      case 'admin_list_withdrawals': return createCorsOutput(adminListWithdrawals());
      case 'admin_add_history':      return createCorsOutput(adminAddHistoryAPI(body));
      case 'admin_update_commission':return createCorsOutput(adminUpdateCommission(body));
      default:           return createCorsOutput({ ok: true, msg: 'ORI Portal API v3' });
    }
  } catch (err) {
    Logger.log('doGet error: ' + err.stack);
    return createCorsOutput({ ok: false, error: err.message });
  }
}

// ══════════════════════════════════════
// POST HANDLER
// ══════════════════════════════════════
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents || e.postData.contents.trim() === '') {
      return createCorsOutput({ ok: false, error: 'Request body trống.' });
    }

    let body;
    try { body = JSON.parse(e.postData.contents); }
    catch (err) { return createCorsOutput({ ok: false, error: 'JSON không hợp lệ.' }); }

    const action = (body.action || '').toLowerCase();

    // Rate limit login
    if (action === 'login') {
      const rl = checkRateLimit('post');
      if (!rl.ok) return createCorsOutput(rl);
    }

    // Kiểm tra quyền
    const auth = checkAuth(action, body, {});
    if (!auth.ok) return createCorsOutput({ ok: false, error: auth.error });

    switch (action) {
      case 'login':      return createCorsOutput(handleLogin(body.hoTen, body.sdt));
      case 'register':   return createCorsOutput(handleRegister(body));
      case 'admin_list_students':    return createCorsOutput(adminListStudents());
      case 'admin_list_withdrawals': return createCorsOutput(adminListWithdrawals());
      case 'admin_add_student':      return createCorsOutput(handleRegister(body));
      case 'admin_add_history':      return createCorsOutput(adminAddHistoryAPI(body));
      case 'admin_update_commission':return createCorsOutput(adminUpdateCommission(body));
      case 'update_profile':         return createCorsOutput(updateProfile(body));
      case 'request_withdrawal':     return createCorsOutput(requestWithdrawal(body));
      default:           return createCorsOutput({ ok: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    Logger.log('doPost error: ' + err.stack);
    return createCorsOutput({ ok: false, error: err.message });
  }
}

// ══════════════════════════════════════
// AUTHENTICATION
// ══════════════════════════════════════
function handleLogin(hoTen, sdt) {
  if (!hoTen || !sdt) return { ok: false, error: 'Vui lòng nhập đầy đủ Họ tên và SĐT.' };

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.HOC_VIEN);
  if (!sh) return { ok: false, error: 'Sheet HocVien không tồn tại.' };

  const rows    = sh.getDataRange().getValues();
  const headers = rows[0];
  const iHoTen  = headers.indexOf('HoTen');
  const iSDT    = headers.indexOf('SDT');

  if (iHoTen === -1 || iSDT === -1) return { ok: false, error: 'Cấu trúc sheet không đúng.' };

  const normName  = hoTen.trim().toLowerCase();
  const normPhone = sdt.trim().replace(/\s/g, '');

  for (let i = 1; i < rows.length; i++) {
    const rowName  = String(rows[i][iHoTen]).trim().toLowerCase();
    const rowPhone = String(rows[i][iSDT]).trim().replace(/\s/g, '');

    const phoneMatch = rowPhone === normPhone
      || rowPhone === normPhone.replace(/^0+/, '')
      || normPhone === rowPhone.replace(/^0+/, '');

    if (rowName === normName && phoneMatch) {
      const profile = {};
      headers.forEach((h, idx) => {
        if (h) {
          let val = rows[i][idx];
          if (val instanceof Date) val = Utilities.formatDate(val, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm');
          profile[h] = val;
        }
      });
      if (profile.TrangThai === 'Admin') profile.role = 'admin';
      return { ok: true, data: profile };
    }
  }

  return { ok: false, error: 'Họ tên hoặc SĐT không đúng. Vui lòng thử lại.' };
}

// ══════════════════════════════════════
// PROFILE
// ══════════════════════════════════════
function getProfile(maHV) {
  if (!maHV) return { ok: false, error: 'Thiếu mã học viên.' };

  const ss   = SpreadsheetApp.openById(SHEET_ID);
  const sh   = ss.getSheetByName(SH.HOC_VIEN);
  if (!sh) return { ok: false, error: 'Sheet HocVien không tồn tại.' };

  const rows    = sh.getDataRange().getValues();
  const headers = rows[0];
  const iMaHV   = headers.indexOf('MaHV');

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][iMaHV]).trim() === String(maHV).trim()) {
      const profile = {};
      headers.forEach((h, idx) => {
        if (h) {
          let val = rows[i][idx];
          if (val instanceof Date) val = Utilities.formatDate(val, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy');
          profile[h] = val;
        }
      });
      return { ok: true, data: profile };
    }
  }

  return { ok: false, error: 'Không tìm thấy học viên.' };
}

// ══════════════════════════════════════
// LEARNING HISTORY
// ══════════════════════════════════════
function getHistory(maHV) {
  if (!maHV) return [];

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.LICH_SU);
  if (!sh) return [];

  const rows    = sh.getDataRange().getValues();
  const headers = rows[0];
  const iMaHV   = headers.indexOf('MaHV');
  const result  = [];

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][iMaHV]).trim() === String(maHV).trim()) {
      const entry = {};
      headers.forEach((h, idx) => {
        if (h) {
          let val = rows[i][idx];
          if (val instanceof Date) val = Utilities.formatDate(val, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy');
          entry[h] = val;
        }
      });
      result.push(entry);
    }
  }

  return result;
}

// ══════════════════════════════════════
// REFERRAL
// ══════════════════════════════════════
function getReferralStats(maHV) {
  if (!maHV) return { ok: false, error: 'Thiếu mã học viên.' };

  const ss   = SpreadsheetApp.openById(SHEET_ID);
  const shHV = ss.getSheetByName(SH.HOC_VIEN);
  if (!shHV) return { ok: false, error: 'Sheet HocVien không tồn tại.' };

  const hvRows    = shHV.getDataRange().getValues();
  const hvHeaders = hvRows[0];
  const iMaHV     = hvHeaders.indexOf('MaHV');
  const iMaGT     = hvHeaders.indexOf('MaGioiThieu');

  let maGioiThieu = '';
  for (let i = 1; i < hvRows.length; i++) {
    if (String(hvRows[i][iMaHV]).trim() === String(maHV).trim()) {
      maGioiThieu = String(hvRows[i][iMaGT]).trim();
      break;
    }
  }

  if (!maGioiThieu) return { ok: true, data: { maGioiThieu:'', referrals:[], totalCommission:0, paidCommission:0, unpaidCommission:0, totalReferred:0 } };

  const shGT = ss.getSheetByName(SH.GIOI_THIEU);
  if (!shGT) return { ok: true, data: { maGioiThieu, referrals:[], totalCommission:0, paidCommission:0, unpaidCommission:0, totalReferred:0 } };

  const gtRows    = shGT.getDataRange().getValues();
  const gtHeaders = gtRows[0];
  const iMaGTCol  = gtHeaders.indexOf('MaGioiThieu');

  const referrals = [];
  let totalCommission = 0;
  let paidCommission  = 0;

  for (let i = 1; i < gtRows.length; i++) {
    if (String(gtRows[i][iMaGTCol]).trim() === maGioiThieu) {
      const entry = {};
      gtHeaders.forEach((h, idx) => {
        if (h) {
          let val = gtRows[i][idx];
          if (val instanceof Date) val = Utilities.formatDate(val, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy');
          entry[h] = val;
        }
      });
      referrals.push(entry);
      const commission = Number(entry['HoaHong_10pct']) || 0;
      totalCommission += commission;
      if (entry['TrangThaiHH'] === 'DaThanhToan') paidCommission += commission;
    }
  }

  return { ok: true, data: { maGioiThieu, referrals, totalCommission, paidCommission, unpaidCommission: totalCommission - paidCommission, totalReferred: referrals.length } };
}

// ══════════════════════════════════════
// LEADERBOARD
// ══════════════════════════════════════
function getLeaderboard() {
  const ss   = SpreadsheetApp.openById(SHEET_ID);
  const shGT = ss.getSheetByName(SH.GIOI_THIEU);
  if (!shGT) return [];

  const rows      = shGT.getDataRange().getValues();
  const headers   = rows[0];
  const iNguoiGT  = headers.indexOf('NguoiGioiThieu');
  const iMaGT     = headers.indexOf('MaGioiThieu');
  const map       = {};

  for (let i = 1; i < rows.length; i++) {
    const name = String(rows[i][iNguoiGT]).trim();
    const code = String(rows[i][iMaGT]).trim();
    if (!name) continue;
    if (!map[code]) map[code] = { name, code, count: 0 };
    map[code].count++;
  }

  return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 10);
}

// ══════════════════════════════════════
// COURSES
// ══════════════════════════════════════
function getCourses() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.KHOA_HOC);
  if (!sh) return [];

  const rows    = sh.getDataRange().getValues();
  const headers = rows[0];
  const result  = [];

  for (let i = 1; i < rows.length; i++) {
    const entry = {};
    headers.forEach((h, idx) => { if (h) entry[h] = rows[i][idx]; });
    if (entry.TrangThai === 'DangMo') result.push(entry);
  }

  return result;
}

// ══════════════════════════════════════
// REGISTER
// ══════════════════════════════════════
function handleRegister(body) {
  const { hoTen, sdt, cccd, email, khoaHoc, refCode } = body;
  if (!hoTen || !sdt) return { ok: false, error: 'Thiếu Họ tên hoặc SĐT.' };

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.HOC_VIEN);
  if (!sh) return { ok: false, error: 'Sheet HocVien không tồn tại.' };

  const rows    = sh.getDataRange().getValues();
  const headers = rows[0];
  const iSDT    = headers.indexOf('SDT');

  const normPhone = sdt.trim().replace(/\s/g, '');
  for (let i = 1; i < rows.length; i++) {
    const existing = String(rows[i][iSDT]).trim().replace(/\s/g, '');
    const dup = existing === normPhone
      || existing === normPhone.replace(/^0+/, '')
      || normPhone === existing.replace(/^0+/, '');
    if (dup) return { ok: false, error: 'Số điện thoại đã được đăng ký.' };
  }

  const maHV         = 'ORI-' + String(rows.length).padStart(4, '0');
  const maGioiThieu  = generateUniqueRefCode(ss);

  let giaGoc = 0, giamGia = 0, hoaHong = 0;

  if (khoaHoc) {
    const shKH = ss.getSheetByName(SH.KHOA_HOC);
    if (shKH) {
      const khRows    = shKH.getDataRange().getValues();
      const khHeaders = khRows[0];
      const iMaKH     = khHeaders.indexOf('MaKH');
      const iGia      = khHeaders.indexOf('GiaGoc');
      const iGiaKM    = khHeaders.indexOf('GiaKM');
      for (let i = 1; i < khRows.length; i++) {
        if (String(khRows[i][iMaKH]).trim() === khoaHoc) {
          giaGoc = Number(khRows[i][iGiaKM] || khRows[i][iGia]) || 0;
          break;
        }
      }
    }
  }

  if (refCode && giaGoc > 0) {
    giamGia = Math.round(giaGoc * 0.05);
    hoaHong = Math.round(giaGoc * 0.05);
  }

  const newRow = [];
  headers.forEach(h => {
    switch(h) {
      case 'MaHV':         newRow.push(maHV); break;
      case 'HoTen':        newRow.push(toTitle(hoTen)); break;
      case 'SDT':          newRow.push(sdt.trim()); break;
      case 'CCCD':         newRow.push(cccd || ''); break;
      case 'Email':        newRow.push(email || ''); break;
      case 'NgayVaoHoc':   newRow.push(new Date()); break;
      case 'KhoaHoc':      newRow.push(khoaHoc || ''); break;
      case 'MaGioiThieu':  newRow.push(maGioiThieu); break;
      case 'GioiThieuBoi': newRow.push(refCode || ''); break;
      case 'TrangThai':    newRow.push(body.trangThai || 'HocThu'); break;
      case 'NgayTao':      newRow.push(new Date()); break;
      default:             newRow.push('');
    }
  });
  sh.appendRow(newRow);

  if (refCode && giaGoc > 0) {
    const shGT = ss.getSheetByName(SH.GIOI_THIEU);
    if (shGT) {
      const iMaGT   = headers.indexOf('MaGioiThieu');
      const iHoTen2 = headers.indexOf('HoTen');
      let nguoiGT   = '';
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][iMaGT]).trim() === refCode) { nguoiGT = String(rows[i][iHoTen2]); break; }
      }

      const gtHeaders = shGT.getRange(1, 1, 1, shGT.getLastColumn()).getValues()[0];
      const gtRow = [];
      gtHeaders.forEach(h => {
        switch(h) {
          case 'MaGioiThieu':    gtRow.push(refCode); break;
          case 'NguoiGioiThieu': gtRow.push(nguoiGT); break;
          case 'NguoiDuocGT':   gtRow.push(toTitle(hoTen)); break;
          case 'MaHV_DuocGT':   gtRow.push(maHV); break;
          case 'NgayGioiThieu':  gtRow.push(new Date()); break;
          case 'KhoaHocDK':     gtRow.push(khoaHoc || ''); break;
          case 'GiaGoc':        gtRow.push(giaGoc); break;
          case 'GiamGia_5pct':  gtRow.push(giamGia); break;
          case 'HoaHong_10pct': gtRow.push(hoaHong); break;
          case 'TrangThaiHH':   gtRow.push('ChuaThanhToan'); break;
          case 'NgayThanhToan':  gtRow.push(''); break;
          default:               gtRow.push('');
        }
      });
      shGT.appendRow(gtRow);
    }
  }

  return { ok: true, data: { maHV, maGioiThieu, giamGia,
    message: giamGia > 0
      ? 'Đăng ký thành công! Bạn được giảm ' + formatMoney(giamGia) + ' nhờ mã giới thiệu.'
      : 'Đăng ký thành công!'
  }};
}

// ══════════════════════════════════════
// ADMIN API
// ══════════════════════════════════════
function adminListStudents() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.HOC_VIEN);
  if (!sh) return { ok: false, error: 'Sheet HocVien không tồn tại.' };

  const rows       = sh.getDataRange().getValues();
  const headers    = rows[0];
  const iTrangThai = headers.indexOf('TrangThai');
  const students   = [];

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][iTrangThai]).trim() === 'Admin') continue;
    const entry = {};
    headers.forEach((h, idx) => {
      if (h) {
        let val = rows[i][idx];
        if (val instanceof Date) val = Utilities.formatDate(val, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy');
        entry[h] = val;
      }
    });
    students.push(entry);
  }

  return { ok: true, data: students };
}

function adminAddHistoryAPI(body) {
  const { maHV, ngay, khoaHoc, baiHoc, diemDanh, ghiChu, diem } = body;
  if (!maHV || !baiHoc) return { ok: false, error: 'Thiếu mã HV hoặc bài học.' };

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.LICH_SU);
  if (!sh) return { ok: false, error: 'Sheet LichSuHoc không tồn tại.' };

  const date = ngay ? new Date(ngay) : new Date();
  sh.appendRow([maHV, date, khoaHoc || '', baiHoc, diemDanh || 'CoMat', ghiChu || '', Number(diem) || 0]);

  return { ok: true, message: 'Đã thêm nhật ký cho ' + maHV };
}

function adminUpdateCommission(body) {
  const { rowIndex, status } = body;
  if (!rowIndex) return { ok: false, error: 'Thiếu vị trí dòng.' };

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.GIOI_THIEU);
  if (!sh) return { ok: false, error: 'Sheet GioiThieu không tồn tại.' };

  const headers    = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const iTrangThai = headers.indexOf('TrangThaiHH');
  const iNgayTT    = headers.indexOf('NgayThanhToan');
  const newStatus  = status || 'DaThanhToan';

  sh.getRange(rowIndex + 1, iTrangThai + 1).setValue(newStatus);
  if (newStatus === 'DaThanhToan') {
    sh.getRange(rowIndex + 1, iNgayTT + 1).setValue(new Date());
  }

  return { ok: true, message: 'Đã cập nhật trạng thái hoa hồng.' };
}

function adminListWithdrawals() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.GIOI_THIEU);
  if (!sh) return { ok: false, error: 'Sheet GioiThieu không tồn tại.' };

  const shHV = ss.getSheetByName(SH.HOC_VIEN);
  const hvRows = shHV ? shHV.getDataRange().getValues() : [];
  const hvHeaders = hvRows[0] || [];
  
  const hvMap = {}; // Map MaGioiThieu to Bank Info
  const iMaGT_HV = hvHeaders.indexOf('MaGioiThieu');
  const iNganHang = hvHeaders.indexOf('NganHang');
  const iSTK = hvHeaders.indexOf('SoTaiKhoan');
  const iCTK = hvHeaders.indexOf('ChuTaiKhoan');
  
  if (iNganHang > -1) {
    for (let i = 1; i < hvRows.length; i++) {
      const code = String(hvRows[i][iMaGT_HV]).trim();
      if (code) {
        hvMap[code] = {
          bank: String(hvRows[i][iNganHang] || ''),
          stk: String(hvRows[i][iSTK] || ''),
          ctk: String(hvRows[i][iCTK] || '')
        };
      }
    }
  }

  const rows = sh.getDataRange().getValues();
  const headers = rows[0];
  const iTrangThai = headers.indexOf('TrangThaiHH');
  const iNguoiGT = headers.indexOf('NguoiGioiThieu');
  const iMaGT = headers.indexOf('MaGioiThieu');
  const iTien = headers.indexOf('HoaHong_10pct');

  const pendingList = [];
  for (let i = 1; i < rows.length; i++) {
    const status = String(rows[i][iTrangThai]).trim();
    if (status === 'DangXuLy') {
      const code = String(rows[i][iMaGT]).trim();
      const bankInfo = hvMap[code] || {};
      pendingList.push({
        rowIndex: i,
        nguoiGioiThieu: rows[i][iNguoiGT],
        maGioiThieu: code,
        hoaHong: rows[i][iTien],
        nganHang: bankInfo.bank,
        soTaiKhoan: bankInfo.stk,
        chuTaiKhoan: bankInfo.ctk
      });
    }
  }

  return { ok: true, data: pendingList };
}

function updateProfile(body) {
  const { maHV, nganHang, soTaiKhoan, chuTaiKhoan } = body;
  if (!maHV) return { ok: false, error: 'Thiếu mã học viên.' };

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.HOC_VIEN);
  if (!sh) return { ok: false, error: 'Sheet HocVien không tồn tại.' };

  const rows = sh.getDataRange().getValues();
  const headers = rows[0];
  const iMaHV = headers.indexOf('MaHV');

  // Check and add columns if they don't exist
  let iNganHang = headers.indexOf('NganHang');
  if (iNganHang === -1) { sh.getRange(1, headers.length + 1).setValue('NganHang'); iNganHang = headers.length; headers.push('NganHang'); }
  let iSTK = headers.indexOf('SoTaiKhoan');
  if (iSTK === -1) { sh.getRange(1, headers.length + 1).setValue('SoTaiKhoan'); iSTK = headers.length; headers.push('SoTaiKhoan'); }
  let iCTK = headers.indexOf('ChuTaiKhoan');
  if (iCTK === -1) { sh.getRange(1, headers.length + 1).setValue('ChuTaiKhoan'); iCTK = headers.length; headers.push('ChuTaiKhoan'); }

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][iMaHV]).trim() === String(maHV).trim()) {
      sh.getRange(i + 1, iNganHang + 1).setValue(nganHang || '');
      sh.getRange(i + 1, iSTK + 1).setValue(soTaiKhoan || '');
      sh.getRange(i + 1, iCTK + 1).setValue(chuTaiKhoan || '');
      return { ok: true, message: 'Cập nhật thông tin thanh toán thành công.' };
    }
  }
  return { ok: false, error: 'Không tìm thấy học viên.' };
}

function requestWithdrawal(body) {
  const { maHV } = body;
  if (!maHV) return { ok: false, error: 'Thiếu mã học viên.' };

  // First get the referral code for this student
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const shHV = ss.getSheetByName(SH.HOC_VIEN);
  let refCode = '';
  if (shHV) {
    const hvRows = shHV.getDataRange().getValues();
    const hvHeaders = hvRows[0];
    const iMaHV = hvHeaders.indexOf('MaHV');
    const iMaGT = hvHeaders.indexOf('MaGioiThieu');
    for (let i = 1; i < hvRows.length; i++) {
      if (String(hvRows[i][iMaHV]).trim() === String(maHV).trim()) {
        refCode = String(hvRows[i][iMaGT]).trim();
        break;
      }
    }
  }

  if (!refCode) return { ok: false, error: 'Không tìm thấy mã giới thiệu.' };

  const sh = ss.getSheetByName(SH.GIOI_THIEU);
  if (!sh) return { ok: false, error: 'Sheet GioiThieu không tồn tại.' };

  const rows = sh.getDataRange().getValues();
  const headers = rows[0];
  const iTrangThai = headers.indexOf('TrangThaiHH');
  const iMaGTC = headers.indexOf('MaGioiThieu');

  let updated = 0;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][iMaGTC]).trim() === refCode) {
      const status = String(rows[i][iTrangThai]).trim();
      if (status === 'ChuaThanhToan' || status === 'Chờ TT') {
        sh.getRange(i + 1, iTrangThai + 1).setValue('DangXuLy');
        updated++;
      }
    }
  }

  if (updated === 0) return { ok: false, error: 'Không có khoản hoa hồng nào đủ điều kiện rút.' };
  return { ok: true, message: 'Đã gửi yêu cầu rút tiền thành công!' };
}

// ══════════════════════════════════════
// [BACKUP] TỰ ĐỘNG HÀNG TUẦN
// Setup: Apps Script → Triggers → Add Trigger
//   Function: weeklyBackup
//   Event: Time-driven → Week timer → Every Monday → 7-8am
// ══════════════════════════════════════
function weeklyBackup() {
  try {
    const props    = PropertiesService.getScriptProperties();
    const backupId = props.getProperty('BACKUP_ID');

    if (!backupId) {
      Logger.log('⚠️ BACKUP_ID chưa được cấu hình trong Script Properties.');
      return;
    }

    const ss       = SpreadsheetApp.openById(SHEET_ID);
    const ssBk     = SpreadsheetApp.openById(backupId);
    const dateStr  = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
    const sheets   = [SH.HOC_VIEN, SH.LICH_SU, SH.GIOI_THIEU, SH.KHOA_HOC];
    let count      = 0;

    sheets.forEach(shName => {
      const src = ss.getSheetByName(shName);
      if (!src) return;

      const backupName = shName + '_' + dateStr;

      // Xóa backup cũ hơn 4 tuần (giữ 4 bản gần nhất)
      const existingSheets = ssBk.getSheets().filter(s => s.getName().startsWith(shName + '_'));
      if (existingSheets.length >= 4) {
        existingSheets.sort((a, b) => a.getName().localeCompare(b.getName()));
        ssBk.deleteSheet(existingSheets[0]); // Xóa bản cũ nhất
      }

      // Copy sheet sang backup
      src.copyTo(ssBk).setName(backupName);
      count++;
    });

    Logger.log('✅ Backup thành công ' + count + ' sheets lúc ' + dateStr);

    // Ghi log vào sheet (tùy chọn)
    logBackup(dateStr, count);

  } catch(err) {
    Logger.log('❌ Backup lỗi: ' + err.message);
  }
}

function logBackup(dateStr, count) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let logSheet = ss.getSheetByName('BackupLog');
    if (!logSheet) {
      logSheet = ss.insertSheet('BackupLog');
      logSheet.appendRow(['Ngày Backup', 'Số Sheet', 'Trạng Thái']);
    }
    logSheet.appendRow([dateStr, count, '✅ Thành công']);
  } catch(e) {
    // Không quan trọng nếu log lỗi
  }
}

// Chạy tay để test backup ngay lập tức
function testBackupNow() {
  weeklyBackup();
  Logger.log('Test backup hoàn tất.');
}

// ══════════════════════════════════════
// ADMIN ACCOUNT
// ══════════════════════════════════════
function createAdminAccount() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.HOC_VIEN);
  if (!sh) { Logger.log('❌ Chạy setupSheets() trước.'); return; }

  const rows    = sh.getDataRange().getValues();
  const headers = rows[0];
  const iHoTen  = headers.indexOf('HoTen');

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][iHoTen]).trim().toLowerCase() === 'admin') {
      Logger.log('⚠️ Tài khoản Admin đã tồn tại.');
      return;
    }
  }

  const props    = PropertiesService.getScriptProperties();
  const adminSdt = props.getProperty('ADMIN_SDT') || '010813';
  const maHV     = 'ADMIN-001';
  const newRow   = [];

  headers.forEach(h => {
    switch(h) {
      case 'MaHV':         newRow.push(maHV); break;
      case 'HoTen':        newRow.push('Admin'); break;
      case 'SDT':          newRow.push(adminSdt); break;
      case 'Email':        newRow.push('admin@ori.academy'); break;
      case 'NgayVaoHoc':   newRow.push(new Date()); break;
      case 'KhoaHoc':      newRow.push('ALL'); break;
      case 'MaGioiThieu':  newRow.push('REF-ADMIN'); break;
      case 'TrangThai':    newRow.push('Admin'); break;
      case 'NgayTao':      newRow.push(new Date()); break;
      default:             newRow.push('');
    }
  });

  sh.appendRow(newRow);
  Logger.log('✅ Admin tạo xong. SĐT từ Script Properties (ADMIN_SDT).');
}

// ══════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════
function generateUniqueRefCode(ss) {
  const sh      = ss.getSheetByName(SH.HOC_VIEN);
  const rows    = sh ? sh.getDataRange().getValues() : [];
  const headers = rows[0] || [];
  const iMaGT   = headers.indexOf('MaGioiThieu');

  const existing = new Set();
  for (let i = 1; i < rows.length; i++) {
    const code = String(rows[i][iMaGT]).trim();
    if (code) existing.add(code);
  }

  let code, attempts = 0;
  do {
    code = 'REF-' + generateCode(5);
    attempts++;
    if (attempts > 50) break;
  } while (existing.has(code));

  return code;
}

function generateCode(length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function toTitle(str) {
  return str.trim().toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
}

function formatMoney(n) {
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ';
}

/**
 * Tra cứu mã giới thiệu → trả tên người giới thiệu
 * Dùng cho form đăng ký public
 */
function lookupRefCode(refCode) {
  if (!refCode) return { ok: false, error: 'Thiếu mã giới thiệu.' };
  
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.HOC_VIEN);
  const rows = sh.getDataRange().getValues();
  const headers = rows[0];
  const iMaGT = headers.indexOf('MaGioiThieu');
  const iHoTen = headers.indexOf('HoTen');
  
  const code = String(refCode).trim().toUpperCase();
  
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][iMaGT]).trim().toUpperCase() === code) {
      return { 
        ok: true, 
        data: { 
          nguoiGioiThieu: rows[i][iHoTen],
          refCode: rows[i][iMaGT],
          giamGia: '5%'
        }
      };
    }
  }
  
  return { ok: false, error: 'Mã giới thiệu không tồn tại.' };
}

// ══════════════════════════════════════
// ADMIN TOOLS (chạy từ Editor)
// ══════════════════════════════════════
function adminAddStudent() {
  const hoTen = 'Nguyễn Thị Mới';
  const sdt   = '0901111222';
  const khoaHoc = 'KH01';
  const refCode = '';

  const result = handleRegister({ hoTen, sdt, khoaHoc, refCode });
  Logger.log(result.ok ? '✅ ' + result.data.message + ' — MaHV: ' + result.data.maHV : '❌ ' + result.error);
}

function adminAddHistory() {
  const maHV     = 'ORI-0001';
  const khoaHoc  = 'TOEIC-450';
  const baiHoc   = 'Listening Part 3';
  const diemDanh = 'CoMat';
  const ghiChu   = 'Làm bài tốt';
  const diem     = 85;

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SH.LICH_SU);
  if (!sh) { Logger.log('❌ Sheet LichSuHoc không tồn tại.'); return; }
  sh.appendRow([maHV, new Date(), khoaHoc, baiHoc, diemDanh, ghiChu, diem]);
  Logger.log('✅ Đã thêm nhật ký: ' + maHV + ' — ' + baiHoc);
}

function autoFillRefCodes() {
  const ss   = SpreadsheetApp.openById(SHEET_ID);
  const sh   = ss.getSheetByName(SH.HOC_VIEN);
  if (!sh) { Logger.log('❌ Sheet không tồn tại.'); return; }

  const rows    = sh.getDataRange().getValues();
  const headers = rows[0];
  const iMaGT   = headers.indexOf('MaGioiThieu');
  const iHoTen  = headers.indexOf('HoTen');

  const existing = new Set();
  for (let i = 1; i < rows.length; i++) {
    const code = String(rows[i][iMaGT]).trim();
    if (code) existing.add(code);
  }

  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][iMaGT] || String(rows[i][iMaGT]).trim() === '') {
      let newCode, attempts = 0;
      do { newCode = 'REF-' + generateCode(5); attempts++; }
      while (existing.has(newCode) && attempts < 50);
      existing.add(newCode);
      sh.getRange(i + 1, iMaGT + 1).setValue(newCode);
      count++;
      Logger.log('  → ' + rows[i][iHoTen] + ': ' + newCode);
    }
  }
  Logger.log('✅ Đã sinh mã cho ' + count + ' học viên.');
}
