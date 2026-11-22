import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  Award,
  Zap,
  Users,
} from 'lucide-react';

const COLORS = ['#1b4f9c', '#0284c7', '#f97316', '#84cc16', '#10b981', '#06b6d4', '#ef4444', '#8b5cf6'];

export default function SuperAdminAnalytics() {
  const [overview, setOverview] = useState(null);
  const [byCategory, setByCategory] = useState([]);
  const [byDept, setByDept] = useState([]);
  const [trends, setTrends] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const [ovRes, catRes, deptRes, trendRes, leadRes] = await Promise.all([
        fetch('/api/analytics/overview'),
        fetch('/api/analytics/by-category'),
        fetch('/api/analytics/by-department'),
        fetch('/api/analytics/trends'),
        fetch('/api/analytics/employee-performance'),
      ]);

      if (ovRes.ok) setOverview(await ovRes.json());
      if (catRes.ok) setByCategory(await catRes.json());
      if (deptRes.ok) setByDept(await deptRes.json());
      if (trendRes.ok) setTrends(await trendRes.json());
      if (leadRes.ok) setLeaderboard(await leadRes.json());
    } catch (err) {
      console.warn('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0f3166', margin: 0 }}>
          City-Wide Infrastructure Analytics & Performance
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.9375rem', margin: '4px 0 0' }}>
          Live metrics, departmental resolution rates, SLA compliance, and workforce efficiency
        </p>
      </div>

      {/* Top Level KPIs */}
      {overview && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="stat-card" style={{ borderLeft: '4px solid #1b4f9c' }}>
            <span className="stat-label">Total Reported Complaints</span>
            <span className="stat-value" style={{ color: '#0f3166' }}>{overview.total}</span>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid #16a34a' }}>
            <span className="stat-label">Resolution Rate</span>
            <span className="stat-value" style={{ color: '#16a34a' }}>
              {overview.resolution_rate}%
            </span>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid #0284c7' }}>
            <span className="stat-label">Avg. Resolution Turnaround</span>
            <span className="stat-value" style={{ color: '#0284c7' }}>
              {overview.avg_resolution_hours} <span style={{ fontSize: '14px', fontWeight: 'normal' }}>hours</span>
            </span>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid #dc2626' }}>
            <span className="stat-label">Overdue Tickets</span>
            <span className="stat-value" style={{ color: '#dc2626' }}>{overview.overdue}</span>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Trend Line Chart */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>
              7-Day Activity: Reported vs. Resolved Issues
            </h3>
          </div>
          <div style={{ width: '100%', height: '280px' }}>
            <ResponsiveContainer>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="reported" stroke="#1b4f9c" strokeWidth={3} name="Reported" />
                <Line type="monotone" dataKey="resolved" stroke="#16a34a" strokeWidth={3} name="Resolved" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Complaints by Category Chart */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Complaints by Category</h3>
          </div>
          <div style={{ width: '100%', height: '280px' }}>
            <ResponsiveContainer>
              <BarChart data={byCategory.slice(0, 5)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" stroke="#64748b" fontSize={12} />
                <YAxis dataKey="category" type="category" stroke="#64748b" fontSize={11} width={100} />
                <Tooltip />
                <Bar dataKey="total" fill="#1b4f9c" radius={[0, 4, 4, 0]} name="Total" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Department Performance & Leaderboard */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Department Resolution Efficiency */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Department Resolution Efficiency</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {byDept.map((dept) => (
              <div key={dept.department}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '600', color: '#0f172a' }}>{dept.name}</span>
                  <span style={{ fontWeight: 'bold', color: '#1b4f9c' }}>
                    {dept.resolution_rate}% ({dept.resolved}/{dept.total} fixed)
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${dept.resolution_rate}%`,
                      height: '100%',
                      background: dept.resolution_rate > 70 ? '#16a34a' : dept.resolution_rate > 40 ? '#d97706' : '#dc2626',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Employee Leaderboard */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={18} color="#eab308" />
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Field Workforce Leaderboard</h3>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {leaderboard.slice(0, 5).map((emp, idx) => (
              <div
                key={emp.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: idx === 0 ? '#fef08a' : '#e2e8f0',
                      color: idx === 0 ? '#854d0e' : '#475569',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    #{idx + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '13.5px', color: '#0f172a' }}>{emp.name}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Dept: {emp.department?.toUpperCase()}</div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#16a34a' }}>
                    {emp.completed_tasks} tasks done
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {emp.completion_rate}% success rate
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
