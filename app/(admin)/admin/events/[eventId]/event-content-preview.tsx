'use client';

import { ContentEditor } from '@/components/organizer/content-editor';

export default function EventContentPreview({ content, label }: { content: string; label: string }) {
  return <div className="overflow-hidden text-sm leading-6 text-slate-700">
    <ContentEditor value={content} onChange={() => undefined} editorLabel={label} editable={false} />
  </div>;
}
