/* Auth mockups: theme, ?state= switch, VI/EN strings (web.login.* of libs/i18n), demo validation. ES5, loads after i18n.js. */
(function () {
  var I = window.ECP_I18N, q = new URLSearchParams(location.search), root = document.documentElement;
  var T = {
    'auth.title.signIn': ['Đăng nhập', 'Sign in'], 'auth.title.request': ['Yêu cầu tài khoản mới', 'Request a new account'],
    'auth.subtitle': ['The Governance and Context for Agentic Era', 'The Governance and Context for Agentic Era'],
    'auth.email': ['Email', 'Email'], 'auth.password': ['Mật khẩu', 'Password'], 'auth.confirm': ['Nhập lại mật khẩu', 'Confirm password'],
    'auth.newPassword': ['Mật khẩu mới', 'New password'], 'auth.forgot': ['Quên mật khẩu?', 'Forgot password?'],
    'auth.signIn': ['Đăng nhập', 'Sign in'], 'auth.or': ['hoặc', 'or'], 'auth.sso': ['Đăng nhập bằng SSO', 'Sign in with SSO'],
    'auth.noAccount': ['Chưa có tài khoản?', 'No account yet?'], 'auth.haveAccount': ['Đã có tài khoản?', 'Already have an account?'],
    'auth.requestAccount': ['Yêu cầu tài khoản mới', 'Request a new account'], 'auth.requestSubmit': ['Gửi yêu cầu', 'Send request'],
    'auth.back': ['Quay lại đăng nhập', 'Back to sign in'],
    'auth.errEmail': ['Nhập email hợp lệ', 'Enter a valid email'], 'auth.errPassword': ['Nhập mật khẩu', 'Enter your password'],
    'auth.errShort': ['Mật khẩu cần ít nhất 8 ký tự', 'Password needs at least 8 characters'], 'auth.errConfirm': ['Mật khẩu nhập lại chưa khớp', 'Passwords do not match'],
    'auth.signInFailed': ['Email hoặc mật khẩu chưa đúng, hoặc tài khoản chưa được duyệt.', 'Email or password is wrong, or the account is not approved yet.'],
    'auth.ssoFailed': ['Đăng nhập SSO không thành công. Thử lại hoặc liên hệ quản trị viên.', 'SSO sign-in failed. Try again or contact your administrator.'],
    'auth.ssoUnavailable': ['Đăng nhập SSO chưa được cấu hình. Liên hệ quản trị viên.', 'SSO sign-in is not configured. Contact an administrator.'],
    'auth.requestSent': ['Đã gửi yêu cầu. Kiểm tra email để xác minh địa chỉ; sau đó quản trị viên sẽ duyệt tài khoản.', 'Request sent. Check your email to verify the address; an administrator then approves the account.'],
    'auth.requestFailed': ['Chưa gửi được yêu cầu. Thử lại sau.', 'Could not send the request. Try again later.'],
    'auth.forgotTitle': ['Quên mật khẩu', 'Forgot password'],
    'auth.forgotIntro': ['Nhập email của tài khoản. Chúng tôi sẽ gửi liên kết đặt lại mật khẩu.', 'Enter the email of your account. We will send a link to reset the password.'],
    'auth.forgotSubmit': ['Gửi liên kết đặt lại', 'Send reset link'],
    'auth.forgotSent': ['Nếu email thuộc một tài khoản đang hoạt động, liên kết đặt lại mật khẩu đã được gửi. Liên kết có hiệu lực 30 phút.', 'If the email belongs to an active account, a reset link has been sent. The link is valid for 30 minutes.'],
    'auth.resetTitle': ['Đặt lại mật khẩu', 'Reset password'], 'auth.resetSubmit': ['Đặt mật khẩu mới', 'Set new password'],
    'auth.resetDone': ['Đã đổi mật khẩu. Đăng nhập bằng mật khẩu mới.', 'Password changed. Sign in with the new password.'],
    'auth.resetInvalid': ['Liên kết không hợp lệ, đã hết hạn hoặc đã được dùng. Yêu cầu một liên kết mới.', 'The link is invalid, expired or already used. Request a new link.'],
    'auth.verifyTitle': ['Xác minh email', 'Verify email'], 'auth.verifyBusy': ['Đang xác minh…', 'Verifying…'],
    'auth.verifyDone': ['Đã xác minh email. Quản trị viên sẽ duyệt yêu cầu trước khi bạn đăng nhập.', 'Email verified. An administrator will review the request before you can sign in.'],
    'auth.verifyInvalid': ['Liên kết xác minh không hợp lệ, đã hết hạn hoặc đã được dùng. Nhập email để nhận liên kết mới.', 'The verification link is invalid, expired or already used. Enter your email to get a new link.'],
    'auth.verifyResend': ['Gửi lại email xác minh', 'Resend verification email'],
    'auth.verifyResent': ['Nếu yêu cầu tài khoản đang chờ xác minh, email mới đã được gửi.', 'If the account request is waiting for verification, a new email has been sent.'],
    'auth.switchLang': ['Chuyển sang English', 'Switch to Tiếng Việt'], 'auth.switchTheme': ['Đổi giao diện sáng / tối', 'Switch light / dark theme']
  };
  for (var k in T) { I.dict.vi[k] = T[k][0]; I.dict.en[k] = T[k][1]; }

  var th = q.get('theme') || localStorage.getItem('ecp-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.setAttribute('data-theme', th === 'dark' ? 'dark' : 'light');

  // state: ?state=<name>; each [data-st="a b"] block shows only in the listed states (see index.html links)
  function setState(s) {
    document.body.setAttribute('data-state', s);
    [].forEach.call(document.querySelectorAll('[data-st]'), function (el) { el.hidden = el.getAttribute('data-st').split(' ').indexOf(s) < 0; });
    [].forEach.call(document.querySelectorAll('[data-busy]'), function (b) { b.classList.toggle('is-busy', b.getAttribute('data-busy').split(' ').indexOf(s) >= 0); });
    [].forEach.call(document.querySelectorAll('[data-err]'), function (f) {
      var on = f.getAttribute('data-err').split(' ').indexOf(s) >= 0;
      f.classList.toggle('has-error', on); f.querySelector('.field-err').hidden = !on; f.querySelector('.input').setAttribute('aria-invalid', on ? 'true' : 'false');
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    setState(q.get('state') || document.body.getAttribute('data-default') || 'idle');
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-goto]'); if (t) { e.preventDefault(); setState(t.getAttribute('data-goto')); }
      var l = e.target.closest('[data-lang-toggle]'); if (l) { e.preventDefault(); I.set(I.lang === 'en' ? 'vi' : 'en', true); l.textContent = I.lang === 'en' ? 'VI' : 'EN'; }
      var m = e.target.closest('[data-theme-toggle]');
      if (m) { th = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; root.setAttribute('data-theme', th); try { localStorage.setItem('ecp-theme', th); } catch (z) {} }
    });
    var lt = document.querySelector('[data-lang-toggle]'); if (lt) lt.textContent = I.lang === 'en' ? 'VI' : 'EN';
  });
  // as login-frame.tsx: the screen is laid out for 1880x1060 and grows (CSS zoom) with the window, never below 1
  function fit() {
    var k = Math.min(3, Math.max(1, Math.min(innerWidth / 1880, innerHeight / 1060))), m = document.querySelector('.login');
    if (!m) return;
    m.style.setProperty('--login-zoom', k.toFixed(3)); m.style.setProperty('--login-h', innerHeight / k + 'px');
  }
  fit(); addEventListener('resize', fit);
})();
