import React, { useState, useEffect } from 'react';
import { Friend } from '../types';
import { Users, UserPlus, Play, Share2, Trash2, UserCheck } from 'lucide-react';

interface FriendsViewProps {
  onJoinRoom: (roomCode: string) => void;
  onInviteFriend: (friendName: string) => void;
}

const STORAGE_KEY = 'parsage_friends_list';

export const FriendsView: React.FC<FriendsViewProps> = ({ onJoinRoom, onInviteFriend }) => {
  const [friends, setFriends] = useState<Friend[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const [friendTagInput, setFriendTagInput] = useState('');
  const [invited, setInvited] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(friends));
    } catch (e) {}
  }, [friends]);

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendTagInput.trim()) return;
    const parts = friendTagInput.trim().split('#');
    const name = parts[0] || 'Friend';
    const tag = parts[1] || Math.floor(1000 + Math.random() * 9000).toString();

    const newFriend: Friend = {
      id: `f-${Date.now()}`,
      name,
      tag,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${name}&backgroundColor=1b1a17`,
      status: 'offline'
    };

    setFriends(prev => [newFriend, ...prev]);
    setFriendTagInput('');
  };

  const handleRemoveFriend = (id: string) => {
    setFriends(prev => prev.filter(f => f.id !== id));
  };

  const handleInvite = (friend: Friend) => {
    onInviteFriend(friend.name);
    setInvited(prev => ({ ...prev, [friend.id]: true }));
    setTimeout(() => {
      setInvited(prev => ({ ...prev, [friend.id]: false }));
    }, 2000);
  };

  const getStatusColor = (status: Friend['status']) => {
    if (status === 'hosting') return 'var(--reggae-gold)';
    if (status === 'in-game') return 'var(--zion-teal-bright)';
    if (status === 'online') return 'var(--reggae-green-bright)';
    return 'var(--fg-muted)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Add Friend Header Bar */}
      <div className="card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={26} color="var(--reggae-green-bright)" />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Friends & Party</h2>
          </div>
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.88rem', marginTop: '2px' }}>
            Add your buddies by Username#Tag to invite them to couch co-op sessions.
          </p>
        </div>

        <form onSubmit={handleAddFriend} style={{ display: 'flex', gap: '8px', minWidth: '320px' }}>
          <input
            type="text"
            value={friendTagInput}
            onChange={(e) => setFriendTagInput(e.target.value)}
            placeholder="Add Friend (e.g. Bro#0420)"
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
            <UserPlus size={16} />
            <span>Add Friend</span>
          </button>
        </form>
      </div>

      {/* Friends List */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--fg-bright)', marginBottom: '16px' }}>
          ALL FRIENDS ({friends.length})
        </h3>

        {friends.length === 0 ? (
          <div style={{
            background: 'var(--bg-input)',
            borderRadius: '10px',
            padding: '48px 24px',
            textAlign: 'center',
            border: '1px dashed var(--border-muted)'
          }}>
            <Users size={48} color="var(--border-muted)" style={{ margin: '0 auto 16px auto' }} />
            <h4 style={{ fontSize: '1.15rem', color: 'var(--fg-bright)', marginBottom: '6px' }}>No Friends Added Yet</h4>
            <p style={{ color: 'var(--fg-muted)', fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto' }}>
              Type your friend's name and tag above (e.g. <code>Bro#0420</code>) and hit <strong>Add Friend</strong> to invite them to game sessions!
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
                      alt={friend.name}
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
                    }} />
                  </div>

                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--fg-bright)' }}>
                      {friend.name} <span style={{ color: 'var(--fg-muted)', fontSize: '0.8rem', fontWeight: 'normal' }}>#{friend.tag}</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: getStatusColor(friend.status), fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {friend.status === 'hosting' ? `⚡ Hosting ${friend.currentGame || 'Game'}` :
                       friend.status === 'in-game' ? `🎮 Playing ${friend.currentGame || 'Game'}` :
                       friend.status === 'online' ? '● Online' : '○ Offline'}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {friend.roomCode && (
                    <button
                      className="btn btn-primary"
                      onClick={() => onJoinRoom(friend.roomCode!)}
                      style={{ padding: '7px 14px', fontSize: '0.82rem' }}
                    >
                      <Play size={14} />
                      <span>Join Game</span>
                    </button>
                  )}

                  <button
                    className="btn btn-secondary"
                    onClick={() => handleInvite(friend)}
                    style={{ padding: '7px 14px', fontSize: '0.82rem' }}
                  >
                    {invited[friend.id] ? <UserCheck size={14} color="var(--reggae-green-bright)" /> : <Share2 size={14} />}
                    <span>{invited[friend.id] ? 'Invite Sent!' : 'Invite to Play'}</span>
                  </button>

                  <button
                    onClick={() => handleRemoveFriend(friend.id)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer', padding: '6px' }}
                    title="Remove Friend"
                  >
                    <Trash2 size={16} />
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
