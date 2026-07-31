import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Chrono, formaterHMS } from './Chrono';

afterEach(() => vi.useRealTimers());

describe('formaterHMS', () => {
  test('formate en HH:MM:SS avec padding', () => {
    expect(formaterHMS(0)).toBe('00:00:00');
    expect(formaterHMS(59)).toBe('00:00:59');
    expect(formaterHMS(3661)).toBe('01:01:01');
  });
});

describe('Chrono', () => {
  test('affiche cumul + segment écoulé depuis le début', () => {
    const now = new Date('2026-07-31T10:00:15Z').getTime();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const debut = new Date('2026-07-31T10:00:05Z').toISOString(); // 10 s avant
    render(<Chrono debut={debut} cumul={5} />); // 5 + 10 = 15 s
    expect(screen.getByText('00:00:15')).toBeInTheDocument();
  });

  test('sans début → affiche seulement le cumul', () => {
    render(<Chrono debut={null} cumul={125} />); // 2 min 05 s
    expect(screen.getByText('00:02:05')).toBeInTheDocument();
  });
});
