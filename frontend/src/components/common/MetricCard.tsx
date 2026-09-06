import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean; // positive = good green, negative = bad red
  };
  variant?: 'light' | 'dark';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'light',
}) => {
  const isDark = variant === 'dark';

  return (
    <div
      className={isDark ? 'card-dark-accent' : 'card-standard'}
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '140px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: isDark ? '#9CA3AF' : '#4B5563',
          }}
        >
          {title}
        </span>
        {Icon && (
          <div
            style={{
              padding: '6px',
              borderRadius: '8px',
              backgroundColor: isDark ? '#1F2937' : '#F1F3F5',
              color: isDark ? '#F9FAFB' : '#111827',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={18} strokeWidth={2} />
          </div>
        )}
      </div>

      <div style={{ margin: '10px 0 6px 0' }}>
        <span
          style={{
            fontSize: '28px',
            fontWeight: 700,
            color: isDark ? '#F9FAFB' : '#111827',
            lineHeight: 1.1,
          }}
        >
          {value}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {trend && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              fontSize: '12px',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: '6px',
              backgroundColor: trend.isPositive ? '#EBFBEE' : '#FFF5F5',
              border: `1px solid ${trend.isPositive ? '#2B8A3E' : '#C92A2A'}`,
              color: trend.isPositive ? '#1B5E20' : '#961C1C',
            }}
          >
            {trend.isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trend.value}
          </span>
        )}
        {subtitle && (
          <span
            style={{
              fontSize: '12px',
              color: isDark ? '#9CA3AF' : '#6B7280',
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};
