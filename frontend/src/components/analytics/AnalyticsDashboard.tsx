import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { TrendingUp, TrendingDown, Users, DollarSign, Activity, Target } from 'lucide-react';

interface AnalyticsData {
  identityHealth: {
    totalUsers: number;
    totalIdentities: number;
    identitiesPerUser: number;
    activeIdentities: number;
    inactiveIdentities: number;
    customDomains: number;
    verifiedDomains: number;
    pendingDomains: number;
  };
  growth: {
    usersToday: number;
    usersThisWeek: number;
    usersThisMonth: number;
    identityGrowthRate: number;
    paymentGrowthRate: number;
    dailySignups: Array<{ date: string; count: number }>;
    weeklySignups: Array<{ week: string; count: number }>;
  };
  conversion: {
    freeToProConversion: number;
    freeToBusinessConversion: number;
    freeToLifetimeConversion: number;
    averageTimeToConversion: number;
    conversionFunnel: Array<{ step: string; count: number; percentage: number }>;
  };
  retention: {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
    churnRate: number;
    retentionByTier: Array<{ tier: string; retention: number }>;
  };
  revenue: {
    totalRevenueSats: number;
    totalRevenueUsd: number;
    monthlyRecurringSats: number;
    monthlyRecurringUsd: number;
    revenueByTier: Array<{ tier: string; sats: number; usd: number }>;
    lifetimeValueByTier: Array<{ tier: string; ltv: number }>;
  };
  tierDistribution: Array<{
    tier: string;
    userCount: number;
    percentage: number;
    identityCount: number;
    revenue: number;
  }>;
}

const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
}> = ({ title, value, subtitle, trend, icon }) => {
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600';
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <div className="text-purple-600">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <div className={`flex items-center text-sm ${trendColor} mt-1`}>
            {TrendIcon && <TrendIcon className="w-4 h-4 mr-1" />}
            {subtitle}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const AnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch('/api/v1/analytics/dashboard', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('nostr_token')}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading analytics...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600">Error loading analytics: {error}</div>
      </div>
    );
  }

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatSats = (sats: number) => `${sats.toLocaleString()} sats`;
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-gray-600 mt-1">Comprehensive platform metrics and insights</p>
      </div>

      {/* Identity Health */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Identity Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Users"
            value={data.identityHealth.totalUsers.toLocaleString()}
            icon={<Users className="w-5 h-5" />}
          />
          <StatCard
            title="Total Identities"
            value={data.identityHealth.totalIdentities.toLocaleString()}
            subtitle={`${data.identityHealth.identitiesPerUser.toFixed(2)} per user`}
            icon={<Activity className="w-5 h-5" />}
          />
          <StatCard
            title="Active Identities"
            value={data.identityHealth.activeIdentities.toLocaleString()}
            subtitle={`${data.identityHealth.inactiveIdentities} inactive`}
            icon={<Target className="w-5 h-5" />}
          />
          <StatCard
            title="Custom Domains"
            value={data.identityHealth.customDomains.toLocaleString()}
            subtitle={`${data.identityHealth.verifiedDomains} verified`}
            icon={<DollarSign className="w-5 h-5" />}
          />
        </div>
      </div>

      {/* Growth Metrics */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Growth</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Users Today"
            value={data.growth.usersToday.toLocaleString()}
            icon={<Users className="w-5 h-5" />}
          />
          <StatCard
            title="Users This Week"
            value={data.growth.usersThisWeek.toLocaleString()}
            icon={<Users className="w-5 h-5" />}
          />
          <StatCard
            title="Users This Month"
            value={data.growth.usersThisMonth.toLocaleString()}
            subtitle={formatPercentage(data.growth.identityGrowthRate)}
            trend={data.growth.identityGrowthRate > 0 ? 'up' : data.growth.identityGrowthRate < 0 ? 'down' : 'neutral'}
            icon={<Users className="w-5 h-5" />}
          />
          <StatCard
            title="Payment Growth"
            value={formatPercentage(data.growth.paymentGrowthRate)}
            trend={data.growth.paymentGrowthRate > 0 ? 'up' : data.growth.paymentGrowthRate < 0 ? 'down' : 'neutral'}
            icon={<DollarSign className="w-5 h-5" />}
          />
        </div>
      </div>

      {/* Conversion Metrics */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Conversion</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Free → Pro"
            value={formatPercentage(data.conversion.freeToProConversion)}
            icon={<Target className="w-5 h-5" />}
          />
          <StatCard
            title="Free → Business"
            value={formatPercentage(data.conversion.freeToBusinessConversion)}
            icon={<Target className="w-5 h-5" />}
          />
          <StatCard
            title="Free → Lifetime"
            value={formatPercentage(data.conversion.freeToLifetimeConversion)}
            icon={<Target className="w-5 h-5" />}
          />
          <StatCard
            title="Avg Time to Convert"
            value={`${data.conversion.averageTimeToConversion.toFixed(1)} days`}
            icon={<Activity className="w-5 h-5" />}
          />
        </div>

        {/* Conversion Funnel */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.conversion.conversionFunnel.map((step, index) => (
                <div key={index} className="flex items-center">
                  <div className="w-32 text-sm font-medium text-gray-700">{step.step}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                    <div
                      className="bg-purple-600 h-full flex items-center justify-end px-2 text-white text-xs font-semibold"
                      style={{ width: `${step.percentage}%` }}
                    >
                      {step.count.toLocaleString()} ({formatPercentage(step.percentage)})
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Retention */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Retention</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Daily Active Users"
            value={data.retention.dailyActiveUsers.toLocaleString()}
            icon={<Users className="w-5 h-5" />}
          />
          <StatCard
            title="Weekly Active Users"
            value={data.retention.weeklyActiveUsers.toLocaleString()}
            icon={<Users className="w-5 h-5" />}
          />
          <StatCard
            title="Monthly Active Users"
            value={data.retention.monthlyActiveUsers.toLocaleString()}
            icon={<Users className="w-5 h-5" />}
          />
          <StatCard
            title="Churn Rate"
            value={formatPercentage(data.retention.churnRate)}
            trend={data.retention.churnRate < 10 ? 'up' : 'down'}
            icon={<Activity className="w-5 h-5" />}
          />
        </div>
      </div>

      {/* Revenue */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Revenue</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Revenue (USD)"
            value={formatCurrency(data.revenue.totalRevenueUsd)}
            icon={<DollarSign className="w-5 h-5" />}
          />
          <StatCard
            title="Total Revenue (Sats)"
            value={formatSats(data.revenue.totalRevenueSats)}
            icon={<DollarSign className="w-5 h-5" />}
          />
          <StatCard
            title="MRR (USD)"
            value={formatCurrency(data.revenue.monthlyRecurringUsd)}
            icon={<DollarSign className="w-5 h-5" />}
          />
          <StatCard
            title="MRR (Sats)"
            value={formatSats(data.revenue.monthlyRecurringSats)}
            icon={<DollarSign className="w-5 h-5" />}
          />
        </div>
      </div>

      {/* Tier Distribution */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Tier Distribution</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.tierDistribution.map((tier) => (
            <Card key={tier.tier}>
              <CardHeader>
                <CardTitle className="text-sm">{tier.tier}</CardTitle>
                <CardDescription>{formatPercentage(tier.percentage)} of users</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>Users: <span className="font-semibold">{tier.userCount}</span></div>
                  <div>Identities: <span className="font-semibold">{tier.identityCount}</span></div>
                  <div>Revenue: <span className="font-semibold">{formatCurrency(tier.revenue)}</span></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
