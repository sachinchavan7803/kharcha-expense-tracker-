/**
 * Kharcha Tracker — Robust, 100% Client-Side Day-Wise Engine
 */

// 1. Constants & Categories
const STORAGE_KEY = 'KHARCHA_TRACKER_VAULT_V3';
const BUDGET_KEY = 'KHARCHA_TRACKER_MONTHLY_BUDGET_V3';

const CATEGORIES = [
  { id: 'kirana', label: 'Kirana & Groceries', color: '#10b981' },
  { id: 'food', label: 'Food & Dining (Swiggy/Zomato)', color: '#f59e0b' },
  { id: 'commute', label: 'Travel & Fuel', color: '#3b82f6' },
  { id: 'bills', label: 'Bills & Utilities', color: '#ec4899' },
  { id: 'rent', label: 'Rent & Maintenance', color: '#8b5cf6' },
  { id: 'shopping', label: 'Shopping & Clothes', color: '#06b6d4' },
  { id: 'health', label: 'Health & Pharmacy', color: '#ef4444' },
  { id: 'misc', label: 'Chai, Snacks & Others', color: '#64748b' }
];

// Reliable Local Date function (Avoids UTC timezone flip bugs)
function getLocalDateString(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Starter Seed Data
const INITIAL_DATA = [
  { id: 't-1', title: 'Kirana & Milk', amount: 320, category: 'kirana', payment: 'UPI', date: getLocalDateString(0), note: 'Daily essentials' },
  { id: 't-2', title: 'Chai & Snacks', amount: 80, category: 'misc', payment: 'Cash', date: getLocalDateString(0), note: 'Office evening tea' },
  { id: 't-3', title: 'Swiggy Dinner', amount: 480, category: 'food', payment: 'UPI', date: getLocalDateString(1), note: 'Paneer Biryani' },
  { id: 't-4', title: 'Petrol refuel', amount: 1000, category: 'commute', payment: 'UPI', date: getLocalDateString(2), note: 'Vehicle fuel' }
];

let transactions = [];
let monthlyBudget = 40000;
let categoryChart = null;
let dailyChart = null;

// INR Formatter
const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

function formatINR(val) {
  return inr.format(Number(val) || 0);
}

// 2. Storage Handlers
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      transactions = JSON.parse(raw) || [];
    } else {
      transactions = [...INITIAL_DATA];
      saveToStorage();
    }
  } catch (err) {
    console.error('Storage parse error', err);
    transactions = [...INITIAL_DATA];
  }

  const savedBudget = localStorage.getItem(BUDGET_KEY);
  if (savedBudget) {
    monthlyBudget = Number(savedBudget) || 40000;
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    localStorage.setItem(BUDGET_KEY, monthlyBudget.toString());
  } catch (err) {
    console.error('Failed to write to localStorage', err);
  }
}

// 3. App Initialization
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  populateDropdownOptions();
  setupCharts();
  bindAllListeners();

  // Set default picker to Today
  const today = getLocalDateString(0);
  document.getElementById('targetDatePicker').value = today;
  document.getElementById('formDate').value = today;

  render();
});

// Setup Categories and Month selectors
function populateDropdownOptions() {
  const catFilter = document.getElementById('categoryFilter');
  const formCat = document.getElementById('formCategory');

  catFilter.innerHTML = '<option value="ALL">All Categories</option>';
  formCat.innerHTML = '';

  CATEGORIES.forEach(c => {
    catFilter.innerHTML += `<option value="${c.id}">${c.label}</option>`;
    formCat.innerHTML += `<option value="${c.id}">${c.label}</option>`;
  });

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthPicker = document.getElementById('monthPicker');
  monthPicker.innerHTML = monthNames.map((m, i) => `<option value="${i}">${m}</option>`).join('');
  monthPicker.value = new Date().getMonth();

  updateYearDropdown();
}

function updateYearDropdown() {
  const yearPicker = document.getElementById('yearPicker');
  const curYear = new Date().getFullYear();
  const years = transactions.map(t => parseInt(t.date.split('-')[0], 10)).filter(y => !isNaN(y));
  years.push(curYear);
  const unique = [...new Set(years)].sort((a, b) => b - a);

  yearPicker.innerHTML = unique.map(y => `<option value="${y}">${y}</option>`).join('');
  yearPicker.value = curYear;
}

// 4. Main Render Pipeline
function render() {
  const mode = document.getElementById('timeScopeSelect').value;
  const pickedDate = document.getElementById('targetDatePicker').value;
  const pickedMonth = parseInt(document.getElementById('monthPicker').value, 10);
  const pickedYear = parseInt(document.getElementById('yearPicker').value, 10);
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const catFilter = document.getElementById('categoryFilter').value;
  const payFilter = document.getElementById('paymentFilter').value;

  // Filter 1: Time Scoping
  const timeScoped = transactions.filter(t => {
    if (!t.date) return false;
    if (mode === 'day') {
      return t.date === pickedDate;
    } else if (mode === 'month') {
      const parts = t.date.split('-');
      const tYear = parseInt(parts[0], 10);
      const tMonth = parseInt(parts[1], 10) - 1;
      return tYear === pickedYear && tMonth === pickedMonth;
    }
    return true; // 'all'
  });

  // Filter 2: Category, Payment, Search
  const displayList = timeScoped.filter(t => {
    const matchCat = catFilter === 'ALL' || t.category === catFilter;
    const matchPay = payFilter === 'ALL' || t.payment === payFilter;
    const matchSearch =
      t.title.toLowerCase().includes(search) ||
      (t.note && t.note.toLowerCase().includes(search)) ||
      (t.payment && t.payment.toLowerCase().includes(search));
    return matchCat && matchPay && matchSearch;
  });

  // Sort Descending
  displayList.sort((a, b) => new Date(b.date) - new Date(a.date));

  renderKPIs(timeScoped, mode, pickedDate);
  renderGroupedList(displayList);
  updateCharts(timeScoped, mode, pickedYear, pickedMonth, pickedDate);
}

// 5. Render KPIs
function renderKPIs(scopedList, mode, pickedDate) {
  const selectedSum = scopedList.reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const todayStr = getLocalDateString(0);
  const todayItems = transactions.filter(t => t.date === todayStr);
  const todaySum = todayItems.reduce((acc, t) => acc + Number(t.amount || 0), 0);

  document.getElementById('kpiTodayTotal').textContent = formatINR(todaySum);
  document.getElementById('kpiTodayCount').textContent = `${todayItems.length} items logged today`;

  const kpiHeading = document.getElementById('kpiHeading');
  if (mode === 'day') {
    kpiHeading.textContent = (pickedDate === todayStr) ? "Today's Spend" : `Spend on ${formatNiceDate(pickedDate)}`;
  } else if (mode === 'month') {
    kpiHeading.textContent = "Month's Total Spend";
  } else {
    kpiHeading.textContent = "Lifetime Spend";
  }

  document.getElementById('kpiSelectedTotal').textContent = formatINR(selectedSum);
  document.getElementById('kpiSelectedCount').textContent = `${scopedList.length} transaction(s)`;

  // Budget calculations
  const curYear = new Date().getFullYear();
  const curMonth = new Date().getMonth();
  const thisMonthSpent = transactions.filter(t => {
    const p = t.date.split('-');
    return parseInt(p[0], 10) === curYear && (parseInt(p[1], 10) - 1) === curMonth;
  }).reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const budgetLeft = Math.max(0, monthlyBudget - thisMonthSpent);
  const budgetPct = Math.min(100, Math.round((thisMonthSpent / (monthlyBudget || 1)) * 100));

  document.getElementById('kpiBudgetLeft').textContent = formatINR(budgetLeft);
  document.getElementById('budgetCapText').textContent = `Cap: ${formatINR(monthlyBudget)}`;
  document.getElementById('budgetPctText').textContent = `${budgetPct}% used`;

  const bBar = document.getElementById('budgetBar');
  bBar.style.width = `${budgetPct}%`;
  bBar.className = `h-full rounded-full transition-all duration-300 ${
    budgetPct >= 100 ? 'bg-rose-500' : budgetPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
  }`;

  // Daily Burn Rate
  const activeDays = new Set(scopedList.map(t => t.date)).size || 1;
  const burn = Math.round(selectedSum / activeDays);
  document.getElementById('kpiDailyAvg').textContent = formatINR(burn);
  document.getElementById('kpiDailyAvgSub').textContent = `Avg across ${activeDays} active day(s)`;
}

// 6. Render Day-Wise Grouped Transactions
function renderGroupedList(list) {
  const container = document.getElementById('transactionsContainer');
  const emptyState = document.getElementById('emptyListState');
  container.innerHTML = '';

  if (list.length === 0) {
    emptyState.classList.remove('hidden');
    document.getElementById('footerCountText').textContent = 'Showing 0 entries';
    document.getElementById('footerSumText').textContent = 'Total: ₹0';
    return;
  }
  emptyState.classList.add('hidden');

  // Group by date
  const groups = {};
  let totalSum = 0;

  list.forEach(t => {
    totalSum += Number(t.amount || 0);
    if (!groups[t.date]) groups[t.date] = [];
    groups[t.date].push(t);
  });

  const sortedDates = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));
  const todayStr = getLocalDateString(0);
  const yesterdayStr = getLocalDateString(1);

  sortedDates.forEach(dateStr => {
    const items = groups[dateStr];
    const daySum = items.reduce((acc, x) => acc + Number(x.amount || 0), 0);

    const isToday = (dateStr === todayStr);
    const isYesterday = (dateStr === yesterdayStr);
    const badge = isToday
      ? `<span class="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">TODAY</span>`
      : isYesterday
      ? `<span class="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">YESTERDAY</span>`
      : '';

    const section = document.createElement('div');
    section.className = 'p-4 sm:p-5 space-y-3';

    // Day Header
    section.innerHTML = `
      <div class="flex items-center justify-between pb-2 border-b border-slate-800">
        <div class="flex items-center">
          <span class="text-xs sm:text-sm font-bold text-white">${formatNiceDate(dateStr)}</span>
          ${badge}
        </div>
        <span class="text-xs sm:text-sm font-extrabold font-mono text-emerald-400">Day Total: ${formatINR(daySum)}</span>
      </div>
      <div class="space-y-2" id="box-${dateStr}"></div>
    `;

    const box = section.querySelector(`#box-${dateStr}`);

    items.forEach(item => {
      const cat = CATEGORIES.find(c => c.id === item.category) || { label: item.category, color: '#64748b' };
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition';
      row.innerHTML = `
        <div class="flex items-center space-x-3 overflow-hidden pr-2">
          <div class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${cat.color}"></div>
          <div class="truncate">
            <div class="text-xs sm:text-sm font-semibold text-white truncate">${escapeHtml(item.title)}</div>
            <div class="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>${cat.label}</span>
              <span>&middot;</span>
              <span class="text-slate-300">${escapeHtml(item.payment || 'UPI')}</span>
              ${item.note ? `<span>&middot;</span> <span class="italic text-slate-500 truncate max-w-[150px] sm:max-w-xs">"${escapeHtml(item.note)}"</span>` : ''}
            </div>
          </div>
        </div>
        <div class="flex items-center space-x-3 flex-shrink-0">
          <span class="font-mono font-bold text-sm sm:text-base text-white">${formatINR(item.amount)}</span>
          <div class="flex items-center space-x-1">
            <button data-action="edit" data-id="${item.id}" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition" title="Edit">
              ✎
            </button>
            <button data-action="delete" data-id="${item.id}" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition" title="Delete">
              🗑
            </button>
          </div>
        </div>
      `;
      box.appendChild(row);
    });

    container.appendChild(section);
  });

  document.getElementById('footerCountText').textContent = `Showing ${list.length} transaction(s)`;
  document.getElementById('footerSumText').textContent = `Total: ${formatINR(totalSum)}`;
}

// 7. Charts Setup & Updates
function setupCharts() {
  if (typeof Chart === 'undefined') return;

  const catCanvas = document.getElementById('categoryCanvas');
  categoryChart = new Chart(catCanvas, {
    type: 'doughnut',
    data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, color: '#94a3b8', font: { size: 10 } } }
      }
    }
  });

  const dailyCanvas = document.getElementById('dailyCanvas');
  dailyChart = new Chart(dailyCanvas, {
    type: 'bar',
    data: { labels: [], datasets: [{ data: [], backgroundColor: '#10b981', borderRadius: 4 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          grid: { color: 'rgba(51, 65, 85, 0.4)' },
          ticks: { color: '#94a3b8', callback: (v) => '₹' + v.toLocaleString('en-IN') }
        },
        x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => `Spent: ${formatINR(ctx.raw)}` }
        }
      }
    }
  });
}

function updateCharts(scopedList, mode, selYear, selMonth, selDate) {
  if (!categoryChart || !dailyChart) return;

  // Category Doughnut
  const sums = {};
  CATEGORIES.forEach(c => { sums[c.id] = 0; });
  scopedList.forEach(t => {
    if (sums[t.category] !== undefined) sums[t.category] += Number(t.amount || 0);
    else sums['misc'] = (sums['misc'] || 0) + Number(t.amount || 0);
  });

  const activeCats = CATEGORIES.filter(c => sums[c.id] > 0);
  const noCat = document.getElementById('noCatData');

  if (activeCats.length === 0) {
    noCat.classList.remove('hidden');
    categoryChart.data.labels = [];
    categoryChart.data.datasets[0].data = [];
    document.getElementById('topCatText').textContent = '—';
  } else {
    noCat.classList.add('hidden');
    categoryChart.data.labels = activeCats.map(c => c.label);
    categoryChart.data.datasets[0].data = activeCats.map(c => sums[c.id]);
    categoryChart.data.datasets[0].backgroundColor = activeCats.map(c => c.color);

    let maxIdx = 0;
    for (let i = 1; i < activeCats.length; i++) {
      if (sums[activeCats[i].id] > sums[activeCats[maxIdx].id]) maxIdx = i;
    }
    document.getElementById('topCatText').textContent = `${activeCats[maxIdx].label} (${formatINR(sums[activeCats[maxIdx].id])})`;
  }
  categoryChart.update();

  // Daily Trend Bar Chart (Active Month)
  let y = selYear;
  let m = selMonth;
  if (mode === 'day') {
    const parts = selDate.split('-');
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10) - 1;
  }

  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daySums = new Array(daysInMonth).fill(0);
  const labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));

  transactions.forEach(t => {
    const p = t.date.split('-');
    const tY = parseInt(p[0], 10);
    const tM = parseInt(p[1], 10) - 1;
    const tD = parseInt(p[2], 10);
    if (tY === y && tM === m && tD >= 1 && tD <= daysInMonth) {
      daySums[tD - 1] += Number(t.amount || 0);
    }
  });

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  document.getElementById('dailyChartSubtitle').textContent = `${monthNames[m]} ${y}`;

  dailyChart.data.labels = labels;
  dailyChart.data.datasets[0].data = daySums;
  dailyChart.update();

  let peakDay = 0;
  for (let i = 1; i < daysInMonth; i++) {
    if (daySums[i] > daySums[peakDay]) peakDay = i;
  }
  document.getElementById('peakDayLabel').textContent =
    daySums[peakDay] > 0 ? `${peakDay + 1} ${monthNames[m]} (${formatINR(daySums[peakDay])})` : '—';
}

// 8. Event Listeners & Actions
function bindAllListeners() {
  // Form Submission
  const form = document.getElementById('kharchaForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const editId = document.getElementById('formExpenseId').value;
    const amountVal = parseFloat(document.getElementById('formAmount').value);
    const titleVal = document.getElementById('formTitle').value.trim();
    const catVal = document.getElementById('formCategory').value;
    const payVal = document.getElementById('formPayment').value;
    const dateVal = document.getElementById('formDate').value;
    const noteVal = document.getElementById('formNote').value.trim();

    if (isNaN(amountVal) || amountVal <= 0 || !titleVal || !dateVal) {
      showToast('Please enter a valid amount and title', '⚠️');
      return;
    }

    if (editId) {
      const idx = transactions.findIndex(t => t.id === editId);
      if (idx !== -1) {
        transactions[idx] = {
          id: editId,
          amount: amountVal,
          title: titleVal,
          category: catVal,
          payment: payVal,
          date: dateVal,
          note: noteVal
        };
        showToast('Expense updated successfully!');
      }
    } else {
      const newEntry = {
        id: 'txn-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        amount: amountVal,
        title: titleVal,
        category: catVal,
        payment: payVal,
        date: dateVal,
        note: noteVal
      };
      transactions.unshift(newEntry);
      showToast('Kharcha added successfully!');

      // If user added expense for a specific date, jump view to that date
      document.getElementById('targetDatePicker').value = dateVal;
    }

    saveToStorage();
    updateYearDropdown();
    closeExpenseModal();
    render();
  });

  // Modal Open & Close
  document.getElementById('openAddModalBtn').addEventListener('click', openAddModal);
  document.getElementById('closeModalBtn').addEventListener('click', closeExpenseModal);
  document.getElementById('cancelModalBtn').addEventListener('click', closeExpenseModal);

  // Event Delegation for Table Edit & Delete (Fixes quote bugs)
  document.getElementById('transactionsContainer').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');

    if (action === 'delete') {
      if (confirm('Delete this kharcha entry?')) {
        transactions = transactions.filter(t => t.id !== id);
        saveToStorage();
        updateYearDropdown();
        render();
        showToast('Expense deleted');
      }
    } else if (action === 'edit') {
      openEditModal(id);
    }
  });

  // Day Navigation Buttons
  document.getElementById('prevDayBtn').addEventListener('click', () => changeDay(-1));
  document.getElementById('nextDayBtn').addEventListener('click', () => changeDay(1));
  document.getElementById('targetDatePicker').addEventListener('change', render);

  document.getElementById('jumpTodayBtn').addEventListener('click', () => {
    document.getElementById('timeScopeSelect').value = 'day';
    document.getElementById('targetDatePicker').value = getLocalDateString(0);
    toggleScopeUI('day');
    render();
  });

  document.getElementById('jumpYesterdayBtn').addEventListener('click', () => {
    document.getElementById('timeScopeSelect').value = 'day';
    document.getElementById('targetDatePicker').value = getLocalDateString(1);
    toggleScopeUI('day');
    render();
  });

  // Scope Changes
  document.getElementById('timeScopeSelect').addEventListener('change', (e) => {
    toggleScopeUI(e.target.value);
    render();
  });

  // Filter Changes
  ['monthPicker', 'yearPicker', 'categoryFilter', 'paymentFilter'].forEach(id => {
    document.getElementById(id).addEventListener('change', render);
  });

  document.getElementById('searchInput').addEventListener('input', render);

  // Set Budget Prompt
  document.getElementById('setBudgetBtn').addEventListener('click', () => {
    const val = prompt('Set your monthly budget in ₹:', monthlyBudget);
    if (val !== null) {
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0) {
        monthlyBudget = num;
        saveToStorage();
        render();
        showToast('Monthly budget updated');
      }
    }
  });

  // Backup Modal Controls
  document.getElementById('backupModalBtn').addEventListener('click', () => {
    document.getElementById('backupModal').style.display = 'flex';
  });
  document.getElementById('closeBackupModalBtn').addEventListener('click', () => {
    document.getElementById('backupModal').style.display = 'none';
  });

  document.getElementById('downloadBackupBtn').addEventListener('click', exportBackupJSON);
  document.getElementById('exportCsvBtn').addEventListener('click', exportReportCSV);

  document.getElementById('importFileInput').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      importBackupJSON(e.target.files[0]);
    }
  });

  document.getElementById('clearAllDataBtn').addEventListener('click', () => {
    if (confirm('Permanently delete all recorded expenses? This cannot be undone.')) {
      transactions = [];
      saveToStorage();
      updateYearDropdown();
      render();
      document.getElementById('backupModal').style.display = 'none';
      showToast('All data cleared', '🗑');
    }
  });
}

// 9. Modal Helpers
function openAddModal() {
  document.getElementById('formExpenseId').value = '';
  document.getElementById('kharchaForm').reset();
  
  // Default to currently selected date
  const currentPicked = document.getElementById('targetDatePicker').value || getLocalDateString(0);
  document.getElementById('formDate').value = currentPicked;

  document.getElementById('modalHeading').textContent = 'Add New Kharcha';
  document.getElementById('expenseModal').style.display = 'flex';
  setTimeout(() => document.getElementById('formAmount').focus(), 50);
}

function openEditModal(id) {
  const item = transactions.find(t => t.id === id);
  if (!item) return;

  document.getElementById('formExpenseId').value = item.id;
  document.getElementById('formAmount').value = item.amount;
  document.getElementById('formTitle').value = item.title;
  document.getElementById('formCategory').value = item.category;
  document.getElementById('formPayment').value = item.payment || 'UPI';
  document.getElementById('formDate').value = item.date;
  document.getElementById('formNote').value = item.note || '';

  document.getElementById('modalHeading').textContent = 'Edit Kharcha';
  document.getElementById('expenseModal').style.display = 'flex';
}

function closeExpenseModal() {
  document.getElementById('expenseModal').style.display = 'none';
}

function changeDay(delta) {
  const picker = document.getElementById('targetDatePicker');
  const cur = picker.value || getLocalDateString(0);
  const parts = cur.split('-');
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  d.setDate(d.getDate() + delta);

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  picker.value = `${y}-${m}-${day}`;
  render();
}

function toggleScopeUI(mode) {
  const dayControls = document.getElementById('dayControls');
  const monthControls = document.getElementById('monthControls');

  if (mode === 'day') {
    dayControls.classList.remove('hidden');
    monthControls.classList.add('hidden');
  } else if (mode === 'month') {
    dayControls.classList.add('hidden');
    monthControls.classList.remove('hidden');
  } else {
    dayControls.classList.add('hidden');
    monthControls.classList.add('hidden');
  }
}

// 10. Backup & CSV Export
function exportBackupJSON() {
  const dataStr = JSON.stringify(transactions, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Kharcha_Backup_${getLocalDateString(0)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('JSON Backup downloaded');
}

function exportReportCSV() {
  if (transactions.length === 0) {
    showToast('No expenses to export', '⚠️');
    return;
  }
  const headers = ['ID', 'Date', 'Title', 'Category', 'Payment Mode', 'Amount', 'Note'];
  const rows = transactions.map(t => [
    t.id,
    t.date,
    `"${(t.title || '').replace(/"/g, '""')}"`,
    t.category,
    t.payment || 'UPI',
    t.amount,
    `"${(t.note || '').replace(/"/g, '""')}"`
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Kharcha_Report_${getLocalDateString(0)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV report downloaded');
}

function importBackupJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      const items = Array.isArray(parsed) ? parsed : (parsed.transactions || []);
      if (!Array.isArray(items)) throw new Error('Invalid schema');

      if (confirm(`Import ${items.length} records? This will merge with your existing data.`)) {
        const idSet = new Set(transactions.map(t => t.id));
        items.forEach(it => {
          if (!it.id || idSet.has(it.id)) {
            it.id = 'txn-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
          }
          transactions.push(it);
        });
        saveToStorage();
        updateYearDropdown();
        render();
        document.getElementById('backupModal').style.display = 'none';
        showToast('Backup restored successfully!');
      }
    } catch (err) {
      alert('Failed to parse JSON file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// 11. Utilities
function formatNiceDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, icon = '✓') {
  const toast = document.getElementById('toast');
  document.getElementById('toastIcon').textContent = icon;
  document.getElementById('toastMsg').textContent = msg;
  toast.style.transform = 'translateY(0)';
  setTimeout(() => {
    toast.style.transform = 'translateY(-150%)';
  }, 2200);
}
