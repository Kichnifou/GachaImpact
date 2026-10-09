/** channel.chat.message chatter types, per Twitch EventSub reference.
 * Unknown/system messages and a declared bot never provision or earn activity. */
export function isEligibleNativeChat(event: { message_type?: string; badges?: readonly { set_id: string }[] }) {
  return ['text', 'channel_points_highlighted', 'channel_points_sub_only', 'user_intro', 'power_ups_message_effect', 'power_ups_gigantified_emote'].includes(event.message_type ?? 'text')
    && !event.badges?.some(badge => badge.set_id === 'bot');
}
