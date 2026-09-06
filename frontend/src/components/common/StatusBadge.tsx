import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';

interface StatusBadgeProps {
  status: 'verified' | 'active' | 'healthy' | 'pending' | 'warning' | 'action_required' | 'danger' | 'critical' | 'offline' | 'incorrect' | 'missing' | 'info';
  label?: string;
  icon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, icon = true }) => {
  let badgeClass = 'badge-info';
  let IconComponent = Info;
  let displayText = label || status.replace('_', ' ').toUpperCase();

  switch (status) {
    case 'verified':
    case 'active':
    case 'healthy':
      badgeClass = 'badge-success';
      IconComponent = CheckCircle2;
      break;
    case 'pending':
    case 'warning':
    case 'action_required':
      badgeClass = 'badge-warning';
      IconComponent = AlertTriangle;
      break;
    case 'danger':
    case 'critical':
    case 'offline':
    case 'incorrect':
    case 'missing':
      badgeClass = 'badge-danger';
      IconComponent = XCircle;
      break;
    default:
      badgeClass = 'badge-info';
      IconComponent = Info;
  }

  return (
    <span className={`badge-status ${badgeClass}`}>
      {icon && <IconComponent size={13} strokeWidth={2.2} />}
      <span>{displayText}</span>
    </span>
  );
};
