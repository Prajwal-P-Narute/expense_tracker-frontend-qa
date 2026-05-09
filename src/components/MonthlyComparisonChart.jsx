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
  income: "#4c8eda",
  expense: "#df7846",
  incomePositive: "#1d5fc1",
  incomeNegative: "#e4572e",
  expensePositive: "#c15321",
  expenseNegative: "#138a72",
};

const formatCurrency = (value) =>
  `₹${currencyFormatter.format(Number(value) || 0)}`;

const formatAxisCurrency = (value) =>
  `₹${compactCurrencyFormatter.format(Number(value) || 0)}`;

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

const buildChangeLabel = (currentValue, previousValue, datasetKey) => {
  if (!Number.isFinite(previousValue)) {
    return null;
  }

  if (previousValue === 0) {
    if (currentValue === 0) {
      return null;
    }

    return {
      text: "+100.0%",
      color:
        datasetKey === "expense"
          ? CHART_COLORS.expensePositive
          : CHART_COLORS.incomePositive,
    };
  }

  const change = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
  const rounded = Number(change.toFixed(1));
  const prefix = rounded > 0 ? "+" : "";

  return {
    text: `${prefix}${rounded.toFixed(1)}%`,
    color:
      datasetKey === "expense"
        ? rounded <= 0
          ? CHART_COLORS.expenseNegative
          : CHART_COLORS.expensePositive
        : rounded >= 0
          ? CHART_COLORS.incomePositive
          : CHART_COLORS.incomeNegative,
  };
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
      const previousMonthPoint = normalizedSeries.get(shiftMonthKey(monthKey, -1));
      const income = point?.income || 0;
      const expense = point?.expense || 0;

      return {
        monthKey,
        income,
        expense,
        incomeChange: buildChangeLabel(
          income,
          previousMonthPoint?.income,
          "income",
        ),
        expenseChange: buildChangeLabel(
          expense,
          previousMonthPoint?.expense,
          "expense",
        ),
      };
    });
  }, [normalizedSeries, selectedMonthKeys]);

  const hasMultipleYears = useMemo(
    () => new Set(selectedMonthKeys.map((monthKey) => monthKey.slice(0, 4))).size > 1,
    [selectedMonthKeys],
  );

  const chartStageWidth = useMemo(() => {
    const monthCount = Math.max(selectedMonthKeys.length, 6);
    const slotWidth = isCompactViewport ? 104 : 88;
    const minimumWidth = isCompactViewport ? 640 : 0;

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
        labels: chartRows.map((row) =>
          hasMultipleYears
            ? shortMonthYearFormatter.format(parseMonthKey(row.monthKey))
            : formatMonthLabel(row.monthKey, false),
        ),
        datasets: [
          {
            label: "Income",
            data: chartRows.map((row) => row.income),
            backgroundColor: CHART_COLORS.income,
            borderRadius: 10,
            maxBarThickness: isCompactViewport ? 26 : 32,
          },
          {
            label: "Expenses",
            data: chartRows.map((row) => row.expense),
            backgroundColor: CHART_COLORS.expense,
            borderRadius: 10,
            maxBarThickness: isCompactViewport ? 26 : 32,
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
            top: isCompactViewport ? 28 : 34,
            right: isCompactViewport ? 22 : 16,
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
              padding: isCompactViewport ? 8 : 6,
              font: {
                size: isCompactViewport ? 11 : 12,
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
          id: "monthly-comparison-change-labels",
          afterDatasetsDraw(chartInstance) {
            const { ctx, chartArea } = chartInstance;
            ctx.save();
            ctx.font = `600 ${isCompactViewport ? 11 : 12}px "Segoe UI", sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";

            chartInstance.data.datasets.forEach((dataset, datasetIndex) => {
              const meta = chartInstance.getDatasetMeta(datasetIndex);

              meta.data.forEach((bar, index) => {
                const changeInfo =
                  datasetIndex === 0
                    ? chartRows[index]?.incomeChange
                    : chartRows[index]?.expenseChange;

                if (!changeInfo?.text) {
                  return;
                }

                const tooltipPosition = bar.tooltipPosition();
                const safeX = Math.min(
                  Math.max(tooltipPosition.x, chartArea.left + 24),
                  chartArea.right - 24,
                );
                const safeY = Math.max(
                  tooltipPosition.y - (isCompactViewport ? 6 : 8),
                  chartArea.top + 14,
                );

                ctx.fillStyle = changeInfo.color;
                ctx.fillText(changeInfo.text, safeX, safeY);
              });
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
            <p>Track income and expense movement month over month.</p>
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
            Starts from the latest month and moves backward, with quick month-to-month
            filtering when you want a specific range.
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
        <div className="monthly-comparison-summary-card range">
          <span>Showing</span>
          <strong>
            {selectedMonthKeys.length} {selectedMonthKeys.length === 1 ? "month" : "months"}
          </strong>
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
