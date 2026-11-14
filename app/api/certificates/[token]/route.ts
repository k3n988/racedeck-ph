import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { CertificateTemplate } from '@/lib/certificates/certificate-template';
import { createAdminClient } from '@/lib/supabase/admin';

type CertificateSnapshot = {
  participant: string; event: string; category: string; date: string; bib: string; finishTime: string; rank: string;
  reference: string; verification: string; organizer: string; signature: string; signaturePosition?: string;
  title?: string; message?: string; eventLogo?: string | null; organizerLogo?: string | null;
  signatureImage?: string | null; backgroundReference?: string | null; participantNamePosition?: { x: number; y: number };
};

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  if (!/^[a-f0-9]{64}$/i.test(params.token)) return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
  const admin = createAdminClient();
  const { data: certificate, error } = await admin.from('certificates')
    .select('certificate_reference,verification_token,template_snapshot,status,revoked_at')
    .eq('verification_token', params.token).maybeSingle();
  if (error) {
    console.error('Certificate download lookup failed', error);
    return NextResponse.json({ error: 'Certificate could not be loaded' }, { status: 500 });
  }
  if (!certificate || certificate.status !== 'issued' || certificate.revoked_at) {
    return NextResponse.json({ error: 'Certificate not found or no longer available' }, { status: 404 });
  }

  try {
    const snapshot = certificate.template_snapshot as unknown as CertificateSnapshot;
    const pdf = await renderToBuffer(React.createElement(CertificateTemplate, { data: snapshot }) as React.ReactElement);
    const safeName = certificate.certificate_reference.replace(/[^a-z0-9_-]/gi, '-');
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
        'Cache-Control': 'private, no-store, max-age=0',
      },
    });
  } catch (renderError) {
    console.error('Certificate PDF rendering failed', renderError);
    return NextResponse.json({ error: 'Certificate PDF could not be generated' }, { status: 500 });
  }
}
