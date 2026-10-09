import { describe, expect, it } from 'vitest';
import { harness, actor } from './helpers/chat-command-harness.js';

describe('R1065 command presentation', () => {
  it.each(['!vote', '!votes'])('routes %s to the same vote consultation', async command => {
    const h = harness(); await h.send(command);
    expect(h.services.bannerVotes.getCurrent).toHaveBeenCalled();
    expect(h.services.bannerVotes.vote).not.toHaveBeenCalled();
  });
  it.each(['!vote', '!votes'])('routes %s choice to the canonical owner', async command => {
    const h = harness(); await h.send(`${command} Candidat`);
    expect(h.services.bannerVotes.vote).toHaveBeenCalledWith(actor, 'candidate', 'rotation', 'INTERNAL_CHAT');
  });
  it.each([1n, 97961656n, 123456789012345678901234567890n])('formats bank BigInt %s without changing its value', async amount => {
    const h = harness();
    h.services.getCurrentPlayerBank.execute.mockResolvedValue({ bankMoras: amount, walletMoras: 3816895n, estimatedInterest: 2938849n } as never);
    const text = await h.send('!banque');
    expect(text).toContain(amount.toLocaleString('fr-FR').replace(/[\u00a0\u202f]/gu, ' '));
    expect(text).toContain('3 816 895'); expect(text).toContain('+2 938 849');
  });
  it.each([undefined, 0n, 1n, 12345678901234567890n])('reads Stella %s from the already loaded inventory', async quantity => {
    const h = harness();
    h.services.getCurrentPlayerInventory.execute.mockResolvedValue({ resources: [], items: quantity === undefined ? [] : [{ externalKey: 'masterless-stella-fortuna', quantity }] } as never);
    const text = await h.send('!sac');
    if (quantity) expect(text).toContain(`✨ Masterless Stella Fortuna : ${quantity.toLocaleString('fr-FR').replace(/[\u00a0\u202f]/gu, ' ')}`);
    else expect(text).not.toContain('Stella');
    expect(h.services.getCurrentPlayerInventory.execute).toHaveBeenCalledTimes(1);
    expect(h.services.getCurrentPlayerBox.execute).not.toHaveBeenCalled();
  });
});
