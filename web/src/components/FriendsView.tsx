import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Play, Share2, Trash2, UserCheck } from 'lucide-react';
import { addFriend, listFriends, removeFriend, type FriendRecord } from '../api/account';

interface FriendsViewProps {
  onJoinRoom: (roomCode: string) => void;
  onInviteFriend: (friendName: string) => void;
  onOpenAuth: () => void;
}

export const FriendsView: React.FC<FriendsViewProps> = ({ onJoinRoom, onInviteFriend, onOpenAuth }) => {
  const [friends, setFriends] = useState<FriendRecord[]>([]);
  const [friendTagInput, setFriendTagInput] = useState('');
  const [invited, setInvited] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      setFriends(await listFriends());
      setError(null);
    } catch (loadError: any) {
      setError(loadError.message || 'Unable to load friends.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendTagInput.trim()) return;
    try {
      const friend = await addFriend(friendTagInput.trim());
      setFriends(previous => [friend, ...previous.filter(item => item.id !== friend.id)]);
      setFriendTagInput('');
      setError(null);
    } catch (addError: any) {
      setError(addError.message || 'Unable to add that friend.');
    }
  };

  const handleRemoveFriend = async (id: string) => {
    await removeFriend(id);
    setFriends(prev => prev.filter(f => f.id !== id));
  };

  const handleInvite = (friend: FriendRecord) => {
    onInviteFriend(friend.name);
    setInvited(prev => ({ ...prev, [friend.id]: true }));
    setTimeout(() => {
      setInvited(prev => ({ ...prev, [friend.id]: false }));
    }, 2000);
  };

  const getStatusColor = (status: FriendRecord['status']) => {
    if (status === 'hosting') return 'var(--reggae-gold)';
    if (status === 'in-game') return 'var(--zion-teal-bright)';
    if (status === 'online') return 'var(--reggae-green-bright)';
    return 'var(--fg-muted)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={26} color="var(--reggae-green-bright)" aria-hidden="true" />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Friends & Party</h2>
          </div>
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.88rem', marginTop: '2px' }}>
            Add a verified Parsage identity by Username#Tag. Presence is live on this host, not a local-only list.
          </p>
        </div>

        <form onSubmit={handleAddFriend} style={{ display: 'flex', gap: '8px', minWidth: '320px' }}>
          <label htmlFor="friend-handle" className="sr-only">Friend handle</label>
          <input
            id="friend-handle"
            type="text"
            value={friendTagInput}
            onChange={(e) => setFriendTagInput(e.target.value)}
            placeholder="Add Friend (e.g. Bro#0420)"
            autoComplete="off"
            style={{
              flex: 1,
              background: 'var(--bg-input)',
              border: '1px solid var(--border-muted)',
              color: 'var(--fg-main)',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.9rem'
            }}
          />
          <button type="submit" className="btn btn-primary" disabled={!friendTagInput.trim()}>
            <UserPlus size={16} aria-hidden="true" />
            <span>Add Friend</span>
          </button>
        </form>
      </div>

      {error && (
        <div role="alert" style={{ background: 'rgba(232, 17, 45, 0.15)', border: '1px solid var(--reggae-red)', color: 'var(--reggae-red-bright)', padding: '14px 18px', borderRadius: '8px' }}>
          {error}{' '}
          <button className="btn btn-secondary" onClick={onOpenAuth} style={{ marginLeft: '8px', padding: '6px 10px', fontSize: '0.8rem' }}>
            Open profile
          </button>
        </div>
      )}

      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--fg-bright)', marginBottom: '16px' }}>
          ALL FRIENDS ({friends.length})
        </h3>

        {loading ? (
          <p style={{ color: 'var(--fg-muted)' }}>Loading friends from the durable store…</p>
        ) : friends.length === 0 ? (
          <div style={{
            background: 'var(--bg-input)',
            borderRadius: '10px',
            padding: '48px 24px',
            textAlign: 'center',
            border: '1px dashed var(--border-muted)'
          }}>
            <Users size={48} color="var(--border-muted)" style={{ margin: '0 auto 16px auto' }} aria-hidden="true" />
            <h4 style={{ fontSize: '1.15rem', color: 'var(--fg-bright)', marginBottom: '6px' }}>No Friends Added Yet</h4>
            <p style={{ color: 'var(--fg-muted)', fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto' }}>
              Both of you need a saved Parsage identity on this host. Then add them as <code>Name#Tag</code>.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {friends.map((friend) => (
              <div
                key={friend.id}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-muted)',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ position: 'relative' }}>
                    <img
                      src={friend.avatarUrl}
                      alt=""
                      style={{ width: '42px', height: '42px', borderRadius: '50%', border: '2px solid var(--border-muted)', background: '#151412' }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: getStatusColor(friend.status),
                      border: '2px solid var(--bg-input)'
                    }} aria-hidden="true" />
                  </div>

                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--fg-bright)' }}>
                      {friend.name} <span style={{ color: 'var(--fg-muted)', fontSize: '0.8rem', fontWeight: 'normal' }}>#{friend.tag}</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: getStatusColor(friend.status), fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {friend.status === 'hosting' ? `Hosting ${friend.currentGame || 'a session'}` :
                       friend.status === 'in-game' ? `Playing ${friend.currentGame || 'a session'}` :
                       friend.status === 'online' ? 'Online' : 'Offline'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {friend.roomCode && (
                    <button
                      className="btn btn-primary"
                      onClick={() => onJoinRoom(friend.roomCode!)}
                      style={{ padding: '7px 14px', fontSize: '0.82rem' }}
                    >
                      <Play size={14} aria-hidden="true" />
                      <span>Join Game</span>
                    </button>
                  )}

                  <button
                    className="btn btn-secondary"
                    onClick={() => handleInvite(friend)}
                    style={{ padding: '7px 14px', fontSize: '0.82rem' }}
                  >
                    {invited[friend.id] ? <UserCheck size={14} color="var(--reggae-green-bright)" aria-hidden="true" /> : <Share2 size={14} aria-hidden="true" />}
                    <span>{invited[friend.id] ? 'Invite Sent!' : 'Invite to Play'}</span>
                  </button>

                  <button
                    onClick={() => handleRemoveFriend(friend.id)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer', padding: '6px' }}
                    aria-label={`Remove ${friend.handle}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
