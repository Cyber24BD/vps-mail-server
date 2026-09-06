import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { StatusBadge } from '../common/StatusBadge';
import { SkeletonCard } from '../common/SkeletonCard';
import type { SystemHealthOverview } from '../../types';


export const DiagnosticsView: React.FC = () => {
  const [health, setHealth] = useState<SystemHealthOverview | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [h, l] = await Promise.all([
        api.getSystemHealth(),
        fetch('/api/v1/logs/?limit=20', {
          headers: { Authorization: `Bearer ${localStorage.getItem('corpmail_token')}` },
        }).then((res) => res.json()).catch(() => []),
      ]);
      setHealth(h);
      setLogs(Array.isArray(l) ? l : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return <SkeletonCard lines={6} height="350px" />;
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* View Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>System Diagnostics & Audit Trails</h2>
          <p style={{ fontSize: '13px', color: '#6B7280' }}>
            Low-level socket latency probes, self-healing diagnostic engine, and administrator audit log records.
          </p>
        </div>
        <button className="btn-secondary" onClick={handleRefresh}>
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>Run Probes</span>
        </button>
      </div>

      {/* Socket Latency Probes */}
      <div className="card-standard" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '16px' }}>
          Real-Time Service Response Probes
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
          {health?.services.map((svc) => (
            <div
              key={svc.name}
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: '#F8F9FA',
                border: '1px solid #E5E7EB',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{svc.name}</span>
                <div style={{ fontSize: '12px', color: '#6B7280' }}>{svc.details}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {svc.response_time_ms !== null && svc.response_time_ms !== undefined && (
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#4B5563' }}>
                    {svc.response_time_ms} ms
                  </span>
                )}
                <StatusBadge status={svc.status} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="card-standard" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={17} />
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Administrator Audit Trail</h3>
        </div>

        {logs.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: '#6B7280', fontSize: '13px' }}>
            No audit records yet. All administrative actions (domain changes, password updates, quota edits) are permanently recorded here.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8F9FA', borderBottom: '1.5px solid #E5E7EB' }}>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: '#4B5563' }}>Actor</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: '#4B5563' }}>Action</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: '#4B5563' }}>Resource</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: '#4B5563', textAlign: 'right' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #F1F3F5' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>{log.actor}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '2px 6px', backgroundColor: '#E5E7EB', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#4B5563' }}>{log.resource_type}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#6B7280', fontSize: '12px' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
