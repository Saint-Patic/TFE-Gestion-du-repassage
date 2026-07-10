import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext';
import App from './App';

beforeEach(() => sessionStorage.clear());

function rendre() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('App', () => {
  test('redirige vers la connexion sans session', async () => {
    rendre();
    expect(await screen.findByText('La Manne à Bulles')).toBeInTheDocument();
  });
});
