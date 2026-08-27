import React, { useState } from 'react';
import { useGamepad } from '../hooks/useGamepad';
import { Gamepad2, Vibrate, CheckCircle2, Sliders, RefreshCw, Activity } from 'lucide-react';

export const GamepadTester: React.FC = () => {
  const {
    gamepads,
    activeGamepadIndex,
    setActiveGamepadIndex,
    deadzone,
    setDeadzone,
    testVibration
  } = useGamepad();

  const [vibrating, setVibrating] = useState(false);

  const activePad = gamepads.find(g => g.index === activeGamepadIndex) || gamepads[0];

  const handleVibrate = () => {
    setVibrating(true);
    testVibration(activeGamepadIndex ?? 0, 400);
    setTimeout(() => setVibrating(false), 450);
  };

  const isBtnPressed = (idx: number) => {
    return activePad ? Boolean(activePad.buttons[idx]) : false;
  };

  const getBtnValue = (idx: number) => {
    return activePad ? activePad.buttonValues[idx] || (activePad.buttons[idx] ? 1 : 0) : 0;
  };

  const getAxis = (idx: number) => {
    return activePad ? (activePad.axes[idx] ?? 0) : 0;
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div className="card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Gamepad2 size={28} color="var(--reggae-green-bright)" />
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Gamepad Lab & Calibration</h2>
          </div>
          <p style={{ color: 'var(--fg-muted)', marginTop: '4px', fontSize: '0.9rem' }}>
            Test buttons, analog stick deadzones, trigger pressure, and dual-motor haptics for low-latency co-op.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            className={`btn ${vibrating ? 'btn-danger' : 'btn-secondary'}`}
            onClick={handleVibrate}
            disabled={!activePad}
            title="Trigger dual rumble motors"
          >
            <Vibrate size={18} color={vibrating ? '#FFF' : 'var(--reggae-gold)'} />
            <span>{vibrating ? 'Rumbling...' : 'Test Rumble'}</span>
          </button>
        </div>
      </div>

      {/* Gamepad Selection & Status Bar */}
      <div className="card" style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', fontWeight: 600 }}>DETECTED CONTROLLERS:</span>
          {gamepads.length === 0 ? (
            <span style={{ color: 'var(--reggae-red-bright)', fontSize: '0.85rem' }}>
              No controller detected. Plug in an Xbox, DualSense, or Switch controller and press any button!
            </span>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              {gamepads.map((pad) => (
                <button
                  key={pad.index}
                  onClick={() => setActiveGamepadIndex(pad.index)}
                  className={`btn ${activeGamepadIndex === pad.index ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                >
                  <CheckCircle2 size={14} />
                  <span>{pad.id.length > 25 ? pad.id.substring(0, 25) + '...' : pad.id} (Slot {pad.index + 1})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Deadzone Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Sliders size={16} color="var(--reggae-gold)" />
          <span style={{ fontSize: '0.85rem', color: 'var(--fg-muted)' }}>Deadzone: {(deadzone * 100).toFixed(0)}%</span>
          <input
            type="range"
            min="0"
            max="0.30"
            step="0.01"
            value={deadzone}
            onChange={(e) => setDeadzone(parseFloat(e.target.value))}
            style={{ width: '100px', accentColor: 'var(--reggae-gold)' }}
          />
        </div>
      </div>

      {/* Interactive Visual Controller Dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1.2fr) minmax(300px, 0.8fr)', gap: '24px' }}>
        {/* SVG Gamepad Diagram */}
        <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <svg viewBox="0 0 600 400" style={{ width: '100%', maxWidth: '520px', filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.6))' }}>
            {/* Controller Body */}
            <path
              d="M 120 100 C 200 80, 400 80, 480 100 C 540 120, 580 240, 520 340 C 490 390, 440 370, 410 300 C 370 240, 230 240, 190 300 C 160 370, 110 390, 80 340 C 20 240, 60 120, 120 100 Z"
              fill="#22201B"
              stroke={activePad ? "var(--reggae-gold)" : "var(--border-muted)"}
              strokeWidth="4"
            />

            {/* Bumpers & Triggers (Top) */}
            {/* LB */}
            <rect
              x="130" y="70" width="80" height="24" rx="8"
              fill={isBtnPressed(4) ? "var(--reggae-green-bright)" : "#343028"}
              stroke="var(--border-muted)" strokeWidth="2"
            />
            <text x="170" y="86" fill="#FFF" fontSize="12" fontWeight="bold" textAnchor="middle">LB</text>

            {/* RB */}
            <rect
              x="390" y="70" width="80" height="24" rx="8"
              fill={isBtnPressed(5) ? "var(--reggae-green-bright)" : "#343028"}
              stroke="var(--border-muted)" strokeWidth="2"
            />
            <text x="430" y="86" fill="#FFF" fontSize="12" fontWeight="bold" textAnchor="middle">RB</text>

            {/* LT Pressure Gauge */}
            <rect
              x="130" y="40" width="80" height="20" rx="4"
              fill="#1B1A17" stroke="var(--border-muted)" strokeWidth="1"
            />
            <rect
              x="130" y="40" width={Math.max(0, Math.min(80, 80 * getBtnValue(6)))} height="20" rx="4"
              fill="var(--reggae-gold)"
            />
            <text x="170" y="55" fill="#FFF" fontSize="11" fontWeight="bold" textAnchor="middle">
              LT {(getBtnValue(6) * 100).toFixed(0)}%
            </text>

            {/* RT Pressure Gauge */}
            <rect
              x="390" y="40" width="80" height="20" rx="4"
              fill="#1B1A17" stroke="var(--border-muted)" strokeWidth="1"
            />
            <rect
              x="390" y="40" width={Math.max(0, Math.min(80, 80 * getBtnValue(7)))} height="20" rx="4"
              fill="var(--reggae-gold)"
            />
            <text x="430" y="55" fill="#FFF" fontSize="11" fontWeight="bold" textAnchor="middle">
              RT {(getBtnValue(7) * 100).toFixed(0)}%
            </text>

            {/* Left Analog Stick */}
            <circle cx="190" cy="180" r="45" fill="#151412" stroke="var(--border-muted)" strokeWidth="2" />
            <circle
              cx={190 + getAxis(0) * 28}
              cy={180 + getAxis(1) * 28}
              r="24"
              fill={isBtnPressed(10) ? "var(--reggae-red-bright)" : "#3D3930"}
              stroke={isBtnPressed(10) ? "#FFF" : "var(--reggae-gold)"}
              strokeWidth="2"
            />
            <text x="190" y="240" fill="var(--fg-muted)" fontSize="11" textAnchor="middle">L3 / Stick</text>

            {/* Right Analog Stick */}
            <circle cx="360" cy="240" r="45" fill="#151412" stroke="var(--border-muted)" strokeWidth="2" />
            <circle
              cx={360 + getAxis(2) * 28}
              cy={240 + getAxis(3) * 28}
              r="24"
              fill={isBtnPressed(11) ? "var(--reggae-red-bright)" : "#3D3930"}
              stroke={isBtnPressed(11) ? "#FFF" : "var(--reggae-gold)"}
              strokeWidth="2"
            />
            <text x="360" y="300" fill="var(--fg-muted)" fontSize="11" textAnchor="middle">R3 / Stick</text>

            {/* D-Pad */}
            <g transform="translate(190, 270)">
              {/* Up */}
              <rect x="-10" y="-30" width="20" height="22" rx="3" fill={isBtnPressed(12) ? "var(--reggae-green-bright)" : "#343028"} />
              {/* Down */}
              <rect x="-10" y="8" width="20" height="22" rx="3" fill={isBtnPressed(13) ? "var(--reggae-green-bright)" : "#343028"} />
              {/* Left */}
              <rect x="-30" y="-10" width="22" height="20" rx="3" fill={isBtnPressed(14) ? "var(--reggae-green-bright)" : "#343028"} />
              {/* Right */}
              <rect x="8" y="-10" width="22" height="20" rx="3" fill={isBtnPressed(15) ? "var(--reggae-green-bright)" : "#343028"} />
              {/* Center */}
              <rect x="-10" y="-10" width="20" height="20" fill="#343028" />
            </g>

            {/* Action Buttons (A, B, X, Y) */}
            <g transform="translate(440, 180)">
              {/* Y (North) */}
              <circle cx="0" cy="-30" r="14" fill={isBtnPressed(3) ? "var(--reggae-gold-bright)" : "#343028"} stroke="var(--reggae-gold)" strokeWidth="1.5" />
              <text x="0" y="-25" fill="#FFF" fontSize="13" fontWeight="bold" textAnchor="middle">Y</text>

              {/* B (East) */}
              <circle cx="30" cy="0" r="14" fill={isBtnPressed(1) ? "var(--reggae-red-bright)" : "#343028"} stroke="var(--reggae-red)" strokeWidth="1.5" />
              <text x="0.5" y="5" dx="30" fill="#FFF" fontSize="13" fontWeight="bold" textAnchor="middle">B</text>

              {/* A (South) */}
              <circle cx="0" cy="30" r="14" fill={isBtnPressed(0) ? "var(--reggae-green-bright)" : "#343028"} stroke="var(--reggae-green)" strokeWidth="1.5" />
              <text x="0" y="35" fill="#FFF" fontSize="13" fontWeight="bold" textAnchor="middle">A</text>

              {/* X (West) */}
              <circle cx="-30" cy="0" r="14" fill={isBtnPressed(2) ? "var(--zion-teal-bright)" : "#343028"} stroke="var(--zion-teal)" strokeWidth="1.5" />
              <text x="0" y="5" dx="-30" fill="#FFF" fontSize="13" fontWeight="bold" textAnchor="middle">X</text>
            </g>

            {/* Center Buttons (Select, Start, Guide) */}
            {/* Back / Select */}
            <circle cx="260" cy="160" r="10" fill={isBtnPressed(8) ? "var(--reggae-gold)" : "#343028"} />
            <text x="260" y="180" fill="var(--fg-muted)" fontSize="9" textAnchor="middle">SELECT</text>

            {/* Start / Menu */}
            <circle cx="340" cy="160" r="10" fill={isBtnPressed(9) ? "var(--reggae-gold)" : "#343028"} />
            <text x="340" y="180" fill="var(--fg-muted)" fontSize="9" textAnchor="middle">START</text>

            {/* Guide / Home */}
            <circle cx="300" cy="140" r="16" fill={isBtnPressed(16) ? "var(--reggae-green)" : "#2B2822"} stroke="var(--reggae-gold)" strokeWidth="2" />
            <text x="300" y="145" fill="var(--reggae-gold)" fontSize="12" fontWeight="bold" textAnchor="middle">🌿</text>
          </svg>
        </div>

        {/* Real-time Values & Diagnostics Panel */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--reggae-gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} /> Real-time Axis & Button State
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
            <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ color: 'var(--fg-muted)', marginBottom: '4px' }}>Left Stick (LX / LY):</div>
              <div className="font-mono" style={{ color: 'var(--reggae-green-bright)', fontWeight: 'bold' }}>
                X: {getAxis(0).toFixed(3)}<br />
                Y: {getAxis(1).toFixed(3)}
              </div>
            </div>

            <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ color: 'var(--fg-muted)', marginBottom: '4px' }}>Right Stick (RX / RY):</div>
              <div className="font-mono" style={{ color: 'var(--zion-teal-bright)', fontWeight: 'bold' }}>
                X: {getAxis(2).toFixed(3)}<br />
                Y: {getAxis(3).toFixed(3)}
              </div>
            </div>

            <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ color: 'var(--fg-muted)', marginBottom: '4px' }}>Analog Triggers:</div>
              <div className="font-mono" style={{ color: 'var(--reggae-gold)', fontWeight: 'bold' }}>
                LT: {(getBtnValue(6) * 100).toFixed(0)}%<br />
                RT: {(getBtnValue(7) * 100).toFixed(0)}%
              </div>
            </div>

            <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ color: 'var(--fg-muted)', marginBottom: '4px' }}>Polling Frequency:</div>
              <div className="font-mono" style={{ color: 'var(--reggae-green-bright)', fontWeight: 'bold' }}>
                120 Hz / 240 Hz<br />
                <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Sub-1ms Dispatch</span>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-muted)', paddingTop: '14px' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '8px' }}>Active Bitmask Buttons:</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Select', 'Start', 'L3', 'R3', 'Up', 'Down', 'Left', 'Right', 'Guide'].map((name, idx) => (
                <span
                  key={name}
                  style={{
                    fontSize: '0.75rem',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontFamily: 'var(--font-mono)',
                    background: isBtnPressed(idx) ? 'var(--reggae-green)' : 'var(--bg-input)',
                    color: isBtnPressed(idx) ? '#FFF' : 'var(--fg-muted)',
                    border: isBtnPressed(idx) ? '1px solid var(--reggae-green-bright)' : '1px solid var(--border-muted)',
                    transition: 'all 0.05s ease'
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
