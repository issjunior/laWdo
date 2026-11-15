import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeQueryMock = vi.fn();
vi.mock('../../main/database/sqlite.js', () => ({
  executeQuery: (...args: unknown[]) => executeQueryMock(...args),
  executeNonQuery: vi.fn(),
}));
vi.mock('../../main/utils/logger.js', () => ({ getLogger: () => ({ error: vi.fn() }) }));

import { listAuditLogs } from '../../main/services/audit-log.service';

describe('audit-log.service', () => {
  beforeEach(() => executeQueryMock.mockReset());

  it('retorna cursor estável e usa-o para avançar entre empates de timestamp', async () => {
    executeQueryMock.mockResolvedValueOnce([
      { id: 9, created_at: '2026-11-14T22:00:00.000Z' },
      { id: 8, created_at: '2026-11-14T22:00:00.000Z' },
    ]);
    const primeira = await listAuditLogs({ limit: 1 });

    expect(primeira.data).toEqual([{ id: 9, created_at: '2026-11-14T22:00:00.000Z' }]);
    expect(primeira.temProxima).toBe(true);
    expect(primeira.proximoCursor).toBeDefined();

    executeQueryMock.mockResolvedValueOnce([]);
    await listAuditLogs({ limit: 1, cursor: primeira.proximoCursor });
    expect(executeQueryMock.mock.calls[1]?.[0]).toContain('(created_at < ? OR (created_at = ? AND id < ?))');
    expect(executeQueryMock.mock.calls[1]?.[1]).toEqual([
      '2026-11-14T22:00:00.000Z', '2026-11-14T22:00:00.000Z', 9, 2,
    ]);
  });

  it('aplica intervalo de data sem função sobre a coluna', async () => {
    executeQueryMock.mockResolvedValueOnce([]);
    await listAuditLogs({ startDate: '2026-11-01', endDate: '2026-11-30' });
    expect(executeQueryMock.mock.calls[0]?.[0]).toContain('created_at >= ?');
    expect(executeQueryMock.mock.calls[0]?.[0]).toContain('created_at < ?');
    expect(executeQueryMock.mock.calls[0]?.[1]).toEqual(['2026-11-01', '2026-12-01', 201]);
  });
});
