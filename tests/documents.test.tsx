import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { ReceiptTemplate } from '../lib/invoices/receipt-template';

describe('payment document templates', () => {
  it('renders a branded receipt PDF', async () => {
    const data = { reference: 'RCT-TEST-1', registration: 'REG-1', participant: 'Test Runner', organizer: 'RaceDeck Org', event: 'Test Race', category: '5K', registration_amount: '500.00', processing_fee: '10.00', platform_fee: '5.00', discount: '0.00', total: 'PHP 515.00', method: 'PayMongo', transaction: 'txn_test', date: '2026-09-09', status: 'succeeded', subtotal: '515.00', tax: '0.00' };
    const buffer = await renderToBuffer(<ReceiptTemplate data={data} />);
    expect(Buffer.from(buffer).subarray(0, 7).toString()).toBe('%PDF-1.');
    expect(buffer.length).toBeGreaterThan(500);
  });
});
