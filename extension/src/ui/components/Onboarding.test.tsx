import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Onboarding } from './Onboarding';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

describe('Onboarding', () => {
  it('renders the first slide initially', () => {
    render(<Onboarding onFinish={vi.fn()} />);
    expect(screen.getByText('Welcome to Arcline')).toBeDefined();
    expect(screen.getByText('Next')).toBeDefined();
  });

  it('navigates through slides', () => {
    render(<Onboarding onFinish={vi.fn()} />);

    // First slide
    expect(screen.getByText('Welcome to Arcline')).toBeDefined();

    // Click Next -> Second slide (Spaces & Tabs)
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Spaces & Tabs')).toBeDefined();

    // Click Next -> Third slide (Auto Archive)
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Auto Archive')).toBeDefined();

    // Click Next -> Fourth slide (Ready to Go)
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Ready to Go?')).toBeDefined();
    expect(screen.getByText('Get Started')).toBeDefined();
  });

  it('calls onFinish when clicking Get Started', () => {
    const onFinish = vi.fn();
    render(<Onboarding onFinish={onFinish} />);

    // Fast forward to last slide (3 clicks)
    const button = screen.getByRole('button');
    fireEvent.click(button); // 2
    fireEvent.click(button); // 3
    fireEvent.click(button); // 4

    expect(screen.getByText('Get Started')).toBeDefined();

    // Click Get Started
    fireEvent.click(screen.getByText('Get Started'));

    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
