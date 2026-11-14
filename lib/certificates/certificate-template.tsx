import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { pdfBranding } from '@/lib/pdf/branding';

// React PDF images do not render in the browser accessibility tree.
/* eslint-disable jsx-a11y/alt-text */

type CertificateData = {
  participant: string;
  event: string;
  category: string;
  date: string;
  bib: string;
  finishTime: string;
  rank: string;
  reference: string;
  verification: string;
  organizer: string;
  signature: string;
  signaturePosition?: string;
  title?: string;
  message?: string;
  eventLogo?: string | null;
  organizerLogo?: string | null;
  signatureImage?: string | null;
  backgroundReference?: string | null;
  participantNamePosition?: { x: number; y: number };
};

const styles = StyleSheet.create({
  page: { padding: 56, justifyContent: 'center', alignItems: 'center', color: '#111827', border: 12, borderColor: pdfBranding.accent, position: 'relative' },
  background: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' },
  logos: { position: 'absolute', top: 34, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { width: 84, height: 60, objectFit: 'contain' },
  title: { fontSize: 26, color: pdfBranding.primary, marginBottom: 20, textAlign: 'center' },
  presentation: { fontSize: 12, textAlign: 'center' },
  name: { position: 'absolute', width: '60%', fontSize: 24, textAlign: 'center', color: pdfBranding.primary },
  detail: { fontSize: 12, marginBottom: 8, textAlign: 'center' },
  message: { position: 'absolute', left: '15%', width: '70%', top: '72%', fontSize: 11, textAlign: 'center', color: '#374151' },
  signatureImage: { position: 'absolute', width: 120, height: 48, objectFit: 'contain', right: 72, bottom: 70 },
  signatory: { position: 'absolute', right: 64, bottom: 42, width: 140, borderTop: 1, borderColor: '#6b7280', paddingTop: 5, textAlign: 'center', fontSize: 10 },
  footer: { position: 'absolute', bottom: 28, fontSize: 8, color: '#6b7280' },
});

export function CertificateTemplate({ data }: { data: CertificateData }) {
  const position = data.participantNamePosition ?? { x: 50, y: 54 };
  const left = Math.min(70, Math.max(0, position.x - 30));
  const top = Math.min(85, Math.max(20, position.y));
  const hasRaceResult = Boolean(data.bib || data.finishTime || data.rank);
  return <Document><Page size="A4" orientation="landscape" style={styles.page}>
    {data.backgroundReference && <Image src={data.backgroundReference} style={styles.background} />}
    {(data.eventLogo || data.organizerLogo) && <View style={styles.logos}>
      {data.eventLogo ? <Image src={data.eventLogo} style={styles.logo} /> : <View style={styles.logo} />}
      {data.organizerLogo ? <Image src={data.organizerLogo} style={styles.logo} /> : <View style={styles.logo} />}
    </View>}
    <Text style={styles.title}>{data.title || `${pdfBranding.name} Certificate of Achievement`}</Text>
    <Text style={styles.presentation}>This certificate is proudly presented to</Text>
    <Text style={{ ...styles.name, left: `${left}%`, top: `${top}%` }}>{data.participant}</Text>
    <Text style={styles.detail}>{data.event} · {data.category} · {data.date}</Text>
    {hasRaceResult && <Text style={styles.detail}>Bib {data.bib || '—'} · Finish {data.finishTime || '—'} · Rank {data.rank || '—'}</Text>}
    {data.reference && <Text style={styles.detail}>Certificate reference: {data.reference}</Text>}
    {data.verification && <Text style={styles.detail}>Verification code: {data.verification}</Text>}
    {data.message && <Text style={styles.message}>{data.message}</Text>}
    {data.signatureImage && <Image src={data.signatureImage} style={styles.signatureImage} />}
    {(data.signature || data.signaturePosition) && <Text style={styles.signatory}>{data.signature}{data.signaturePosition ? `\n${data.signaturePosition}` : ''}</Text>}
    <Text style={styles.footer}>{data.organizer ? `${data.organizer} · ` : ''}{pdfBranding.footer}</Text>
  </Page></Document>;
}
