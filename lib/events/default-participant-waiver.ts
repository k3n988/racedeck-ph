export const EVENT_NAME_TOKEN = '{{EVENT_NAME}}';

export const DEFAULT_PARTICIPANT_WAIVER_TITLE = 'Participant Waiver and Release Agreement';

export const DEFAULT_PARTICIPANT_WAIVER_CONTENT = `By registering for and participating in the ${EVENT_NAME_TOKEN}, I acknowledge that my participation is entirely voluntary. I understand that this event involves physical activities and potential risks. By accepting this agreement, I confirm that I have read, understood, and agreed to the following terms and conditions:

1. I acknowledge that participating in this running event involves inherent risks, including but not limited to physical injuries, slips, falls, collisions with other participants, unpredictable weather conditions, traffic hazards, and uneven road surfaces.

2. I voluntarily accept and assume all risks associated with participating in this event. To the extent permitted by law, I release the event organizers, sponsors, partners, volunteers, and associated personnel from liability for injuries, damages, or losses resulting from ordinary risks of participation.

3. I declare that I am physically and medically capable of participating in this event. I confirm that I have adequately prepared and have not received medical advice restricting me from engaging in running or similar physical activities.

4. In the event of an accident, injury, or medical emergency, I authorize the event organizers and designated medical personnel to arrange appropriate first aid, emergency assistance, or necessary medical treatment.

5. I authorize the event organizers, sponsors, and authorized partners to capture and use photographs, videos, and other recordings featuring me during the event for documentation, publicity, marketing, and promotional purposes, subject to applicable privacy laws.

6. I acknowledge that this agreement applies throughout my participation in the event, including related activities conducted before, during, and immediately after the race.

7. I understand that this waiver covers claims arising from ordinary negligence, acts, or omissions of the released parties only to the extent permitted by applicable law, without affecting rights that cannot legally be waived.

8. I understand that the organizers may postpone, reschedule, modify, or cancel the event due to severe weather, natural disasters, public safety concerns, or circumstances beyond their reasonable control. Registration fees shall be subject to the event's published refund policy and applicable law.

9. I confirm that I have carefully reviewed the event guidelines and agree to follow all safety regulations, race procedures, and instructions issued by authorized event officials.

FOR PARTICIPANTS BELOW 18 YEARS OLD

A parent or legal guardian must review and accept the following conditions on behalf of any participating minor:

10. As the parent or legal guardian, I confirm that my child is physically capable of participating in the running event and has no known medical restrictions that would make participation unsafe.

11. I acknowledge the potential risks associated with my child's participation and authorize event personnel to provide or arrange necessary medical assistance in the event of an accident, injury, illness, or emergency.

12. I grant permission for photographs, videos, and recordings of my child taken during the event to be used for legitimate event documentation and promotional activities, in accordance with applicable privacy and child protection laws.

13. I accept responsibility for ensuring that my child understands and follows the event's safety rules, registration requirements, and instructions provided by organizers and authorized personnel.

14. I acknowledge the risks involved in my child's participation and agree to the release provisions of this agreement only to the extent permitted by law, without waiving any rights or protections that legally belong to my child.

15. I understand that the event may be postponed, modified, rescheduled, or canceled due to unfavorable weather, emergencies, or unforeseen circumstances. Any refunds or transfers shall follow the organizers' published policies and applicable regulations.

16. I certify that I have read and understood this waiver on behalf of my child and agree to ensure compliance with all event regulations, safety procedures, and directions given by race officials.

ACKNOWLEDGMENT AND AGREEMENT

By proceeding with registration, I confirm that I have carefully read, understood, and voluntarily accepted the terms of this Participant Waiver and Release Agreement, including the Assumption of Risk, Medical Authorization, Photography and Video Consent, Liability Release, and Event Cancellation and Rescheduling Policy. I acknowledge my responsibility to follow all event rules and safety guidelines throughout my participation.`;

export function eventWaiverContentForTitle(content: string, eventName: string) {
  return content.replaceAll(EVENT_NAME_TOKEN, eventName.trim() || 'this event');
}
