import { TicketCode } from '../../domain/value-objects/ticket-code';
import { HmacTicketCodeHasher } from './hmac-ticket-code-hasher';

const SECRET = 'a-very-long-server-secret-for-tests-0123456789';

describe('HmacTicketCodeHasher (RN-012)', () => {
  const code = TicketCode.create('ABCD-EFGH-JKMN');

  it('is deterministic so the door can find the ticket by its hash', async () => {
    const hasher = new HmacTicketCodeHasher(SECRET);
    expect((await hasher.hash(code)).equals(await hasher.hash(TicketCode.create('abcd-efgh-jkmn')))).toBe(true);
  });

  it('never contains the code and depends on the server secret', async () => {
    const hash = await new HmacTicketCodeHasher(SECRET).hash(code);
    const otherSecret = await new HmacTicketCodeHasher(`${SECRET}-other`).hash(code);
    expect(hash.value).toMatch(/^[0-9a-f]{64}$/);
    expect(hash.value).not.toContain('ABCD');
    expect(hash.equals(otherSecret)).toBe(false);
  });

  it('refuses a short secret', () => {
    expect(() => new HmacTicketCodeHasher('short')).toThrow(/at least 32/);
  });
});
