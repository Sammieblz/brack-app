import { request } from './state';
export * from '../back-ownership/adapters';
export const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
export const CameraResultType = { DataUrl: 'dataUrl' };
export const CameraSource = { Camera: 'CAMERA', Photos: 'PHOTOS', Prompt: 'PROMPT' };
export const Camera = { getPhoto: async (options: unknown) => { await request('avatar-pick', options); return { dataUrl: pixel, format: 'png' }; } };
export const Geolocation = {
  checkPermissions: async () => ({ location: 'granted', coarseLocation: 'granted' }),
  requestPermissions: async () => ({ location: 'granted', coarseLocation: 'granted' }),
  getCurrentPosition: async () => ({ coords: { latitude: 40.6782, longitude: -73.9442, accuracy: 10 } }),
};
export const pushNotificationsService = { isNative: () => false, register: async () => 'fixture-token', unregister: async () => undefined,
  setupListeners: () => () => undefined };
