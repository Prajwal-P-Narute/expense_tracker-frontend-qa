import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import "./MonthlyComparisonChart.css";

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
);

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const percentFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const monthLabelFormatter = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  year: "numeric",
});

const shortMonthFormatter = new Intl.DateTimeFormat("en-IN", {
  month: "short",
});

const shortMonthYearFormatter = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  year: "2-digit",
});

const CHART_COLORS = {
  income: "#16a34a",
  expense: "#dc2626",
  savingsPositive: "#15803d",
  savingsNegative: "#b91c1c",
  labelBackground: "rgba(255, 255, 255, 0.96)",
  labelBorder: "rgba(148, 163, 184, 0.24)",
};

const formatCurrency = (value) =>
  `₹${currencyFormatter.format(Number(value) || 0)}`;

const formatAxisCurrency = (value) =>
  `₹${compactCurrencyFormatter.format(Number(value) || 0)}`;

const formatCompactCurrency = (value) =>
  `₹${compactCurrencyFormatter.format(Math.abs(Number(value) || 0))}`;

const formatSignedCurrency = (value) => {
  const amount = Number(value) || 0;
  const prefix = amount < 0 ? "-₹" : "₹";
  return `${prefix}${currencyFormatter.format(Math.abs(amount))}`;
};

const formatSavingsRate = (value) => {
  const numericValue = Number(value) || 0;
  const prefix = numericValue > 0 ? "+" : "";
  return `${prefix}${percentFormatter.format(numericValue)}%`;
};

const calculateSavingsRate = (income, expense) => {
  const safeIncome = Number(income) || 0;
  const safeExpense = Number(expense) || 0;
  const savings = safeIncome - safeExpense;

  if (safeIncome > 0) {
    return (savings / safeIncome) * 100;
  }

  return savings === 0 ? 0 : -100;
};

const drawRoundedRect = (ctx, x, y, width, height, radius) => {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
};

const getMonthKeyFromDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const parseMonthKey = (monthKey) => {
  if (!/^\d{4}-\d{2}$/.test(monthKey || "")) {
    return null;
  }

  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
};

const shiftMonthKey = (monthKey, delta) => {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) {
    return monthKey;
  }

  return getMonthKeyFromDate(
    new Date(parsed.getFullYear(), parsed.getMonth() + delta, 1),
  );
};

const compareMonthKeys = (left, right) => left.localeCompare(right);

const formatMonthLabel = (monthKey, includeYear = true) => {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) {
    return monthKey;
  }

  return includeYear
    ? monthLabelFormatter.format(parsed)
    : shortMonthFormatter.format(parsed);
};

const buildMonthRange = (fromKey, toKey) => {
  if (!fromKey || !toKey || compareMonthKeys(fromKey, toKey) > 0) {
    return [];
  }

  const months = [];
  let current = fromKey;

  while (compareMonthKeys(current, toKey) <= 0) {
    months.push(current);
    current = shiftMonthKey(current, 1);
  }

  return months;
};

export default function MonthlyComparisonChart({
  monthlyComparison,
  hasActiveFilters,
}) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [isCompactViewport, setIsCompactViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 640 : false,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncViewport = () => {
      setIsCompactViewport(window.innerWidth <= 640);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  const normalizedSeries = useMemo(() => {
    const points = Array.isArray(monthlyComparison) ? monthlyComparison : [];
    const entries = points
      .map((point) => ({
        monthKey: typeof point?.monthKey === "string" ? point.monthKey : "",
        income: Number(point?.income) || 0,
        expense: Number(point?.expense) || 0,
      }))
      .filter((point) => /^\d{4}-\d{2}$/.test(point.monthKey))
      .sort((left, right) => compareMonthKeys(left.monthKey, right.monthKey));

    return new Map(entries.map((point) => [point.monthKey, point]));
  }, [monthlyComparison]);

  const currentMonthKey = useMemo(() => getMonthKeyFromDate(new Date()), []);

  const pickerBounds = useMemo(() => {
    const availableKeys = [...normalizedSeries.keys()];
    const earliestDataMonthKey = availableKeys[0] || currentMonthKey;
    const latestDataMonthKey = availableKeys[availableKeys.length - 1] || currentMonthKey;
    const earliestPickerMonthKey =
      compareMonthKeys(shiftMonthKey(currentMonthKey, -11), earliestDataMonthKey) < 0
        ? shiftMonthKey(currentMonthKey, -11)
        : earliestDataMonthKey;
    const latestPickerMonthKey =
      compareMonthKeys(currentMonthKey, latestDataMonthKey) > 0
        ? currentMonthKey
        : latestDataMonthKey;

    return {
      earliestPickerMonthKey,
      latestPickerMonthKey,
    };
  }, [currentMonthKey, normalizedSeries]);

  const monthOptions = useMemo(
    () =>
      buildMonthRange(
        pickerBounds.earliestPickerMonthKey,
        pickerBounds.latestPickerMonthKey,
      ),
    [pickerBounds],
  );

  const [fromMonthKey, setFromMonthKey] = useState("");
  const [toMonthKey, setToMonthKey] = useState("");

  useEffect(() => {
    if (!monthOptions.length) {
      return;
    }

    const defaultToMonthKey = pickerBounds.latestPickerMonthKey;
    const defaultFromMonthKey = monthOptions.includes(shiftMonthKey(defaultToMonthKey, -5))
      ? shiftMonthKey(defaultToMonthKey, -5)
      : monthOptions[0];

    setFromMonthKey((currentValue) =>
      currentValue && monthOptions.includes(currentValue)
        ? currentValue
        : defaultFromMonthKey,
    );
    setToMonthKey((currentValue) =>
      currentValue && monthOptions.includes(currentValue)
        ? currentValue
        : defaultToMonthKey,
    );
  }, [monthOptions, pickerBounds.latestPickerMonthKey]);

  const selectedMonthKeys = useMemo(() => {
    if (!fromMonthKey || !toMonthKey) {
      return [];
    }

    return buildMonthRange(fromMonthKey, toMonthKey).reverse();
  }, [fromMonthKey, toMonthKey]);

  const chartRows = useMemo(() => {
    return selectedMonthKeys.map((monthKey) => {
      const point = normalizedSeries.get(monthKey);
      const income = point?.income || 0;
      const expense = point?.expense || 0;
      const savings = income - expense;
      const savingsRate = calculateSavingsRate(income, expense);

      return {
        monthKey,
        income,
        expense,
        savings,
        savingsRate,
      };
    });
  }, [normalizedSeries, selectedMonthKeys]);

  const hasMultipleYears = useMemo(
    () => new Set(selectedMonthKeys.map((monthKey) => monthKey.slice(0, 4))).size > 1,
    [selectedMonthKeys],
  );

  const chartStageWidth = useMemo(() => {
    const monthCount = Math.max(selectedMonthKeys.length, 6);
    const slotWidth = isCompactViewport ? 128 : 96;
    const minimumWidth = isCompactViewport ? 720 : 0;

    return Math.max(monthCount * slotWidth, minimumWidth);
  }, [isCompactViewport, selectedMonthKeys.length]);

  const showScrollHint = isCompactViewport && selectedMonthKeys.length > 4;

  useEffect(() => {
    if (!canvasRef.current || !chartRows.length || !fromMonthKey || !toMonthKey) {
      return undefined;
    }

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const chart = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: chartRows.map((row) => [
          hasMultipleYears
            ? shortMonthYearFormatter.format(parseMonthKey(row.monthKey))
            : formatMonthLabel(row.monthKey, false),
          formatSavingsRate(row.savingsRate),
        ]),
        datasets: [
          {
            label: "Income",
            data: chartRows.map((row) => row.income),
            backgroundColor: CHART_COLORS.income,
            borderRadius: 10,
            maxBarThickness: isCompactViewport ? 24 : 30,
          },
          {
            label: "Expense",
            data: chartRows.map((row) => row.expense),
            backgroundColor: CHART_COLORS.expense,
            borderRadius: 10,
            maxBarThickness: isCompactViewport ? 24 : 30,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 450,
        },
        interaction: {
          mode: "index",
          intersect: false,
        },
        layout: {
          padding: {
            top: isCompactViewport ? 32 : 40,
            right: isCompactViewport ? 20 : 16,
            left: isCompactViewport ? 4 : 0,
          },
        },
        plugins: {
          legend: {
            position: "top",
            align: "start",
            labels: {
              usePointStyle: true,
              pointStyle: "rectRounded",
              boxWidth: isCompactViewport ? 10 : 12,
              color: "#23335b",
              font: {
                size: isCompactViewport ? 12 : 13,
                weight: "700",
              },
            },
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                const row = chartRows[items[0]?.dataIndex ?? 0];
                return row ? formatMonthLabel(row.monthKey) : "";
              },
              label: (context) =>
                `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`,
              footer: (items) => {
                const row = chartRows[items[0]?.dataIndex ?? 0];
                return row
                  ? `Savings: ${formatSignedCurrency(row.savings)} (${formatSavingsRate(row.savingsRate)})`
                  : "";
              },
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              color: "#5a647a",
              autoSkip: false,
              maxRotation: 0,
              minRotation: 0,
              padding: isCompactViewport ? 10 : 8,
              font: {
                size: isCompactViewport ? 10 : 11,
                weight: "600",
              },
            },
            border: {
              display: false,
            },
          },
          y: {
            beginAtZero: true,
            grid: {
              color: "rgba(148, 163, 184, 0.18)",
            },
            ticks: {
              color: "#64748b",
              padding: isCompactViewport ? 6 : 8,
              font: {
                size: isCompactViewport ? 11 : 12,
              },
              callback: (value) => formatAxisCurrency(value),
            },
            border: {
              display: false,
            },
          },
        },
      },
      plugins: [
        {
          id: "monthly-comparison-metrics",
          afterDatasetsDraw(chartInstance) {
            const { ctx, chartArea } = chartInstance;
            const incomeMeta = chartInstance.getDatasetMeta(0);
            const expenseMeta = chartInstance.getDatasetMeta(1);

            const drawBadge = (text, centerX, topY, options = {}) => {
              const {
                textColor = "#23335b",
                fontSize = 11,
                fontWeight = "700",
                paddingX = 7,
                paddingY = 4,
                radius = 10,
                minTop = chartArea.top + 4,
              } = options;

              ctx.save();
              ctx.font = `${fontWeight} ${fontSize}px "Segoe UI", sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";

              const textWidth = ctx.measureText(text).width;
              const badgeWidth = textWidth + paddingX * 2;
              const badgeHeight = fontSize + paddingY * 2 + 2;
              const safeLeft = Math.min(
                Math.max(centerX - badgeWidth / 2, chartArea.left + 4),
                chartArea.right - badgeWidth - 4,
              );
              const safeTop = Math.max(topY, minTop);

              drawRoundedRect(
                ctx,
                safeLeft,
                safeTop,
                badgeWidth,
                badgeHeight,
                radius,
              );
              ctx.fillStyle = CHART_COLORS.labelBackground;
              ctx.fill();
              ctx.strokeStyle = CHART_COLORS.labelBorder;
              ctx.lineWidth = 1;
              ctx.stroke();

              ctx.fillStyle = textColor;
              ctx.fillText(
                text,
                safeLeft + badgeWidth / 2,
                safeTop + badgeHeight / 2,
              );
              ctx.restore();

              return {
                top: safeTop,
                height: badgeHeight,
              };
            };

            ctx.save();

            chartRows.forEach((row, index) => {
              const incomeBar = incomeMeta.data[index];
              const expenseBar = expenseMeta.data[index];

              if (!incomeBar || !expenseBar) {
                return;
              }

              const incomePoint = incomeBar.tooltipPosition();
              const expensePoint = expenseBar.tooltipPosition();

              if (row.income > 0) {
                drawBadge(
                  formatCompactCurrency(row.income),
                  incomePoint.x,
                  incomePoint.y - (isCompactViewport ? 26 : 28),
                  {
                    textColor: CHART_COLORS.income,
                    fontSize: isCompactViewport ? 10 : 11,
                    paddingX: 6,
                    paddingY: 3,
                    radius: 9,
                    minTop: chartArea.top - (isCompactViewport ? 10 : 12),
                  },
                );
              }

              if (row.expense > 0) {
                drawBadge(
                  formatCompactCurrency(row.expense),
                  expensePoint.x,
                  expensePoint.y - (isCompactViewport ? 26 : 28),
                  {
                    textColor: CHART_COLORS.expense,
                    fontSize: isCompactViewport ? 10 : 11,
                    paddingX: 6,
                    paddingY: 3,
                    radius: 9,
                    minTop: chartArea.top - (isCompactViewport ? 10 : 12),
                  },
                );
              }
            });

            ctx.restore();
          },
        },
      ],
    });

    chartRef.current = chart;

    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, [chartRows, fromMonthKey, hasMultipleYears, isCompactViewport, toMonthKey]);

  const selectedIncomeTotal = useMemo(
    () => chartRows.reduce((total, row) => total + row.income, 0),
    [chartRows],
  );

  const selectedExpenseTotal = useMemo(
    () => chartRows.reduce((total, row) => total + row.expense, 0),
    [chartRows],
  );

  const selectedSavingsTotal = useMemo(
    () => selectedIncomeTotal - selectedExpenseTotal,
    [selectedExpenseTotal, selectedIncomeTotal],
  );

  const selectedSavingsRate = useMemo(
    () => calculateSavingsRate(selectedIncomeTotal, selectedExpenseTotal),
    [selectedExpenseTotal, selectedIncomeTotal],
  );

  const handleFromMonthChange = (event) => {
    const nextFromMonthKey = event.target.value;
    setFromMonthKey(nextFromMonthKey);

    if (toMonthKey && compareMonthKeys(nextFromMonthKey, toMonthKey) > 0) {
      setToMonthKey(nextFromMonthKey);
    }
  };

  const handleToMonthChange = (event) => {
    const nextToMonthKey = event.target.value;
    setToMonthKey(nextToMonthKey);

    if (fromMonthKey && compareMonthKeys(nextToMonthKey, fromMonthKey) < 0) {
      setFromMonthKey(nextToMonthKey);
    }
  };

  if (!normalizedSeries.size) {
    return (
      <section className="monthly-comparison-panel">
        <div className="monthly-comparison-header">
        <div>
          <h3>Monthly Income vs Expense</h3>
          <p>Track income, expense, and actual monthwise savings.</p>
          </div>
          {hasActiveFilters ? (
            <span className="monthly-comparison-filter-pill">Filtered</span>
          ) : null}
        </div>

        <div className="monthly-comparison-empty">
          Add a few transactions to unlock the month-by-month comparison chart.
        </div>
      </section>
    );
  }

  return (
    <section className="monthly-comparison-panel">
      <div className="monthly-comparison-header">
        <div>
          <h3>Monthly Income vs Expense</h3>
          <p>
            Starts from the latest month and moves backward, with saving balance
            and saving rate shown for each month.
          </p>
        </div>

        <div className="monthly-comparison-header-meta">
          {hasActiveFilters ? (
            <span className="monthly-comparison-filter-pill">Filtered</span>
          ) : null}

          <div className="monthly-comparison-controls">
            <label className="monthly-comparison-select-wrap">
              <span>From</span>
              <select
                value={fromMonthKey}
                onChange={handleFromMonthChange}
                className="monthly-comparison-select"
              >
                {monthOptions.map((monthKey) => (
                  <option key={monthKey} value={monthKey}>
                    {formatMonthLabel(monthKey)}
                  </option>
                ))}
              </select>
            </label>

            <label className="monthly-comparison-select-wrap">
              <span>To</span>
              <select
                value={toMonthKey}
                onChange={handleToMonthChange}
                className="monthly-comparison-select"
              >
                {monthOptions.map((monthKey) => (
                  <option key={monthKey} value={monthKey}>
                    {formatMonthLabel(monthKey)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="monthly-comparison-summary">
        <div className="monthly-comparison-summary-card income">
          <span>Selected income</span>
          <strong>{formatCurrency(selectedIncomeTotal)}</strong>
        </div>
        <div className="monthly-comparison-summary-card expense">
          <span>Selected expense</span>
          <strong>{formatCurrency(selectedExpenseTotal)}</strong>
        </div>
        <div
          className={`monthly-comparison-summary-card savings ${
            selectedSavingsTotal < 0 ? "negative" : "positive"
          }`}
        >
          <span>Selected savings</span>
          <strong>{formatSignedCurrency(selectedSavingsTotal)}</strong>
          <small>
            {formatSavingsRate(selectedSavingsRate)} across{" "}
            {selectedMonthKeys.length} {selectedMonthKeys.length === 1 ? "month" : "months"}
          </small>
        </div>
      </div>

      {showScrollHint ? (
        <div className="monthly-comparison-scroll-hint">
          Swipe sideways to see the full month range.
        </div>
      ) : null}

      <div className="monthly-comparison-chart-wrap">
        <div
          className="monthly-comparison-chart-stage"
          style={{ width: `${chartStageWidth}px` }}
        >
          <canvas
            ref={canvasRef}
            aria-label="Monthly income and expense comparison chart"
          />
        </div>
      </div>
    </section>
  );
}
