import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const device = vi.hoisted(() => ({
  native: true,
  supported: true,
  impact: vi.fn(), notification: vi.fn(),
  selectionStart: vi.fn(), selectionChanged: vi.fn(), selectionEnd: vi.fn(),
  vibrate: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: {
  isNativePlatform: () => device.native,
  isPluginAvailable: () => device.supported,
} }));
vi.mock('@capacitor/haptics', () => ({
  Haptics: device,
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
  NotificationType: { Success: 'SUCCESS', Error: 'ERROR' },
}));
import { useHapticFeedback } from './useHapticFeedback';

beforeEach(() => {
  vi.resetAllMocks();
  device.native = true;
  device.supported = true;
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: device.vibrate });
  Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { hasBeenActive: true } });
});

describe('semantic haptic boundary', () => {
  it('uses a complete selection lifecycle rather than an impact', async () => {
    const { result } = renderHook(() => useHapticFeedback());
    await act(() => result.current.triggerHaptic('selection'));
    expect(device.selectionStart).toHaveBeenCalledOnce();
    expect(device.selectionChanged).toHaveBeenCalledOnce();
    expect(device.selectionEnd).toHaveBeenCalledOnce();
    expect(device.impact).not.toHaveBeenCalled();
  });

  it('serializes overlapping selection lifecycles', async () => {
    const events: string[] = [];
    device.selectionStart.mockImplementation(async () => { events.push('start'); });
    device.selectionChanged.mockImplementation(async () => { events.push('change'); });
    device.selectionEnd.mockImplementation(async () => { events.push('end'); });
    const { result } = renderHook(() => useHapticFeedback());
    await act(() => Promise.all([result.current.triggerHaptic('selection'), result.current.triggerHaptic('selection')]));
    expect(events).toEqual(['start', 'change', 'end', 'start', 'change', 'end']);
  });

  it('releases a failed selection and still handles the next action', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    device.selectionChanged.mockRejectedValueOnce(new Error('device unavailable'));
    const { result } = renderHook(() => useHapticFeedback());
    await act(() => result.current.triggerHaptic('selection'));
    expect(device.selectionEnd).toHaveBeenCalledOnce();
    await act(() => result.current.triggerHaptic('selection'));
    expect(device.selectionEnd).toHaveBeenCalledTimes(2);
    debug.mockRestore();
  });

  it('attempts cleanup even if native selection preparation rejects', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    device.selectionStart.mockRejectedValueOnce(new Error('native start interrupted'));
    const { result } = renderHook(() => useHapticFeedback());
    await act(() => result.current.triggerHaptic('selection'));
    expect(device.selectionChanged).not.toHaveBeenCalled();
    expect(device.selectionEnd).toHaveBeenCalledOnce();
    debug.mockRestore();
  });

  it.each([['light', 'LIGHT'], ['medium', 'MEDIUM'], ['heavy', 'HEAVY']] as const)('keeps %s impacts explicit', async (pattern, style) => {
    const { result } = renderHook(() => useHapticFeedback());
    await act(() => result.current.triggerHaptic(pattern));
    expect(device.impact).toHaveBeenCalledExactlyOnceWith({ style });
  });

  it.each([['success', 'SUCCESS'], ['error', 'ERROR']] as const)('keeps %s outcome feedback semantic', async (pattern, type) => {
    const { result } = renderHook(() => useHapticFeedback());
    await act(() => result.current.triggerHaptic(pattern));
    expect(device.notification).toHaveBeenCalledExactlyOnceWith({ type });
  });

  it('honors an opt-out immediately after rerender without a stale callback', async () => {
    const { result, rerender } = renderHook(({ enabled }) => useHapticFeedback({ enabled }), { initialProps: { enabled: true } });
    const trigger = result.current.triggerHaptic;
    rerender({ enabled: false });
    await act(() => trigger('selection'));
    expect(device.selectionStart).not.toHaveBeenCalled();
    expect(device.impact).not.toHaveBeenCalled();
    expect(device.vibrate).not.toHaveBeenCalled();
  });

  it('does nothing when the native plugin is unavailable', async () => {
    device.supported = false;
    const { result } = renderHook(() => useHapticFeedback());
    await act(() => result.current.triggerHaptic('selection'));
    expect(device.selectionStart).not.toHaveBeenCalled();
    expect(device.vibrate).not.toHaveBeenCalled();
  });

  it('keeps web selection short and skips it before activation or without support', async () => {
    device.native = false;
    const { result } = renderHook(() => useHapticFeedback());
    await act(() => result.current.triggerHaptic('selection'));
    expect(device.vibrate).toHaveBeenCalledExactlyOnceWith(5);
    Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { hasBeenActive: false } });
    await act(() => result.current.triggerHaptic('selection'));
    expect(device.vibrate).toHaveBeenCalledOnce();
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: undefined });
    await expect(result.current.triggerHaptic('selection')).resolves.toBeUndefined();
  });
});
