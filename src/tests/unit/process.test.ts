import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock find-process module
vi.mock('find-process', () => ({
  default: vi.fn(),
}));

// Mock logger to avoid console output during tests
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock paths module to avoid child_process issues
vi.mock('../../utils/paths', () => ({
  getAntigravityExecutablePath: vi.fn(() => '/path/to/antigravity'),
  isWsl: vi.fn(() => false),
}));

// Import after mocks are set up
import {
  isProcessRunning,
  closeAntigravity,
  startAntigravity,
  resetProcessCache,
} from '../../ipc/process/handler';
import findProcess from 'find-process';

describe('Process Handler', () => {
  const mockFindProcess = findProcess as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset cache before each test
    resetProcessCache();
  });

  describe('isProcessRunning', () => {
    it('should return true when Antigravity main process is found on macOS', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      Object.defineProperty(process, 'pid', { value: 1000, configurable: true });

      mockFindProcess.mockResolvedValue([
        {
          pid: 12345,
          name: 'Antigravity',
          cmd: '/Applications/Antigravity.app/Contents/MacOS/Antigravity',
        },
      ]);

      const result = await isProcessRunning();
      expect(result).toBe(true);
      // Now uses single case-insensitive search
      expect(mockFindProcess).toHaveBeenCalledWith('name', 'antigravity', true);
    });

    it('should return false when only helper processes are found', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      Object.defineProperty(process, 'pid', { value: 1000, configurable: true });

      mockFindProcess.mockResolvedValue([
        {
          pid: 12346,
          name: 'Antigravity Helper (Renderer)',
          cmd: '/Applications/Antigravity.app/Contents/Frameworks/Antigravity Helper (Renderer).app --type=renderer',
        },
        {
          pid: 12347,
          name: 'Antigravity Helper (GPU)',
          cmd: '/Applications/Antigravity.app/Contents/Frameworks/Antigravity Helper (GPU).app --type=gpu-process',
        },
      ]);

      const result = await isProcessRunning();
      expect(result).toBe(false);
    });

    it('should return false when only manager process is found', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      Object.defineProperty(process, 'pid', { value: 1000, configurable: true });

      mockFindProcess.mockResolvedValue([
        {
          pid: 12348,
          name: 'Antigravity Manager',
          cmd: '/Applications/Antigravity Manager.app/Contents/MacOS/Antigravity Manager',
        },
      ]);

      const result = await isProcessRunning();
      expect(result).toBe(false);
    });

    it('should return false when no processes are found', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      Object.defineProperty(process, 'pid', { value: 1000, configurable: true });

      mockFindProcess.mockResolvedValue([]);

      const result = await isProcessRunning();
      expect(result).toBe(false);
    });

    it('should skip self process', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      Object.defineProperty(process, 'pid', { value: 12345, configurable: true });

      mockFindProcess.mockResolvedValue([
        {
          pid: 12345, // Same as current PID
          name: 'Antigravity',
          cmd: '/Applications/Antigravity.app/Contents/MacOS/Antigravity',
        },
      ]);

      const result = await isProcessRunning();
      expect(result).toBe(false);
    });

    it('should return true when Antigravity.exe is found on Windows', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      Object.defineProperty(process, 'pid', { value: 1000, configurable: true });

      mockFindProcess.mockResolvedValue([
        {
          pid: 12345,
          name: 'Antigravity.exe',
          cmd: 'C:\\Program Files\\Antigravity\\Antigravity.exe',
        },
      ]);

      const result = await isProcessRunning();
      expect(result).toBe(true);
    });

    it('should return true when antigravity is found on Linux', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      Object.defineProperty(process, 'pid', { value: 1000, configurable: true });

      mockFindProcess.mockResolvedValue([
        {
          pid: 12345,
          name: 'antigravity',
          cmd: '/usr/bin/antigravity',
        },
      ]);

      const result = await isProcessRunning();
      expect(result).toBe(true);
    });

    it('should handle find-process errors gracefully', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      Object.defineProperty(process, 'pid', { value: 1000, configurable: true });

      mockFindProcess.mockRejectedValue(new Error('Process enumeration failed'));

      const result = await isProcessRunning();
      expect(result).toBe(false);
    });

    it('should exclude processes with --type= argument', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      Object.defineProperty(process, 'pid', { value: 1000, configurable: true });

      mockFindProcess.mockResolvedValue([
        {
          pid: 12345,
          name: 'Antigravity',
          cmd: '/Applications/Antigravity.app/Contents/MacOS/Antigravity --type=utility',
        },
      ]);

      const result = await isProcessRunning();
      expect(result).toBe(false);
    });
  });

  describe('Caching and Rate Limiting', () => {
    it('should use rate limiting to prevent rapid subprocess calls', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      Object.defineProperty(process, 'pid', { value: 1000, configurable: true });

      mockFindProcess.mockResolvedValue([
        {
          pid: 12345,
          name: 'Antigravity',
          cmd: '/Applications/Antigravity.app/Contents/MacOS/Antigravity',
        },
      ]);

      // First call should execute the subprocess search
      const result1 = await isProcessRunning();
      expect(result1).toBe(true);
      expect(mockFindProcess).toHaveBeenCalledTimes(1);

      // Immediate second call within MIN_CALL_INTERVAL (5s) should be rate limited
      // and return cached value without calling subprocess
      const result2 = await isProcessRunning();
      expect(result2).toBe(true);
      expect(mockFindProcess).toHaveBeenCalledTimes(1);

      // Third immediate call should also be rate limited
      const result3 = await isProcessRunning();
      expect(result3).toBe(true);
      expect(mockFindProcess).toHaveBeenCalledTimes(1);
    });

    it('should return false when error occurs and no cache exists', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      Object.defineProperty(process, 'pid', { value: 1000, configurable: true });

      // Simulate error on first call with no prior cache
      mockFindProcess.mockRejectedValue(new Error('Network error'));

      const result = await isProcessRunning();
      // No cache available, should return false
      expect(result).toBe(false);
    });

    it('should reset cache correctly allowing fresh subprocess query', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      Object.defineProperty(process, 'pid', { value: 1000, configurable: true });

      mockFindProcess.mockResolvedValue([
        {
          pid: 12345,
          name: 'Antigravity',
          cmd: '/Applications/Antigravity.app/Contents/MacOS/Antigravity',
        },
      ]);

      await isProcessRunning();
      expect(mockFindProcess).toHaveBeenCalledTimes(1);

      // Reset cache to clear rate limiting and cache state
      resetProcessCache();

      // Next call should execute a fresh subprocess query
      await isProcessRunning();
      expect(mockFindProcess).toHaveBeenCalledTimes(2);
    });

    it('should execute fresh query on first call even without prior cache', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      Object.defineProperty(process, 'pid', { value: 1000, configurable: true });

      // Ensure no prior cache exists
      resetProcessCache();

      mockFindProcess.mockResolvedValue([]);

      // First call should execute fresh query even though rate limiting
      // could theoretically apply (due to timestamp being 0)
      const result = await isProcessRunning();
      expect(result).toBe(false);
      expect(mockFindProcess).toHaveBeenCalledTimes(1);
    });
  });

  describe('Module exports', () => {
    it('should export all required functions', () => {
      expect(isProcessRunning).toBeDefined();
      expect(closeAntigravity).toBeDefined();
      expect(startAntigravity).toBeDefined();
      expect(resetProcessCache).toBeDefined();
    });
  });
});
