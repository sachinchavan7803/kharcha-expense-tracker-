// --- Storage Keys & Initial Setup ---
const STORAGE_KEY = 'KHARCHA_TRACKER_VAULT_V2';
const BUDGET_KEY = 'KHARCHA_TRACKER_MONTHLY_BUDGET_V2';

const CATEGORIES = [
  { id: 'kirana', label: 'Kirana & Groceries', color: '#10b981' },
  { id: 'food', label: 'Food & Swiggy/Zomato', color: '#f59e0b' },
  { id: 'commute', label: 'Fuel & Commute', color: '#3b82f6' },
  { id: 'bills', label: 'Bills, Wi-Fi & Recharge', color: '#ec4899' },
  { id: 'rent', label: 'Rent & Maintenance', color: '#8b5cf6' },
  { id: 'shopping', label: 'Shopping & Clothes', color: '#06b6d4' },
  { id: 'health', label: 'Pharmacy & Medical', color: '#ef4444' },
  { id: 'entertainment', label: 'OTT, Outings & Movies', color: '#eab308' },
  { id: 'misc', label: 'Chai, Snacks & Misc', color: '#64748b' }
];

function getISODate(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

const SEED_DATA = [
  { id: 'seed-1', title: 'Kirana Store & Milk', amount: 340, category: 'kirana', payment: 'UPI', date: getISODate(0), note: 'Daily essentials' },
  { id: 'seed-2', title: 'Chai & Evening Snacks', amount: 90, category: 'misc', payment: 'Cash', date: getISODate(0), note: 'Tea with friends' },
  { id: 'seed-3', title: 'Swiggy Dinner', amount: 450, category: 'food', payment: 'UPI', date: getISODate(1), note: 'Biryani bowl' },
  { id: 'seed-4', title: 'Petrol refuel', amount: 1000, category: 'commute', payment: 'UPI', date: getISODate(1), note: 'Full tank' },
  { id: 'seed-5', title: 'Electricity Bill', amount: 1850, category: 'bills', payment: 'Net Banking', date: getISODate(3), note: 'Home utility' }
];

let transactions = [];
let monthlyBudget = 40000;
let categoryChartInstance = null;
let dailyChartInstance = null;

// --- Currency Formatter ---
const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});
function formatINR(val) {
  return inrFormatter.format(val || 0);
}

// --- Local Storage Management ---
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      transactions = Array.isArray(parsed) ? parsed : (parsed.transactions || []);
    } else {
      transactions = [...SEED_DATA];
      saveData();
    }
  } catch (err) {
    transactions = [...SEED_DATA];
  }

  const savedBudget = localStorage.getItem(BUDGET_KEY);
  if (savedBudget) monthlyBudget = Number(savedBudget) || 40000;
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  localStorage.setItem(BUDGET_KEY, monthlyBudget.toString());
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  populateDropdowns();
  initCharts();
  bindEvents();
  
  // Set default view date to Today
  document.getElementById('singleDateInput').value = getISODate(0);
  
  renderApp();
  lucide.createIcons();
});

function populateDropdowns() {
  const catFilter = document.getElementById('categoryFilter');
  const expenseCat = document.getElementById('expenseCategory');

  catFilter.innerHTML = '<option value="ALL">All Categories</option>';
  expenseCat.innerHTML = '';
  CATEGORIES.forEach(c => {
    catFilter.innerHTML += `<option value="${c.id}">${c.label}</option>`;
    expenseCat.innerHTML += `<option value="${c.id}">${c.label}</option>`;
  });

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthSelect = document.getElementById('monthSelect');
  monthSelect.innerHTML = monthNames.map((m, idx) => `<option value="${idx}">${m}</option>`).join('');
  monthSelect.value = new Date().getMonth();

  populateYearSelect();
}

function populateYearSelect() {
  const yearSelect = document.getElementById('yearSelect');
  const curYear = new Date().getFullYear();
  const years = transactions.map(t => new Date(t.date).getFullYear()).filter(y => !isNaN(y));
  years.push(curYear);
  const distinctYears = [...new Set(years)].sort((a, b) => b - a);
  yearSelect.innerHTML = distinctYears.map(y => `<option value="${y}">${y}</option>`).join('');
  yearSelect.value = curYear;
}

// --- Main Render Pipeline ---
function renderApp() {
  const scope = document.getElementById('timeScopeSelect').value;
  const singleDate = document.getElementById('singleDateInput').value;
  const selYear = parseInt(document.getElementById('yearSelect').value, 10);
  const selMonth = parseInt(document.getElementById('monthSelect').value, 10);
  const search = document.getElementById('searchInput').value.toLowerCase();
  const catFilter = document.getElementById('categoryFilter').value;
  const payFilter = document.getElementById('paymentFilter').value;

  // 1. Time-scoped items
  const timeScopedList = transactions.filter(t => {
    if (!t.date) return false;
    if (scope === 'day') {
      return t.date === singleDate;
    } else if (scope === 'month') {
      const d = new Date(t.date);
      return d.getFullYear() === selYear && d.getMonth() === selMonth;
    } else if (scope === 'year') {
      const d = new Date(t.date);
      return d.getFullYear() === selYear;
    }
    return true; // 'all'
  });

  // 2. Filtered for user search / category
  const filteredList = timeScopedList.filter(t => {
    const matchCat = catFilter === 'ALL' || t.category === catFilter;
    const matchPay = payFilter === 'ALL' || t.payment === payFilter;
    const matchSearch =
      t.title.toLowerCase().includes(search) ||
      (t.note && t.note.toLowerCase().includes(search)) ||
      (t.payment && t.payment.toLowerCase().includes(search));
    return matchCat && matchPay && matchSearch;
  });

  // Always sort descending by date
  filteredList.sort((a, b) => new Date(b.date) - new Date(a.date));

  renderKPIs(timeScopedList, scope, singleDate);
  renderCharts(timeScopedList, scope, selYear, selMonth);
  renderGroupedDayList(filteredList);
  lucide.createIcons();
}

// --- Render KPI Cards ---
function renderKPIs(scopedList, scope, singleDate) {
  const periodTotal = scopedList.reduce((acc, t) => acc + Number(t.amount || 0), 0);
  
  // Real-time today spend calculation
  const todayStr = getISODate(0);
  const todayItems = transactions.filter(t => t.date === todayStr);
  const todaySpend = todayItems.reduce((acc, t) => acc + Number(t.amount || 0), 0);
  document.getElementById('todaySpendVal').textContent = formatINR(todaySpend);
  document.getElementById('todayTxnCount').textContent = `${todayItems.length} items logged today`;

  // Scope card
  const titleEl = document.getElementById('kpiScopeTitle');
  if (scope === 'day') {
    titleEl.textContent = singleDate === todayStr ? "Today's Total Spend" : `Spend on ${formatDisplayDate(singleDate)}`;
  } else if (scope === 'month') {
    titleEl.textContent = "Month's Total Spend";
  } else if (scope === 'year') {
    titleEl.textContent = "Year's Total Spend";
  } else {
    titleEl.textContent = "Lifetime Total Spend";
  }

  document.getElementById('periodSpendVal').textContent = formatINR(periodTotal);
  document.getElementById('periodTxnCount').textContent = `${scopedList.length} transaction(s) recorded`;

  // Monthly Budget Status
  const curMonth = new Date().getMonth();
  const curYear = new Date().getFullYear();
  const thisMonthTotal = transactions
    .filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === curYear && d.getMonth() === curMonth;
    })
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const budgetRemaining = Math.max(0, monthlyBudget - thisMonthTotal);
  const budgetSpentPct = Math.min(100, Math.round((thisMonthTotal / (monthlyBudget || 1)) * 100));

  document.getElementById('budgetRemainingVal').textContent = formatINR(budgetRemaining);
  document.getElementById('budgetSpentPercent').textContent = `${budgetSpentPct}% used`;
  document.getElementById('budgetCapText').textContent = `Cap: ${formatINR(monthlyBudget)}`;

  const pBar = document.getElementById('budgetProgressBar');
  pBar.style.width = `${budgetSpentPct}%`;
  pBar.className = `h-full rounded-full transition-all duration-500 ${
    budgetSpentPct >= 100 ? 'bg-rose-500' : budgetSpentPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
  }`;

  // Daily Burn Rate
  const activeDays = new Set(scopedList.map(t => t.date)).size || 1;
  const dailyBurn = Math.round(periodTotal / activeDays);
  document.getElementById('dailyAvgVal').textContent = formatINR(dailyBurn);
  document.getElementById('dailyAvgSubtext').textContent = `Avg across ${activeDays} active day(s)`;
}

// --- Grouped Day-Wise List Rendering ---
function renderGroupedDayList(list) {
  const container = document.getElementById('groupedTransactionsContainer');
  const emptyState = document.getElementById('emptyState');
  container.innerHTML = '';

  if (list.length === 0) {
    emptyState.classList.remove('hidden');
    document.getElementById('showingCountText').textContent = 'Showing 0 entries';
    document.getElementById('tableSumText').textContent = 'Total: ₹0';
    return;
  }
  emptyState.classList.add('hidden');

  // Group transactions by date
  const groups = {};
  let totalSum = 0;

  list.forEach(item => {
    totalSum += Number(item.amount || 0);
    if (!groups[item.date]) groups[item.date] = [];
    groups[item.date].push(item);
  });

  const sortedDates = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));

  sortedDates.forEach(dateStr => {
    const dayItems = groups[dateStr];
    const dayTotal = dayItems.reduce((acc, t) => acc + Number(t.amount || 0), 0);

    const isToday = dateStr === getISODate(0);
    const isYesterday = dateStr === getISODate(1);
    const dayTag = isToday ? '<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-bold ml-2">TODAY</span>' :
                   isYesterday ? '<span class="px-2 py-0.5 rounded text-[10px] bg-slate-700 text-slate-300 font-bold ml-2">YESTERDAY</span>' : '';

    // Day Section
    const section = document.createElement('div');
    section.className = 'py-3 px-4 sm:px-6';

    // Day Header with Day's Total
    section.innerHTML = `
      <div class="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/40">
        <div class="flex items-center">
          <i data-lucide="calendar" class="w-4 h-4 text-emerald-400 mr-2"></i>
          <span class="text-xs sm:text-sm font-bold text-white tracking-wide">${formatDisplayDate(dateStr)}</span>
          ${dayTag}
        </div>
        <div class="text-xs sm:text-sm font-extrabold text-emerald-400 font-mono">
          Day Total: ${formatINR(dayTotal)}
        </div>
      </div>
      <div class="space-y-2" id="day-items-${dateStr}"></div>
    `;

    const itemsContainer = section.querySelector(`#day-items-${dateStr}`);

    dayItems.forEach(item => {
      const cat = CATEGORIES.find(c => c.id === item.category) || { label: item.category, color: '#64748b' };
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between p-2.5 rounded-xl bg-slate-900/50 hover:bg-slate-750/70 border border-slate-800/80 transition group';
      row.innerHTML = `
        <div class="flex items-center space-x-3">
          <div class="w-2.5 h-2.5 rounded-full" style="background-color: ${cat.color}"></div>
          <div>
            <div class="text-xs sm:text-sm font-semibold text-white group-hover:text-emerald-400 transition">${escapeHtml(item.title)}</div>
            <div class="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
              <span>${cat.label}</span>
              <span>&middot;</span>
              <span class="text-slate-300">${escapeHtml(item.payment || 'UPI')}</span>
              ${item.note ? `<span>&middot;</span> <span class="italic text-slate-400">"${escapeHtml(item.note)}"</span>` : ''}
            </div>
          </div>
        </div>
        <div class="flex items-center space-x-3">
          <span class="font-mono font-bold text-white text-xs sm:text-sm">${formatINR(item.amount)}</span>
          <div class="inline-flex items-center space-x-1 opacity-70 group-hover:opacity-100">
            <button onclick="openEditModal('${item.id}')" class="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-emerald-400" title="Edit">
              <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="deleteExpense('${item.id}')" class="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-400" title="Delete">
              <i data-lucide="trash" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
      itemsContainer.appendChild(row);
    });

    container.appendChild(section);
  });

  document.getElementById('showingCountText').textContent = `Showing ${list.length} item(s) across ${sortedDates.length} day(s)`;
  document.getElementById('tableSumText').textContent = `Total: ${formatINR(totalSum)}`;
}

// --- Date Formatter ---
function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const dateObj = new Date(year, month - 1, day);
  return dateObj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// --- Chart Setup & Rendering ---
function initCharts() {
  const catCtx = document.getElementById('categoryChart').getContext('2d');
  categoryChartInstance = new Chart(catCtx, {
    type: 'doughnut',
    data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 0 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, color: '#94a3b8', font: { size: 10 } } }
      }
    }
  });

  const dailyCtx = document.getElementById('dailyTrendChart').getContext('2d');
  dailyChartInstance = new Chart(dailyCtx, {
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

function renderCharts(scopedList, scope, targetYear, targetMonth) {
  // 1. Category Chart
  const catSums = {};
  CATEGORIES.forEach(c => { catSums[c.id] = 0; });
  scopedList.forEach(t => {
    if (catSums[t.category] !== undefined) catSums[t.category] += Number(t.amount || 0);
    else catSums['misc'] = (catSums['misc'] || 0) + Number(t.amount || 0);
  });

  const activeCategories = CATEGORIES.filter(c => catSums[c.id] > 0);
  const labels = activeCategories.map(c => c.label);
  const data = activeCategories.map(c => catSums[c.id]);
  const colors = activeCategories.map(c => c.color);

  const noData = document.getElementById('noDataCategory');
  if (data.length === 0) {
    noData.classList.remove('hidden');
    categoryChartInstance.data.labels = [];
    categoryChartInstance.data.datasets[0].data = [];
    document.getElementById('topCategoryName').textContent = '—';
  } else {
    noData.classList.add('hidden');
    categoryChartInstance.data.labels = labels;
    categoryChartInstance.data.datasets[0].data = data;
    categoryChartInstance.data.datasets[0].backgroundColor = colors;

    let maxIdx = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i] > data[maxIdx]) maxIdx = i;
    }
    document.getElementById('topCategoryName').textContent = `${labels[maxIdx]} (${formatINR(data[maxIdx])})`;
  }
  categoryChartInstance.update();

  // 2. Day-by-Day Bar Chart for the active month
  let focusYear = targetYear;
  let focusMonth = targetMonth;
  if (scope === 'day') {
    const d = new Date(document.getElementById('singleDateInput').value);
    focusYear = d.getFullYear();
    focusMonth = d.getMonth();
  }

  const daysInMonth = new Date(focusYear, focusMonth + 1, 0).getDate();
  const daySums = new Array(daysInMonth).fill(0);
  const monthLabels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);

  transactions.forEach(t => {
    const d = new Date(t.date);
    if (d.getFullYear() === focusYear && d.getMonth() === focusMonth) {
      const dayNum = d.getDate();
      if (dayNum >= 1 && dayNum <= daysInMonth) {
        daySums[dayNum - 1] += Number(t.amount || 0);
      }
    }
  });

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  document.getElementById('dailyChartMonthLabel').textContent = `${monthNames[focusMonth]} ${focusYear}`;

  dailyChartInstance.data.labels = monthLabels;
  dailyChartInstance.data.datasets[0].data = daySums;
  dailyChartInstance.update();

  // Peak Day calculation
  let peakDay = 0;
  for (let i = 1; i < daysInMonth; i++) {
    if (daySums[i] > daySums[peakDay]) peakDay = i;
  }
  document.getElementById('peakDayText').textContent =
    daySums[peakDay] > 0 ? `${peakDay + 1} ${monthNames[focusMonth]} (${formatINR(daySums[peakDay])})` : '—';
}

// --- CRUD Actions ---
window.deleteExpense = function(id) {
  if (confirm('Delete this expense?')) {
    transactions = transactions.filter(t => t.id !== id);
    saveData();
    populateYearSelect();
    renderApp();
  }
};

window.openEditModal = function(id) {
  const item = transactions.find(t => t.id === id);
  if (!item) return;

  document.getElementById('editExpenseId').value = item.id;
  document.getElementById('expenseAmount').value = item.amount;
  document.getElementById('expenseTitle').value = item.title;
  document.getElementById('expenseCategory').value = item.category;
  document.getElementById('expensePayment').value = item.payment || 'UPI';
  document.getElementById('expenseDate').value = item.date;
  document.getElementById('expenseNote').value = item.note || '';

  document.getElementById('modalTitle').innerHTML = `
    <span class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400"><i data-lucide="edit-3" class="w-4 h-4"></i></span>
    Edit Kharcha
  `;
  document.getElementById('expenseModal').classList.remove('hidden');
  lucide.createIcons();
};

function openAddModal() {
  document.getElementById('editExpenseId').value = '';
  document.getElementById('expenseForm').reset();
  
  // Pre-fill modal with the currently viewed day
  const currentSelectedDate = document.getElementById('singleDateInput').value || getISODate(0);
  document.getElementById('expenseDate').value = currentSelectedDate;

  document.getElementById('modalTitle').innerHTML = `
    <span class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400"><i data-lucide="plus-circle" class="w-4 h-4"></i></span>
    Add New Kharcha
  `;
  document.getElementById('expenseModal').classList.remove('hidden');
  lucide.createIcons();
}

function shiftSingleDay(direction) {
  const input = document.getElementById('singleDateInput');
  const d = new Date(input.value || getISODate(0));
  d.setDate(d.getDate() + direction);
  input.value = d.toISOString().split('T')[0];
  renderApp();
}

// --- Event Listeners ---
function bindEvents() {
  document.getElementById('openAddModalBtn').addEventListener('click', openAddModal);
  document.getElementById('closeExpenseModalBtn').addEventListener('click', () => {
    document.getElementById('expenseModal').classList.add('hidden');
  });
  document.getElementById('cancelExpenseModalBtn').addEventListener('click', () => {
    document.getElementById('expenseModal').classList.add('hidden');
  });

  // Expense Form Submit
  document.getElementById('expenseForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = document.getElementById('editExpenseId').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const title = document.getElementById('expenseTitle').value.trim();
    const category = document.getElementById('expenseCategory').value;
    const payment = document.getElementById('expensePayment').value;
    const date = document.getElementById('expenseDate').value;
    const note = document.getElementById('expenseNote').value.trim();

    if (!amount || !title || !date) return;

    if (editId) {
      const idx = transactions.findIndex(t => t.id === editId);
      if (idx !== -1) {
        transactions[idx] = { id: editId, amount, title, category, payment, date, note };
      }
    } else {
      transactions.unshift({
        id: 'txn-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
        amount,
        title,
        category,
        payment,
        date,
        note
      });
      // Focus single-day view on the added expense's date
      document.getElementById('singleDateInput').value = date;
    }

    saveData();
    populateYearSelect();
    document.getElementById('expenseModal').classList.add('hidden');
    renderApp();
  });

  // Day Navigation
  document.getElementById('prevDayBtn').addEventListener('click', () => shiftSingleDay(-1));
  document.getElementById('nextDayBtn').addEventListener('click', () => shiftSingleDay(1));
  document.getElementById('singleDateInput').addEventListener('change', renderApp);

  document.getElementById('jumpTodayBtn').addEventListener('click', () => {
    document.getElementById('timeScopeSelect').value = 'day';
    document.getElementById('singleDateInput').value = getISODate(0);
    toggleScopeControls('day');
    renderApp();
  });

  document.getElementById('jumpYesterdayBtn').addEventListener('click', () => {
    document.getElementById('timeScopeSelect').value = 'day';
    document.getElementById('singleDateInput').value = getISODate(1);
    toggleScopeControls('day');
    renderApp();
  });

  // Scope Switcher
  document.getElementById('timeScopeSelect').addEventListener('change', (e) => {
    toggleScopeControls(e.target.value);
    renderApp();
  });

  ['monthSelect', 'yearSelect', 'categoryFilter', 'paymentFilter'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderApp);
  });

  document.getElementById('searchInput').addEventListener('input', renderApp);

  // Set Budget Prompt
  document.getElementById('setBudgetBtn').addEventListener('click', () => {
    const input = prompt('Enter your monthly budget in ₹:', monthlyBudget);
    if (input !== null) {
      const parsed = parseFloat(input);
      if (!isNaN(parsed) && parsed > 0) {
        monthlyBudget = parsed;
        saveData();
        renderApp();
      }
    }
  });

  // Backup Controls
  document.getElementById('backupBtn').addEventListener('click', () => {
    document.getElementById('backupModal').classList.remove('hidden');
    lucide.createIcons();
  });
  document.getElementById('closeBackupModalBtn').addEventListener('click', () => {
    document.getElementById('backupModal').classList.add('hidden');
  });

  document.getElementById('downloadBackupBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(transactions, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Kharcha_Backup_${getISODate(0)}.json`;
    a.click();
  });

  document.getElementById('exportCsvBtn').addEventListener('click', () => {
    if (transactions.length === 0) return alert('No data to export');
    const headers = ['ID', 'Date', 'Title', 'Category', 'Payment Mode', 'Amount', 'Note'];
    const rows = transactions.map(t => [t.id, t.date, `"${t.title}"`, t.category, t.payment, t.amount, `"${t.note || ''}"`]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Kharcha_Report_${getISODate(0)}.csv`;
    a.click();
  });

  document.getElementById('importJsonInput').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          transactions = Array.isArray(parsed) ? parsed : (parsed.transactions || []);
          saveData();
          populateYearSelect();
          renderApp();
          alert('Backup restored successfully!');
          document.getElementById('backupModal').classList.add('hidden');
        } catch (err) {
          alert('Invalid JSON file.');
        }
      };
      reader.readAsText(e.target.files[0]);
    }
  });
}

function toggleScopeControls(scope) {
  const dayBox = document.getElementById('daySelectorContainer');
  const monthYearBox = document.getElementById('monthYearControls');
  const monthSelect = document.getElementById('monthSelect');

  if (scope === 'day') {
    dayBox.classList.remove('hidden');
    monthYearBox.classList.add('hidden');
  } else if (scope === 'month') {
    dayBox.classList.add('hidden');
    monthYearBox.classList.remove('hidden');
    monthSelect.classList.remove('hidden');
  } else if (scope === 'year') {
    dayBox.classList.add('hidden');
    monthYearBox.classList.remove('hidden');
    monthSelect.classList.add('hidden');
  } else {
    dayBox.classList.add('hidden');
    monthYearBox.classList.add('hidden');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
