const API_BASE = 'https://jom-bank-backend-jacquesmends9750-uc.a.run.app';

const authPanel = document.getElementById('authPanel');
const dashboard = document.getElementById('dashboard');
const adminPanel = document.getElementById('adminPanel');
const welcomeText = document.getElementById('welcomeText');
const accountName = document.querySelector('#accountName span');
const accountNumber = document.querySelector('#accountNumber span');
const accountEmail = document.querySelector('#accountEmail span');
const balanceAmount = document.getElementById('balanceAmount');
const transactionHistory = document.getElementById('transactionHistory');
const dashboardAlert = document.getElementById('dashboardAlert');
const userList = document.getElementById('userList');
const refreshUsersBtn = document.getElementById('refreshUsersBtn');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');

const showLogin = document.getElementById('show-login');
const showRegister = document.getElementById('show-register');
const switchToRegister = document.getElementById('switchToRegister');
const switchToLogin = document.getElementById('switchToLogin');
const logoutBtn = document.getElementById('logoutBtn');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginCard = document.getElementById('loginCard');
const registerCard = document.getElementById('registerCard');
const otpCard = document.getElementById('otpCard');
const otpForm = document.getElementById('otpForm');
const otpInput = document.getElementById('otpInput');
const otpEmailDisplay = document.getElementById('otpEmailDisplay');
const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');
const otpError = document.getElementById('otpError');
const forgotPinLink = document.getElementById('forgotPinLink');
const registerPhone = document.getElementById('registerPhone');
const confirmRegisterPin = document.getElementById('confirmRegisterPin');
const quickAccessSection = document.getElementById('quickAccessSection');
const resendOtpBtn = document.getElementById('resendOtpBtn');
const resendTimer = document.getElementById('resendTimer');
const forgotRequestCard = document.getElementById('forgotRequestCard');
const forgotRequestForm = document.getElementById('forgotRequestForm');
const forgotEmail = document.getElementById('forgotEmail');
const forgotRequestError = document.getElementById('forgotRequestError');
const resetPinCard = document.getElementById('resetPinCard');
const resetPinForm = document.getElementById('resetPinForm');
const newPin = document.getElementById('newPin');
const confirmNewPin = document.getElementById('confirmNewPin');
const resetPinError = document.getElementById('resetPinError');

const depositPanel = document.getElementById('depositPanel');
const withdrawPanel = document.getElementById('withdrawPanel');
const billsPanel = document.getElementById('billsPanel');
const changePinPanel = document.getElementById('changePinPanel');
const themeToggle = document.getElementById('themeToggle');
const openDeposit = document.getElementById('openDeposit');
const openWithdraw = document.getElementById('openWithdraw');
const openBills = document.getElementById('openBills');
const openChangePin = document.getElementById('openChangePin');
const openTransfer = document.getElementById('openTransfer');
const transferPanel = document.getElementById('transferPanel');
const quickDeposit = document.getElementById('quickDeposit');
const quickWithdraw = document.getElementById('quickWithdraw');
const quickBills = document.getElementById('quickBills');
const quickBalance = document.getElementById('quickBalance');
const quickInfo = document.getElementById('quickInfo');

const depositForm = document.getElementById('depositForm');
const withdrawForm = document.getElementById('withdrawForm');
const billsForm = document.getElementById('billsForm');
const changePinForm = document.getElementById('changePinForm');
const transferForm = document.getElementById('transferForm');
const transferEmail = document.getElementById('transferEmail');
const transferAmount = document.getElementById('transferAmount');
const transferNote = document.getElementById('transferNote');
const beneficiaryForm = document.getElementById('beneficiaryForm');
const beneficiaryName = document.getElementById('beneficiaryName');
const beneficiaryEmail = document.getElementById('beneficiaryEmail');
const beneficiaryList = document.getElementById('beneficiaryList');

let currentTheme = localStorage.getItem('jomBankTheme') || 'dark';
let currentToken = localStorage.getItem('jomBankToken');
let currentAccount = null;
let pendingEmail = null;
let pendingAction = null;

function setToken(token) {
  currentToken = token;
  if (token) {
    localStorage.setItem('jomBankToken', token);
  } else {
    localStorage.removeItem('jomBankToken');
  }
}

function showMessage(message) {
  alert(message);
}

function showDashboardAlert(message) {
  if (!dashboardAlert) return;
  dashboardAlert.textContent = message;
  dashboardAlert.classList.remove('hidden');
}

function hideDashboardAlert() {
  if (!dashboardAlert) return;
  dashboardAlert.textContent = '';
  dashboardAlert.classList.add('hidden');
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('jomBankTheme', theme);
  currentTheme = theme;
  if (themeToggle) {
    themeToggle.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
  }
}

function showOnly(...elements) {
  [authPanel, dashboard, adminPanel].forEach((panel) => {
    if (!panel) return;
    panel.classList.add('hidden');
  });
  elements.forEach((element) => {
    if (!element) return;
    element.classList.remove('hidden');
  });
}

function setQuickAccessVisible(visible) {
  if (!quickAccessSection) return;
  quickAccessSection.classList.toggle('hidden', !visible);
}

function showFormError(element, message) {
  if (element) {
    element.textContent = message || '';
  }
}

function clearFormErrors() {
  showFormError(loginError, '');
  showFormError(registerError, '');
  showFormError(otpError, '');
}

function showOtpCard(email, action) {
  pendingEmail = email;
  pendingAction = action;
  if (loginCard) loginCard.classList.add('hidden');
  if (registerCard) registerCard.classList.add('hidden');
  if (otpCard) otpCard.classList.remove('hidden');
  if (otpEmailDisplay) otpEmailDisplay.textContent = `Verify code for ${email}`;
  if (otpInput) otpInput.value = '';
  clearFormErrors();
}

function hideOtpCard() {
  if (otpCard) otpCard.classList.add('hidden');
  if (loginCard) loginCard.classList.remove('hidden');
  if (registerCard) registerCard.classList.remove('hidden');
  pendingEmail = null;
  pendingAction = null;
}

function startResendTimer(seconds) {
  if (!resendOtpBtn || !resendTimer) return;
  resendOtpBtn.disabled = true;
  let remaining = seconds;
  resendTimer.textContent = ` (${remaining}s)`;
  const iv = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(iv);
      resendOtpBtn.disabled = false;
      resendTimer.textContent = '';
      return;
    }
    resendTimer.textContent = ` (${remaining}s)`;
  }, 1000);
}

function formatPhoneNumber(value) {
  let digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    digits = '233' + digits.slice(1);
  }
  if (!digits.startsWith('233')) {
    digits = '233' + digits;
  }
  const rest = digits.slice(3);
  const parts = [];
  if (rest.length > 0) parts.push(rest.slice(0, 2));
  if (rest.length > 2) parts.push(rest.slice(2, 5));
  if (rest.length > 5) parts.push(rest.slice(5, 9));
  return ['+233', ...parts].filter(Boolean).join(' ');
}

function handlePhoneInput(event) {
  const formatted = formatPhoneNumber(event.target.value);
  event.target.value = formatted;
}

function showSection(section) {
  [depositPanel, withdrawPanel, billsPanel, changePinPanel].forEach((panel) => panel.classList.add('hidden'));
  if (section) section.classList.remove('hidden');
}

async function api(path, method = 'GET', body = null, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  if (auth && currentToken) {
    options.headers.Authorization = `Bearer ${currentToken}`;
  }
  const response = await fetch(`${API_BASE}${path}`,{ ...options,mode: 'cors' });

  const contentType = response.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = {error:await response.text() };
  }
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function updateDashboard(account) {
  currentAccount = account;
  welcomeText.textContent = `Hello, ${account.name}`;
  accountName.textContent = account.name;
  accountNumber.textContent = account.accountNumber;
  accountEmail.textContent = account.email;
  balanceAmount.textContent = `GHS ${account.balance.toFixed(2)}`;
  if (account.status === 'pending') {
    showDashboardAlert('Your account is pending admin approval.');
  } else if (account.status === 'rejected') {
    showDashboardAlert('Your account was rejected. Contact support for help.');
  } else {
    hideDashboardAlert();
  }
}

function renderHistory(transactions = []) {
  transactionHistory.innerHTML = '';
  if (!transactions.length) {
    transactionHistory.innerHTML = '<li class="history-item"><span class="history-type">No activity yet.</span></li>';
    return;
  }
  transactions.forEach((tx) => {
    const item = document.createElement('li');
    item.className = 'history-item';
    const type = document.createElement('span');
    type.className = 'history-type';
    const date = new Date(tx.created_at).toLocaleDateString();
    type.textContent = `${date} • ${tx.type} — ${tx.note}`;
    const amount = document.createElement('span');
    amount.className = 'history-amount';
    amount.textContent = `${tx.amount >= 0 ? '+' : '-'}GHS ${Math.abs(tx.amount).toFixed(2)}`;
    item.appendChild(type);
    item.appendChild(amount);
    transactionHistory.appendChild(item);
  });
}

async function loadUserDashboard() {
  try {
    const accountData = await api('/api/account');
    updateDashboard(accountData.account);
    const history = await api('/api/transactions?limit=5');
    renderHistory(history.transactions);
    await loadBeneficiaries();
    setQuickAccessVisible(true);
    showOnly(dashboard);
    showSection(depositPanel);
  } catch (error) {
    showMessage(error.message);
    setToken(null);
    showAuth();
  }
}

async function loadAccount() {
  if (!currentToken) {
    setQuickAccessVisible(false);
    return showAuth();
  }
  try {
    const data = await api('/api/account');
    if (data.account.isAdmin) {
      setQuickAccessVisible(false);
      await refreshUsers();
      showOnly(adminPanel);
      return;
    }
    await loadUserDashboard();
  } catch (error) {
    setToken(null);
    showAuth();
  }
}

function showAuth() {
  setQuickAccessVisible(false);
  hideOtpCard();
  clearFormErrors();
  showOnly(authPanel);
  showSection(null);
}

async function loadBeneficiaries() {
  if (!currentAccount) return;
  try {
    const data = await api('/api/beneficiaries');
    renderBeneficiaries(data.beneficiaries);
  } catch (error) {
    beneficiaryList.innerHTML = '';
  }
}

function renderBeneficiaries(beneficiaries = []) {
  if (!beneficiaryList) return;
  beneficiaryList.innerHTML = '';
  if (!beneficiaries.length) {
    beneficiaryList.innerHTML = '<li class="history-item">No beneficiaries saved yet.</li>';
    return;
  }
  beneficiaries.forEach((item) => {
    const listItem = document.createElement('li');
    listItem.innerHTML = `
      <div>
        <strong>${item.beneficiary_name}</strong><br />
        <span>${item.beneficiary_email}</span>
      </div>
      <button class="btn tertiary" data-email="${item.beneficiary_email}">Remove</button>
    `;
    beneficiaryList.appendChild(listItem);
  });
}

async function logout() {
  try {
    if (currentToken) await api('/api/logout', 'GET', null, true);
  } catch (error) {
    // ignore
  }
  setToken(null);
  currentAccount = null;
  setQuickAccessVisible(false);
  showAuth();
}

async function refreshUsers() {
  try {
    const data = await api('/api/admin/users');
    userList.innerHTML = '';
    data.users.forEach((user) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td>${user.account_number}</td>
        <td>GHS ${user.balance.toFixed(2)}</td>
        <td>${user.status}</td>
        <td>
          ${user.status === 'pending' ? `<button class="btn primary approve-account" data-email="${user.email}">Approve</button>
          <button class="btn tertiary reject-account" data-email="${user.email}">Reject</button>` : ''}
          ${user.status === 'active' ? `<button class="btn tertiary freeze-account" data-email="${user.email}">Freeze</button>` : ''}
          ${user.status === 'frozen' ? `<button class="btn primary freeze-account" data-email="${user.email}">Reactivate</button>` : ''}
        </td>
      `;
      userList.appendChild(row);
    });
    showOnly(adminPanel);
  } catch (error) {
    showMessage(error.message);
    showAuth();
  }
}

showLogin.addEventListener('click', () => document.getElementById('loginCard').scrollIntoView({ behavior: 'smooth' }));
showRegister.addEventListener('click', () => document.getElementById('registerCard').scrollIntoView({ behavior: 'smooth' }));
switchToRegister.addEventListener('click', () => document.getElementById('registerCard').scrollIntoView({ behavior: 'smooth' }));
switchToLogin.addEventListener('click', () => document.getElementById('loginCard').scrollIntoView({ behavior: 'smooth' }));

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFormErrors();
  try {
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const pin = document.getElementById('loginPin').value.trim();
    const data = await api('/api/login', 'POST', { email, pin }, false);
    if (data.otpRequired) {
      showOtpCard(email, 'login');
      loginForm.reset();
      return;
    }
    setToken(data.token);
    currentAccount = data.account;
    if (currentAccount.isAdmin) {
      await refreshUsers();
    } else {
      await loadUserDashboard();
    }
    loginForm.reset();
  } catch (error) {
    showFormError(loginError, error.message);
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFormErrors();
  try {
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim().toLowerCase();
    const phone = registerPhone.value.trim();
    const pin = document.getElementById('registerPin').value.trim();
    const confirmPin = confirmRegisterPin.value.trim();
    if (pin !== confirmPin) {
      throw new Error('PIN confirmation does not match.');
    }
    const data = await api('/api/register', 'POST', { name, email, phone, pin, confirmPin }, false);
    if (data.otpRequired) {
      showOtpCard(email, 'register');
      registerForm.reset();
      return;
    }
    showMessage(data.message || 'Registration successful. Please verify OTP.');
    registerForm.reset();
  } catch (error) {
    showFormError(registerError, error.message);
  }
});

logoutBtn.addEventListener('click', logout);
adminLogoutBtn.addEventListener('click', logout);

if (forgotPinLink) {
  forgotPinLink.addEventListener('click', () => {
    clearFormErrors();
    if (forgotRequestCard) {
      showOnly(authPanel);
      loginCard.classList.add('hidden');
      registerCard.classList.add('hidden');
      forgotRequestCard.classList.remove('hidden');
    }
  });
}

if (registerPhone) {
  registerPhone.addEventListener('input', handlePhoneInput);
}

if (otpForm) {
  otpForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors();
    try {
      const otp = otpInput.value.trim();
      if (!pendingEmail || !otp) {
        throw new Error('Please enter the OTP code.');
      }
      const data = await api('/api/verify-otp', 'POST', { email: pendingEmail, otp }, false);
      if (data.token) {
        setToken(data.token);
        currentAccount = data.account;
        if (currentAccount.isAdmin) {
          await refreshUsers();
        } else {
          await loadUserDashboard();
        }
      } else {
        if (data.resetVerified) {
          // show reset PIN UI
          hideOtpCard();
          if (resetPinCard) {
            resetPinCard.classList.remove('hidden');
          }
          return;
        }
        showMessage(data.message || 'OTP verified. Awaiting admin approval.');
        showAuth();
      }
      otpForm.reset();
    } catch (error) {
      showFormError(otpError, error.message);
    }
  });
}

if (resendOtpBtn) {
  resendOtpBtn.addEventListener('click', async () => {
    try {
      if (!pendingEmail) throw new Error('No email to resend OTP for.');
      await api('/api/resend-otp', 'POST', { email: pendingEmail }, false);
      startResendTimer(60);
      showMessage('OTP resent.');
    } catch (err) {
      showFormError(otpError, err.message || err);
      if (err.message && err.message.includes('Please wait')) {
        startResendTimer(30);
      }
    }
  });
}

if (forgotRequestForm) {
  forgotRequestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors();
    try {
      const email = forgotEmail.value.trim().toLowerCase();
      const data = await api('/api/forgot-pin', 'POST', { email }, false);
      showOtpCard(email, 'reset');
      forgotRequestForm.reset();
    } catch (err) {
      showFormError(forgotRequestError, err.message);
    }
  });
}

if (resetPinForm) {
  resetPinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors();
    try {
      const pin = newPin.value.trim();
      const confirm = confirmNewPin.value.trim();
      if (!pendingEmail) throw new Error('No email in context.');
      await api('/api/reset-pin', 'POST', { email: pendingEmail, otp: otpInput.value.trim(), newPin: pin, confirmPin: confirm }, false);
      showMessage('PIN reset successful. You may now login.');
      resetPinForm.reset();
      showAuth();
    } catch (err) {
      showFormError(resetPinError, err.message);
    }
  });
}

openDeposit.addEventListener('click', () => { if (!currentAccount) return showAuth(); showSection(depositPanel); depositPanel.scrollIntoView({ behavior: 'smooth' }); });
openWithdraw.addEventListener('click', () => { if (!currentAccount) return showAuth(); showSection(withdrawPanel); withdrawPanel.scrollIntoView({ behavior: 'smooth' }); });
openBills.addEventListener('click', () => { if (!currentAccount) return showAuth(); showSection(billsPanel); billsPanel.scrollIntoView({ behavior: 'smooth' }); });
openChangePin.addEventListener('click', () => { if (!currentAccount) return showAuth(); showSection(changePinPanel); changePinPanel.scrollIntoView({ behavior: 'smooth' }); });
openTransfer.addEventListener('click', () => { if (!currentAccount) return showAuth(); showSection(transferPanel); transferPanel.scrollIntoView({ behavior: 'smooth' }); });
quickDeposit.addEventListener('click', () => { if (!currentAccount) return showAuth(); showSection(depositPanel); depositPanel.scrollIntoView({ behavior: 'smooth' }); });
quickWithdraw.addEventListener('click', () => { if (!currentAccount) return showAuth(); showSection(withdrawPanel); withdrawPanel.scrollIntoView({ behavior: 'smooth' }); });
quickBills.addEventListener('click', () => { if (!currentAccount) return showAuth(); showSection(billsPanel); billsPanel.scrollIntoView({ behavior: 'smooth' }); });
quickBalance.addEventListener('click', () => { if (!currentAccount) { showAuth(); showMessage('Please log in to see your balance.'); return; } showMessage(`Your available balance is GHS ${currentAccount.balance.toFixed(2)}.`); });
quickInfo.addEventListener('click', () => document.querySelector('.info-card').scrollIntoView({ behavior: 'smooth' }));
if (themeToggle) {
  themeToggle.addEventListener('click', () => applyTheme(currentTheme === 'dark' ? 'light' : 'dark'));
}

depositForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const amount = parseFloat(document.getElementById('depositAmount').value);
    if (Number.isNaN(amount) || amount <= 0) throw new Error('Enter a valid deposit amount.');
    const data = await api('/api/deposit', 'POST', { amount });
    updateDashboard(data.account);
    const history = await api('/api/transactions?limit=5');
    renderHistory(history.transactions);
    showSection(depositPanel);
    showMessage(`Successfully deposited GHS ${amount.toFixed(2)}.`);
    depositForm.reset();
  } catch (error) {
    showMessage(error.message);
  }
});

withdrawForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    if (Number.isNaN(amount) || amount <= 0) throw new Error('Enter a valid withdrawal amount.');
    const data = await api('/api/withdraw', 'POST', { amount });
    updateDashboard(data.account);
    const history = await api('/api/transactions?limit=5');
    renderHistory(history.transactions);
    showSection(withdrawPanel);
    showMessage(`Successfully withdrew GHS ${amount.toFixed(2)}.`);
    withdrawForm.reset();
  } catch (error) {
    showMessage(error.message);
  }
});

billsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const billType = document.getElementById('billType').value;
    const amount = parseFloat(document.getElementById('billAmount').value);
    if (!billType || Number.isNaN(amount) || amount <= 0) throw new Error('Enter a valid bill type and amount.');
    const data = await api('/api/pay-bill', 'POST', { billType, amount });
    updateDashboard(data.account);
    const history = await api('/api/transactions?limit=5');
    renderHistory(history.transactions);
    showSection(billsPanel);
    showMessage(`Bill paid: ${billType} for GHS ${amount.toFixed(2)}.`);
    billsForm.reset();
  } catch (error) {
    showMessage(error.message);
  }
});

transferForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const toEmail = transferEmail.value.trim().toLowerCase();
    const amount = parseFloat(transferAmount.value);
    const note = transferNote.value.trim();
    if (!toEmail || Number.isNaN(amount) || amount <= 0) {
      throw new Error('Enter a valid recipient email and amount.');
    }
    const data = await api('/api/transfer', 'POST', { toEmail, amount, note });
    updateDashboard(data.account);
    const history = await api('/api/transactions?limit=5');
    renderHistory(history.transactions);
    loadBeneficiaries();
    showSection(transferPanel);
    showMessage(`Transfer to ${toEmail} completed for GHS ${amount.toFixed(2)}.`);
    transferForm.reset();
  } catch (error) {
    showMessage(error.message);
  }
});

beneficiaryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const name = beneficiaryName.value.trim();
    const email = beneficiaryEmail.value.trim().toLowerCase();
    if (!name || !email) throw new Error('Enter beneficiary name and email.');
    const data = await api('/api/beneficiaries', 'POST', { beneficiaryName: name, beneficiaryEmail: email });
    renderBeneficiaries(data.beneficiaries);
    showMessage('Beneficiary saved successfully.');
    beneficiaryForm.reset();
  } catch (error) {
    showMessage(error.message);
  }
});

beneficiaryList.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const email = button.dataset.email;
  if (!email) return;
  try {
    const data = await api('/api/beneficiaries', 'DELETE', { email });
    renderBeneficiaries(data.beneficiaries);
    showMessage('Beneficiary removed.');
  } catch (error) {
    showMessage(error.message);
  }
});

changePinForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const currentPin = document.getElementById('currentPin').value.trim();
    const newPin = document.getElementById('newPin').value.trim();
    const confirmPin = document.getElementById('confirmPin').value.trim();
    if (newPin !== confirmPin) throw new Error('New PIN and confirmation do not match.');
    await api('/api/change-pin', 'POST', { currentPin, newPin });
    showSection(null);
    showMessage('Your PIN has been updated successfully.');
    changePinForm.reset();
  } catch (error) {
    showMessage(error.message);
  }
});

refreshUsersBtn.addEventListener('click', refreshUsers);

userList.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const email = button.dataset.email;
  if (button.classList.contains('approve-account')) {
    await api('/api/admin/verify', 'POST', { email, action: 'approve' });
    await refreshUsers();
    return;
  }
  if (button.classList.contains('reject-account')) {
    await api('/api/admin/verify', 'POST', { email, action: 'reject' });
    await refreshUsers();
    return;
  }
  if (button.classList.contains('freeze-account')) {
    await api('/api/admin/freeze', 'POST', { email });
    await refreshUsers();
    return;
  }
  if (button.classList.contains('unlock-account')) {
    await api('/api/admin/unlock', 'POST', { email });
    await refreshUsers();
    return;
  }
});

window.addEventListener('DOMContentLoaded', () => {
  applyTheme(currentTheme);
  loadAccount();
});
