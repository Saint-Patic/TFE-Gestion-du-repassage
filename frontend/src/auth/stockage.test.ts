import { describe, test, expect, beforeEach } from 'vitest';
import { lireJeton, ecrireJeton, effacerJeton } from './stockage';

beforeEach(() => sessionStorage.clear());

describe('stockage du jeton', () => {
  test('écrit puis lit le jeton', () => {
    ecrireJeton('abc');
    expect(lireJeton()).toBe('abc');
  });
  test('efface le jeton', () => {
    ecrireJeton('abc');
    effacerJeton();
    expect(lireJeton()).toBeNull();
  });
});
