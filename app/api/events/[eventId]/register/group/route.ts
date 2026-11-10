import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { PayMongoProvider } from '@/lib/payments/paymongo.provider';
import { reserveRegistrationSlot } from '@/lib/registrations/slot.service';
import { calculatePaymentTotal } from '@/lib/payments/pricing.service';
import { getCategoryPricing } from '@/lib/events/category-pricing';
import { getRaceCategoryRows } from '@/lib/events/race-category-query';
import { categoryRegistrationAvailabilityReason, effectiveCategoryAvailability } from '@/lib/events/registration-availability';
import { isEmergencyContactRelationship } from '@/lib/registrations/emergency-contact';
import { validateRegistrationAnswers } from '@/lib/registration-form/validate-answers';
import { parseVariantOptions } from '@/lib/events/variant-options';
import { hasVariantSlots, loadVariantUsage, variantUsageKey } from '@/lib/events/variant-inventory';

const participantSchema = z.object({
  category_id: z.string().uuid(),
  answers: z.record(z.string(), z.string().max(4000)).default({}),
  race_kit_selections: z.record(z.string(), z.string().max(160)).default({}),
  merchandise: z.array(z.object({ item_id: z.string().uuid(), quantity: z.number().int().min(1).max(5), variant: z.string().max(80).nullable() })).max(20).default([]),
  accept_waiver: z.boolean().default(false),
});
const schema = z.object({
  registrants: z.array(participantSchema).min(1).max(10),
  promo_code: z.string().trim().min(3).max(64).optional(),
  payment_method: z.enum(['qrph', 'paymaya', 'gcash']).default('qrph'),
  idempotency_key: z.string().trim().min(16).max(120),
  accept_platform_terms: z.boolean().default(false),
});
type RpcClient = { rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }> };
const registrationNumber = () => `REG-${new Date().getUTCFullYear()}-${crypto.randomInt(100000, 999999)}`;

export async function POST(request: Request, { params }: { params: { eventId: string } }) {
  const userId = null;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Check the participant details and try again.' }, { status: 400 });
  const { registrants, promo_code: rawPromoCode, payment_method: paymentMethod, idempotency_key: idempotencyKey, accept_platform_terms: acceptPlatformTerms } = parsed.data;
  if (!acceptPlatformTerms) return NextResponse.json({ error: 'You must accept the Platform Disclaimer and Terms and Conditions before continuing.' }, { status: 400 });
  if (registrants.some((registrant) => !registrant.accept_waiver)) return NextResponse.json({ error: 'Each participant must accept the Participant Waiver before continuing.' }, { status: 400 });
  const admin = createAdminClient();
  const db = admin as unknown as SupabaseClient;

  const { data: existing } = await admin.from('payments').select('id,registration_id,gateway,checkout_url,status,amount_due,currency,registrations!inner(user_id,event_id,registration_number)').in('gateway', ['paymongo', 'pending_setup']).eq('idempotency_key', idempotencyKey).maybeSingle();
  if (existing) {
    const owner = Array.isArray(existing.registrations) ? existing.registrations[0] : existing.registrations;
    if ((owner?.user_id ?? null) !== userId || owner.event_id !== params.eventId) return NextResponse.json({ error: 'Registration request is not available' }, { status: 409 });
    return NextResponse.json({ payment_id: existing.id, registration_id: existing.registration_id, registration_numbers: owner?.registration_number ? [owner.registration_number] : [], checkout_url: existing.checkout_url, status: existing.status, payment_setup_pending: existing.gateway === 'pending_setup' });
  }

  const { data: event } = await admin.from('events').select('id,organization_id,name,event_date,lifecycle_status,review_status,registration_availability,registration_opens_at,registration_closes_at').eq('id', params.eventId).maybeSingle();
  const now = Date.now();
  if (!event || event.lifecycle_status !== 'published' || event.review_status !== 'approved') return NextResponse.json({ error: 'This event is not currently available for registration.' }, { status: 409 });
  const categoryIds = Array.from(new Set(registrants.map((row) => row.category_id)));
  const { data: categories, error: categoryError } = await getRaceCategoryRows(admin, event.id, categoryIds);
  if (categoryError) return NextResponse.json({ error: 'Race categories could not be checked' }, { status: 500 });
  if (!categories || categories.length !== categoryIds.length) return NextResponse.json({ error: 'One or more selected race distances are unavailable.' }, { status: 409 });
  const unavailableCategory = categories.find((category) => !['open', 'closing_soon'].includes(effectiveCategoryAvailability(category, event, now)));
  if (unavailableCategory) return NextResponse.json({ error: categoryRegistrationAvailabilityReason(unavailableCategory, event, now) }, { status: 409 });

  const [{ data: waiver, error: waiverError }, { data: fields, error: fieldsError }, { data: kits, error: kitsError }] = await Promise.all([
    admin.from('event_waivers').select('id,version,title').eq('event_id', event.id).eq('organization_id', event.organization_id).eq('status', 'published').maybeSingle(),
    admin.from('event_registration_fields').select('id,label,field_type,is_required,event_registration_field_options(value,label)').eq('event_id', event.id).eq('is_active', true),
    admin.from('race_kit_configs').select('id,category_id,race_kit_items(id,item_name,quantity,details,is_required,is_active)').eq('event_id', event.id).eq('status', 'active'),
  ]);
  if (waiverError || fieldsError || kitsError) return NextResponse.json({ error: 'Event registration requirements could not be checked' }, { status: 500 });

  const kitSlotRequests: Array<{ itemId: string; itemName: string; variant: string; quantity: number; slots: number | null; registrantIndex: number }> = [];

  for (let index = 0; index < registrants.length; index += 1) {
    const registrant = registrants[index];
    const answers = registrant.answers;
    const participant = {
      first_name: answers.first_name?.trim() ?? '', middle_name: answers.middle_name?.trim() ?? '', last_name: answers.last_name?.trim() ?? '',
      gender: answers.gender?.trim() ?? '',
      birthdate: answers.birthdate?.trim() ?? '', email: answers.email?.trim().toLowerCase() ?? '',
      mobile: answers.contact_number?.trim() ?? '', address: answers.address?.trim() ?? '',
      emergency_contact_name: answers.emergency_contact?.trim() ?? '', emergency_contact_number: answers.emergency_contact_phone?.trim() ?? '',
      emergency_contact_relationship: answers.emergency_contact_relationship?.trim() ?? '',
    };
    const required = Object.entries({ 'First name': participant.first_name, 'Last name': participant.last_name, Birthdate: participant.birthdate, Email: participant.email, 'Contact number': participant.mobile, Address: participant.address, 'Emergency contact person': participant.emergency_contact_name, 'Emergency contact phone': participant.emergency_contact_number, 'Emergency contact relationship': participant.emergency_contact_relationship }).find(([, value]) => !value);
    if (required) return NextResponse.json({ error: `Registrant ${index + 1}: ${required[0]} is required` }, { status: 400 });
    if (participant.gender && !['male', 'female', 'prefer_not_to_say'].includes(participant.gender)) return NextResponse.json({ error: `Registrant ${index + 1}: choose a valid gender option` }, { status: 400 });
    if (participant.first_name.length > 100 || participant.middle_name.length > 100 || participant.last_name.length > 100 || participant.mobile.length > 40 || participant.emergency_contact_number.length > 40 || participant.address.length > 500 || participant.emergency_contact_name.length > 120 || participant.emergency_contact_relationship.length > 120) return NextResponse.json({ error: `Registrant ${index + 1}: please check the length of the participant details` }, { status: 400 });
    if (!isEmergencyContactRelationship(participant.emergency_contact_relationship)) return NextResponse.json({ error: `Registrant ${index + 1}: choose a valid emergency contact relationship` }, { status: 400 });
    if (!z.string().email().safeParse(participant.email).success) return NextResponse.json({ error: `Registrant ${index + 1}: enter a valid email address` }, { status: 400 });
    const birthdate = Date.parse(`${participant.birthdate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(participant.birthdate) || !Number.isFinite(birthdate) || new Date(birthdate).toISOString().slice(0, 10) !== participant.birthdate || birthdate >= now) return NextResponse.json({ error: `Registrant ${index + 1}: enter a valid birthdate in the past` }, { status: 400 });
    const answerError = validateRegistrationAnswers(fields ?? [], answers);
    if (answerError) return NextResponse.json({ error: `Registrant ${index + 1}: ${answerError}` }, { status: 400 });
    const categoryKits = (kits ?? []).filter((kit) => kit.category_id === registrant.category_id);
    const sharedKits = (kits ?? []).filter((kit) => kit.category_id === null);
    // Shared inclusions always apply; category-specific inclusions extend them.
    const items = [...sharedKits, ...categoryKits].flatMap((kit) => kit.race_kit_items ?? []).filter((item) => item.is_active);
    const optionMap = new Map<string, { name: string; variants: string[]; required: boolean }>();
    for (const item of items) {
      const details = item.details && typeof item.details === 'object' && !Array.isArray(item.details) ? item.details as Record<string, unknown> : {};
      const options = parseVariantOptions(details.variants);
      const variants = options.map((option) => option.name);
      // Included-kit variants (such as singlet sizes) must be selected for the
      // registrant's chosen category; enforce this server-side as well as in the form.
      if (variants.length) optionMap.set(item.id, { name: item.item_name, variants, required: true });
    }
    if (Object.keys(registrant.race_kit_selections).some((id) => !optionMap.has(id))) return NextResponse.json({ error: `Registrant ${index + 1}: a race kit option is not available for this category` }, { status: 400 });
    for (const id of Array.from(optionMap.keys())) {
      const option = optionMap.get(id)!;
      if ((option.required && !registrant.race_kit_selections[id]) || (registrant.race_kit_selections[id] && !option.variants.includes(registrant.race_kit_selections[id]))) return NextResponse.json({ error: `Registrant ${index + 1}: choose a valid option for ${option.name}` }, { status: 400 });
      const selected = registrant.race_kit_selections[id];
      if (selected) {
        const item = items.find((candidate) => candidate.id === id)!;
        const details = item.details && typeof item.details === 'object' && !Array.isArray(item.details) ? item.details as Record<string, unknown> : {};
        const selectedOption = parseVariantOptions(details.variants).find((variant) => variant.name === selected);
        if (selectedOption) kitSlotRequests.push({ itemId: id, itemName: item.item_name, variant: selected, quantity: item.quantity ?? 1, slots: selectedOption.slots, registrantIndex: index + 1 });
      }
    }
  }

  const variantUsage = await loadVariantUsage(admin, event.id).catch((error) => { console.error('Unable to check size availability', error); return null; });
  if (!variantUsage) return NextResponse.json({ error: 'Size availability could not be checked. Please try again.' }, { status: 500 });
  const requestedKitCounts = new Map<string, number>();
  for (const request of kitSlotRequests) {
    const key = variantUsageKey(request.itemId, request.variant);
    requestedKitCounts.set(key, (requestedKitCounts.get(key) ?? 0) + request.quantity);
  }
  for (const request of kitSlotRequests) {
    const key = variantUsageKey(request.itemId, request.variant);
    if (!hasVariantSlots({ slots: request.slots }, (variantUsage.kit.get(key) ?? 0) * request.quantity, requestedKitCounts.get(key) ?? request.quantity)) return NextResponse.json({ error: `${request.variant} for ${request.itemName} is out of stock. Choose another option${kitSlotRequests.filter((candidate) => candidate.itemId === request.itemId && candidate.variant === request.variant).length > 1 ? ` (Registrant ${request.registrantIndex})` : ''}.` }, { status: 409 });
  }

  const allMerchandise = registrants.flatMap((row) => row.merchandise);
  const merchandiseIds = Array.from(new Set(allMerchandise.map((item) => item.item_id)));
  const { data: catalog, error: catalogError } = merchandiseIds.length ? await db.from('event_merchandise').select('id,name,unit_price,variants').eq('event_id', event.id).eq('is_active', true).in('id', merchandiseIds) : { data: [], error: null };
  if (catalogError || (catalog ?? []).length !== merchandiseIds.length) return NextResponse.json({ error: 'One or more optional merchandise items are no longer available' }, { status: catalogError ? 500 : 409 });
  const requestedMerchandiseCounts = new Map<string, number>();
  const merchandiseByRegistrant = registrants.map((registrant) => {
    const lines = registrant.merchandise.map((selection) => {
      const product = catalog?.find((item) => item.id === selection.item_id);
      if (!product) return null;
      const variants = parseVariantOptions(product.variants);
      const chosenVariant = variants.find((option) => option.name === selection.variant);
      if ((variants.length && !chosenVariant) || (!variants.length && selection.variant)) return null;
      if (chosenVariant) {
        const usageKey = variantUsageKey(product.id, chosenVariant.name);
        const totalRequested = (requestedMerchandiseCounts.get(usageKey) ?? 0) + selection.quantity;
        if (!hasVariantSlots(chosenVariant, variantUsage.merchandise.get(usageKey) ?? 0, totalRequested)) return null;
        requestedMerchandiseCounts.set(usageKey, totalRequested);
      }
      const unit = Number(product.unit_price);
      return { event_merchandise_id: product.id, item_name: product.name, variant: selection.variant, quantity: selection.quantity, unit_price: unit, line_total: Math.round(unit * selection.quantity * 100) / 100 };
    });
    return lines.some((line) => !line) ? null : lines as Array<NonNullable<(typeof lines)[number]>>;
  });
  if (merchandiseByRegistrant.some((lines) => lines === null)) return NextResponse.json({ error: 'Choose a valid option for each optional merchandise item' }, { status: 400 });

  const categoryById = new Map((categories ?? []).map((category) => [category.id, category]));
  const priceByCategoryId = new Map((categories ?? []).map((category) => [category.id, getCategoryPricing(category).amount]));
  const categoryTotal = registrants.reduce((sum, row) => sum + Number(priceByCategoryId.get(row.category_id) ?? 0), 0);
  const merchandiseTotal = (merchandiseByRegistrant as Array<NonNullable<(typeof merchandiseByRegistrant)[number]>>).flat().reduce((sum, line) => sum + line.line_total, 0);
  const subtotal = Math.round((categoryTotal + merchandiseTotal) * 100) / 100;
  const groupId = crypto.randomUUID();
  const holds: string[] = [];
  const registrations: Array<{ id: string; registration_number: string; category_id: string; first_name: string; last_name: string; email: string }> = [];
  let paymentId: string | null = null;
  let promoAnchorId: string | null = null;
  let promoApplied = false;
  const rollback = async () => {
    if (paymentId) await admin.from('payments').update({ status: 'cancelled', failure_message: 'Grouped registration could not be completed' }).eq('id', paymentId).in('status', ['pending', 'processing']);
    if (paymentId && promoApplied && promoAnchorId) await (admin as unknown as RpcClient).rpc('reverse_promo_redemption', { p_payment_id: paymentId, p_registration_id: promoAnchorId });
    if (registrations.length) await admin.from('registrations').update({ status: 'cancelled' }).in('id', registrations.map((row) => row.id));
    if (holds.length) await admin.from('registration_holds').update({ status: 'released' }).in('id', holds);
  };
  for (let index = 0; index < registrants.length; index += 1) {
    const registrant = registrants[index];
    const holdExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { data: hold, error: holdError } = await reserveRegistrationSlot(admin, event.id, registrant.category_id, null, holdExpiry, `${groupId}:${index}`);
    if (holdError || !hold) { await rollback(); return NextResponse.json({ error: `Registrant ${index + 1}: the selected category is full or could not be reserved` }, { status: 409 }); }
    holds.push(hold);
    const answers = registrant.answers;
    const { data: row, error } = await admin.from('registrations').insert({
      registration_number: registrationNumber(), event_id: event.id, category_id: registrant.category_id,
      checkout_group_id: groupId, user_id: userId, hold_id: hold, status: 'pending_payment',
      first_name: answers.first_name.trim(), middle_name: answers.middle_name?.trim() || null, last_name: answers.last_name.trim(), gender: answers.gender?.trim() || null, birthdate: answers.birthdate,
      email: answers.email.trim().toLowerCase(), mobile: answers.contact_number.trim(), address: answers.address.trim(),
      emergency_contact_name: answers.emergency_contact.trim(), emergency_contact_number: answers.emergency_contact_phone.trim(), emergency_contact_relationship: answers.emergency_contact_relationship.trim(),
      shirt_size: answers.shirt_size?.trim() || null,
    }).select('id,registration_number,category_id,first_name,last_name,email').single();
    if (error || !row) { await rollback(); return NextResponse.json({ error: `Registrant ${index + 1}: registration could not be saved` }, { status: 500 }); }
    registrations.push(row);
  }

  const promoCode = rawPromoCode?.toUpperCase() ?? null;
  const { data: promo } = promoCode ? await admin.from('promo_codes').select('id,code,event_id,currency,status,applies_to_all_categories').eq('event_id', event.id).eq('code', promoCode).maybeSingle() : { data: null };
  if (promoCode && !promo) { await rollback(); return NextResponse.json({ error: 'Promo code is invalid for this event' }, { status: 400 }); }
  let promoEligible = categoryTotal;
  let promoAnchor = registrations[0];
  if (promo && !promo.applies_to_all_categories) {
    const { data: allowedCategories } = await admin.from('promo_code_categories').select('category_id').eq('promo_code_id', promo.id);
    const eligible = registrations.filter((row) => (allowedCategories ?? []).some((allowed) => allowed.category_id === row.category_id));
    if (!eligible.length) { await rollback(); return NextResponse.json({ error: 'This promo code does not apply to the selected categories' }, { status: 400 }); }
    promoEligible = eligible.reduce((sum, row) => sum + Number(priceByCategoryId.get(row.category_id) ?? 0), 0);
    promoAnchor = eligible[0];
  }

  const promoAnchorIndex = registrations.findIndex((row) => row.id === promoAnchor.id);
  promoAnchorId = promoAnchor.id;
  const { data: payment, error: paymentError } = await admin.from('payments').insert({
    registration_id: promoAnchor.id, event_id: event.id, organization_id: event.organization_id,
    gateway: process.env.PAYMONGO_SECRET_KEY ? 'paymongo' : 'pending_setup', idempotency_key: idempotencyKey, amount_due: subtotal, currency: 'PHP', status: 'pending',
    // The payment itself does not expire while the gateway is unconfigured.
    // Slot holds remain short-lived so unpaid entries cannot reserve capacity indefinitely.
    expires_at: process.env.PAYMONGO_SECRET_KEY ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
    metadata: { checkout_group_id: groupId, registration_ids: registrations.map((row) => row.id), registration_amount: subtotal, category_amount: categoryTotal, merchandise_amount: merchandiseTotal, merchandise_items: (merchandiseByRegistrant as Array<NonNullable<(typeof merchandiseByRegistrant)[number]>>).flat().map((line) => ({ item_name: line.item_name, variant: line.variant, quantity: line.quantity, line_total: line.line_total })), participants: registrations.map((row) => ({ registration_id: row.id, registration_number: row.registration_number, name: `${row.first_name} ${row.last_name}`, category: categoryById.get(row.category_id)?.name, category_amount: Number(priceByCategoryId.get(row.category_id) ?? 0) })), payment_method: paymentMethod, processing_fee: 0, platform_fee: 0, discount_amount: 0, total_amount: subtotal },
  }).select('id').single();
  if (paymentError || !payment) { await rollback(); return NextResponse.json({ error: 'Secure checkout could not be initialized' }, { status: 500 }); }
  paymentId = payment.id;

  if (promo) {
    const { error: promoError } = await (admin as unknown as RpcClient).rpc('redeem_promo_code', { p_promo_code_id: promo.id, p_user_id: userId, p_registration_id: promoAnchor.id, p_event_id: event.id, p_category_id: promoAnchor.category_id, p_payment_id: payment.id, p_eligible_amount: promoEligible, p_currency: 'PHP' });
    if (promoError) { await rollback(); return NextResponse.json({ error: 'This promo code could not be applied. Check the code and its terms, or continue without it.' }, { status: 409 }); }
    promoApplied = true;
    const { data: redemption } = await admin.from('promo_code_redemptions').select('discount_amount').eq('payment_id', payment.id).maybeSingle();
    const discount = Number(redemption?.discount_amount ?? 0);
    const pricing = calculatePaymentTotal({ registrationAmount: subtotal, discountAmount: discount });
    const { error: pricingError } = await admin.from('payments').update({ amount_due: pricing.totalAmount, metadata: { checkout_group_id: groupId, registration_ids: registrations.map((row) => row.id), registration_amount: subtotal, category_amount: categoryTotal, merchandise_amount: merchandiseTotal, merchandise_items: (merchandiseByRegistrant as Array<NonNullable<(typeof merchandiseByRegistrant)[number]>>).flat().map((line) => ({ item_name: line.item_name, variant: line.variant, quantity: line.quantity, line_total: line.line_total })), participants: registrations.map((row) => ({ registration_id: row.id, registration_number: row.registration_number, name: `${row.first_name} ${row.last_name}`, category: categoryById.get(row.category_id)?.name, category_amount: Number(priceByCategoryId.get(row.category_id) ?? 0) })), processing_fee: pricing.processingFee, platform_fee: pricing.platformFee, discount_amount: pricing.discountAmount, total_amount: pricing.totalAmount } }).eq('id', payment.id);
    if (pricingError) { await rollback(); return NextResponse.json({ error: 'Checkout pricing could not be saved' }, { status: 500 }); }
  }

  for (let index = 0; index < registrants.length; index += 1) {
    const registrant = registrants[index];
    const registration = registrations[index];
    const waiverAcceptedAt = new Date().toISOString();
    if (waiver) {
      const { error } = await admin.from('event_waiver_acceptances').insert({ event_waiver_id: waiver.id, organization_id: event.organization_id, event_id: event.id, registration_id: registration.id, participant_id: userId, accepted_at: waiverAcceptedAt, source_context: 'participant_registration' });
      if (error) { await rollback(); return NextResponse.json({ error: `Registrant ${index + 1}: waiver acceptance could not be recorded` }, { status: 500 }); }
    }
    const categoryKits = (kits ?? []).filter((kit) => kit.category_id === registrant.category_id || kit.category_id === null);
    const kitItemNames = new Map(categoryKits.flatMap((kit) => kit.race_kit_items ?? []).map((kitItem) => [kitItem.id, kitItem.item_name]));
    const selectedKits = Object.entries(registrant.race_kit_selections).map(([itemId, variant]) => ({ item_id: itemId, item_name: kitItemNames.get(itemId) ?? null, variant: String(variant) }));
    const { error: activityError } = await admin.from('registration_activity').insert({ registration_id: registration.id, action: 'created', actor: userId, metadata: {
      checkout_group_id: groupId,
      registrant_number: index + 1,
      race_kit_selections: selectedKits,
      participant_waiver_acceptance: { accepted: true, event_id: event.id, registration_id: registration.id, waiver_id: waiver?.id ?? null, waiver_version: waiver?.version ?? 1, accepted_at: waiverAcceptedAt },
      platform_terms_acceptance: { accepted: true, event_id: event.id, registration_id: registration.id, accepted_at: waiverAcceptedAt },
    } });
    const fieldIds = new Set((fields ?? []).map((field) => field.id));
    const answers = Object.entries(registrant.answers).filter(([fieldId]) => fieldIds.has(fieldId)).map(([field_id, value]) => ({ registration_id: registration.id, field_id, value: String(value) }));
    const { error: answerError } = answers.length ? await admin.from('registration_responses').insert(answers) : { error: null };
    const merchLines = (merchandiseByRegistrant as Array<NonNullable<(typeof merchandiseByRegistrant)[number]>>)[index];
    const { error: merchError } = merchLines.length ? await db.from('registration_merchandise').insert(merchLines.map((line) => ({ ...line, registration_id: registration.id, event_id: event.id, organization_id: event.organization_id }))) : { error: null };
    if (activityError || answerError || merchError) { await rollback(); return NextResponse.json({ error: `Registrant ${index + 1}: registration options could not be saved` }, { status: 500 }); }
  }

  if (!process.env.PAYMONGO_SECRET_KEY) {
    await admin.from('registration_activity').insert(registrations.map((row) => ({ registration_id: row.id, action: 'payment_setup_pending', actor: userId, metadata: { checkout_group_id: groupId, payment_id: payment.id, reason: 'PayMongo is not configured' } })));
    return NextResponse.json({ payment_id: payment.id, registration_id: promoAnchor.id, registration_ids: registrations.map((row) => row.id), registration_numbers: registrations.map((row) => row.registration_number), status: 'pending', payment_setup_pending: true }, { status: 201 });
  }

  try {
    const amount = Number((await admin.from('payments').select('amount_due').eq('id', payment.id).single()).data?.amount_due ?? subtotal);
    const returnPath = `/events/${event.id}`;
    const checkout = await new PayMongoProvider().createCheckout({ amount, currency: 'PHP', description: `${event.name} · ${registrations.length} participant${registrations.length === 1 ? '' : 's'}`, reference: registrations[promoAnchorIndex].registration_number, successUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin}${returnPath}`, cancelUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin}${returnPath}`, paymentMethod });
    const { error: saveError } = await admin.from('payments').update({ gateway_payment_id: checkout.gatewayPaymentId, checkout_url: checkout.checkoutUrl }).eq('id', payment.id);
    if (saveError) throw saveError;
    if (holds.length) {
      const { error: holdError } = await admin.from('registration_holds').update({ status: 'converted' }).in('id', holds);
      if (holdError) throw holdError;
    }
    await admin.from('registration_activity').insert(registrations.map((row) => ({ registration_id: row.id, action: 'payment_initiated', actor: userId, metadata: { checkout_group_id: groupId, payment_id: payment.id } })));
    return NextResponse.json({ payment_id: payment.id, registration_id: promoAnchor.id, registration_ids: registrations.map((row) => row.id), registration_numbers: registrations.map((row) => row.registration_number), checkout_url: checkout.checkoutUrl, status: 'pending' }, { status: 201 });
  } catch (error) {
    console.error('Unable to create grouped checkout', error);
    await rollback();
    return NextResponse.json({ error: 'Secure checkout could not be created. Review your details and try again.' }, { status: 502 });
  }
}
