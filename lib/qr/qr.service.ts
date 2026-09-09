import crypto from 'node:crypto';
import QRCode from 'qrcode';
export function registrationToken(registrationId: string) { const secret = process.env.REGISTRATION_QR_SECRET; if (!secret) throw new Error('Registration QR is not configured'); return crypto.createHmac('sha256', secret).update(registrationId).digest('hex'); }
export function verifyRegistrationToken(registrationId: string, token: string) { const expected = registrationToken(registrationId); const actual = Buffer.from(token, 'hex'); const expectedBuffer = Buffer.from(expected, 'hex'); return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer); }
export async function registrationQrDataUrl(registrationId: string) { const token = registrationToken(registrationId); return { token, dataUrl: await QRCode.toDataURL(JSON.stringify({ registration_id: registrationId, token })) }; }
