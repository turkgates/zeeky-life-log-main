import { supabase } from '@/lib/supabase';

export type FriendRelationship =
  | 'arkadaş'
  | 'aile'
  | 'akraba'
  | 'iş arkadaşı'
  | 'partner'
  | 'diğer';

export interface Friend {
  id: string;
  user_id: string;
  name: string;
  phone?: string;
  email?: string;
  nickname?: string;
  relationship: FriendRelationship;
  notes?: string;
  is_favorite: boolean;
  last_interaction?: string;
  interaction_count: number;
  source: string;
  created_at: string;
}

export const fetchFriends = async (userId: string) => {
  if (!userId) return { data: [], error: null };
  const { data, error } = await supabase
    .from('friends')
    .select('*')
    .eq('user_id', userId)
    .order('interaction_count', { ascending: false });
  return { data, error };
};

export const searchFriends = async (userId: string, query: string) => {
  if (!userId) return [];
  const { data } = await supabase
    .from('friends')
    .select('id, name, nickname, relationship')
    .eq('user_id', userId)
    .ilike('name', `%${query}%`)
    .limit(5);
  return data || [];
};

export const addFriend = async (userId: string, friend: Partial<Friend>) => {
  if (!userId) return { data: null, error: { message: 'Oturum yok' } };
  const { data, error } = await supabase
    .from('friends')
    .insert({
      user_id: userId,
      name: friend.name,
      phone: friend.phone || null,
      email: friend.email || null,
      nickname: friend.nickname || null,
      relationship: friend.relationship || 'arkadaş',
      notes: friend.notes || null,
      is_favorite: friend.is_favorite || false,
      source: friend.source || 'manual',
      interaction_count: 0,
    })
    .select()
    .single();
  return { data, error };
};

export const updateFriend = async (userId: string, id: string, updates: Partial<Friend>) => {
  if (!userId) return { data: null, error: { message: 'Oturum yok' } };
  const { data, error } = await supabase
    .from('friends')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  return { data, error };
};

export const deleteFriend = async (userId: string, id: string) => {
  if (!userId) return { error: { message: 'Oturum yok' } };
  const { error } = await supabase
    .from('friends')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  return { error };
};

export const findOrCreateFriend = async (userId: string, name: string) => {
  if (!userId) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;

  const { data: existing } = await supabase
    .from('friends')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', trimmed)
    .maybeSingle();

  if (existing) {
    const nextCount = (existing.interaction_count ?? 0) + 1;
    await supabase
      .from('friends')
      .update({
        interaction_count: nextCount,
        last_interaction: new Date().toISOString(),
      })
      .eq('id', existing.id);
    return { ...existing, interaction_count: nextCount, last_interaction: new Date().toISOString() };
  }

  const { data: newFriend } = await supabase
    .from('friends')
    .insert({
      user_id: userId,
      name: trimmed,
      relationship: 'arkadaş',
      source: 'chat',
      interaction_count: 1,
      last_interaction: new Date().toISOString(),
    })
    .select()
    .single();

  return newFriend;
};
