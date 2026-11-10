import { redirect } from 'next/navigation';

/** Keep /events compatible while using the homepage as the single event listing. */
export default function EventsPage() {
  redirect('/#home-events');
}
