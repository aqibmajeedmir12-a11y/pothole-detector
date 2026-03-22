import { useState, useEffect, useRef } from 'react';
import { FileText, Download, RefreshCw, TrendingUp, AlertTriangle, Wrench, CheckCircle, Calendar, MapPin, IndianRupee } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { reportsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const periods = [
  { key: 'daily', label: 'Daily', description: 'Last 30 days' },
  { key: 'monthly', label: 'Monthly', description: 'Last 12 months' },
  { key: 'yearly', label: 'Yearly', description: 'Last 5 years' },
];

const severityColors = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const barGradientColors = ['#667eea', '#764ba2'];

export default function ReportsPage() {
  const { user } = useAuth();
  const [activePeriod, setActivePeriod] = useState('daily');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async (period) => {
    try {
      setLoading(true);
      const res = await reportsAPI.getReport(period || activePeriod, { state: user?.state, district: user?.district });
      setReportData(res.data.data);
    } catch (err) {
      console.error('Failed to fetch report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(activePeriod);
  }, [activePeriod]);

  const handlePeriodChange = (period) => {
    setActivePeriod(period);
  };

  const formatLabel = (label) => {
    if (!label) return '—';
    if (activePeriod === 'daily') {
      const d = new Date(label + 'T00:00:00');
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    }
    if (activePeriod === 'monthly') {
      const [y, m] = label.split('-');
      const d = new Date(parseInt(y), parseInt(m) - 1);
      return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    }
    return label;
  };

  const downloadPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      await import('jspdf-autotable');

      const doc = new jsPDF();
      const summary = reportData?.summary;
      const grouped = reportData?.grouped || [];
      const periodInfo = periods.find(p => p.key === activePeriod);

      // Title
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text('Road Condition Report', 14, 22);

      // Subtitle
      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text(`${periodInfo?.label} Report — ${periodInfo?.description}`, 14, 30);
      doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 36);

      // Divider
      doc.setDrawColor(200);
      doc.line(14, 40, 196, 40);

      // Summary section
      doc.setFontSize(14);
      doc.setTextColor(40, 40, 40);
      doc.text('Summary', 14, 50);

      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const summaryItems = [
        `Total Detections: ${summary?.totalDetections || 0}`,
        `Critical: ${summary?.criticalCount || 0}  |  High: ${summary?.highCount || 0}  |  Medium: ${summary?.mediumCount || 0}  |  Low: ${summary?.lowCount || 0}`,
        `Repaired: ${summary?.repairedCount || 0}`,
        `Total Repair Cost: ₹${(summary?.totalCost || 0).toLocaleString('en-IN')}`,
        `Average Confidence: ${summary?.avgConfidence ? (summary.avgConfidence * 100).toFixed(1) + '%' : 'N/A'}`,
      ];
      summaryItems.forEach((item, i) => {
        doc.text(item, 14, 58 + i * 6);
      });

      // Table
      doc.setFontSize(14);
      doc.setTextColor(40, 40, 40);
      doc.text('Detection Details', 14, 95);

      const tableData = grouped.map(row => [
        formatLabel(row.label),
        row.count,
        row.critical,
        row.high,
        row.medium,
        row.low,
        row.repaired,
        `₹${(row.totalCost || 0).toLocaleString('en-IN')}`,
      ]);

      doc.autoTable({
        startY: 100,
        head: [['Period', 'Total', 'Critical', 'High', 'Medium', 'Low', 'Repaired', 'Cost']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [102, 126, 234],
          textColor: 255,
          fontSize: 9,
          fontStyle: 'bold',
        },
        bodyStyles: { fontSize: 8, textColor: [60, 60, 60] },
        alternateRowStyles: { fillColor: [245, 247, 255] },
        styles: { cellPadding: 3 },
      });

      // Top Roads section (if available)
      const topRoads = reportData?.topRoads || [];
      if (topRoads.length > 0) {
        const finalY = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(14);
        doc.setTextColor(40, 40, 40);
        doc.text('Top Affected Roads', 14, finalY);

        doc.autoTable({
          startY: finalY + 5,
          head: [['Road Name', 'Detections', 'Total Cost']],
          body: topRoads.map(r => [r.road_name, r.count, `₹${(r.totalCost || 0).toLocaleString('en-IN')}`]),
          theme: 'grid',
          headStyles: {
            fillColor: [118, 75, 162],
            textColor: 255,
            fontSize: 9,
            fontStyle: 'bold',
          },
          bodyStyles: { fontSize: 8, textColor: [60, 60, 60] },
          alternateRowStyles: { fillColor: [250, 245, 255] },
          styles: { cellPadding: 3 },
        });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('AIoT Smart Road Monitor — Auto-Generated Report', 14, doc.internal.pageSize.height - 10);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 35, doc.internal.pageSize.height - 10);
      }

      doc.save(`road-report-${activePeriod}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    }
  };

  const summary = reportData?.summary;
  const grouped = reportData?.grouped || [];
  const topRoads = reportData?.topRoads || [];

  const chartData = grouped.map(row => ({
    ...row,
    name: formatLabel(row.label),
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary-400" />
            Reports
          </h1>
          <p className="text-sm text-gray-500 mt-1">View and download road condition reports</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchReport()}
            disabled={loading}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={downloadPDF}
            disabled={loading || !reportData}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Period selector */}
      <div className="glass-card p-1.5 inline-flex gap-1">
        {periods.map(({ key, label, description }) => (
          <button
            key={key}
            onClick={() => handlePeriodChange(key)}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              activePeriod === key
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/25'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="block">{label}</span>
            <span className={`text-[10px] block mt-0.5 ${activePeriod === key ? 'text-primary-200' : 'text-gray-600'}`}>
              {description}
            </span>
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="glass-card p-12 text-center">
          <RefreshCw className="w-8 h-8 text-primary-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-400">Loading report data...</p>
        </div>
      )}

      {!loading && reportData && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5 group hover:border-primary-500/30 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary-500/15 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary-400" />
                </div>
              </div>
              <p className="text-3xl font-bold text-white">{summary?.totalDetections || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Total Detections</p>
            </div>

            <div className="glass-card p-5 group hover:border-red-500/30 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
              </div>
              <p className="text-3xl font-bold text-red-400">{summary?.criticalCount || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Critical Issues</p>
            </div>

            <div className="glass-card p-5 group hover:border-amber-500/30 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                  <IndianRupee className="w-5 h-5 text-amber-400" />
                </div>
              </div>
              <p className="text-3xl font-bold text-amber-400">
                ₹{(summary?.totalCost || 0).toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-gray-500 mt-1">Total Repair Cost</p>
            </div>

            <div className="glass-card p-5 group hover:border-green-500/30 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
              </div>
              <p className="text-3xl font-bold text-green-400">{summary?.repairedCount || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Repaired</p>
            </div>
          </div>

          {/* Chart */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-1">Detection Trend</h2>
            <p className="text-xs text-gray-500 mb-5">
              {periods.find(p => p.key === activePeriod)?.description} breakdown
            </p>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} barSize={activePeriod === 'yearly' ? 50 : undefined}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#667eea" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#764ba2" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e2030',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      color: '#e2e8f0',
                      fontSize: '12px',
                    }}
                    labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  />
                  <Bar dataKey="count" fill="url(#barGradient)" radius={[6, 6, 0, 0]} name="Detections" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <Calendar className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">No data available for this period</p>
              </div>
            )}
          </div>

          {/* Data table */}
          <div className="glass-card overflow-hidden">
            <div className="p-5 border-b border-white/5">
              <h2 className="text-lg font-semibold text-white">Detailed Breakdown</h2>
              <p className="text-xs text-gray-500 mt-1">{grouped.length} entries</p>
            </div>
            {grouped.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-5 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider">Period</th>
                      <th className="text-center px-3 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider">Total</th>
                      <th className="text-center px-3 py-3 text-xs text-red-400/70 font-semibold uppercase tracking-wider">Critical</th>
                      <th className="text-center px-3 py-3 text-xs text-orange-400/70 font-semibold uppercase tracking-wider">High</th>
                      <th className="text-center px-3 py-3 text-xs text-amber-400/70 font-semibold uppercase tracking-wider">Medium</th>
                      <th className="text-center px-3 py-3 text-xs text-green-400/70 font-semibold uppercase tracking-wider">Low</th>
                      <th className="text-center px-3 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider">Repaired</th>
                      <th className="text-right px-5 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.map((row, i) => (
                      <tr key={row.label} className="table-row">
                        <td className="px-5 py-3 text-gray-300 font-medium">{formatLabel(row.label)}</td>
                        <td className="px-3 py-3 text-center text-white font-semibold">{row.count}</td>
                        <td className="px-3 py-3 text-center">
                          {row.critical > 0 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-red-500/15 text-red-400 text-xs font-bold">{row.critical}</span>
                          ) : (
                            <span className="text-gray-700">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {row.high > 0 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-orange-500/15 text-orange-400 text-xs font-bold">{row.high}</span>
                          ) : (
                            <span className="text-gray-700">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {row.medium > 0 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-bold">{row.medium}</span>
                          ) : (
                            <span className="text-gray-700">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {row.low > 0 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-green-500/15 text-green-400 text-xs font-bold">{row.low}</span>
                          ) : (
                            <span className="text-gray-700">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {row.repaired > 0 ? (
                            <span className="text-green-400 font-medium">{row.repaired}</span>
                          ) : (
                            <span className="text-gray-700">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right text-amber-400 font-medium">
                          ₹{(row.totalCost || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Total row */}
                  <tfoot>
                    <tr className="border-t border-white/10 bg-white/[0.02]">
                      <td className="px-5 py-3 text-primary-400 font-bold text-xs uppercase tracking-wider">Total</td>
                      <td className="px-3 py-3 text-center text-white font-bold">{summary?.totalDetections || 0}</td>
                      <td className="px-3 py-3 text-center text-red-400 font-bold">{summary?.criticalCount || 0}</td>
                      <td className="px-3 py-3 text-center text-orange-400 font-bold">{summary?.highCount || 0}</td>
                      <td className="px-3 py-3 text-center text-amber-400 font-bold">{summary?.mediumCount || 0}</td>
                      <td className="px-3 py-3 text-center text-green-400 font-bold">{summary?.lowCount || 0}</td>
                      <td className="px-3 py-3 text-center text-green-400 font-bold">{summary?.repairedCount || 0}</td>
                      <td className="px-3 py-3 text-right text-amber-400 font-bold">
                        ₹{(summary?.totalCost || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-gray-500">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No data for this period</p>
              </div>
            )}
          </div>

          {/* Top affected roads */}
          {topRoads.length > 0 && (
            <div className="glass-card overflow-hidden">
              <div className="p-5 border-b border-white/5">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary-400" />
                  Top Affected Roads
                </h2>
              </div>
              <div className="divide-y divide-white/5">
                {topRoads.map((road, i) => (
                  <div key={road.road_name} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-primary-500/15 flex items-center justify-center text-xs font-bold text-primary-400">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-300 font-medium">{road.road_name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-400">{road.count} detected</span>
                      <span className="text-amber-400 font-medium">₹{(road.totalCost || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
