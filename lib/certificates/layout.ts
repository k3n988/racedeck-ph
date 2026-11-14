export type ParticipantNamePosition = { x: number; y: number };
export type CertificateLayoutSettings = {
  participant_name_position?: ParticipantNamePosition;
  background_reference?: string | null;
};

const LAYOUT_KEY = 'racedeck_certificate_layout';
const defaultPosition: ParticipantNamePosition = { x: 50, y: 54 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readCertificateLayout(config: unknown): Required<CertificateLayoutSettings> {
  const entry = Array.isArray(config) ? config.find((item) => isRecord(item) && item.key === LAYOUT_KEY) : null;
  const value = isRecord(entry) ? entry : {};
  const position = isRecord(value.participant_name_position) ? value.participant_name_position : {};
  const x = typeof position.x === 'number' && Number.isFinite(position.x) ? Math.min(90, Math.max(10, position.x)) : defaultPosition.x;
  const y = typeof position.y === 'number' && Number.isFinite(position.y) ? Math.min(85, Math.max(20, position.y)) : defaultPosition.y;
  return {
    participant_name_position: { x, y },
    background_reference: typeof value.background_reference === 'string' && value.background_reference.trim() ? value.background_reference : null,
  };
}

export function writeCertificateLayout(config: unknown, layout: CertificateLayoutSettings): unknown[] {
  const entries = Array.isArray(config) ? config.filter((item) => !(isRecord(item) && item.key === LAYOUT_KEY)) : [];
  return [...entries, {
    key: LAYOUT_KEY,
    participant_name_position: layout.participant_name_position ?? defaultPosition,
    background_reference: layout.background_reference ?? null,
  }];
}
