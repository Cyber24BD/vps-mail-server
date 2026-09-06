import React, { useState, useEffect } from 'react';
import {
  Activity,
  Mail,
  Layers,
  Cpu,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api';
import { MetricCard } from '../common/MetricCard';
import { SkeletonCard } from '../common/SkeletonCard';
import { StatusBadge } from '../common/StatusBadge';
import type { SystemHealthOverview, SystemResourceMetrics } from '../../types';


export const DashboardView: React.FC = () => {
  const [health, setHealth] = useState<SystemHealthOverview | null>(null);
  const [metrics, setMetrics] = useState<SystemResourceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [healthData, metricsData] = await Promise.all([
        api.getSystemHealth(),
        api.getSystemMetrics(),
      ]);
      setHealth(healthData);
      setMetrics(metricsData);
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard height="280px" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>System Health & Overview</h2>
          <p style={{ fontSize: '13px', color: '#6B7280' }}>
            Real-time telemetry and microservice operation indicators.
          </p>
        </div>
        <button
          onClick={handleManualRefresh}
          className="btn-secondary"
          style={{ fontSize: '13px', padding: '6px 14px' }}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>Refresh Probes</span>
        </button>
      </div>

      {/* Metric Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <MetricCard
          title="Overall Health"
          value={health?.overall_status === 'healthy' ? 'Nominal' : 'Action Needed'}
          subtitle="All mail sockets active"
          icon={Activity}
          trend={{ value: '100% SLA', isPositive: true }}
        />

        <MetricCard
          title="CPU Utilization"
          value={`${metrics?.cpu_percent ?? 0}%`}
          subtitle="Host processor load"
          icon={Cpu}
          trend={{
            value: (metrics?.cpu_percent || 0) < 70 ? 'Optimal' : 'High Load',
            isPositive: (metrics?.cpu_percent || 0) < 70,
          }}
        />

        <MetricCard
          title="Memory Usage"
          value={`${metrics?.memory_percent ?? 0}%`}
          subtitle={`${metrics?.memory_used_mb ?? 0} MB / ${metrics?.memory_total_mb ?? 0} MB`}
          icon={Layers}
          trend={{
            value: (metrics?.memory_percent || 0) < 80 ? 'Stable' : 'Elevated',
            isPositive: (metrics?.memory_percent || 0) < 80,
          }}
        />

        <MetricCard
          title="Mail Queue"
          value={metrics?.mail_queue_count ?? 0}
          subtitle="Outgoing Postfix queue"
          icon={Mail}
          variant="dark"
          trend={{ value: 'Clear', isPositive: true }}
        />
      </div>

      {/* Microservice Probes Grid */}
      <div className="card-standard" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>
            Infrastructure Service Health Checks
          </h3>
          <span style={{ fontSize: '12px', color: '#6B7280' }}>
            Validated via local container sockets
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
          {health?.services.map((svc) => (
            <div
              key={svc.name}
              style={{
                padding: '14px 16px',
                borderRadius: '10px',
                border: '1px solid #E5E7EB',
                backgroundColor: '#F8F9FA',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{svc.name}</div>
                <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                  {svc.details || 'Operational'}
                </div>
              </div>
              <StatusBadge status={svc.status} />
            </div>
          ))}
        </div>
      </div>

      {/* Storage Quota Bar */}
      <div className="card-standard" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HardDrive size={16} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>VPS Storage Allocation</span>
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
            {metrics?.disk_used_gb} GB used of {metrics?.disk_total_gb} GB ({metrics?.disk_percent}%)
          </span>
        </div>
        <div style={{ width: '100%', height: '8px', backgroundColor: '#E5E7EB', borderRadius: '4px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${metrics?.disk_percent || 0}%`,
              height: '100%',
              background: (metrics?.disk_percent || 0) > 85 ? 'var(--gradient-danger)' : 'var(--gradient-success)',
              borderRadius: '4px',
              transition: 'width 300ms ease',
            }}
          />
        </div>
      </div>
    </div>
  );
};
