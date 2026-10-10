import { TicketCode } from '../../domain/value-objects/ticket-code';
import { CryptoTicketCodeGenerator } from './crypto-ticket-code-generator';

describe('CryptoTicketCodeGenerator (RN-012)', () => {
  it('generates valid, unambiguous XXXX-XXXX-XXXX codes', () => {
    const generator = new CryptoTicketCodeGenerator();
    const codes = Array.from({ length: 500 }, () => generator.generate());
    for (const code of codes) {
      expect(code).toBeInstanceOf(TicketCode);
      expect(code.reveal()).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(code.reveal()).not.toMatch(/[01OIL]/);
    }
    expect(new Set(codes.map((code) => code.reveal())).size).toBe(codes.length);
  });
});
