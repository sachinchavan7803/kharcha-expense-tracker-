// --- Initial State & Categories ---
const STORAGE_KEY = 'KHARCHA_TRACKER_VAULT_V2';
const BUDGET_KEY = 'KHARCHA_TRACKER_MONTHLY_BUDGET_V2';

const CATEGORIES = [
  { id: 'kirana', label: 'Kirana & Groceries', color: '#10b981' },
  { id: 'food', label: 'Food & Swiggy/Zomato', color: '#f59e0b' },
  { id: 'commute', label: 'Fuel & Commute', color: '#3b82f6' },
  { id: 'bills', label: 'Bills, Wi-Fi & Recharge', color: '#ec4899' },
  { id: 'rent', label: 'Rent & Maintenance', color: '#8b5cf6' },
  { id: 'shopping', label: 'Shopping & Electronics', color: '#06b6d4' },
  { id: 'health', label: 'Pharmacy & Medical', color: '#ef4444' },
  { id: 'entertainment', label: 'OTT, Outings & Movies', color: '#eab308' },
  { id: 'misc', label: 'Miscellaneous / Cash', color: '#64748b' }
];

const SEED_DATA = [
  { id: 'txn-1', title: 'Kirana & Blinkit items', amount: 850, category: 'kirana', payment: 'UPI', date: getRecentDateString(0), note: 'Atta, milk, fruits' },
  { id: 'txn-2', title: 'Swiggy Dinner', amount: 420, category: 'food', payment: 'UPI', date: getRecentDateString(1), note: 'Paneer Biryani' },
  { id: 'txn-3', title: 'Petrol refuel', amount: 1500, category: 'commute', payment: 'Credit Card', date: getRecentDateString(3), note: 'Full tank bike/car' },
  { id: 'txn-4', title: 'Electricity Bill', amount: 2100, category: 'bills', payment: 'Net Banking', date: getRecentDateString(6), note: 'Mahavitaran / MSEB' },
  { id: 'txn-5', title: 'Medical store medicines', amount: 340, category: 'health', payment: 'Cash', date: getRecentDateString(10), note: 'Vitamins and cough drops' }
];

function getRecentDateString(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

let transactions = [];
let monthlyBudget = 40000;
let categoryChartInstance = null;
let trendChartInstance = null;

// --- Currency Formatter ---
const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

function formatINR(val) {
  return inrFormatter.format(val || 0);
}

// --- Load and Save Data ---
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
    console.error('Error reading localStorage', err);
    transactions = [...SEED_DATA];
  }

  const savedBudget = localStorage.getItem(BUDGET_KEY);
  if (savedBudget) {
    monthlyBudget = Number(savedBudget) || 40000;
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  localStorage.setItem(BUDGET_KEY, monthlyBudget.toString());
  updateVaultStorageKPIs();
}

// --- Lifecycle Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  populateDropdowns();
  initCharts();
  bindEvents();
  renderApp();
  lucide.createIcons();
});

// --- Populate Filters & Dropdowns ---
function populateDropdowns() {
  const categoryFilter = document.getElementById('categoryFilter');
  const expenseCategory = document.getElementById('expenseCategory');

  categoryFilter.innerHTML = '<option value="ALL">All Categories</option>';
  expenseCategory.innerHTML = '';

  CATEGORIES.forEach(cat => {
    categoryFilter.innerHTML += `<option value="${cat.id}">${cat.label}</option>`;
    expenseCategory.innerHTML += `<option value="${cat.id}">${cat.label}</option>`;
  });

  const monthSelect = document.getElementById('monthSelect');
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  monthSelect.innerHTML = monthNames.map((m, idx) => `<option value="${idx}">${m}</option>`).join('');

  const today = new Date();
  monthSelect.value = today.getMonth();

  populateYearSelect();
}

function populateYearSelect() {
  const yearSelect = document.getElementById('yearSelect');
  const currentYear = new Date().getFullYear();
  const txYears = transactions.map(t => new Date(t.date).getFullYear()).filter(y => !isNaN(y));
  txYears.push(currentYear);
  const distinctYears = [...new Set(txYears)].sort((a, b) => b - a);

  yearSelect.innerHTML = distinctYears.map(y => `<option value="${y}">${y}</option>`).join('');
  yearSelect.value = currentYear;
}

// --- Main Render Pipeline ---
function renderApp() {
  const scope = document.getElementById('timeScopeSelect').value;
  const selectedYear = parseInt(document.getElementById('yearSelect').value, 10);
  const selectedMonth = parseInt(document.getElementById('monthSelect').value, 10);
  const search = document.getElementById('searchInput').value.toLowerCase();
  const catFilter = document.getElementById('categoryFilter').value;
  const payFilter = document.getElementById('paymentFilter').value;

  // 1. Time-scoped items for metrics & charts
  const timeScopedList = transactions.filter(t => {
    const d = new Date(t.date);
    if (isNaN(d.getTime())) return false;
    if (scope === 'all') return true;
    if (scope === 'year') return d.getFullYear() === selectedYear;
    return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
  });

  // 2. Filtered list for the table
  const tableList = timeScopedList.filter(t => {
    const matchCat = catFilter === 'ALL' || t.category === catFilter;
    const matchPay = payFilter === 'ALL' || t.payment === payFilter;
    const matchSearch =
      t.title.toLowerCase().includes(search) ||
      (t.note && t.note.toLowerCase().includes(search)) ||
      (t.payment && t.payment.toLowerCase().includes(search));
    return matchCat && matchPay && matchSearch;
  });

  // Sort descending by date
  tableList.sort((a, b) => new Date(b.date) - new Date(a.date));

  renderKPIs(timeScopedList, scope);
  renderCharts(timeScopedList, selectedYear);
  renderTable(tableList);
  updateVaultStorageKPIs();
  lucide.createIcons();
}

// --- Render KPI Cards ---
function renderKPIs(scopedList, scope) {
  const periodTotal = scopedList.reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const lifetimeTotal = transactions.reduce((acc, t) => acc + Number(t.amount || 0), 0);

  document.getElementById('periodSpendVal').textContent = formatINR(periodTotal);
  document.getElementById('periodTxnCount').textContent = `${scopedList.length} transaction(s) recorded`;
  document.getElementById('lifetimeSpendVal').textContent = formatINR(lifetimeTotal);

  const kpiLabel = document.getElementById('kpiPeriodLabel');
  if (scope === 'all') kpiLabel.textContent = 'Lifetime Spend';
  else if (scope === 'year') kpiLabel.textContent = "Year's Total Spend";
  else kpiLabel.textContent = "Month's Total Spend";

  // Budget Calculations
  const spentPct = Math.min(100, Math.round((periodTotal / (monthlyBudget || 1)) * 100));
  const remaining = Math.max(0, monthlyBudget - periodTotal);

  document.getElementById('budgetRemainingVal').textContent = formatINR(remaining);
  document.getElementById('budgetSpentPercent').textContent = `${spentPct}% utilized`;
  document.getElementById('budgetCapText').textContent = `Cap: ${formatINR(monthlyBudget)}`;

  const pBar = document.getElementById('budgetProgressBar');
  pBar.style.width = `${spentPct}%`;
  pBar.className = `h-full rounded-full transition-all duration-500 ${
    spentPct >= 100 ? 'bg-rose-500' : spentPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
  }`;

  // Daily Average
  const activeDays = new Set(scopedList.map(t => t.date)).size || 1;
  const dailyBurn = Math.round(periodTotal / activeDays);
  document.getElementById('dailyAvgVal').textContent = formatINR(dailyBurn);
  document.getElementById('dailyAvgSubtext').textContent = `Avg over ${activeDays} active day(s)`;
}

// --- Render Table ---
function renderTable(list) {
  const tbody = document.getElementById('transactionTableBody');
  const emptyState = document.getElementById('emptyState');
  tbody.innerHTML = '';

  if (list.length === 0) {
    emptyState.classList.remove('hidden');
    document.getElementById('showingCountText').textContent = 'Showing 0 entries';
    document.getElementById('tableSumText').textContent = 'Total: ₹0';
    return;
  }
  emptyState.classList.add('hidden');

  let tableSum = 0;
  list.forEach(item => {
    tableSum += Number(item.amount || 0);
    const cat = CATEGORIES.find(c => c.id === item.category) || { label: item.category, color: '#64748b' };

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-750/50 transition border-b border-slate-700/40 group';
    tr.innerHTML = `
      <td class="py-3 px-4 sm:px-6 whitespace-nowrap text-xs text-slate-400 font-mono">${item.date}</td>
      <td class="py-3 px-4">
        <div class="font-semibold text-white">${escapeHtml(item.title)}</div>
        ${item.note ? `<div class="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">${escapeHtml(item.note)}</div>` : ''}
      </td>
      <td class="py-3 px-4 whitespace-nowrap">
        <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium" style="background-color: ${cat.color}22; color: ${cat.color}; border: 1px solid ${cat.color}44;">
          ${cat.label}
        </span>
      </td>
      <td class="py-3 px-4 whitespace-nowrap text-xs text-slate-300">${escapeHtml(item.payment || 'UPI')}</td>
      <td class="py-3 px-4 text-right whitespace-nowrap font-bold text-white font-mono">${formatINR(item.amount)}</td>
      <td class="py-3 px-4 sm:px-6 text-center whitespace-nowrap">
        <div class="inline-flex items-center space-x-1.5 opacity-85 group-hover:opacity-100">
          <button onclick="openEditModal('${item.id}')" class="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition" title="Edit">
            <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
          </button>
          <button onclick="deleteExpense('${item.id}')" class="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition" title="Delete">
            <i data-lucide="trash" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('showingCountText').textContent = `Showing ${list.length} entries`;
  document.getElementById('tableSumText').textContent = `Total: ${formatINR(tableSum)}`;
}

// --- Chart.js Setup & Rendering ---
function initCharts() {
  const catCtx = document.getElementById('categoryChart').getContext('2d');
  categoryChartInstance = new Chart(catCtx, {
    type: 'doughnut',
    data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 0 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, color: '#94a3b8', font: { size: 10 } } }
      },
      cutout: '70%'
    }
  });

  const trendCtx = document.getElementById('annualTrendChart').getContext('2d');
  trendChartInstance = new Chart(trendCtx, {
    type: 'bar',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [{
        label: 'Spending (₹)',
        data: new Array(12).fill(0),
        backgroundColor: '#10b981',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          grid: { color: 'rgba(51, 65, 85, 0.4)' },
          ticks: { color: '#94a3b8', callback: (v) => '₹' + v.toLocaleString('en-IN') }
        },
        x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
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

function renderCharts(scopedList, targetYear) {
  // 1. Category Breakdown
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

    // Highest category calculation
    let maxIdx = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i] > data[maxIdx]) maxIdx = i;
    }
    document.getElementById('topCategoryName').textContent = `${labels[maxIdx]} (${formatINR(data[maxIdx])})`;
  }
  categoryChartInstance.update();

  // 2. Annual Trend 12 Months
  document.getElementById('trendYearLabel').textContent = targetYear.toString();
  const monthSums = new Array(12).fill(0);
  transactions.forEach(t => {
    const d = new Date(t.date);
    if (d.getFullYear() === targetYear) {
      monthSums[d.getMonth()] += Number(t.amount || 0);
    }
  });

  trendChartInstance.data.datasets[0].data = monthSums;
  trendChartInstance.update();

  // Highest / Lowest Month
  let maxMonthIdx = 0;
  let minMonthIdx = -1;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 0; i < 12; i++) {
    if (monthSums[i] > monthSums[maxMonthIdx]) maxMonthIdx = i;
    if (monthSums[i] > 0) {
      if (minMonthIdx === -1 || monthSums[i] < monthSums[minMonthIdx]) minMonthIdx = i;
    }
  }

  document.getElementById('highestMonthText').textContent =
    monthSums[maxMonthIdx] > 0 ? `${monthNames[maxMonthIdx]} (${formatINR(monthSums[maxMonthIdx])})` : '—';
  document.getElementById('lowestMonthText').textContent =
    minMonthIdx !== -1 ? `${monthNames[minMonthIdx]} (${formatINR(monthSums[minMonthIdx])})` : '—';
}

// --- CRUD Actions ---
window.deleteExpense = function(id) {
  if (confirm('Delete this expense entry?')) {
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
  document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('modalTitle').innerHTML = `
    <span class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400"><i data-lucide="plus-circle" class="w-4 h-4"></i></span>
    Add New Kharcha
  `;
  document.getElementById('expenseModal').classList.remove('hidden');
  lucide.createIcons();
}

function closeExpenseModal() {
  document.getElementById('expenseModal').classList.add('hidden');
}

// --- Backup & Vault Stats ---
function updateVaultStorageKPIs() {
  const jsonStr = JSON.stringify(transactions);
  const bytes = new Blob([jsonStr]).size;
  const kb = (bytes / 1024).toFixed(1);

  document.getElementById('storageRecordsCount').textContent = transactions.length;
  document.getElementById('vaultRecordCount').textContent = transactions.length;
  document.getElementById('vaultBytes').textContent = `${kb} KB`;
}

function exportJSONBackup() {
  const payload = {
    app: 'KharchaTracker',
    version: 2,
    exportDate: new Date().toISOString(),
    monthlyBudget: monthlyBudget,
    transactions: transactions
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Kharcha_Tracker_Backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV() {
  if (transactions.length === 0) {
    alert('No transactions to export.');
    return;
  }
  const headers = ['ID', 'Date', 'Title', 'Category', 'Payment Mode', 'Amount (INR)', 'Note'];
  const rows = transactions.map(t => [
    t.id,
    t.date,
    `"${(t.title || '').replace(/"/g, '""')}"`,
    t.category,
    t.payment || 'UPI',
    t.amount,
    `"${(t.note || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Kharcha_Report_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJSONFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      let importedTxns = [];

      if (Array.isArray(parsed)) {
        importedTxns = parsed;
      } else if (parsed.transactions && Array.isArray(parsed.transactions)) {
        importedTxns = parsed.transactions;
        if (parsed.monthlyBudget) monthlyBudget = Number(parsed.monthlyBudget);
      } else {
        alert('Invalid JSON file format.');
        return;
      }

      if (confirm(`Import ${importedTxns.length} records? This will merge with your existing database.`)) {
        const idSet = new Set(transactions.map(t => t.id));
        importedTxns.forEach(item => {
          if (!item.id || idSet.has(item.id)) {
            item.id = 'txn-' + Math.random().toString(36).substr(2, 9);
          }
          transactions.push(item);
        });

        saveData();
        populateYearSelect();
        renderApp();
        alert('Backup imported successfully!');
        document.getElementById('backupModal').classList.add('hidden');
      }
    } catch (err) {
      alert('Error parsing JSON backup file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// --- Event Listeners ---
function bindEvents() {
  document.getElementById('openAddModalBtn').addEventListener('click', openAddModal);
  document.getElementById('closeExpenseModalBtn').addEventListener('click', closeExpenseModal);
  document.getElementById('cancelExpenseModalBtn').addEventListener('click', closeExpenseModal);

  // Form Submission
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
    }

    saveData();
    populateYearSelect();
    closeExpenseModal();
    renderApp();
  });

  // Filter Event Listeners
  ['timeScopeSelect', 'monthSelect', 'yearSelect', 'categoryFilter', 'paymentFilter'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      const scope = document.getElementById('timeScopeSelect').value;
      const monthYearControls = document.getElementById('monthYearControls');
      const monthSelect = document.getElementById('monthSelect');

      if (scope === 'all') {
        monthYearControls.classList.add('opacity-40', 'pointer-events-none');
      } else if (scope === 'year') {
        monthYearControls.classList.remove('opacity-40', 'pointer-events-none');
        monthSelect.classList.add('hidden');
      } else {
        monthYearControls.classList.remove('opacity-40', 'pointer-events-none');
        monthSelect.classList.remove('hidden');
      }
      renderApp();
    });
  });

  document.getElementById('searchInput').addEventListener('input', renderApp);

  document.getElementById('jumpToTodayBtn').addEventListener('click', () => {
    const now = new Date();
    document.getElementById('timeScopeSelect').value = 'month';
    document.getElementById('monthSelect').classList.remove('hidden');
    document.getElementById('monthYearControls').classList.remove('opacity-40', 'pointer-events-none');
    document.getElementById('monthSelect').value = now.getMonth();
    document.getElementById('yearSelect').value = now.getFullYear();
    renderApp();
  });

  // Set Budget Modal Prompt
  document.getElementById('setBudgetBtn').addEventListener('click', () => {
    const current = monthlyBudget;
    const input = prompt('Enter your monthly budget in ₹:', current);
    if (input !== null) {
      const parsed = parseFloat(input);
      if (!isNaN(parsed) && parsed > 0) {
        monthlyBudget = parsed;
        saveData();
        renderApp();
      }
    }
  });

  // Backup Modal Controls
  document.getElementById('backupBtn').addEventListener('click', () => {
    document.getElementById('backupModal').classList.remove('hidden');
    lucide.createIcons();
  });
  document.getElementById('closeBackupModalBtn').addEventListener('click', () => {
    document.getElementById('backupModal').classList.add('hidden');
  });
  document.getElementById('downloadBackupBtn').addEventListener('click', exportJSONBackup);
  document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);

  document.getElementById('importJsonInput').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      importJSONFile(e.target.files[0]);
    }
  });

  document.getElementById('resetAllDataBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to permanently clear all expense records? This cannot be undone unless you have a JSON backup.')) {
      transactions = [];
      saveData();
      populateYearSelect();
      renderApp();
      document.getElementById('backupModal').classList.add('hidden');
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}