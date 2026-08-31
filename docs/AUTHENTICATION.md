# Google authentication

Parsage uses Google Identity Services only to obtain a signed ID token. The server verifies its signature, issuer, audience, expiry, subject, and verified-email claim with Google's official Node.js authentication library. A successful verification creates a random Parsage session in an `HttpOnly`, `SameSite=Strict` cookie; Google tokens are not stored.

The Electron application opens Google login in the system browser because Google Identity Services does not support embedded webviews. A five-minute, single-use pairing transfers the verified Parsage identity back to Electron without exposing its session cookie to the browser page.

## Google Cloud setup

1. Create an OAuth 2.0 Client ID with application type **Web application**.
2. Add these Authorized JavaScript origins for local use:
   - `http://127.0.0.1:7777`
   - `http://localhost:7777`
3. Add the HTTPS origin used by any deployed Parsage server.
4. Put the client ID—not a client secret—in `~/.config/parsage/env`:

```text
GOOGLE_CLIENT_ID=123456789-example.apps.googleusercontent.com
REQUIRE_AUTH=true
COOKIE_SECURE=false
```

Restart Parsage after changing the file. Use `COOKIE_SECURE=true` behind HTTPS in production.

## Security behavior

- Missing configuration disables the Google button instead of creating a fake identity.
- Invalid or unverified Google credentials return HTTP 401 and create no session.
- When `REQUIRE_AUTH=true`, anonymous WebSocket clients cannot host or join rooms.
- Browser WebSocket connections must come from the same origin as the signaling server; native clients without an `Origin` header remain supported.
- Google identities determine the signaling display name; clients cannot impersonate another name.
- Reconnect credentials can only be claimed by the same verified Google subject that owned the interrupted session.
- Logout invalidates the server session and expires its cookie.
