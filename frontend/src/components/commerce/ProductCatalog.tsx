import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Check, Zap, Shield, Crown, AlertCircle } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  priceUsd: number;
  priceSats: number;
  tier: string;
  billingCycle?: 'monthly' | 'annual' | 'lifetime';
  features: string[];
  popular?: boolean;
}

interface CommerceConfig {
  provider: string;
  ready: boolean;
  features: string[];
}

const ProductCatalog: React.FC<{ onSelectProduct?: (productId: string) => void }> = ({ onSelectProduct }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [config, setConfig] = useState<CommerceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const [productsRes, configRes] = await Promise.all([
          fetch('/api/v1/commerce/products'),
          fetch('/api/v1/commerce/config'),
        ]);

        if (!productsRes.ok || !configRes.ok) {
          throw new Error('Failed to fetch product catalog');
        }

        const productsData = await productsRes.json();
        const configData = await configRes.json();

        setProducts(productsData.products || []);
        setConfig(configData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatSats = (sats: number) => sats.toLocaleString();

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'FREE':
        return <Zap className="w-6 h-6 text-gray-600" />;
      case 'PRO':
        return <Shield className="w-6 h-6 text-purple-600" />;
      case 'BUSINESS':
        return <Crown className="w-6 h-6 text-yellow-600" />;
      case 'LIFETIME':
        return <Crown className="w-6 h-6 text-blue-600" />;
      default:
        return null;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'FREE':
        return 'border-gray-300';
      case 'PRO':
        return 'border-purple-500';
      case 'BUSINESS':
        return 'border-yellow-500';
      case 'LIFETIME':
        return 'border-blue-500';
      default:
        return 'border-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading product catalog...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!config?.ready) {
    return (
      <div className="flex items-center justify-center h-64 text-center">
        <div>
          <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">Payment System Not Ready</h3>
          <p className="text-gray-600 mt-2">
            The {config?.provider || 'payment'} provider is not fully configured.
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Please contact support to enable payments.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900">Choose Your Plan</h2>
        <p className="text-gray-600 mt-2">
          Select the perfect plan for your Nostr identity needs
        </p>
        {config && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
            <Shield className="w-4 h-4" />
            <span>Powered by {config.provider}</span>
            <span>•</span>
            <span>{config.features.join(', ')}</span>
          </div>
        )}
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product) => (
          <Card
            key={product.id}
            className={`relative ${getTierColor(product.tier)} border-2 ${
              product.popular ? 'shadow-lg scale-105' : ''
            } hover:shadow-xl transition-all`}
          >
            {product.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                  POPULAR
                </span>
              </div>
            )}

            <CardHeader className="text-center">
              <div className="flex justify-center mb-2">{getTierIcon(product.tier)}</div>
              <CardTitle className="text-xl">{product.name}</CardTitle>
              <CardDescription className="text-sm">{product.description}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Pricing */}
              <div className="text-center border-t border-b py-4">
                <div className="text-3xl font-bold text-gray-900">
                  {product.priceUsd === 0 ? 'Free' : formatPrice(product.priceUsd)}
                </div>
                {product.priceSats > 0 && (
                  <div className="text-sm text-gray-600 mt-1">
                    {formatSats(product.priceSats)} sats
                  </div>
                )}
                {product.billingCycle && (
                  <div className="text-xs text-gray-500 mt-1">
                    {product.billingCycle === 'monthly' && 'per month'}
                    {product.billingCycle === 'annual' && 'per year'}
                    {product.billingCycle === 'lifetime' && 'one-time'}
                  </div>
                )}
              </div>

              {/* Features */}
              <div className="space-y-2">
                {product.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>

            <CardFooter>
              <Button
                className="w-full"
                variant={product.popular ? 'default' : 'outline'}
                onClick={() => onSelectProduct?.(product.id)}
                disabled={product.tier === 'FREE'}
              >
                {product.tier === 'FREE' ? 'Current Plan' : 'Select Plan'}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Annual Savings Banner */}
      {products.some((p) => p.billingCycle === 'annual') && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
          <p className="text-purple-900 font-semibold">💰 Save up to 17% with annual billing!</p>
          <p className="text-purple-700 text-sm mt-1">
            Get 2 months free when you choose an annual plan
          </p>
        </div>
      )}

      {/* Provider Features */}
      {config && (
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {config.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                <span className="text-gray-700 capitalize">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductCatalog;
