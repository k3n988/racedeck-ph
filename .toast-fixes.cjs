const fs = require('fs');

function edit(file, callback) {
  const source = fs.readFileSync(file, 'utf8');
  const next = callback(source);
  if (next === source) throw new Error(`No change in ${file}`);
  fs.writeFileSync(file, next);
}

edit('app/(organizer)/organizer/events/page.tsx', source => {
  const start = source.indexOf('{(loadError || deleteError) && <p role="alert"');
  const end = source.indexOf('<div className="w-full overflow-x-auto', start);
  if (start < 0 || end < 0) throw new Error('Organizer events error feedback not found');
  return source.slice(0, start) + `{(loadError || deleteError) && <ToastFeedback message={deleteError || loadError} tone="error"><div className="flex items-center gap-3"><span>{deleteError || loadError}</span>{loadError && <button type="button" onClick={() => void load()} className="font-semibold underline underline-offset-2">Retry</button>}</div></ToastFeedback>}` + source.slice(end);
});

for (const file of [
  'app/(organizer)/organizer/payments/page.tsx',
  'app/(organizer)/organizer/payouts/page.tsx',
  'components/organizer/reports-dashboard.tsx',
]) {
  edit(file, source => source
    .replace("window.setTimeout(() => setToast(''), 2800);", "window.setTimeout(() => setToast(''), 5000);")
    .replace(/<div aria-live="polite" aria-atomic="true" className="fixed bottom-5 right-5 z-\[120\]">\{toast && <ToastFeedback message=\{String\(toast\)\} tone="info"><p role="status" className="rounded-lg bg-\[#0b2348\] px-4 py-3 text-sm font-semibold text-white shadow-lg">\{toast\}<\/p><\/ToastFeedback>\}<\/div>/g,
      '{toast && <ToastFeedback message={toast} tone="auto" />}'));
}

for (const file of [
  'app/(public)/results/results-table.tsx',
  'components/organizer/organization-data-page.tsx',
  'app/(admin)/admin/payment-operations/page.tsx',
]) {
  edit(file, source => source.replaceAll('{!message && ', '{'));
}

for (const file of [
  'app/(organizer)/organizer/events/[eventId]/setup/details/page.tsx',
  'app/(organizer)/organizer/events/[eventId]/setup/partners-manager.tsx',
  'app/(admin)/admin/events/[eventId]/review-actions.tsx',
  'app/(admin)/admin/organizers/[organizerId]/organizer-review-actions.tsx',
]) {
  edit(file, source => source.replaceAll('message={String(message)} tone="error"', 'message={String(message)} tone="auto"'));
}

const roots = ['app', 'components'];
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) visit(file);
    else if (file.endsWith('.tsx')) {
      const source = fs.readFileSync(file, 'utf8');
      const next = source.replaceAll('message={String(message)} tone="info"', 'message={String(message)} tone="auto"');
      if (next !== source) fs.writeFileSync(file, next);
    }
  }
}
roots.forEach(visit);
