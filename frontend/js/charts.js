/**
 * FinWise Chart.js Visualizations
 */

class ChartManager {
    constructor() {
        this.expenseChartInstance = null;
        this.cashflowChartInstance = null;
    }

    renderExpenseChart(canvasId, categoryMap) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const labels = Object.keys(categoryMap);
        const data = Object.values(categoryMap);

        if (this.expenseChartInstance) {
            this.expenseChartInstance.destroy();
        }

        if (labels.length === 0) {
            labels.push('No Expenses');
            data.push(1);
        }

        const backgroundColors = [
            '#6366F1', '#10B981', '#F59E0B', '#EF4444', 
            '#8B5CF6', '#EC4899', '#06B6D4', '#14B8A6', '#F97316'
        ];

        this.expenseChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#1e293b',
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#94a3b8',
                            font: { family: "'Inter', sans-serif", size: 12 },
                            boxWidth: 14,
                            padding: 12
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const val = context.parsed;
                                return ` ${context.label}: $${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
                            }
                        }
                    }
                },
                cutout: '70%'
            }
        });
    }

    renderCashflowChart(canvasId, totalIncome, totalExpenses, netSavings) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (this.cashflowChartInstance) {
            this.cashflowChartInstance.destroy();
        }

        this.cashflowChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Total Income', 'Total Expenses', 'Net Savings'],
                datasets: [{
                    label: 'Amount ($)',
                    data: [totalIncome, totalExpenses, netSavings],
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.85)',  // emerald
                        'rgba(239, 68, 68, 0.85)',   // red
                        'rgba(99, 102, 241, 0.85)'   // indigo
                    ],
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return ` $${context.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(148, 163, 184, 0.1)' },
                        ticks: {
                            color: '#94a3b8',
                            callback: function (val) { return '$' + val; }
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    }
}

window.ChartManager = new ChartManager();
