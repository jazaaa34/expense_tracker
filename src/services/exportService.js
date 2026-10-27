
// ==============================================================================
// EXPORT SERVICE - WALLETWEATHER WEB
// Exports user transactions to a standard CSV statement
// ==============================================================================

export const exportService = {
  exportToCsv(transactions, fileName = 'WalletWeather_Statement.csv') {
    if (!transactions || transactions.length === 0) {
      alert('No transactions available to export.');
      return;
    }

    const headers = ['ID', 'Date', 'Time', 'Type', 'Category', 'Name', 'Amount (INR)', 'PaymentMethod', 'Note', 'Tag'];
    
    const rows = transactions.map(t => {
      const d = new Date(t.date);
      const dateStr = d.toISOString().split('T')[0];
      const timeStr = d.toTimeString().split(' ')[0];
      const safeName = (t.name || '').replace(/"/g, '""');
      const safeNote = (t.note || '').replace(/"/g, '""');

      return [
        t.id,
        dateStr,
        timeStr,
        t.isExpense ? 'Expense' : 'Income',
        t.category,
        `"${safeName}"`,
        t.amount,
        t.paymentMethod || 'UPI',
        `"${safeNote}"`,
        t.tag || 'Personal'
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};
