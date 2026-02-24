import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { PostPaymentWizard } from '../components/onboarding/PostPaymentWizard';

const mockOnComplete = vi.fn();

const renderWizard = (tier: 'PRO' | 'BUSINESS' | 'LIFETIME' = 'PRO') => {
  return render(
    <BrowserRouter>
      <PostPaymentWizard
        tier={tier}
        paymentId="test-payment-123"
        onComplete={mockOnComplete}
      />
    </BrowserRouter>
  );
};

describe('PostPaymentWizard', () => {
  it('renders success step initially', () => {
    renderWizard();
    expect(screen.getByText('Payment Confirmed!')).toBeInTheDocument();
    expect(screen.getByText(/Welcome to PRO/)).toBeInTheDocument();
  });

  it('shows correct tier in success message', () => {
    renderWizard('LIFETIME');
    expect(screen.getByText(/Welcome to Lifetime/)).toBeInTheDocument();
  });

  it('displays progress steps', () => {
    renderWizard();
    expect(screen.getByText('Payment Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Claim Your Identity')).toBeInTheDocument();
    expect(screen.getByText('Configure Nostr Client')).toBeInTheDocument();
  });

  it('advances to next step when clicking continue', () => {
    renderWizard();
    const continueButton = screen.getByRole('button', { name: /Let's Go!/i });
    fireEvent.click(continueButton);
    expect(screen.getByText('Claim Your NIP-05 Identity')).toBeInTheDocument();
  });

  it('shows BYOD option for PRO tier', () => {
    renderWizard('PRO');
    const continueButton = screen.getByRole('button', { name: /Let's Go!/i });
    fireEvent.click(continueButton);
    expect(screen.getByText(/Custom Domain/)).toBeInTheDocument();
  });

  it('does not show BYOD option for FREE tier', () => {
    renderWizard('FREE' as any);
    const continueButton = screen.getByRole('button', { name: /Let's Go!/i });
    fireEvent.click(continueButton);
    expect(screen.queryByText(/Custom Domain/)).not.toBeInTheDocument();
  });

  it('allows skipping onboarding flow', () => {
    renderWizard();
    const continueButton = screen.getByRole('button', { name: /Let's Go!/i });
    fireEvent.click(continueButton);
    
    const laterButton = screen.getByRole('button', { name: /I'll Do This Later/i });
    fireEvent.click(laterButton);
    
    expect(screen.getByText("You're All Set!")).toBeInTheDocument();
  });

  it('calls onComplete when finishing wizard', () => {
    renderWizard();
    
    // Navigate through all steps
    fireEvent.click(screen.getByRole('button', { name: /Let's Go!/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /Got It!/i }));
    fireEvent.click(screen.getByRole('button', { name: /Go to Dashboard/i }));
    
    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('shows client configuration instructions', () => {
    renderWizard();
    
    // Navigate to config step
    fireEvent.click(screen.getByRole('button', { name: /Let's Go!/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    
    expect(screen.getByText('Damus (iOS)')).toBeInTheDocument();
    expect(screen.getByText('Amethyst (Android)')).toBeInTheDocument();
    expect(screen.getByText(/Primal/)).toBeInTheDocument();
  });

  it('displays receipt link in success step', () => {
    renderWizard();
    expect(screen.getByText(/View Receipt/)).toBeInTheDocument();
  });

  it('shows quick links on final step', () => {
    renderWizard();
    
    // Skip to final step
    fireEvent.click(screen.getByRole('button', { name: /Let's Go!/i }));
    fireEvent.click(screen.getByRole('button', { name: /I'll Do This Later/i }));
    
    expect(screen.getByText('📊 Dashboard')).toBeInTheDocument();
    expect(screen.getByText('🆔 Claim Identity')).toBeInTheDocument();
    expect(screen.getByText('💳 Subscription')).toBeInTheDocument();
    expect(screen.getByText('🧾 Receipt')).toBeInTheDocument();
  });
});
